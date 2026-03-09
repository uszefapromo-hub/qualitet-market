document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;
  const plan = QM.getPlan();
  const rank = { basic: 1, pro: 2, elite: 3 };

  document.querySelectorAll('[data-require]').forEach(el => {
    const req = el.getAttribute('data-require');
    if ((rank[plan] || 1) < (rank[req] || 1)) {
      el.classList.add('disabled-plan');
      if (el.tagName === 'A') el.href = 'cennik.html';
      el.addEventListener('click', (e) => {
        e.preventDefault();
        alert(`Ta opcja wymaga planu ${req.toUpperCase()}.`);
      });
    }
  });

  document.querySelectorAll('[data-current-plan]').forEach(el => {
    el.textContent = plan.toUpperCase();
  });
});
