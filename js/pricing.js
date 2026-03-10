
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-plan-select]').forEach(btn => {
    btn.addEventListener('click', () => {
      const plan = btn.getAttribute('data-plan-select');
      window.QM.setActivePlan(plan);
      alert(`Plan ${plan.toUpperCase()} ustawiony.`);
      location.reload();
    });
  });
});
