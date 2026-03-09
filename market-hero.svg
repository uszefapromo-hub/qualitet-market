document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;
  document.querySelectorAll('[data-plan-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.getAttribute('data-plan-select');
      QM.setPlan(plan);
      alert('Plan ustawiony: ' + plan.toUpperCase());
      location.href = 'dashboard.html';
    });
  });
});
