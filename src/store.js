'use strict';
/**
 * Oddiy fayl-baza. Hech qanday tashqi kutubxona va kompilyatsiya kerak emas —
 * barcha ma'lumot bitta JSON faylda (data/data.json) saqlanadi.
 * Shu sababli dastur istalgan kompyuterda, istalgan Node versiyasida ishlaydi.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

let FILE = null;
let db = { seq: { tests: 0, questions: 0, attempts: 0 }, tests: [], questions: [], attempts: [] };
let saveTimer = null;
let saving = false;
let dirty = false;

/* ------------------------------------------------------------------ init */

function pickDir() {
  const candidates = [
    path.resolve(process.env.DATA_DIR || './data'),
    path.join(os.homedir(), '.test-ustoz'),
    path.join(os.tmpdir(), 'test-ustoz'),
  ];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.probe');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      if (dir !== candidates[0]) {
        console.warn(`[baza] "${candidates[0]}" papkasiga yozib bo'lmadi, ma'lumot shu yerda: ${dir}`);
      }
      return dir;
    } catch (e) { /* keyingisini sinaymiz */ }
  }
  throw new Error("Ma'lumotlarni saqlash uchun papka topilmadi");
}

function init() {
  const dir = pickDir();
  FILE = path.join(dir, 'data.json');

  if (fs.existsSync(FILE)) {
    try {
      const raw = fs.readFileSync(FILE, 'utf8');
      const parsed = JSON.parse(raw);
      db = {
        seq: Object.assign({ tests: 0, questions: 0, attempts: 0 }, parsed.seq),
        tests: parsed.tests || [],
        questions: parsed.questions || [],
        attempts: parsed.attempts || [],
      };
    } catch (e) {
      // Buzilgan fayl — zaxiraga olib, toza boshlaymiz
      const bak = FILE + '.buzilgan-' + Date.now();
      try { fs.renameSync(FILE, bak); } catch {}
      console.error(`[baza] Fayl o'qilmadi, zaxiraga olindi: ${bak}`);
    }
  }
  console.log(`[baza] Tayyor: ${FILE}`);
  return { file: FILE, dir };
}

/* ------------------------------------------------------------------ save */

function writeNow() {
  if (!FILE || saving) return;
  saving = true;
  dirty = false;
  const tmp = FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(db), 'utf8');
    fs.renameSync(tmp, FILE);
  } catch (e) {
    console.error('[baza] Saqlashda xato:', e.message);
  } finally {
    saving = false;
    if (dirty) save();
  }
}

function save() {
  dirty = true;
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; writeNow(); }, 150);
}

/** Dastur yopilayotganda darhol saqlash */
function flush() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } writeNow(); }

function nextId(kind) { db.seq[kind] = (db.seq[kind] || 0) + 1; return db.seq[kind]; }
const num = (v, d = 0) => (v === undefined || v === null || v === '' ? d : Number(v) || 0);
const bool = (v) => (v ? 1 : 0);

/* ----------------------------------------------------------------- tests */

const tests = {
  all() { return db.tests.slice().sort((a, b) => b.id - a.id); },
  active() { return tests.all().filter((t) => t.is_active); },
  get(id) { return db.tests.find((t) => t.id === Number(id)) || null; },

  create(b) {
    const t = {
      id: nextId('tests'),
      title: String(b.title || '').trim(),
      subject: b.subject || '',
      description: b.description || '',
      duration_min: num(b.duration_min, 30) || 30,
      questions_per_attempt: num(b.questions_per_attempt, 0),
      shuffle_questions: bool(b.shuffle_questions),
      shuffle_options: bool(b.shuffle_options),
      show_answers: bool(b.show_answers),
      pass_percent: num(b.pass_percent, 60),
      is_active: bool(b.is_active),
      created_at: new Date().toISOString(),
    };
    db.tests.push(t); save();
    return t.id;
  },

  update(id, b) {
    const t = tests.get(id);
    if (!t) return false;
    Object.assign(t, {
      title: String(b.title || '').trim() || t.title,
      subject: b.subject || '',
      description: b.description || '',
      duration_min: num(b.duration_min, 30) || 30,
      questions_per_attempt: num(b.questions_per_attempt, 0),
      shuffle_questions: bool(b.shuffle_questions),
      shuffle_options: bool(b.shuffle_options),
      show_answers: bool(b.show_answers),
      pass_percent: num(b.pass_percent, 60),
      is_active: bool(b.is_active),
    });
    save();
    return true;
  },

  remove(id) {
    id = Number(id);
    db.tests = db.tests.filter((t) => t.id !== id);
    db.questions = db.questions.filter((q) => q.test_id !== id);
    db.attempts = db.attempts.filter((a) => a.test_id !== id);
    save();
  },
};

