'use strict';
const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const multer = require('multer');
const XLSX = require('xlsx');
const db = require('../db');
const { parseFile } = require('../parsers');
const { nowIso } = require('../util');

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
    return res.status(401).json({ error: 'Login yoki parol noto\'g\'ri' });
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
router.get('/tests', auth, async (req, res) => {
  const rows = await db.all(
    `SELECT t.*, (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS q_count,
            (SELECT COUNT(*) FROM attempts a WHERE a.test_id = t.id AND a.status <> 'active') AS a_count
     FROM tests t ORDER BY t.id DESC`
  );
  res.json(rows.map((r) => ({ ...r, q_count: Number(r.q_count), a_count: Number(r.a_count) })));
});

router.post('/tests', auth, async (req, res) => {
  const b = req.body || {};
  if (!String(b.title || '').trim()) return res.status(400).json({ error: 'Test nomini kiriting' });
  const id = await db.insert(
    `INSERT INTO tests (title, subject, description, duration_min, questions_per_attempt,
      shuffle_questions, shuffle_options, show_answers, pass_percent, is_active, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [String(b.title).trim(), b.subject || '', b.description || '',
     Number(b.duration_min) || 30, Number(b.questions_per_attempt) || 0,
     b.shuffle_questions ? 1 : 0, b.shuffle_options ? 1 : 0, b.show_answers ? 1 : 0,
     Number(b.pass_percent) || 60, b.is_active ? 1 : 0, nowIso()]
  );
  res.json({ id });
});

router.put('/tests/:id', auth, async (req, res) => {
  const b = req.body || {};
  await db.run(
    `UPDATE tests SET title=?, subject=?, description=?, duration_min=?, questions_per_attempt=?,
     shuffle_questions=?, shuffle_options=?, show_answers=?, pass_percent=?, is_active=? WHERE id=?`,
    [String(b.title || '').trim(), b.subject || '', b.description || '',
     Number(b.duration_min) || 30, Number(b.questions_per_attempt) || 0,
     b.shuffle_questions ? 1 : 0, b.shuffle_options ? 1 : 0, b.show_answers ? 1 : 0,
     Number(b.pass_percent) || 60, b.is_active ? 1 : 0, req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/tests/:id', auth, async (req, res) => {
  await db.run('DELETE FROM questions WHERE test_id = ?', [req.params.id]);
  await db.run('DELETE FROM attempts WHERE test_id = ?', [req.params.id]);
  await db.run('DELETE FROM tests WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

/* ---------------------------------------------------------------- Savollar */
router.get('/tests/:id/questions', auth, async (req, res) => {
  const rows = await db.all('SELECT * FROM questions WHERE test_id = ? ORDER BY position, id', [req.params.id]);
  res.json(rows);
});

function validQuestion(q) {
  if (!String(q.text || '').trim()) return 'Savol matni bo\'sh';
  if (!String(q.opt_a || '').trim() || !String(q.opt_b || '').trim()) return 'Kamida A va B variant kerak';
  if (!['A', 'B', 'C', 'D'].includes(String(q.correct || '').toUpperCase())) return 'To\'g\'ri javob A/B/C/D bo\'lsin';
  return null;
}

router.post('/tests/:id/questions', auth, async (req, res) => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  const last = await db.get('SELECT MAX(position) AS p FROM questions WHERE test_id = ?', [req.params.id]);
  let pos = Number(last && last.p ? last.p : 0);
  const errors = [];
  let added = 0;
  for (const q of items) {
    const err = validQuestion(q);
    if (err) { errors.push(err); continue; }
    pos++;
    await db.insert(
      'INSERT INTO questions (test_id, text, opt_a, opt_b, opt_c, opt_d, correct, position) VALUES (?,?,?,?,?,?,?,?)',
      [req.params.id, String(q.text).trim(), q.opt_a || '', q.opt_b || '', q.opt_c || '', q.opt_d || '',
       String(q.correct).toUpperCase(), pos]
    );
    added++;
  }
  res.json({ added, errors });
});

router.put('/questions/:id', auth, async (req, res) => {
  const q = req.body || {};
  const err = validQuestion(q);
  if (err) return res.status(400).json({ error: err });
  await db.run(
    'UPDATE questions SET text=?, opt_a=?, opt_b=?, opt_c=?, opt_d=?, correct=? WHERE id=?',
    [String(q.text).trim(), q.opt_a || '', q.opt_b || '', q.opt_c || '', q.opt_d || '',
     String(q.correct).toUpperCase(), req.params.id]
  );
  res.json({ ok: true });
});

router.delete('/questions/:id', auth, async (req, res) => {
  await db.run('DELETE FROM questions WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.delete('/tests/:id/questions', auth, async (req, res) => {
  await db.run('DELETE FROM questions WHERE test_id = ?', [req.params.id]);
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
    res.status(400).json({ error: e.userMessage ? e.message : 'Faylni o\'qib bo\'lmadi: ' + e.message });
  } finally {
    fs.unlink(req.file.path, () => {});
  }
});

/* ------------------------------------------------------------ Matndan import */
router.post('/import/text', auth, async (req, res) => {
  const { parseText } = require('../parsers');
  const questions = parseText(req.body && req.body.text);
  res.json({
    count: questions.length,
    questions: questions.map((q) => ({
      text: q.text, opt_a: q.a, opt_b: q.b, opt_c: q.c, opt_d: q.d, correct: q.correct,
    })),
  });
});

/* ---------------------------------------------------------------- Natijalar */
router.get('/results', auth, async (req, res) => {
  const { testId, group, q } = req.query;
  const where = ["status <> 'active'"];
  const params = [];
  if (testId) { where.push('test_id = ?'); params.push(testId); }
  if (group) { where.push('group_name = ?'); params.push(String(group).toUpperCase()); }
  if (q) {
    where.push('(LOWER(last_name) LIKE ? OR LOWER(first_name) LIKE ?)');
    const like = `%${String(q).toLowerCase()}%`;
    params.push(like, like);
  }
  const rows = await db.all(
    `SELECT id, test_title, last_name, first_name, middle_name, group_name, total,
            correct_count, wrong_count, percent, grade, passed, status, started_at, finished_at
     FROM attempts WHERE ${where.join(' AND ')} ORDER BY id DESC LIMIT 1000`,
    params
  );
  res.json(rows);
});

router.get('/results/stats', auth, async (req, res) => {
  const total = await db.get("SELECT COUNT(*) AS c FROM attempts WHERE status <> 'active'");
  const avg = await db.get("SELECT AVG(percent) AS p FROM attempts WHERE status <> 'active'");
  const passed = await db.get("SELECT COUNT(*) AS c FROM attempts WHERE status <> 'active' AND passed = 1");
  const tests = await db.get('SELECT COUNT(*) AS c FROM tests');
  const questions = await db.get('SELECT COUNT(*) AS c FROM questions');
  res.json({
    attempts: Number(total.c), tests: Number(tests.c), questions: Number(questions.c),
    avgPercent: Math.round(Number(avg.p || 0)), passed: Number(passed.c),
  });
});

/** Bitta talabaning to'liq natijasi — savol, uning javobi va to'g'ri javob */
router.get('/results/:id', auth, async (req, res) => {
  const a = await db.get('SELECT * FROM attempts WHERE id = ?', [req.params.id]);
  if (!a) return res.status(404).json({ error: 'Natija topilmadi' });

  const order = JSON.parse(a.order_json || '[]');
  const answers = JSON.parse(a.answers_json || '{}');
  const ids = order.map((o) => o.id);
  let detail = [];
  if (ids.length) {
    const ph = ids.map(() => '?').join(',');
    const qs = await db.all(`SELECT * FROM questions WHERE id IN (${ph})`, ids);
    const byId = new Map(qs.map((q) => [String(q.id), q]));
    detail = order.map((o, i) => {
      const q = byId.get(String(o.id));
      if (!q) return null;
      const given = answers[String(o.id)] || null;
      return {
        n: i + 1,
        text: q.text,
        options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
        given, correct: q.correct, ok: given === q.correct,
      };
    }).filter(Boolean);
  }

  res.json({
    id: a.id,
    student: { last: a.last_name, first: a.first_name, middle: a.middle_name, group: a.group_name },
    test: a.test_title,
    total: a.total, correct: a.correct_count, wrong: a.wrong_count,
    percent: a.percent, grade: a.grade, passed: !!a.passed, status: a.status,
    startedAt: a.started_at, finishedAt: a.finished_at,
    detail,
  });
});

router.delete('/results/:id', auth, async (req, res) => {
  await db.run('DELETE FROM attempts WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

router.get('/results/export.xlsx', auth, async (req, res) => {
  const { testId } = req.query;
  const params = [];
  let sql = "SELECT * FROM attempts WHERE status <> 'active'";
  if (testId) { sql += ' AND test_id = ?'; params.push(testId); }
  sql += ' ORDER BY id DESC';
  const rows = await db.all(sql, params);

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

/* ----------------------------------------- Lokal tarmoq manzillari + QR */
router.get('/lan', auth, async (req, res) => {
  const { lanAddresses } = require('../net');
  const QR = require('qrcode');
  const port = process.env.PORT || 3000;
  const ips = lanAddresses();
  const urls = ips.map((ip) => `http://${ip}:${port}`);
  // Renderда/bulutda ishlayotgan bo'lsa — brauzerdagi manzilning o'zi
  const publicUrl = `${req.protocol}://${req.get('host')}`;
  const primary = urls[0] || publicUrl;
  let qr = '';
  try { qr = await QR.toDataURL(primary, { width: 260, margin: 1 }); } catch {}
  res.json({ urls, publicUrl, primary, qr });
});

/* -------------------------------------------------------- Namuna fayllar */
router.get('/namuna.xlsx', auth, (req, res) => {
  const rows = [
    ['Savol', 'A', 'B', 'C', 'D', "To'g'ri javob"],
    ["O'zbekiston poytaxti qaysi shahar?", 'Samarqand', 'Toshkent', 'Buxoro', 'Xiva', 'B'],
    ['2 + 2 * 2 = ?', '8', '6', '4', '2', 'B'],
    ["Eng katta okean qaysi?", 'Atlantika', 'Hind', 'Tinch', 'Shimoliy Muz', 'C'],
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
