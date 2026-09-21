'use strict';
/** Natijalarni Telegram botga yuborish (token bo'lmasa — jim o'tkazib yuboradi) */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function fmtDuration(ms) {
  if (!ms || ms < 0) return '-';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m} daq ${s % 60} son`;
}

function buildMessage(a) {
  const fio = [a.last_name, a.first_name, a.middle_name].filter(Boolean).join(' ');
  const dur = a.started_at && a.finished_at
    ? fmtDuration(new Date(a.finished_at) - new Date(a.started_at))
    : '-';
  const mark = a.passed ? '✅' : '❌';
  return [
    `${mark} <b>YANGI TEST NATIJASI</b>`,
    ``,
    `👤 <b>F.I.O:</b> ${esc(fio)}`,
    `👥 <b>Guruh:</b> ${esc(a.group_name)}`,
    `📘 <b>Test:</b> ${esc(a.test_title)}`,
    ``,
    `✔️ To'g'ri: <b>${a.correct_count}</b>`,
    `✖️ Noto'g'ri: <b>${a.wrong_count}</b>`,
    `📊 Jami savol: <b>${a.total}</b>`,
    `💯 Foiz: <b>${a.percent}%</b>`,
    `⭐ Baho: <b>${a.grade}</b>`,
    `⏱ Sarflangan vaqt: ${dur}`,
    ``,
    `🕒 ${new Date(a.finished_at || Date.now()).toLocaleString('uz-UZ', { timeZone: 'Asia/Tashkent' })}`,
  ].join('\n');
}

async function sendResult(attempt) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token || !chatId) return { ok: false, skipped: true };

  const text = buildMessage(attempt);
  const targets = chatId.split(',').map((c) => c.trim()).filter(Boolean);
  const results = [];

  for (const cid of targets) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cid,
          text,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!data.ok) console.error('[telegram] xato:', data.description || res.status);
      results.push(!!data.ok);
    } catch (e) {
      console.error('[telegram] ulanish xatosi:', e.message);
      results.push(false);
    }
  }
  return { ok: results.some(Boolean) };
}

async function testConnection() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
  if (!token) return { ok: false, error: 'TELEGRAM_BOT_TOKEN kiritilmagan' };
  if (!chatId) return { ok: false, error: 'TELEGRAM_CHAT_ID kiritilmagan' };
  try {
    const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
    if (!me.ok) return { ok: false, error: 'Token noto\'g\'ri' };
    const res = await (await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId.split(',')[0].trim(), text: '✅ Test tizimi botga muvaffaqiyatli ulandi.' }),
    })).json();
    if (!res.ok) return { ok: false, error: res.description || 'Xabar yuborilmadi' };
    return { ok: true, bot: me.result.username };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { sendResult, testConnection, buildMessage };
