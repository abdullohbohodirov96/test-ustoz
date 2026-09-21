(function () {
  const $ = (id) => document.getElementById(id);
  const att = JSON.parse(sessionStorage.getItem('attempt') || 'null');
  if (!att) { location.href = '/'; return; }

  let current = null;
  let choice = null;
  let deadline = new Date(att.deadline);
  let finished = false;

  $('testTitle').textContent = att.title;
  $('studentName').textContent = att.student + ' · ' + att.group;
  document.title = att.title;

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
  function showErr(m) {
    const el = $('err'); el.textContent = m; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 5000);
  }
  const api = (url, opt = {}) =>
    fetch(url, {
      ...opt,
      headers: { 'Content-Type': 'application/json', 'X-Attempt-Token': att.token, ...(opt.headers || {}) },
    });

  /* ------------------------------------------------------------- taymer */
  function tick() {
    if (finished) return;
    const left = deadline - new Date();
    if (left <= 0) { $('timer').textContent = '00:00'; goResult(); return; }
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    $('timer').textContent = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    $('timer').classList.toggle('low', left < 60000);
  }
  setInterval(tick, 500); tick();

  /* ------------------------------------------------------------- render */
  function render(q) {
    current = q; choice = null;
    $('counter').textContent = `Savol ${q.number} / ${q.total}`;
    $('qnum').textContent = `Savol ${q.number}`;
    $('qtext').textContent = q.text;
    $('bar').style.width = (((q.index + 1) / q.total) * 100) + '%';
    $('opts').innerHTML = q.options
      .map((o) => `<div class="opt" data-l="${o.letter}">
          <div class="letter">${o.letter}</div><div class="txt">${esc(o.text)}</div>
        </div>`)
      .join('');
    $('opts').querySelectorAll('.opt').forEach((el) => {
      el.addEventListener('click', () => {
        $('opts').querySelectorAll('.opt').forEach((x) => x.classList.remove('sel'));
        el.classList.add('sel');
        choice = el.dataset.l;
        $('nextBtn').disabled = false;
      });
    });
    $('nextBtn').disabled = true;
    $('nextBtn').textContent = q.number === q.total ? 'Testni yakunlash ✓' : 'Keyingisi →';
    window.scrollTo({ top: 0 });
  }

  async function load() {
    try {
      const r = await api(`/api/attempts/${att.attemptId}/question`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Xatolik');
      if (d.finished) return goResult();
      if (d.deadline) deadline = new Date(d.deadline);
      render(d.question);
    } catch (e) { showErr(e.message); }
  }

  async function next() {
    if (!choice || !current) return;
    const btn = $('nextBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>';
    try {
      const r = await api(`/api/attempts/${att.attemptId}/answer`, {
        method: 'POST',
        body: JSON.stringify({ choice, index: current.index }),
      });
      const d = await r.json();
      if (!r.ok && r.status !== 409) throw new Error(d.error || 'Xatolik');
      if (d.finished) return goResult();
      await load();
    } catch (e) {
      showErr(e.message);
      btn.disabled = false;
      btn.textContent = 'Keyingisi →';
    }
  }

  function goResult() {
    finished = true;
    sessionStorage.setItem('result', JSON.stringify({ id: att.attemptId, token: att.token }));
    location.replace('/result.html');
  }

  $('nextBtn').addEventListener('click', next);

  /* --------------------------------------------- orqaga qaytishni bloklash */
  history.pushState(null, '', location.href);
  window.addEventListener('popstate', () => {
    history.pushState(null, '', location.href);
    showErr('Orqaga qaytish mumkin emas. Savolga javob berib davom eting.');
  });
  window.addEventListener('beforeunload', (e) => {
    if (finished) return;
    e.preventDefault();
    e.returnValue = '';
  });

  /* ----------------------------------------------------- klaviatura: A-D */
  document.addEventListener('keydown', (e) => {
    const k = e.key.toUpperCase();
    if (['A', 'B', 'C', 'D'].includes(k)) {
      const el = $('opts').querySelector(`.opt[data-l="${k}"]`);
      if (el) el.click();
    } else if (e.key === 'Enter' && !$('nextBtn').disabled) {
      next();
    }
  });

  load();
})();
