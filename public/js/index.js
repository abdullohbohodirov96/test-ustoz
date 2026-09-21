(function () {
  const $ = (id) => document.getElementById(id);
  let tests = [];
  let selected = null;

  function showErr(msg) {
    const el = $('err');
    el.textContent = msg;
    el.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => el.classList.remove('show'), 6000);
  }

  /* Har bir so'zning birinchi harfini katta qilish */
  function properCase(s) {
    return String(s || '')
      .replace(/\s+/g, ' ')
      .trimStart()
      .split(' ')
      .map((w) =>
        w.split('-')
          .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : p))
          .join('-')
      )
      .join(' ');
  }

  ['lastName', 'firstName', 'middleName'].forEach((id) => {
    const el = $(id);
    el.addEventListener('input', () => {
      const pos = el.selectionStart;
      el.value = properCase(el.value);
      el.setSelectionRange(pos, pos);
    });
  });
  $('groupName').addEventListener('input', (e) => {
    const pos = e.target.selectionStart;
    e.target.value = e.target.value.toUpperCase();
    e.target.setSelectionRange(pos, pos);
  });

  function renderTests() {
    const box = $('testList');
    if (!tests.length) {
      box.innerHTML =
        '<div class="empty"><div class="ic">📭</div>Hozircha faol test yo\'q.<br>' +
        '<span class="muted">O\'qituvchi admin paneldan test qo\'shishi kerak.</span></div>';
      return;
    }
    box.innerHTML = tests
      .map(
        (t) => `
      <div class="test-item" data-id="${t.id}">
        <div class="ic">📘</div>
        <div style="flex:1">
          <div class="t">${esc(t.title)}</div>
          <div class="m">${t.subject ? esc(t.subject) + ' · ' : ''}${t.questions} ta savol · ${t.durationMin} daqiqa</div>
        </div>
        <div style="font-size:20px;color:#9ca3af">›</div>
      </div>`
      )
      .join('');

    box.querySelectorAll('.test-item').forEach((el) => {
      el.addEventListener('click', () => {
        box.querySelectorAll('.test-item').forEach((x) => x.classList.remove('active'));
        el.classList.add('active');
        selected = tests.find((t) => String(t.id) === el.dataset.id);
        $('formBlock').style.display = 'block';
        $('rules').innerHTML =
          `<b>${esc(selected.title)}</b> — ${selected.questions} ta savol, ${selected.durationMin} daqiqa.<br>` +
          `Har bir savolga javob berib «Keyingisi» tugmasini bosasiz. <b>Orqaga qaytish mumkin emas.</b>`;
        $('lastName').focus();
      });
    });
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  async function start() {
    if (!selected) return showErr('Avval testni tanlang');
    const body = {
      testId: selected.id,
      lastName: $('lastName').value.trim(),
      firstName: $('firstName').value.trim(),
      middleName: $('middleName').value.trim(),
      groupName: $('groupName').value.trim(),
    };
    if (!body.lastName || !body.firstName || !body.middleName || !body.groupName)
      return showErr("Barcha maydonlarni to'ldiring");

    const btn = $('startBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span> Tayyorlanmoqda…';
    try {
      const r = await fetch('/api/attempts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Xatolik');
      sessionStorage.setItem('attempt', JSON.stringify(data));
      location.href = '/test.html';
    } catch (e) {
      showErr(e.message);
      btn.disabled = false;
      btn.textContent = 'Testni boshlash →';
    }
  }

  $('startBtn').addEventListener('click', start);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && $('formBlock').style.display === 'block') start();
  });

  fetch('/api/tests')
    .then((r) => r.json())
    .then((d) => { tests = d; renderTests(); })
    .catch(() => showErr('Testlarni yuklab bo\'lmadi'));
})();
