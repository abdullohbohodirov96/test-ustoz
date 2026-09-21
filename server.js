'use strict';
require('dotenv').config();

const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const db = require('./src/db');
const publicRoutes = require('./src/routes/public');
const { router: adminRoutes } = require('./src/routes/admin');

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  next();
});

app.use('/api', publicRoutes);
app.use('/api/admin', adminRoutes);

app.get('/healthz', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));
app.use((req, res) => {
  if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Topilmadi' });
  res.status(404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, req, res, next) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.userMessage ? err.message : 'Server xatosi' });
});

const PORT = process.env.PORT || 3000;

db.init()
  .then(async () => {
    if (process.env.SEED_DEMO !== '0') {
      try { await require('./scripts/seed').seedIfEmpty(); } catch (e) { console.error('[seed]', e.message); }
    }
    app.listen(PORT, '0.0.0.0', () => {
      const { lanAddresses } = require('./src/net');
      const ips = lanAddresses();
      console.log('\n' + '═'.repeat(58));
      console.log('  ✅ TEST TIZIMI ISHGA TUSHDI');
      console.log('═'.repeat(58));
      console.log(`\n  Shu kompyuterda:`);
      console.log(`     Test sahifasi : http://localhost:${PORT}`);
      console.log(`     Admin panel   : http://localhost:${PORT}/admin`);
      if (ips.length) {
        console.log(`\n  Shu Wi-Fi/tarmoqdagi boshqa qurilmalarda (telefon, noutbuk):`);
        ips.forEach((ip) => console.log(`     http://${ip}:${PORT}`));
        console.log(`\n  👉 Shu manzilni talabalarga bering. Internet SHART EMAS —`);
        console.log(`     faqat bitta Wi-Fi/routerga ulangan bo'lishsa yetadi.`);
      }
      console.log(`\n  To'xtatish: Ctrl + C\n`);
    });
  })
  .catch((e) => {
    console.error('Bazaga ulanib bo\'lmadi:', e);
    process.exit(1);
  });
