'use strict';
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const store = require('../store');
const { parseFile, parseText } = require('../parsers');
const { buildDetail } = require('./public');

const router = express.Router();
const upload = multer({
  dest: path.join(os.tmpdir(), 'test-ustoz-uploads'),
  limits: { fileSize: 20 * 1024 * 1024 },
});

const SECRET = process.env.SESSION_SECRET || 'ozgartiring-bu-kalitni';
const COOKIE = 'tu_admin';

function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(tok) {
  if (!tok || !tok.includes('.')) return null;
  const [body, mac] = tok.split('.');
  const expect = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expect))) return null;
  try {
    const data = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}

function auth(req, res, next) {
  const data = verify(req.cookies[COOKIE]);
  if (!data) return res.status(401).json({ error: 'Avtorizatsiya kerak' });
  req.admin = data;
  next();
}

/* ------------------------------------------------------------------ Login */
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const U = process.env.ADMIN_USER || 'admin';
  const P = process.env.ADMIN_PASSWORD || 'admin123';
  if (String(username) !== U || String(password) !== P) {
    return res.status(401).json({ error: "Login yoki parol noto'g'ri" });
  }
  const tok = sign({ u: U, exp: Date.now() + 12 * 3600 * 1000 });
  res.cookie(COOKIE, tok, {
    httpOnly: true, sameSite: 'lax', maxAge: 12 * 3600 * 1000,
    secure: process.env.NODE_ENV === 'production',
  });
  res.json({ ok: true, user: U });
});

router.post('/logout', (req, res) => { res.clearCookie(COOKIE); res.json({ ok: true }); });
router.get('/me', auth, (req, res) => res.json({ user: req.admin.u }));

/* ------------------------------------------------------------------ Testlar */
router.get('/tests', auth, (req, res) => {
  res.json(store.tests.all().map((t) => ({
    ...t,
    q_count: store.questions.countByTest(t.id),
    a_count: store.attempts.countFinishedByTest(t.id),
  })));
});

router.post('/tests', auth, (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Test nomini kiriting' });
  res.json({ id: store.tests.create(b) });
});

router.put('/tests/:id', auth, (req, res) => {
  if (!store.tests.update(req.params.id, req.body || {})) {
    return res.status(404).json({ error: 'Test topilmadi' });
  }
  res.json({ ok: true });
});

