
document.addEventListener('DOMContentLoaded', () => {
  const root = document.getElementById('suppliers-list');
  if(!root) return;
  const suppliers = [
    {id:'eu-home', name:'EU Home Supply', margin:22, qty:120, niche:'dom i ogród'},
    {id:'beauty-max', name:'Beauty Max', margin:35, qty:80, niche:'beauty'},
    {id:'techflow', name:'Tech Flow', margin:18, qty:50, niche:'elektronika'},
  ];
  root.innerHTML = suppliers.map(s => `
    <article class="supplier-card">
      <span class="eyebrow">${s.niche}</span>
      <h3>${s.name}</h3>
      <p>Średnia marża: ${s.margin}% • Dostępnych produktów: ${s.qty}</p>
      <button class="btn btn-primary" data-import="${s.id}">Importuj do systemu</button>
    </article>
  `).join('');

  root.querySelectorAll('[data-import]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-import');
      const map = window.QM.read(window.QM.KEYS.products, {});
      map[id] = [
        {name:'Produkt Start 1', cost:29, supplier:id},
        {name:'Produkt Start 2', cost:45, supplier:id},
        {name:'Produkt Start 3', cost:89, supplier:id},
      ];
      window.QM.write(window.QM.KEYS.products, map);
      window.QM.write(window.QM.KEYS.intel, {supplier:id, importedAt:new Date().toISOString()});
      window.QM.write(window.QM.KEYS.listing, {supplier:id, products: map[id].length});
      alert('Hurtownia zaimportowana.');
      location.href = 'dashboard.html';
    });
  });
});
