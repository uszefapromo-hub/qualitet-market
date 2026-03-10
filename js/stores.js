
document.addEventListener('DOMContentLoaded', () => {
  const card = document.getElementById('active-store-card');
  if (!card) return;

  const store = window.QM.getActiveStore();
  const margin = window.QM.getMargin();

  card.innerHTML = `
    <h3>Aktywny sklep</h3>
    <div class="shop-banner" style="margin-bottom:14px">
      <img src="${store.logo || 'assets/logo-uszefa.svg'}" alt="Logo sklepu">
      <div>
        <strong>${store.name}</strong>
        <div>${store.niche || 'Sprzedaż wielobranżowa'}</div>
      </div>
    </div>
    <div class="kv"><span>Plan</span><strong>${String(store.plan || 'basic').toUpperCase()}</strong></div>
    <div class="kv"><span>Motyw</span><strong>${store.theme || 'clean'}</strong></div>
    <div class="kv"><span>Marża</span><strong>${margin}%</strong></div>
    <div class="kv"><span>ID sklepu</span><strong>${store.id}</strong></div>
  `;
});
