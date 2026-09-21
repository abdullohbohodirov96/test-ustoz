'use strict';
const express = require('express');
const db = require('../db');
const tg = require('../telegram');
const { properCase, validName, shuffle, token, gradeOf, nowIso } = require('../util');

const router = express.Router();
const LETTERS = ['A', 'B', 'C', 'D'];

/* ------------------------------------------------------------ Faol testlar */
router.get('/tests', async (req, res) => {
  const rows = await db.all(
    `SELECT t.id, t.title, t.subject, t.description, t.duration_min, t.questions_per_attempt,
            (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS q_count
     FROM tests t WHERE t.is_active = 1 ORDER BY t.id DESC`
  );
  res.json(
    rows
      .filter((t) => Number(t.q_count) > 0)
      .map((t) => ({
        id: t.id,
        title: t.title,
        subject: t.subject,
        description: t.description,
        durationMin: t.duration_min,
        questions: t.questions_per_attempt > 0
          ? Math.min(t.questions_per_attempt, Number(t.q_count))
          : Number(t.q_count),
      }))
  );
});

/* ------------------------------------------------------------ Testni boshlash */
router.post('/attempts', async (req, res) => {
  try {
    const { testId } = req.body || {};
    const lastName = properCase(req.body.lastName);
    const firstName = properCase(req.body.firstName);
    const middleName = properCase(req.body.middleName);
    const groupName = String(req.body.groupName || '').trim().toUpperCase();

    if (!validName(lastName)) return res.status(400).json({ error: 'Familiya lotin harflarida kiritilsin' });
    if (!validName(firstName)) return res.status(400).json({ error: 'Ism lotin harflarida kiritilsin' });
    if (!validName(middleName)) return res.status(400).json({ error: 'Otasining ismi lotin harflarida kiritilsin' });
    if (!groupName || groupName.length > 30) return res.status(400).json({ error: 'Guruh nomerini kiriting' });

    const test = await db.get('SELECT * FROM tests WHERE id = ? AND is_active = 1', [testId]);
    if (!test) return res.status(404).json({ error: 'Test topilmadi yoki faol emas' });

    let qs = await db.all('SELECT id FROM questions WHERE test_id = ? ORDER BY position, id', [test.id]);
    if (!qs.length) return res.status(400).json({ error: 'Bu testda savollar yo\'q' });

    let ids = qs.map((q) => q.id);
    if (test.shuffle_questions) ids = shuffle(ids);
    if (test.questions_per_attempt > 0) ids = ids.slice(0, test.questions_per_attempt);

    // Variantlar tartibi ham har bir talabaga alohida
    const order = ids.map((id) => ({
      id,
      opt: test.shuffle_options ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3],
    }));

    const started = new Date();
    const deadline = new Date(started.getTime() + (test.duration_min || 30) * 60000);
    const tk = token();

    const attemptId = await db.insert(
      `INSERT INTO attempts
       (token, test_id, test_title, last_name, first_name, middle_name, group_name,
        order_json, answers_json, current_index, total, status, started_at, deadline_at, ip)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [tk, test.id, test.title, lastName, firstName, middleName, groupName,
       JSON.stringify(order), '{}', 0, order.length, 'active',
       started.toISOString(), deadline.toISOString(),
       String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim()]
    );

    res.json({
      attemptId,
      token: tk,
      total: order.length,
      durationMin: test.duration_min,
      deadline: deadline.toISOString(),
      title: test.title,
      student: `${lastName} ${firstName} ${middleName}`,
      group: groupName,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server xatosi' });
  }
});

/* ---------------------------------------------------------- Yordamchi */
async function loadAttempt(req, res) {
  const { id } = req.params;
  const tk = req.get('X-Attempt-Token') || req.query.token || (req.body && req.body.token);
  const a = await db.get('SELECT * FROM attempts WHERE id = ?', [id]);
  if (!a) { res.status(404).json({ error: 'Urinish topilmadi' }); return null; }
  if (a.token !== tk) { res.status(403).json({ error: 'Ruxsat yo\'q' }); return null; }
  return a;
}

function publicQuestion(q, mapping, index, total) {
  const src = [q.opt_a, q.opt_b, q.opt_c, q.opt_d];
  return {
    index,
    total,
    number: index + 1,
    text: q.text,
    options: mapping.map((origIdx, i) => ({ letter: LETTERS[i], text: src[origIdx] || '' })),
  };
}

/* ------------------------------------------------------------ Joriy savol */
router.get('/attempts/:id/question', async (req, res) => {
  const a = await loadAttempt(req, res);
  if (!a) return;
  if (a.status !== 'active') return res.json({ finished: true });
  if (new Date() > new Date(a.deadline_at)) {
    await finishAttempt(a, 'timeout');
    return res.json({ finished: true, reason: 'timeout' });
  }
  const order = JSON.parse(a.order_json);
  if (a.current_index >= order.length) { await finishAttempt(a, 'done'); return res.json({ finished: true }); }

  const item = order[a.current_index];
  const q = await db.get('SELECT * FROM questions WHERE id = ?', [item.id]);
  if (!q) return res.status(500).json({ error: 'Savol topilmadi' });

  res.json({
    finished: false,
    question: publicQuestion(q, item.opt, a.current_index, order.length),
    deadline: a.deadline_at,
  });
});

/* ------------------------------------------------------------ Javob berish */
router.post('/attempts/:id/answer', async (req, res) => {
  const a = await loadAttempt(req, res);
  if (!a) return;
  if (a.status !== 'active') return res.json({ finished: true });

  if (new Date() > new Date(a.deadline_at)) {
    const r = await finishAttempt(a, 'timeout');
    return res.json({ finished: true, reason: 'timeout', resultToken: r.token });
  }

  const { choice, index } = req.body || {};
  const order = JSON.parse(a.order_json);
  if (Number(index) !== a.current_index) {
    return res.status(409).json({ error: 'Savol tartibi mos emas', currentIndex: a.current_index });
  }

  const answers = JSON.parse(a.answers_json || '{}');
  const item = order[a.current_index];
  const letterIdx = LETTERS.indexOf(String(choice || '').toUpperCase());
  // ko'rsatilgan harfni asl variant indeksiga qaytaramiz
  answers[String(item.id)] = letterIdx >= 0 ? LETTERS[item.opt[letterIdx]] : null;

  const nextIndex = a.current_index + 1;
  await db.run('UPDATE attempts SET answers_json = ?, current_index = ? WHERE id = ?', [
    JSON.stringify(answers), nextIndex, a.id,
  ]);

  if (nextIndex >= order.length) {
    const fresh = await db.get('SELECT * FROM attempts WHERE id = ?', [a.id]);
    await finishAttempt(fresh, 'done');
    return res.json({ finished: true });
  }
  res.json({ finished: false, nextIndex });
});

/* ------------------------------------------------------------ Yakunlash */
async function finishAttempt(a, reason) {
  if (a.status !== 'active') return a;
  const order = JSON.parse(a.order_json);
  const answers = JSON.parse(a.answers_json || '{}');
  const ids = order.map((o) => o.id);
  const placeholders = ids.map(() => '?').join(',');
  const qs = ids.length
    ? await db.all(`SELECT id, text, opt_a, opt_b, opt_c, opt_d, correct FROM questions WHERE id IN (${placeholders})`, ids)
    : [];
  const byId = new Map(qs.map((q) => [String(q.id), q]));

  let correct = 0;
  const detail = [];
  for (const o of order) {
    const q = byId.get(String(o.id));
    if (!q) continue;
    const given = answers[String(o.id)] || null;
    const ok = given && given === q.correct;
    if (ok) correct++;
    detail.push({
      text: q.text,
      given,
      correct: q.correct,
      ok: !!ok,
      options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
    });
  }
  const total = order.length;
  const wrong = total - correct;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const grade = gradeOf(percent);

  const test = await db.get('SELECT pass_percent, show_answers FROM tests WHERE id = ?', [a.test_id]);
  const passed = percent >= (test ? test.pass_percent : 60) ? 1 : 0;

  await db.run(
    `UPDATE attempts SET status = ?, finished_at = ?, correct_count = ?, wrong_count = ?,
     percent = ?, grade = ?, passed = ?, total = ? WHERE id = ?`,
    [reason === 'timeout' ? 'timeout' : 'finished', nowIso(), correct, wrong, percent, grade, passed, total, a.id]
  );

  const updated = await db.get('SELECT * FROM attempts WHERE id = ?', [a.id]);
  updated._detail = detail;
  updated._showAnswers = test ? !!test.show_answers : true;

  tg.sendResult(updated).catch(() => {});
  return updated;
}

/* ------------------------------------------------------------ Natija */
router.get('/attempts/:id/result', async (req, res) => {
  let a = await loadAttempt(req, res);
  if (!a) return;
  if (a.status === 'active') a = await finishAttempt(a, 'manual');

  const test = await db.get('SELECT show_answers, pass_percent, title, subject FROM tests WHERE id = ?', [a.test_id]);
  let detail = [];
  if (test && test.show_answers) {
    const order = JSON.parse(a.order_json);
    const answers = JSON.parse(a.answers_json || '{}');
    const ids = order.map((o) => o.id);
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
          given,
          correct: q.correct,
          ok: given === q.correct,
        };
      }).filter(Boolean);
    }
  }

  res.json({
    student: { last: a.last_name, first: a.first_name, middle: a.middle_name, group: a.group_name },
    test: { title: a.test_title, subject: test ? test.subject : '' },
    total: a.total,
    correct: a.correct_count,
    wrong: a.wrong_count,
    percent: a.percent,
    grade: a.grade,
    passed: !!a.passed,
    startedAt: a.started_at,
    finishedAt: a.finished_at,
    showAnswers: !!(test && test.show_answers),
    telegram: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
    detail,
  });
});

/* ------------------------------------------------- Testni erta yakunlash */
router.post('/attempts/:id/finish', async (req, res) => {
  const a = await loadAttempt(req, res);
  if (!a) return;
  if (a.status === 'active') await finishAttempt(a, 'manual');
  res.json({ ok: true });
});

module.exports = router;
