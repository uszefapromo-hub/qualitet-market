document.addEventListener('DOMContentLoaded', () => {
  const card = document.getElementById('active-store-card');
  if (!card) return;
  const store = window.QM.getActiveStore();
  card.innerHTML = `
    <h3>Aktywny sklep</h3>
    <div class="kv"><span>Nazwa</span><strong>${store.name}</strong></div>
    <div class="kv"><span>Nisza</span><strong>${store.niche || 'Sprzedaż wielobranżowa'}</strong></div>
    <div class="kv"><span>Plan</span><strong>${String(store.plan || 'basic').toUpperCase()}</strong></div>
    <div class="kv"><span>Motyw</span><strong>${store.theme || 'clean'}</strong></div>
    <div class="kv"><span>Marża</span><strong>${store.margin || 20}%</strong></div>
  `;
});
