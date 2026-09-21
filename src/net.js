'use strict';
const os = require('os');

/** Kompyuterning lokal tarmoqdagi (Wi-Fi/LAN) IP manzillari */
function lanAddresses() {
  const out = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const ni of ifaces[name] || []) {
      if (ni.family !== 'IPv4' && ni.family !== 4) continue;
      if (ni.internal) continue;
      // faqat xususiy tarmoq manzillari
      if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ni.address)) out.push(ni.address);
    }
  }
  return [...new Set(out)];
}

module.exports = { lanAddresses };
