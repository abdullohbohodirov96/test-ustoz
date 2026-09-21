(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let tests = [];
  let pendingImport = null;

  /* ------------------------------------------------------------ helpers */
  function msg(type, text) {
    const el = $(type === 'err' ? 'err' : 'ok');
    el.textContent = text;
    el.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => el.classList.remove('show'), 5000);
  }

  async function api(url, opt = {}) {
    const r = await fetch(url, {
      credentials: 'same-origin',
      headers: opt.body instanceof FormData ? {} : { 'Content-Type': 'application/json' },
      ...opt,
    });
    if (r.status === 401) { showLogin(); throw new Error('Qayta kiring'); }
    const ct = r.headers.get('content-type') || '';
    const d = ct.includes('json') ? await r.json() : await r.text();
    if (!r.ok) throw new Error((d && d.error) || 'Xatolik');
    return d;
  }

  function showLogin() { $('loginView').style.display = 'block'; $('appView').style.display = 'none'; }
  function showApp() { $('loginView').style.display = 'none'; $('appView').style.display = 'block'; loadAll(); }

  function openModal(title, html) {
    $('modalTitle').textContent = title;
    $('modalBody').innerHTML = html;
    $('modalBg').classList.add('show');
  }
  function closeModal() { $('modalBg').classList.remove('show'); }
  $('modalX').addEventListener('click', closeModal);
  $('modalBg').addEventListener('click', (e) => { if (e.target === $('modalBg')) closeModal(); });

  /* -------------------------------------------------------------- login */
  $('lgBtn').addEventListener('click', doLogin);
  $('lgPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  async function doLogin() {
    const el = $('loginErr'); el.classList.remove('show');
    try {
      await api('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ username: $('lgUser').value, password: $('lgPass').value }),
      });
      showApp();
    } catch (e) { el.textContent = e.message; el.classList.add('show'); }
  }
  $('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/api/admin/logout', { method: 'POST' });
    location.reload();
  });

  /* --------------------------------------------------------------- tabs */
  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach((x) => x.classList.remove('active'));
      t.classList.add('active');
      $('p-' + t.dataset.p).classList.add('active');
      if (t.dataset.p === 'results') loadResults();
      if (t.dataset.p === 'questions') loadQuestions();
      if (t.dataset.p === 'lan') loadLan();
    });
  });

  /* -------------------------------------------------------------- stats */
  async function loadStats() {
    try {
      const s = await api('/api/admin/results/stats');
      $('stats').innerHTML = `
        <div class="stat brand"><div class="v">${s.tests}</div><div class="k">Testlar</div></div>
        <div class="stat"><div class="v">${s.questions}</div><div class="k">Savollar</div></div>
        <div class="stat"><div class="v">${s.attempts}</div><div class="k">Topshirilgan</div></div>
        <div class="stat good"><div class="v">${s.passed}</div><div class="k">O'tganlar</div></div>
        <div class="stat"><div class="v">${s.avgPercent}%</div><div class="k">O'rtacha ball</div></div>`;
    } catch (e) {}
  }

  /* -------------------------------------------------------------- tests */
  async function loadTests() {
    tests = await api('/api/admin/tests');
    $('testsBody').innerHTML = tests.length
      ? tests.map((t) => `<tr>
          <td>${t.id}</td>
          <td><b>${esc(t.title)}</b>${t.description ? `<br><span class="muted">${esc(t.description)}</span>` : ''}</td>
          <td>${esc(t.subject)}</td>
          <td>${t.q_count}${t.questions_per_attempt ? ` <span class="muted">(${t.questions_per_attempt} ta beriladi)</span>` : ''}</td>
          <td>${t.duration_min} daq</td>
          <td>${t.a_count}</td>
          <td>${t.is_active ? '<span class="badge ok">Faol</span>' : '<span class="badge gray">O\'chiq</span>'}</td>
          <td class="right" style="white-space:nowrap">
            <button class="btn sm ghost" data-edit="${t.id}">✎</button>
            <button class="btn sm danger" data-del="${t.id}">🗑</button>
          </td></tr>`).join('')
      : '<tr><td colspan="8" class="empty">Hali test yo\'q. «+ Yangi test» tugmasini bosing.</td></tr>';

    $('testsBody').querySelectorAll('[data-edit]').forEach((b) =>
      b.addEventListener('click', () => testForm(tests.find((t) => t.id == b.dataset.edit))));
    $('testsBody').querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Test, uning savollari va natijalari butunlay o\'chiriladi. Davom etasizmi?')) return;
        await api('/api/admin/tests/' + b.dataset.del, { method: 'DELETE' });
        msg('ok', 'Test o\'chirildi'); loadAll();
      }));

    const opts = tests.map((t) => `<option value="${t.id}">${esc(t.title)} (${t.q_count} ta savol)</option>`).join('');
    $('qTestSel').innerHTML = opts || '<option value="">— test yo\'q —</option>';
    $('impTestSel').innerHTML = opts || '<option value="">— test yo\'q —</option>';
    $('resTestSel').innerHTML = '<option value="">Barcha testlar</option>' +
      tests.map((t) => `<option value="${t.id}">${esc(t.title)}</option>`).join('');
  }

  function testForm(t) {
    const d = t || { title: '', subject: '', description: '', duration_min: 30, questions_per_attempt: 0,
      shuffle_questions: 1, shuffle_options: 1, show_answers: 1, pass_percent: 60, is_active: 1 };
    openModal(t ? 'Testni tahrirlash' : 'Yangi test', `
      <div class="field"><label>Test nomi *</label><input id="f_title" value="${esc(d.title)}"></div>
      <div class="row">
        <div class="field"><label>Fan</label><input id="f_subject" value="${esc(d.subject)}"></div>
        <div class="field"><label>Vaqt (daqiqa)</label><input type="number" id="f_dur" value="${d.duration_min}" min="1"></div>
      </div>
      <div class="field"><label>Izoh</label><input id="f_desc" value="${esc(d.description)}"></div>
      <div class="row">
        <div class="field"><label>Nechta savol berilsin? <span class="hint">0 = hammasi</span></label>
          <input type="number" id="f_qpa" value="${d.questions_per_attempt}" min="0"></div>
        <div class="field"><label>O'tish foizi (%)</label>
          <input type="number" id="f_pass" value="${d.pass_percent}" min="0" max="100"></div>
      </div>
      <label class="check"><input type="checkbox" id="f_sq" ${d.shuffle_questions ? 'checked' : ''}> Savollarni aralashtirish</label>
      <label class="check"><input type="checkbox" id="f_so" ${d.shuffle_options ? 'checked' : ''}> ABCD variantlarni aralashtirish</label>
      <label class="check"><input type="checkbox" id="f_sa" ${d.show_answers ? 'checked' : ''}> Oxirida to'g'ri javoblarni ko'rsatish</label>
      <label class="check"><input type="checkbox" id="f_act" ${d.is_active ? 'checked' : ''}> Faol (talabalar ko'radi)</label>
      <button class="btn block mt" id="f_save">Saqlash</button>
    `);
    $('f_save').addEventListener('click', async () => {
      const body = {
        title: $('f_title').value, subject: $('f_subject').value, description: $('f_desc').value,
        duration_min: $('f_dur').value, questions_per_attempt: $('f_qpa').value,
        pass_percent: $('f_pass').value,
        shuffle_questions: $('f_sq').checked, shuffle_options: $('f_so').checked,
        show_answers: $('f_sa').checked, is_active: $('f_act').checked,
      };
      try {
        if (t) await api('/api/admin/tests/' + t.id, { method: 'PUT', body: JSON.stringify(body) });
        else await api('/api/admin/tests', { method: 'POST', body: JSON.stringify(body) });
        closeModal(); msg('ok', 'Saqlandi'); loadAll();
      } catch (e) { msg('err', e.message); }
    });
  }
  $('newTestBtn').addEventListener('click', () => testForm(null));

  /* ----------------------------------------------------------- questions */
  async function loadQuestions() {
    const id = $('qTestSel').value;
    if (!id) { $('qList').innerHTML = '<div class="empty">Avval test yarating</div>'; return; }
    const qs = await api(`/api/admin/tests/${id}/questions`);
    $('qList').innerHTML = qs.length
      ? qs.map((q, i) => {
          const o = { A: q.opt_a, B: q.opt_b, C: q.opt_c, D: q.opt_d };
          return `<div class="review-item ok">
            <div style="display:flex;justify-content:space-between;gap:10px">
              <div class="q">${i + 1}. ${esc(q.text)}</div>
              <div style="white-space:nowrap">
                <button class="btn sm ghost" data-qe="${q.id}">✎</button>
                <button class="btn sm danger" data-qd="${q.id}">🗑</button>
              </div>
            </div>
            ${['A', 'B', 'C', 'D'].filter((L) => o[L]).map((L) =>
              `<div style="font-size:14px;color:${L === q.correct ? '#166534' : '#4b5563'};font-weight:${L === q.correct ? 600 : 400}">
                 ${L === q.correct ? '✔' : '•'} ${L}) ${esc(o[L])}</div>`).join('')}
          </div>`;
        }).join('')
      : '<div class="empty"><div class="ic">❓</div>Bu testda hali savol yo\'q</div>';

    $('qList').querySelectorAll('[data-qe]').forEach((b) =>
      b.addEventListener('click', () => qForm(qs.find((q) => q.id == b.dataset.qe))));
    $('qList').querySelectorAll('[data-qd]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Savol o\'chirilsinmi?')) return;
        await api('/api/admin/questions/' + b.dataset.qd, { method: 'DELETE' });
        loadQuestions(); loadTests(); loadStats();
      }));
  }
  $('qTestSel').addEventListener('change', loadQuestions);

  function qForm(q) {
    const d = q || { text: '', opt_a: '', opt_b: '', opt_c: '', opt_d: '', correct: 'A' };
    openModal(q ? 'Savolni tahrirlash' : 'Yangi savol', `
      <div class="field"><label>Savol matni *</label><textarea id="q_text" style="min-height:80px">${esc(d.text)}</textarea></div>
      ${['a', 'b', 'c', 'd'].map((L) => `
        <div class="field"><label>${L.toUpperCase()} variant${L === 'a' || L === 'b' ? ' *' : ''}</label>
        <input id="q_${L}" value="${esc(d['opt_' + L])}"></div>`).join('')}
      <div class="field"><label>To'g'ri javob *</label>
        <select id="q_correct">${['A', 'B', 'C', 'D'].map((L) =>
          `<option ${d.correct === L ? 'selected' : ''}>${L}</option>`).join('')}</select></div>
      <button class="btn block" id="q_save">Saqlash</button>
    `);
    $('q_save').addEventListener('click', async () => {
      const body = {
        text: $('q_text').value, opt_a: $('q_a').value, opt_b: $('q_b').value,
        opt_c: $('q_c').value, opt_d: $('q_d').value, correct: $('q_correct').value,
      };
      try {
        if (q) await api('/api/admin/questions/' + q.id, { method: 'PUT', body: JSON.stringify(body) });
        else await api(`/api/admin/tests/${$('qTestSel').value}/questions`, { method: 'POST', body: JSON.stringify(body) });
        closeModal(); msg('ok', 'Saqlandi'); loadQuestions(); loadTests(); loadStats();
      } catch (e) { msg('err', e.message); }
    });
  }
  $('addQBtn').addEventListener('click', () => { if ($('qTestSel').value) qForm(null); else msg('err', 'Avval test yarating'); });
  $('clearQBtn').addEventListener('click', async () => {
    const id = $('qTestSel').value;
    if (!id || !confirm('Ushbu testdagi BARCHA savollar o\'chiriladi. Davom etasizmi?')) return;
    await api(`/api/admin/tests/${id}/questions`, { method: 'DELETE' });
    msg('ok', 'Savollar o\'chirildi'); loadQuestions(); loadTests(); loadStats();
  });

  /* -------------------------------------------------------------- import */
  function renderPreview(data) {
    pendingImport = data.questions;
    if (!data.count) {
      $('preview').innerHTML = '<div class="alert err show mt">Savol topilmadi. Fayl formatini tekshiring yoki yuqoridagi namunalarga moslang.</div>';
      return;
    }
    $('preview').innerHTML = `
      <div class="alert ok show mt"><b>${data.count} ta savol topildi.</b> Quyida tekshiring — to'g'ri javoblarni o'zgartirishingiz mumkin.</div>
      <div id="prevList">${data.questions.map((q, i) => `
        <div class="review-item ok">
          <div class="q">${i + 1}. ${esc(q.text)}</div>
          ${['a', 'b', 'c', 'd'].filter((L) => q['opt_' + L]).map((L) =>
            `<div style="font-size:14px">${L.toUpperCase()}) ${esc(q['opt_' + L])}</div>`).join('')}
          <div style="margin-top:8px;display:flex;align-items:center;gap:8px">
            <span class="muted">To'g'ri javob:</span>
            <select data-i="${i}" style="width:auto;padding:5px 10px">
              ${['A', 'B', 'C', 'D'].map((L) => `<option ${q.correct === L ? 'selected' : ''}>${L}</option>`).join('')}
            </select>
          </div>
        </div>`).join('')}</div>
      <button class="btn block mt" id="saveImport">✓ ${data.count} ta savolni testga qo'shish</button>`;

    $('preview').querySelectorAll('select[data-i]').forEach((s) =>
      s.addEventListener('change', () => { pendingImport[s.dataset.i].correct = s.value; }));

    $('saveImport').addEventListener('click', async () => {
      const testId = $('impTestSel').value;
      if (!testId) return msg('err', 'Avval test yarating');
      const btn = $('saveImport'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Saqlanmoqda…';
      try {
        const r = await api(`/api/admin/tests/${testId}/questions`, { method: 'POST', body: JSON.stringify(pendingImport) });
        msg('ok', `${r.added} ta savol qo'shildi`);
        $('preview').innerHTML = ''; $('impFile').value = ''; $('impText').value = '';
        loadAll();
      } catch (e) { msg('err', e.message); btn.disabled = false; btn.textContent = 'Qayta urinish'; }
    });
  }

  $('impBtn').addEventListener('click', async () => {
    const f = $('impFile').files[0];
    if (!f) return msg('err', 'Fayl tanlang');
    const fd = new FormData(); fd.append('file', f);
    const btn = $('impBtn'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> Tahlil qilinmoqda…';
    try { renderPreview(await api('/api/admin/import/preview', { method: 'POST', body: fd })); }
    catch (e) { msg('err', e.message); }
    finally { btn.disabled = false; btn.textContent = 'Faylni tahlil qilish'; }
  });

  $('impTextBtn').addEventListener('click', async () => {
    const text = $('impText').value.trim();
    if (!text) return msg('err', 'Matn kiriting');
    try { renderPreview(await api('/api/admin/import/text', { method: 'POST', body: JSON.stringify({ text }) })); }
    catch (e) { msg('err', e.message); }
  });

  /* ------------------------------------------------------------- results */
  let lastResults = [];

  /** Matnni buferga nusxalash (https bo'lmagan lokal tarmoqda ham ishlaydi) */
  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch (e) {}
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    } catch (e) { return false; }
  }

  async function loadResults() {
    const params = new URLSearchParams();
    if ($('resTestSel').value) params.set('testId', $('resTestSel').value);
    if ($('resSearch').value.trim()) params.set('q', $('resSearch').value.trim());
    const rows = await api('/api/admin/results?' + params);
    lastResults = rows;
    $('resBody').innerHTML = rows.length
      ? rows.map((r, i) => `<tr>
          <td>${i + 1}</td>
          <td><b>${esc(r.last_name)} ${esc(r.first_name)}</b><br><span class="muted">${esc(r.middle_name)}</span></td>
          <td>${esc(r.group_name)}</td>
          <td>${esc(r.test_title)}</td>
          <td style="color:#16a34a;font-weight:600">${r.correct_count}</td>
          <td style="color:#dc2626;font-weight:600">${r.wrong_count}</td>
          <td><b>${r.percent}%</b></td>
          <td>${r.grade}</td>
          <td>${r.passed ? '<span class="badge ok">O\'tdi</span>' : '<span class="badge bad">O\'tmadi</span>'}
              ${r.status === 'timeout' ? ' <span class="badge gray">vaqt tugadi</span>' : ''}</td>
          <td class="muted" style="white-space:nowrap">${r.finished_at ? new Date(r.finished_at).toLocaleString('uz-UZ') : '-'}</td>
          <td style="white-space:nowrap">
            <button class="btn sm ghost" data-rv="${r.id}" title="Batafsil ko'rish">👁</button>
            <button class="btn sm danger" data-rd="${r.id}">🗑</button></td>
        </tr>`).join('')
      : '<tr><td colspan="11" class="empty">Hali natija yo\'q</td></tr>';

    $('resBody').querySelectorAll('[data-rv]').forEach((b) =>
      b.addEventListener('click', () => showResult(b.dataset.rv)));

    $('resBody').querySelectorAll('[data-rd]').forEach((b) =>
      b.addEventListener('click', async () => {
        if (!confirm('Natija o\'chirilsinmi?')) return;
        await api('/api/admin/results/' + b.dataset.rd, { method: 'DELETE' });
        loadResults(); loadStats();
      }));
  }
  $('resRefresh').addEventListener('click', loadResults);
  $('resTestSel').addEventListener('change', loadResults);
  let t0; $('resSearch').addEventListener('input', () => { clearTimeout(t0); t0 = setTimeout(loadResults, 350); });
  $('resExport').addEventListener('click', () => {
    const p = $('resTestSel').value ? '?testId=' + $('resTestSel').value : '';
    location.href = '/api/admin/results/export.xlsx' + p;
  });

  /* Butun jadvalni matn qilib nusxalash (Excel/Word ga to'g'ridan-to'g'ri qo'yiladi) */
  $('resCopy').addEventListener('click', async () => {
    if (!lastResults.length) return msg('err', 'Nusxalash uchun natija yo\'q');
    const head = ["№", 'Familiya', 'Ism', 'Otasining ismi', 'Guruh', 'Test',
      'Jami', "To'g'ri", "Noto'g'ri", 'Foiz', 'Baho', 'Holat', 'Sana'].join('\t');
    const body = lastResults.map((r, i) => [
      i + 1, r.last_name, r.first_name, r.middle_name, r.group_name, r.test_title,
      r.total, r.correct_count, r.wrong_count, r.percent + '%', r.grade,
      r.passed ? "O'tdi" : "O'tmadi",
      r.finished_at ? new Date(r.finished_at).toLocaleString('uz-UZ') : '',
    ].join('\t')).join('\n');
    const ok = await copyText(head + '\n' + body);
    msg(ok ? 'ok' : 'err', ok
      ? `${lastResults.length} ta natija nusxalandi — Excel yoki Word'ga qo'ying (Cmd/Ctrl+V)`
      : 'Nusxalab bo\'lmadi, «⬇ Excel» tugmasidan foydalaning');
  });

  /* Bitta talabaning to'liq natijasi */
  async function showResult(id) {
    try {
      const d = await api('/api/admin/results/' + id);
      const fio = `${d.student.last} ${d.student.first} ${d.student.middle}`;
      const rows = d.detail.map((q) => {
        const g = q.given ? `${q.given}) ${esc(q.options[q.given] || '')}` : 'javob berilmagan';
        const c = `${q.correct}) ${esc(q.options[q.correct] || '')}`;
        return `<div class="review-item ${q.ok ? 'ok' : 'bad'}">
          <div class="q">${q.n}. ${esc(q.text)}</div>
          <span class="a ${q.ok ? 'good' : 'wrong'}">Javobi: ${g}</span>
          ${q.ok ? '' : `<span class="a good">To'g'ri: ${c}</span>`}
        </div>`;
      }).join('');

      openModal(fio, `
        <div class="stat-grid" style="margin-top:0">
          <div class="stat good"><div class="v">${d.correct}</div><div class="k">To'g'ri</div></div>
          <div class="stat bad"><div class="v">${d.wrong}</div><div class="k">Noto'g'ri</div></div>
          <div class="stat"><div class="v">${d.total}</div><div class="k">Jami</div></div>
          <div class="stat brand"><div class="v">${d.percent}%</div><div class="k">Baho: ${d.grade}</div></div>
        </div>
        <p class="muted">${esc(d.student.group)} guruh · ${esc(d.test)} ·
          ${d.finishedAt ? new Date(d.finishedAt).toLocaleString('uz-UZ') : ''}
          ${d.status === 'timeout' ? ' · <b>vaqt tugagan</b>' : ''}</p>
        <button class="btn ghost sm" id="copyOne">📋 Nusxa olish</button>
        <div class="mt">${rows || '<div class="muted">Javoblar saqlanmagan</div>'}</div>
      `);

      $('copyOne').addEventListener('click', async () => {
        const lines = [
          `F.I.O: ${fio}`,
          `Guruh: ${d.student.group}`,
          `Test: ${d.test}`,
          `Natija: ${d.correct} to'g'ri / ${d.wrong} noto'g'ri (jami ${d.total})`,
          `Foiz: ${d.percent}%   Baho: ${d.grade}`,
          `Sana: ${d.finishedAt ? new Date(d.finishedAt).toLocaleString('uz-UZ') : '-'}`,
          '',
          ...d.detail.map((q) =>
            `${q.n}. ${q.text}\n   Javobi: ${q.given || '—'}${q.ok ? ' ✔' : `  |  To'g'ri: ${q.correct}`}`),
        ].join('\n');
        const ok = await copyText(lines);
        msg(ok ? 'ok' : 'err', ok ? 'Nusxalandi' : 'Nusxalab bo\'lmadi');
      });
    } catch (e) { msg('err', e.message); }
  }

  /* ------------------------------------------------------------ ulanish */
  async function loadLan() {
    try {
      const d = await api('/api/admin/lan');
      const links = (d.urls.length ? d.urls : [d.publicUrl])
        .map((u) => `<div style="font-size:21px;font-weight:700;margin:6px 0">
             <a href="${esc(u)}" target="_blank">${esc(u)}</a></div>`).join('');
      $('lanBox').innerHTML =
        links +
        (d.qr ? `<img src="${d.qr}" alt="QR" style="margin-top:14px;border:1px solid var(--line);border-radius:12px">
                 <div class="muted">Telefon kamerasi bilan skanerlang</div>` : '');
    } catch (e) { $('lanBox').innerHTML = '<div class="muted">Manzillarni olib bo\'lmadi</div>'; }
  }

  /* ---------------------------------------------------------------- init */
  async function loadAll() {
    await loadTests();
    await loadStats();
    if ($('p-questions').classList.contains('active')) loadQuestions();
    if ($('p-results').classList.contains('active')) loadResults();
  }

  api('/api/admin/me').then(showApp).catch(showLogin);
})();
