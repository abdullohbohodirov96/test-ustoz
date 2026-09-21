'use strict';
const express = require('express');
const store = require('../store');
const { properCase, validName, shuffle, token, gradeOf, nowIso } = require('../util');

const router = express.Router();
const LETTERS = ['A', 'B', 'C', 'D'];

/* ------------------------------------------------------------ Faol testlar */
router.get('/tests', (req, res) => {
  const out = store.tests.active()
    .map((t) => {
      const count = store.questions.countByTest(t.id);
      return {
        id: t.id,
        title: t.title,
        subject: t.subject,
        description: t.description,
        durationMin: t.duration_min,
        questions: t.questions_per_attempt > 0 ? Math.min(t.questions_per_attempt, count) : count,
        _count: count,
      };
    })
    .filter((t) => t._count > 0)
    .map(({ _count, ...t }) => t);
  res.json(out);
});

/* ------------------------------------------------------------ Testni boshlash */
router.post('/attempts', (req, res) => {
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

    const test = store.tests.get(testId);
    if (!test || !test.is_active) return res.status(404).json({ error: 'Test topilmadi yoki faol emas' });

    let ids = store.questions.byTest(test.id).map((q) => q.id);
    if (!ids.length) return res.status(400).json({ error: "Bu testda savollar yo'q" });

    if (test.shuffle_questions) ids = shuffle(ids);
    if (test.questions_per_attempt > 0) ids = ids.slice(0, test.questions_per_attempt);

    const order = ids.map((id) => ({
      id,
      opt: test.shuffle_options ? shuffle([0, 1, 2, 3]) : [0, 1, 2, 3],
    }));

    const started = new Date();
    const deadline = new Date(started.getTime() + (test.duration_min || 30) * 60000);
    const tk = token();

    const attemptId = store.attempts.create({
      token: tk,
      test_id: test.id,
      test_title: test.title,
      last_name: lastName, first_name: firstName, middle_name: middleName,
      group_name: groupName,
      order: order,
      answers: {},
      current_index: 0,
      total: order.length,
      correct_count: 0, wrong_count: 0, percent: 0, grade: 0, passed: 0,
      status: 'active',
      started_at: started.toISOString(),
      deadline_at: deadline.toISOString(),
      finished_at: null,
      ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim(),
    });

    res.json({
      attemptId, token: tk,
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
function loadAttempt(req, res) {
  const tk = req.get('X-Attempt-Token') || req.query.token || (req.body && req.body.token);
  const a = store.attempts.get(req.params.id);
  if (!a) { res.status(404).json({ error: 'Urinish topilmadi' }); return null; }
  if (a.token !== tk) { res.status(403).json({ error: "Ruxsat yo'q" }); return null; }
  return a;
}

function publicQuestion(q, mapping, index, total) {
  const src = [q.opt_a, q.opt_b, q.opt_c, q.opt_d];
  return {
    index, total, number: index + 1, text: q.text,
    options: mapping.map((origIdx, i) => ({ letter: LETTERS[i], text: src[origIdx] || '' })),
  };
}

/* ------------------------------------------------------------ Joriy savol */
router.get('/attempts/:id/question', (req, res) => {
  const a = loadAttempt(req, res);
  if (!a) return;
  if (a.status !== 'active') return res.json({ finished: true });
  if (new Date() > new Date(a.deadline_at)) { finishAttempt(a, 'timeout'); return res.json({ finished: true, reason: 'timeout' }); }
  if (a.current_index >= a.order.length) { finishAttempt(a, 'done'); return res.json({ finished: true }); }

  const item = a.order[a.current_index];
  const q = store.questions.get(item.id);
  if (!q) return res.status(500).json({ error: 'Savol topilmadi' });

  res.json({
    finished: false,
    question: publicQuestion(q, item.opt, a.current_index, a.order.length),
    deadline: a.deadline_at,
  });
});

/* ------------------------------------------------------------ Javob berish */
router.post('/attempts/:id/answer', (req, res) => {
  const a = loadAttempt(req, res);
  if (!a) return;
  if (a.status !== 'active') return res.json({ finished: true });
  if (new Date() > new Date(a.deadline_at)) { finishAttempt(a, 'timeout'); return res.json({ finished: true, reason: 'timeout' }); }

  const { choice, index } = req.body || {};
  if (Number(index) !== a.current_index) {
    return res.status(409).json({ error: 'Savol tartibi mos emas', currentIndex: a.current_index });
  }

  const item = a.order[a.current_index];
  const letterIdx = LETTERS.indexOf(String(choice || '').toUpperCase());
  a.answers[String(item.id)] = letterIdx >= 0 ? LETTERS[item.opt[letterIdx]] : null;
  a.current_index += 1;
  store.attempts.update(a.id, { answers: a.answers, current_index: a.current_index });

  if (a.current_index >= a.order.length) { finishAttempt(a, 'done'); return res.json({ finished: true }); }
  res.json({ finished: false, nextIndex: a.current_index });
});

/* ------------------------------------------------------------ Yakunlash */
function finishAttempt(a, reason) {
  if (a.status !== 'active') return a;
  const qs = store.questions.getMany(a.order.map((o) => o.id));
  const byId = new Map(qs.map((q) => [String(q.id), q]));

  let correct = 0;
  for (const o of a.order) {
    const q = byId.get(String(o.id));
    if (!q) continue;
    if (a.answers[String(o.id)] === q.correct) correct++;
  }
  const total = a.order.length;
  const wrong = total - correct;
  const percent = total ? Math.round((correct / total) * 100) : 0;
  const test = store.tests.get(a.test_id);

  store.attempts.update(a.id, {
    status: reason === 'timeout' ? 'timeout' : 'finished',
    finished_at: nowIso(),
    correct_count: correct, wrong_count: wrong,
    percent, grade: gradeOf(percent),
    passed: percent >= (test ? test.pass_percent : 60) ? 1 : 0,
    total,
  });
  return store.attempts.get(a.id);
}

/** Natija tafsilotlari (savol, berilgan javob, to'g'ri javob) */
function buildDetail(a) {
  const qs = store.questions.getMany(a.order.map((o) => o.id));
  const byId = new Map(qs.map((q) => [String(q.id), q]));
  return a.order.map((o, i) => {
    const q = byId.get(String(o.id));
    if (!q) return null;
    const given = a.answers[String(o.id)] || null;
    return {
      n: i + 1, text: q.text,
      options: { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d },
      given, correct: q.correct, ok: given === q.correct,
    };
  }).filter(Boolean);
}

/* ------------------------------------------------------------ Natija */
router.get('/attempts/:id/result', (req, res) => {
  let a = loadAttempt(req, res);
  if (!a) return;
  if (a.status === 'active') a = finishAttempt(a, 'manual');

  const test = store.tests.get(a.test_id);
  const showAnswers = !!(test && test.show_answers);

  res.json({
    student: { last: a.last_name, first: a.first_name, middle: a.middle_name, group: a.group_name },
    test: { title: a.test_title, subject: test ? test.subject : '' },
    total: a.total, correct: a.correct_count, wrong: a.wrong_count,
    percent: a.percent, grade: a.grade, passed: !!a.passed,
    startedAt: a.started_at, finishedAt: a.finished_at,
    showAnswers,
    detail: showAnswers ? buildDetail(a) : [],
  });
});

/* ------------------------------------------------- Testni erta yakunlash */
router.post('/attempts/:id/finish', (req, res) => {
  const a = loadAttempt(req, res);
  if (!a) return;
  if (a.status === 'active') finishAttempt(a, 'manual');
  res.json({ ok: true });
});

module.exports = router;
module.exports.buildDetail = buildDetail;
