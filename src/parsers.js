'use strict';
/**
 * Word (.docx), Excel (.xlsx/.xls), CSV va TXT fayllardan ABCD savollarni ajratib olish.
 * Qaytaradi: [{ text, a, b, c, d, correct }]
 */
const path = require('path');
const mammoth = require('mammoth');
const XLSX = require('xlsx');

const LETTERS = ['A', 'B', 'C', 'D'];

// Kirill harflarini lotin ABCD ga moslash
const LETTER_MAP = {
  A: 'A', B: 'B', C: 'C', D: 'D',
  a: 'A', b: 'B', c: 'C', d: 'D',
  'А': 'A', 'Б': 'B', 'В': 'C', 'Г': 'D',
  'а': 'A', 'б': 'B', 'в': 'C', 'г': 'D',
  '1': 'A', '2': 'B', '3': 'C', '4': 'D',
};

function normLetter(ch) {
  return LETTER_MAP[ch] || null;
}

function clean(s) {
  return String(s == null ? '' : s)
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------- TEXT PARSER

const RE_QUESTION = /^\s*(?:№\s*)?(\d{1,3})\s*[.)\-:]\s*(.+)$/;
const RE_OPTION = /^\s*([+*#]?)\s*([A-Da-dА-Га-г])\s*[.)\-:]\s+(.+)$/;
// "1) variant" ko'rinishidagi raqamli variantlar (savol raqami bilan chalkashmasligi uchun alohida)
const RE_OPTION_NUM = /^\s*([+*#]?)\s*([1-4])\s*[.)\-:]\s+(.+)$/;
const RE_ANSWER_LINE = /^\s*(?:to['’‘`]?g['’‘`]?ri\s*javob|javob(?:i)?|answer|ответ|правильный\s*ответ)\s*[:\-–]\s*([A-DA-Da-dА-Га-г1-4])\s*$/i;
const RE_QMARK = /^\s*\?\s*(.+)$/;       // "? Savol matni"
const RE_PLUS = /^\s*\+\s*(.+)$/;        // "+ to'g'ri javob"
const RE_MINUS = /^\s*[-–—]\s*(.+)$/;    // "- noto'g'ri javob"

/**
 * Format 1: raqamlangan savol + A) B) C) D) variantlar
 * To'g'ri javob: variant oldida "+", yoki alohida "Javob: B" qatori,
 * yoki variant matni oxirida (to'g'ri)/(+)
 */
function parseNumbered(lines) {
  const out = [];
  let cur = null;

  const push = () => {
    if (cur && cur.text && cur.opts.filter(Boolean).length >= 2) {
      const q = {
        text: cur.text,
        a: cur.opts[0] || '',
        b: cur.opts[1] || '',
        c: cur.opts[2] || '',
        d: cur.opts[3] || '',
        correct: cur.correct || 'A',
      };
      out.push(q);
    }
    cur = null;
  };

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;

    const ans = line.match(RE_ANSWER_LINE);
    if (ans && cur) {
      const L = normLetter(ans[1]);
      if (L) cur.correct = L;
      continue;
    }

    // --- harfli variant: A) B) C) D)
    let opt = line.match(RE_OPTION);
    let optIdx = null;
    if (opt && cur) {
      const L = normLetter(opt[2]);
      if (L) optIdx = LETTERS.indexOf(L);
    }
    // --- raqamli variant: 1) 2) 3) 4)  — faqat ketma-ketlik to'g'ri kelsa
    if (optIdx === null && cur) {
      const on = line.match(RE_OPTION_NUM);
      if (on) {
        const filled = cur.opts.filter(Boolean).length;
        const d = Number(on[2]);
        if (filled < 4 && d === filled + 1) { opt = on; optIdx = filled; }
      }
    }
    if (optIdx !== null && optIdx >= 0) {
      const mark = opt[1];
      let text = clean(opt[3]);
      let isCorrect = mark === '+' || mark === '*' || mark === '#';
      // matn oxirida belgilangan to'g'ri javob
      const tail = text.match(/\s*\((?:\+|to['’`]?g['’`]?ri|правильный|correct)\)\s*$/i);
      if (tail) { isCorrect = true; text = clean(text.slice(0, tail.index)); }
      cur.opts[optIdx] = text;
      if (isCorrect) cur.correct = LETTERS[optIdx];
      continue;
    }

    const qm = line.match(RE_QUESTION);
    if (qm) {
      // Agar joriy savolning variantlari hali to'lmagan bo'lsa va bu raqam
      // variantga o'xshasa ham — yangi savol deb olamiz (raqamlash ketma-ket).
      push();
      cur = { text: clean(qm[2]), opts: ['', '', '', ''], correct: null };
      continue;
    }

    // savolning davomi (ko'p qatorli matn)
    if (cur && cur.opts.every((o) => !o)) {
      cur.text = clean(cur.text + ' ' + line);
    }
  }
  push();
  return out;
}

/**
 * Format 2:  ? Savol
 *            + to'g'ri
 *            - noto'g'ri
 */
function parseQPlus(lines) {
  const out = [];
  let cur = null;

  const push = () => {
    if (cur && cur.text && cur.opts.length >= 2) {
      const correctIdx = cur.opts.findIndex((o) => o.correct);
      const ordered = cur.opts.slice(0, 4);
      out.push({
        text: cur.text,
        a: ordered[0] ? ordered[0].text : '',
        b: ordered[1] ? ordered[1].text : '',
        c: ordered[2] ? ordered[2].text : '',
        d: ordered[3] ? ordered[3].text : '',
        correct: LETTERS[correctIdx >= 0 && correctIdx < 4 ? correctIdx : 0],
      });
    }
    cur = null;
  };

  for (const raw of lines) {
    const line = clean(raw);
    if (!line) continue;

    const qm = line.match(RE_QMARK);
    if (qm) { push(); cur = { text: clean(qm[1]), opts: [] }; continue; }

    const pm = line.match(RE_PLUS);
    if (pm && cur) { cur.opts.push({ text: clean(pm[1]), correct: true }); continue; }

    const mm = line.match(RE_MINUS);
    if (mm && cur) { cur.opts.push({ text: clean(mm[1]), correct: false }); continue; }

    if (cur && cur.opts.length === 0) cur.text = clean(cur.text + ' ' + line);
  }
  push();
  return out;
}

/**
 * Format 3: savol satri, keyin belgisiz 4 ta variant satri.
 * Birinchi variant to'g'ri deb hisoblanadi (ko'p test banklarida shunday),
 * yoki "+" bilan belgilangan bo'lsa — o'sha.
 */
function parseBlocks(lines) {
  const out = [];
  const buf = [];
  const flush = () => {
    if (buf.length >= 3) {
      const text = buf[0];
      const rest = buf.slice(1, 5);
      let correct = 'A';
      const opts = rest.map((r, i) => {
        const m = r.match(/^\s*[+*#]\s*(.+)$/);
        if (m) { correct = LETTERS[i]; return clean(m[1]); }
        return clean(r);
      });
      out.push({
        text, a: opts[0] || '', b: opts[1] || '', c: opts[2] || '', d: opts[3] || '', correct,
      });
    }
    buf.length = 0;
  };
  for (const raw of lines) {
    const line = clean(raw);
    if (!line) { flush(); continue; }
    buf.push(line);
    if (buf.length === 5) flush();
  }
  flush();
  return out;
}

function parseText(raw) {
  const lines = String(raw || '').split(/\r?\n/);
  const joined = lines.join('\n');

  const candidates = [];
  if (/^\s*\?\s*\S/m.test(joined) && /^\s*\+\s*\S/m.test(joined)) {
    candidates.push(parseQPlus(lines));
  }
  candidates.push(parseNumbered(lines));
  candidates.push(parseBlocks(lines));

  // eng ko'p to'liq savol chiqargan variantni tanlaymiz
  let best = [];
  for (const c of candidates) {
    const valid = c.filter((q) => q.text && q.a && q.b);
    if (valid.length > best.length) best = valid;
  }
  return best;
}

// ------------------------------------------------------------- EXCEL / CSV

const HEAD_Q = /savol|question|вопрос|matn/i;
const HEAD_CORRECT = /to['’`]?g['’`]?ri|javob|correct|answer|ответ/i;

function parseSheet(rows) {
  const out = [];
  if (!rows.length) return out;

  let startRow = 0;
  let col = { q: 0, a: 1, b: 2, c: 3, d: 4, correct: 5 };

  // sarlavha qatorini topamiz
  const head = rows[0].map((c) => clean(c));
  const hasHeader = head.some((c) => HEAD_Q.test(c));
  if (hasHeader) {
    startRow = 1;
    const find = (re) => head.findIndex((c) => re.test(c));
    const qi = find(HEAD_Q);
    if (qi >= 0) col.q = qi;
    const ai = head.findIndex((c) => /^a$|variant\s*a|^a\)/i.test(c));
    if (ai >= 0) { col.a = ai; col.b = ai + 1; col.c = ai + 2; col.d = ai + 3; }
    else { col.a = col.q + 1; col.b = col.q + 2; col.c = col.q + 3; col.d = col.q + 4; }
    const ci = head.findIndex((c, i) => i > col.q && HEAD_CORRECT.test(c) && !/^savol/i.test(c));
    col.correct = ci >= 0 ? ci : col.d + 1;
  }

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r] || [];
    const text = clean(row[col.q]);
    if (!text) continue;
    let opts = [clean(row[col.a]), clean(row[col.b]), clean(row[col.c]), clean(row[col.d])];
    if (opts.filter(Boolean).length < 2) continue;

    let correct = null;
    // "+" bilan belgilangan variant
    opts = opts.map((o, i) => {
      const m = o.match(/^\s*[+*#]\s*(.+)$/);
      if (m) { correct = LETTERS[i]; return clean(m[1]); }
      return o;
    });
    if (!correct) {
      const cell = clean(row[col.correct]);
      if (cell) {
        const L = normLetter(cell[0]);
        if (L) correct = L;
        else {
          const idx = opts.findIndex((o) => o.toLowerCase() === cell.toLowerCase());
          if (idx >= 0) correct = LETTERS[idx];
        }
      }
    }
    out.push({ text, a: opts[0], b: opts[1], c: opts[2], d: opts[3], correct: correct || 'A' });
  }
  return out;
}

// ------------------------------------------------------------------ PUBLIC

async function parseFile(filePath, originalName) {
  const ext = path.extname(originalName || filePath).toLowerCase();

  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return parseText(value);
  }

  if (ext === '.xlsx' || ext === '.xls' || ext === '.xlsm' || ext === '.csv') {
    const wb = XLSX.readFile(filePath, { cellDates: false });
    let all = [];
    for (const name of wb.SheetNames) {
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
      all = all.concat(parseSheet(rows));
    }
    // Agar jadval formatida chiqmasa — matn sifatida urinib ko'ramiz
    if (all.length === 0) {
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const txt = XLSX.utils.sheet_to_txt(sheet, { FS: '\n' });
      return parseText(txt);
    }
    return all;
  }

  if (ext === '.txt' || ext === '.md' || ext === '.text') {
    const fs = require('fs');
    return parseText(fs.readFileSync(filePath, 'utf8'));
  }

  if (ext === '.doc') {
    const err = new Error(
      'Eski .doc format qo\'llab-quvvatlanmaydi. Word\'da oching va "Farqli saqlash → .docx" qiling.'
    );
    err.userMessage = true;
    throw err;
  }

  const err = new Error(`Noma'lum fayl turi: ${ext}. .docx, .xlsx, .csv yoki .txt yuklang.`);
  err.userMessage = true;
  throw err;
}

module.exports = { parseFile, parseText, LETTERS };
