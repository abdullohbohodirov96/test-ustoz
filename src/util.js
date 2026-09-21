'use strict';
const crypto = require('crypto');

/**
 * Har bir so'zning birinchi harfini katta qiladi.
 * "boHodirov" -> "Bohodirov",  "ulugbek o'g'li" -> "Ulugbek O'g'li",
 * "abdulla-aziz" -> "Abdulla-Aziz"   (apostrofdan keyin katta harf QILINMAYDI)
 */
function properCase(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return '';
  return s
    .split(' ')
    .map((word) =>
      word
        .split('-')
        .map((part) => {
          if (!part) return part;
          return part.charAt(0).toLocaleUpperCase('en-US') + part.slice(1).toLocaleLowerCase('en-US');
        })
        .join('-')
    )
    .join(' ');
}

/** Faqat lotin harflari, bo'shliq, tire va apostrof */
const NAME_RE = /^[A-Za-z][A-Za-z\s'’`ʻ\-]{1,48}$/;

function validName(s) {
  return NAME_RE.test(String(s || '').trim());
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function token(n = 24) {
  return crypto.randomBytes(n).toString('hex');
}

function gradeOf(percent) {
  if (percent >= 86) return 5;
  if (percent >= 71) return 4;
  if (percent >= 56) return 3;
  return 2;
}

function nowIso() {
  return new Date().toISOString();
}

module.exports = { properCase, validName, shuffle, token, gradeOf, nowIso, NAME_RE };
