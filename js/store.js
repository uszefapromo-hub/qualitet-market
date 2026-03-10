
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('store-form');
  const preview = document.querySelector('[data-store-preview]');
  if(!form) return;

  const updatePreview = () => {
    const data = new FormData(form);
    const name = data.get('name') || 'Twój sklep';
    const niche = data.get('niche') || 'Wybierz niszę';
    const logo = data.get('logo') || 'assets/logo-qualitet.svg';
    const plan = String(data.get('plan') || 'basic').toUpperCase();
    const theme = data.get('theme') || 'clean';
    preview.innerHTML = `<img src="${logo}" alt="logo"><strong>${name}</strong><span>${niche}</span><span>Plan ${plan} • motyw ${theme}</span>`;
  };

  form.addEventListener('input', updatePreview);
  updatePreview();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const stores = window.QM.stores();
    const store = {
      id: `store-${Date.now()}`,
      name: data.get('name'),
      niche: data.get('niche'),
      logo: data.get('logo') || 'assets/logo-uszefa.svg',
      logoName: (data.get('logo') || '').split('/').pop() || 'domyślne',
      plan: data.get('plan'),
      theme: data.get('theme'),
      margin: Number(data.get('margin') || 20)
    };
    stores.push(store);
    window.QM.write(window.QM.KEYS.stores, stores);
    localStorage.setItem(window.QM.KEYS.activeStore, store.id);
    localStorage.setItem(window.QM.KEYS.margin, String(store.margin));
    localStorage.setItem(window.QM.KEYS.plan, store.plan);
    alert('Sklep zapisany. Możesz wejść do panelu sklepu.');
    location.href = 'panel-sklepu.html';
  });
});
