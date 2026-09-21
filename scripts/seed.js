'use strict';
const store = require('../src/store');

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
      ['Suvning kimyoviy formulasi qanday yoziladi?', 'CO2', 'H2O', 'O2', 'NaCl', 'B'],
      ['"O\'tkan kunlar" romani muallifi kim?', 'Oybek', 'Abdulla Qodiriy', "G'afur G'ulom", "Cho'lpon", 'B'],
      ['Bir yilda nechta oy bor?', '10', '11', '12', '13', 'C'],
      ['Amir Temur davlatining poytaxti qaysi shahar edi?', 'Toshkent', 'Samarqand', 'Buxoro', 'Shahrisabz', 'B'],
      ['Inson tanasidagi eng katta organ qaysi?', 'Yurak', 'Jigar', 'Teri', "O'pka", 'C'],
      ['Kompyuterning "miya"si deb nima ataladi?', 'Monitor', 'Protsessor (CPU)', 'Klaviatura', 'Sichqoncha', 'B'],
      ["Uchburchak ichki burchaklari yig'indisi necha gradus?", '90°', '180°', '270°', '360°', 'B'],
    ],
  },
  {
    title: 'Demo test — Matematika',
    subject: 'Matematika',
    description: "Boshlang'ich matematika bo'yicha 5 ta savol.",
    duration_min: 5,
    questions: [
      ['15 × 4 = ?', '45', '60', '54', '64', 'B'],
      ['144 sonining kvadrat ildizi nechaga teng?', '11', '12', '13', '14', 'B'],
      ['100 ning 25 foizi nechaga teng?', '20', '25', '30', '35', 'B'],
      ['Doira yuzasi formulasi qaysi?', '2πr', 'πr²', 'πd', 'r²', 'B'],
      ['7! (7 faktorial) nechaga teng?', '2520', '5040', '720', '40320', 'B'],
    ],
  },
];

function seedIfEmpty() {
  if (store.tests.all().length > 0) return false;

  for (const d of DEMO) {
    const id = store.tests.create({
      title: d.title, subject: d.subject, description: d.description,
      duration_min: d.duration_min, questions_per_attempt: 0,
      shuffle_questions: 1, shuffle_options: 1, show_answers: 1,
      pass_percent: 60, is_active: 1,
    });
    for (const q of d.questions) {
      store.questions.create(id, {
        text: q[0], opt_a: q[1], opt_b: q[2], opt_c: q[3], opt_d: q[4], correct: q[5],
      });
    }
  }
  console.log("[seed] Demo testlar qo'shildi");
  return true;
}

module.exports = { seedIfEmpty };

if (require.main === module) {
  require('dotenv').config();
  store.init();
  seedIfEmpty();
  store.flush();
}
