'use strict';
/**
 * Bitta DB qatlami — DATABASE_URL bo'lsa PostgreSQL, bo'lmasa SQLite.
 * Barcha SQL `?` placeholder bilan yoziladi, Postgres uchun $1,$2 ga aylantiriladi.
 */
const fs = require('fs');
const path = require('path');

const PG_URL = (process.env.DATABASE_URL || '').trim();
const IS_PG = !!PG_URL;

let pool = null;
let sqlite = null;

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function init() {
  if (IS_PG) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: PG_URL,
      ssl: PG_URL.includes('localhost') ? false : { rejectUnauthorized: false },
      max: 5,
    });
    await pool.query('SELECT 1');
  } else {
    const Database = require('better-sqlite3');
    const dir = path.resolve(process.env.DATA_DIR || './data');
    fs.mkdirSync(dir, { recursive: true });
    sqlite = new Database(path.join(dir, 'test.db'));
    // WAL tezroq, lekin ba'zi tarmoq/virtual disklarda ishlamaydi — xato bo'lsa oddiy rejim
    try { sqlite.pragma('journal_mode = WAL'); }
    catch { try { sqlite.pragma('journal_mode = DELETE'); } catch {} }
    try { sqlite.pragma('foreign_keys = ON'); } catch {}
  }
  await migrate();
  console.log(`[db] ${IS_PG ? 'PostgreSQL' : 'SQLite'} tayyor`);
}

async function run(sql, params = []) {
  if (IS_PG) {
    const r = await pool.query(toPg(sql), params);
    return { rowCount: r.rowCount };
  }
  const info = sqlite.prepare(sql).run(params);
  return { rowCount: info.changes };
}

async function all(sql, params = []) {
  if (IS_PG) {
    const r = await pool.query(toPg(sql), params);
    return r.rows;
  }
  return sqlite.prepare(sql).all(params);
}

async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] || null;
}

/** INSERT qilib, yangi id ni qaytaradi */
async function insert(sql, params = []) {
  if (IS_PG) {
    const r = await pool.query(toPg(sql) + ' RETURNING id', params);
    return r.rows[0].id;
  }
  const info = sqlite.prepare(sql).run(params);
  return Number(info.lastInsertRowid);
}

const ID = () => (IS_PG ? 'SERIAL PRIMARY KEY' : 'INTEGER PRIMARY KEY AUTOINCREMENT');

async function migrate() {
  await run(`CREATE TABLE IF NOT EXISTS tests (
    id ${ID()},
    title TEXT NOT NULL,
    subject TEXT DEFAULT '',
    description TEXT DEFAULT '',
    duration_min INTEGER DEFAULT 30,
    questions_per_attempt INTEGER DEFAULT 0,
    shuffle_questions INTEGER DEFAULT 1,
    shuffle_options INTEGER DEFAULT 1,
    show_answers INTEGER DEFAULT 1,
    pass_percent INTEGER DEFAULT 60,
    is_active INTEGER DEFAULT 1,
    created_at TEXT
  )`);

  await run(`CREATE TABLE IF NOT EXISTS questions (
    id ${ID()},
    test_id INTEGER NOT NULL,
    text TEXT NOT NULL,
    opt_a TEXT DEFAULT '',
    opt_b TEXT DEFAULT '',
    opt_c TEXT DEFAULT '',
    opt_d TEXT DEFAULT '',
    correct TEXT NOT NULL,
    position INTEGER DEFAULT 0
  )`);

  await run(`CREATE TABLE IF NOT EXISTS attempts (
    id ${ID()},
    token TEXT NOT NULL,
    test_id INTEGER NOT NULL,
    test_title TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    first_name TEXT DEFAULT '',
    middle_name TEXT DEFAULT '',
    group_name TEXT DEFAULT '',
    order_json TEXT DEFAULT '[]',
    answers_json TEXT DEFAULT '{}',
    current_index INTEGER DEFAULT 0,
    total INTEGER DEFAULT 0,
    correct_count INTEGER DEFAULT 0,
    wrong_count INTEGER DEFAULT 0,
    percent INTEGER DEFAULT 0,
    grade INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    status TEXT DEFAULT 'active',
    started_at TEXT,
    finished_at TEXT,
    deadline_at TEXT,
    ip TEXT DEFAULT ''
  )`);

  await run(`CREATE INDEX IF NOT EXISTS idx_q_test ON questions(test_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_a_test ON attempts(test_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_a_token ON attempts(token)`);
}

module.exports = { init, run, all, get, insert, IS_PG };