router.delete('/tests/:id', auth, (req, res) => {
  store.tests.remove(req.params.id);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- Savollar */
router.get('/tests/:id/questions', auth, (req, res) => {
  res.json(store.questions.byTest(req.params.id));
});

function validQuestion(q) {
  if (!String(q.text || '').trim()) return "Savol matni bo'sh";
  if (!String(q.opt_a || '').trim() || !String(q.opt_b || '').trim()) return 'Kamida A va B variant kerak';
  if (!['A', 'B', 'C', 'D'].includes(String(q.correct || '').toUpperCase())) return "To'g'ri javob A/B/C/D bo'lsin";
  return null;
}

router.post('/tests/:id/questions', auth, (req, res) => {
  if (!store.tests.get(req.params.id)) return res.status(404).json({ error: 'Test topilmadi' });
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const errors = [];
  let added = 0;
  for (const q of items) {
    const err = validQuestion(q);
    if (err) { errors.push(err); continue; }
    store.questions.create(req.params.id, q);
    added++;
  }
  res.json({ added, errors });
});

router.put('/questions/:id', auth, (req, res) => {
  const err = validQuestion(req.body || {});
  if (err) return res.status(400).json({ error: err });
  if (!store.questions.update(req.params.id, req.body)) {
    return res.status(404).json({ error: 'Savol topilmadi' });
  }
  res.json({ ok: true });
});

router.delete('/questions/:id', auth, (req, res) => {
  store.questions.remove(req.params.id);
  res.json({ ok: true });
});

router.delete('/tests/:id/questions', auth, (req, res) => {
  store.questions.removeByTest(req.params.id);
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ Import */
router.post('/import/preview', auth, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });
  try {
    const questions = await parseFile(req.file.path, req.file.originalname);
    res.json({
      count: questions.length,
      questions: questions.map((q) => ({
        text: q.text, opt_a: q.a, opt_b: q.b, opt_c: q.c, opt_d: q.d, correct: q.correct,
      })),
    });
  } catch (e) {
    res.status(400).json({ error: e.userMessage ? e.message : "Faylni o'qib bo'lmadi: " + e.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

router.post('/import/text', auth, (req, res) => {
  const questions = parseText(req.body && req.body.text);
  res.json({
    count: questions.length,
    questions: questions.map((q) => ({
      text: q.text, opt_a: q.a, opt_b: q.b, opt_c: q.c, opt_d: q.d, correct: q.correct,
    })),
  });
});

/* ---------------------------------------------------------------- Natijalar */
router.get('/results', auth, (req, res) => {
  const rows = store.attempts.search({
    testId: req.query.testId, group: req.query.group, q: req.query.q,
  });
  res.json(rows.map((r) => ({
    id: r.id, test_title: r.test_title,
    last_name: r.last_name, first_name: r.first_name, middle_name: r.middle_name,
    group_name: r.group_name, total: r.total,
    correct_count: r.correct_count, wrong_count: r.wrong_count,
    percent: r.percent, grade: r.grade, passed: r.passed, status: r.status,
    started_at: r.started_at, finished_at: r.finished_at,
  })));
});

router.get('/results/stats', auth, (req, res) => res.json(store.attempts.stats()));

router.get('/results/export.xlsx', auth, (req, res) => {
  const rows = store.attempts.search({ testId: req.query.testId });
  const data = rows.map((r, i) => ({
    '№': i + 1,
    'Familiya': r.last_name,
    'Ism': r.first_name,
    'Otasining ismi': r.middle_name,
    'Guruh': r.group_name,
    'Test': r.test_title,
    'Jami savol': r.total,
    "To'g'ri": r.correct_count,
    "Noto'g'ri": r.wrong_count,
    'Foiz': r.percent,
    'Baho': r.grade,
    'Holat': r.passed ? "O'tdi" : "O'tmadi",
    'Boshlandi': r.started_at ? new Date(r.started_at).toLocaleString('uz-UZ') : '',
    'Tugadi': r.finished_at ? new Date(r.finished_at).toLocaleString('uz-UZ') : '',
  }));

  const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ Natija: "Ma'lumot yo'q" }]);
  ws['!cols'] = [{ wch: 5 }, { wch: 16 }, { wch: 14 }, { wch: 18 }, { wch: 10 }, { wch: 24 },
                 { wch: 11 }, { wch: 9 }, { wch: 10 }, { wch: 7 }, { wch: 7 }, { wch: 10 },
                 { wch: 18 }, { wch: 18 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Natijalar');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="natijalar-${Date.now()}.xlsx"`);
  res.send(buf);
});

/** Bitta talabaning to'liq natijasi */
router.get('/results/:id', auth, (req, res) => {
  const a = store.attempts.get(req.params.id);
  if (!a) return res.status(404).json({ error: 'Natija topilmadi' });
  res.json({
    id: a.id,
    student: { last: a.last_name, first: a.first_name, middle: a.middle_name, group: a.group_name },
    test: a.test_title,
    total: a.total, correct: a.correct_count, wrong: a.wrong_count,
    percent: a.percent, grade: a.grade, passed: !!a.passed, status: a.status,
    startedAt: a.started_at, finishedAt: a.finished_at,
    detail: buildDetail(a),
  });
});

router.delete('/results/:id', auth, (req, res) => {
  store.attempts.remove(req.params.id);
  res.json({ ok: true });
});

/* ----------------------------------------- Lokal tarmoq manzillari + QR */
router.get('/lan', auth, async (req, res) => {
  const { lanAddresses } = require('../net');
  const port = process.env.PORT || 3000;
  const ips = lanAddresses();
  const urls = ips.map((ip) => `http://${ip}:${port}`);
  const publicUrl = `${req.protocol}://${req.get('host')}`;
  const primary = urls[0] || publicUrl;
  let qr = '';
  try { qr = await require('qrcode').toDataURL(primary, { width: 260, margin: 1 }); } catch {}
  res.json({ urls, publicUrl, primary, qr });
});

/* -------------------------------------------------------- Namuna fayllar */
router.get('/namuna.xlsx', auth, (req, res) => {
  const rows = [
    ['Savol', 'A', 'B', 'C', 'D', "To'g'ri javob"],
    ["O'zbekiston poytaxti qaysi shahar?", 'Samarqand', 'Toshkent', 'Buxoro', 'Xiva', 'B'],
    ['2 + 2 * 2 = ?', '8', '6', '4', '2', 'B'],
    ['Eng katta okean qaysi?', 'Atlantika', 'Hind', 'Tinch', 'Shimoliy Muz', 'C'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 14 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Savollar');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="namuna-savollar.xlsx"');
  res.send(buf);
});

module.exports = { router, auth, verify, COOKIE };
