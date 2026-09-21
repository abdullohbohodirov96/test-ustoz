'use strict';
const db = require('../src/db');
const { nowIso } = require('../src/util');

const DEMO = [
  {
    title: 'Demo test — Umumiy bilim',
    subject: 'Umumiy',
    description: "Tizimni sinab ko'rish uchun namuna test. 10 ta savol, 10 daqiqa.",
    duration_min: 10,
    questions: [
      ["O'zbekiston Respublikasining poytaxti qaysi shahar?", 'Samarqand', 'Toshkent', 'Buxoro', 'Xiva', 'B'],
      ['2 + 2 × 2 amalining natijasi nechaga teng?', '8', '6', '4', '2', 'B'],
      ['Yer sayyorasining eng katta okeani qaysi?', 'Atlantika okeani', 'Hind okeani', 'Tinch okean', 'Shimoliy Muz okeani', 'C'],
      ["Suvning kimyoviy formulasi qanday yoziladi?", 'CO2', 'H2O', 'O2', 'NaCl', 'B'],
      ["\"O'tkan kunlar\" romani muallifi kim?", 'Oybek', 'Abdulla Qodiriy', "G'afur G'ulom", 'Cho\'lpon', 'B'],
      ['Bir yilda nechta oy bor?', '10', '11', '12', '13', 'C'],
      ["Amir Temur davlatining poytaxti qaysi shahar edi?", 'Toshkent', 'Samarqand', 'Buxoro', 'Shahrisabz', 'B'],
      ['Inson tanasidagi eng katta organ qaysi?', 'Yurak', 'Jigar', 'Teri', "O'pka", 'C'],
      ["Kompyuterning \"miya\"si deb nima ataladi?", 'Monitor', 'Protsessor (CPU)', 'Klaviatura', 'Sichqoncha', 'B'],
      ['Uchburchak ichki burchaklari yig\'indisi necha gradus?', '90°', '180°', '270°', '360°', 'B'],
    ],
  },
  {
    title: 'Demo test — Matematika',
    subject: 'Matematika',
    description: 'Boshlang\'ich matematika bo\'yicha 5 ta savol.',
    duration_min: 5,
    questions: [
      ['15 × 4 = ?', '45', '60', '54', '64', 'B'],
      ['144 sonining kvadrat ildizi nechaga teng?', '11', '12', '13', '14', 'B'],
      ["100 ning 25 foizi nechaga teng?", '20', '25', '30', '35', 'B'],
      ['Doira yuzasi formulasi qaysi?', '2πr', 'πr²', 'πd', 'r²', 'B'],
      ['7! (7 faktorial) nechaga teng?', '2520', '5040', '720', '40320', 'B'],
    ],
  },
];

async function seedIfEmpty() {
  const row = await db.get('SELECT COUNT(*) AS c FROM tests');
  if (Number(row.c) > 0) return false;

  for (const d of DEMO) {
    const id = await db.insert(
      `INSERT INTO tests (title, subject, description, duration_min, questions_per_attempt,
        shuffle_questions, shuffle_options, show_answers, pass_percent, is_active, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [d.title, d.subject, d.description, d.duration_min, 0, 1, 1, 1, 60, 1, nowIso()]
    );
    let pos = 0;
    for (const q of d.questions) {
      pos++;
      await db.insert(
        'INSERT INTO questions (test_id, text, opt_a, opt_b, opt_c, opt_d, correct, position) VALUES (?,?,?,?,?,?,?,?)',
        [id, q[0], q[1], q[2], q[3], q[4], q[5], pos]
      );
    }
  }
  console.log('[seed] Demo testlar qo\'shildi');
  return true;
}

module.exports = { seedIfEmpty };

if (require.main === module) {
  require('dotenv').config();
  db.init().then(seedIfEmpty).then(() => process.exit(0));
}
