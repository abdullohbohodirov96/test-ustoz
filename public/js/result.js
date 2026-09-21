(function () {
  const $ = (id) => document.getElementById(id);
  const ref = JSON.parse(sessionStorage.getItem('result') || 'null');
  if (!ref) { location.href = '/'; return; }

  function esc(s) {
    return String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  const GRADE_TEXT = { 5: "A'lo", 4: 'Yaxshi', 3: 'Qoniqarli', 2: 'Qoniqarsiz' };

  fetch(`/api/attempts/${ref.id}/result`, { headers: { 'X-Attempt-Token': ref.token } })
    .then((r) => r.json().then((d) => { if (!r.ok) throw new Error(d.error); return d; }))
    .then(render)
    .catch((e) => {
      const el = $('err'); el.textContent = e.message || 'Natijani yuklab bo\'lmadi'; el.classList.add('show');
    });

  function render(d) {
    const fio = `${d.student.last} ${d.student.first} ${d.student.middle}`;

    $('percent').textContent = d.percent + '%';
    $('circle').classList.toggle('fail', !d.passed);
    $('verdict').textContent = d.passed ? '🎉 Test muvaffaqiyatli yakunlandi!' : 'Test yakunlandi';
    $('who').textContent = `${fio} · ${d.student.group} guruh · ${d.test.title}`;

    $('sCorrect').textContent = d.correct;
    $('sWrong').textContent = d.wrong;
    $('sTotal').textContent = d.total;
    $('sGrade').textContent = d.grade;

    if (d.telegram) $('tgNote').style.display = 'block';

    // sertifikat
    $('cName').textContent = fio;
    $('cGroup').textContent = `${d.student.group} guruh talabasi`;
    $('cTest').textContent = d.test.title;
    $('cScore').textContent = `${d.total} ta savoldan ${d.correct} tasiga to'g'ri javob berdi (${d.percent}%)`;
    $('cGrade').textContent = `Baho: ${d.grade} — ${GRADE_TEXT[d.grade] || ''}`;
    $('cDate').textContent = new Date(d.finishedAt || Date.now()).toLocaleString('uz-UZ');
    document.title = `Natija — ${fio}`;

    if (d.showAnswers && d.detail && d.detail.length) {
      $('reviewCard').style.display = 'block';
      $('review').innerHTML = d.detail
        .map((q) => {
          const opts = q.options;
          const givenTxt = q.given ? `${q.given}) ${esc(opts[q.given] || '')}` : 'Javob berilmagan';
          const corrTxt = `${q.correct}) ${esc(opts[q.correct] || '')}`;
          return `<div class="review-item ${q.ok ? 'ok' : 'bad'}">
            <div class="q">${q.n}. ${esc(q.text)}</div>
            <span class="a ${q.ok ? 'good' : 'wrong'}">Sizning javobingiz: ${givenTxt}</span>
            ${q.ok ? '' : `<span class="a good">To'g'ri javob: ${corrTxt}</span>`}
          </div>`;
        })
        .join('');
    }
  }
})();
