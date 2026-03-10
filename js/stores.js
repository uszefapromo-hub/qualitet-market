document.addEventListener('DOMContentLoaded', () => {
  const activeStoreCard = document.getElementById('active-store-card');
  if (activeStoreCard) {
    const store = window.QM.getActiveStore();
    activeStoreCard.innerHTML = `
      <h3>Aktywny sklep</h3>
      <div class="kv"><span>Nazwa</span><strong>${store.name || 'Brak sklepu'}</strong></div>
      <div class="kv"><span>Plan</span><strong>${String(store.plan || 'basic').toUpperCase()}</strong></div>
      <div class="kv"><span>Marża</span><strong>${store.margin || window.QM.getMargin()}%</strong></div>
    `;
  }

  const storesCountEls = document.querySelectorAll('[data-stores-count]');
  const marginEls = document.querySelectorAll('[data-margin-default]');
  const intelEl = document.querySelector('[data-intel-status]');
  const crmEl = document.querySelector('[data-crm-status]');
  const fillIntelBtn = document.querySelector('[data-fill-intel]');
  const fillCrmBtn = document.querySelector('[data-fill-crm]');

  if (storesCountEls.length) {
    storesCountEls.forEach(el => { el.textContent = window.QM.stores().length; });
  }
  if (marginEls.length) {
    marginEls.forEach(el => { el.textContent = window.QM.getMargin() + '%'; });
  }
  if (intelEl) {
    const intel = window.QM.read(window.QM.KEYS.intel, null);
    intelEl.textContent = intel ? 'Gotowe (' + (intel.supplier || '') + ')' : 'Brak';
  }
  if (crmEl) {
    const crm = window.QM.read(window.QM.KEYS.crm, null);
    crmEl.textContent = crm ? 'Uzupełnione' : 'Puste';
  }
  if (fillIntelBtn) {
    fillIntelBtn.addEventListener('click', () => {
      window.QM.write(window.QM.KEYS.intel, { supplier: 'demo', importedAt: new Date().toISOString() });
      alert('Dane startowe ustawione.');
      location.reload();
    });
  }
  if (fillCrmBtn) {
    fillCrmBtn.addEventListener('click', () => {
      window.QM.write(window.QM.KEYS.crm, [{ name: 'Klient demo', email: 'demo@example.com' }]);
      alert('Wzór CRM utworzony.');
      location.reload();
    });
  }
});
