document.addEventListener('DOMContentLoaded', () => {
  const card = document.getElementById('active-store-card');
  if (!card) return;
  const store = window.QM.getActiveStore();
  card.innerHTML = `
    <h3>${store.name}</h3>
    <div class="kv"><span>Plan</span><strong>${String(store.plan).toUpperCase()}</strong></div>
    <div class="kv"><span>Motyw</span><strong>${store.theme}</strong></div>
    <div class="kv"><span>Marża</span><strong>${store.margin}%</strong></div>
    <div class="kv"><span>Nisza</span><strong>${store.niche || 'Sprzedaż wielobranżowa'}</strong></div>
  `;
});