/* ------------------------------------------------------------- questions */

const questions = {
  byTest(testId) {
    return db.questions
      .filter((q) => q.test_id === Number(testId))
      .sort((a, b) => (a.position - b.position) || (a.id - b.id));
  },
  countByTest(testId) { return db.questions.filter((q) => q.test_id === Number(testId)).length; },
  get(id) { return db.questions.find((q) => q.id === Number(id)) || null; },
  getMany(ids) {
    const set = new Set(ids.map(Number));
    return db.questions.filter((q) => set.has(q.id));
  },
  total() { return db.questions.length; },

  create(testId, b) {
    const last = questions.byTest(testId).slice(-1)[0];
    const q = {
      id: nextId('questions'),
      test_id: Number(testId),
      text: String(b.text || '').trim(),
      opt_a: b.opt_a || '', opt_b: b.opt_b || '', opt_c: b.opt_c || '', opt_d: b.opt_d || '',
      correct: String(b.correct || 'A').toUpperCase(),
      position: last ? last.position + 1 : 1,
    };
    db.questions.push(q); save();
    return q.id;
  },

  update(id, b) {
    const q = questions.get(id);
    if (!q) return false;
    Object.assign(q, {
      text: String(b.text || '').trim(),
      opt_a: b.opt_a || '', opt_b: b.opt_b || '', opt_c: b.opt_c || '', opt_d: b.opt_d || '',
      correct: String(b.correct || 'A').toUpperCase(),
    });
    save();
    return true;
  },

  remove(id) { db.questions = db.questions.filter((q) => q.id !== Number(id)); save(); },
  removeByTest(testId) {
    db.questions = db.questions.filter((q) => q.test_id !== Number(testId)); save();
  },
};

/* -------------------------------------------------------------- attempts */

const attempts = {
  get(id) { return db.attempts.find((a) => a.id === Number(id)) || null; },
  finished() { return db.attempts.filter((a) => a.status !== 'active').sort((a, b) => b.id - a.id); },
  countFinishedByTest(testId) {
    return db.attempts.filter((a) => a.test_id === Number(testId) && a.status !== 'active').length;
  },

  create(obj) {
    const a = Object.assign({ id: nextId('attempts') }, obj);
    db.attempts.push(a); save();
    return a.id;
  },

  update(id, patch) {
    const a = attempts.get(id);
    if (!a) return false;
    Object.assign(a, patch);
    save();
    return true;
  },

  remove(id) { db.attempts = db.attempts.filter((a) => a.id !== Number(id)); save(); },

  search({ testId, group, q } = {}) {
    let rows = attempts.finished();
    if (testId) rows = rows.filter((a) => a.test_id === Number(testId));
    if (group) rows = rows.filter((a) => String(a.group_name).toUpperCase() === String(group).toUpperCase());
    if (q) {
      const s = String(q).toLowerCase();
      rows = rows.filter((a) =>
        String(a.last_name).toLowerCase().includes(s) || String(a.first_name).toLowerCase().includes(s));
    }
    return rows.slice(0, 2000);
  },

  stats() {
    const fin = attempts.finished();
    const avg = fin.length ? Math.round(fin.reduce((s, a) => s + (a.percent || 0), 0) / fin.length) : 0;
    return {
      attempts: fin.length,
      tests: db.tests.length,
      questions: db.questions.length,
      avgPercent: avg,
      passed: fin.filter((a) => a.passed).length,
    };
  },
};

process.on('exit', flush);
process.on('SIGINT', () => { flush(); process.exit(0); });
process.on('SIGTERM', () => { flush(); process.exit(0); });

module.exports = { init, flush, tests, questions, attempts, file: () => FILE };
