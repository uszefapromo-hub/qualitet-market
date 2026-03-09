document.addEventListener('DOMContentLoaded', () => {
  const hero = document.getElementById('shop-hero');
  const products = document.getElementById('shop-products');
  if(!hero || !products) return;

  const store = window.QM.getActiveStore();
  const margin = Number(store.margin || window.QM.getMargin());
  hero.innerHTML = `
    <div class="shop-banner">
      <img src="${store.logo || 'logo-uszefa.svg'}" alt="Logo sklepu">
      <div>
        <h2>${store.name}</h2>
        <p>${store.niche || 'Sprzedaż wielobranżowa'} • plan ${String(store.plan).toUpperCase()} • motyw ${store.theme}</p>
      </div>
    </div>`;

  const imported = Object.values(window.QM.read(window.QM.KEYS.products, {})).flat();
  const demo = imported.length ? imported : [
    {name:'Starter biznesowy', cost:39},
    {name:'Pakiet wzrostu', cost:59},
    {name:'Zestaw premium', cost:129},
  ];
  products.innerHTML = demo.slice(0,6).map((p, idx) => {
    const price = p.cost * (1 + margin/100);
    return `
      <article class="product-card">
        <span class="eyebrow">Oferta ${idx+1}</span>
        <h3>${p.name}</h3>
        <p class="price">${window.QM.money(price)}</p>
        <p>Koszt bazowy: ${window.QM.money(p.cost)}</p>
        <button class="btn btn-primary" data-add='${JSON.stringify({id:`p${idx}`, name:p.name, price:Math.round(price), qty:1})}'>Dodaj do koszyka</button>
      </article>`;
  }).join('');

  products.querySelectorAll('[data-add]').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = JSON.parse(btn.getAttribute('data-add'));
      const cart = window.QM.cart();
      const existing = cart.find(x => x.id === item.id);
      if(existing) existing.qty += 1; else cart.push(item);
      window.QM.write(window.QM.KEYS.cart, cart);
      alert('Dodano do koszyka.');
    });
  });
});
