document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;

  const grid = document.getElementById('products-grid');
  const q = document.getElementById('search-q');
  const cat = document.getElementById('filter-category');
  const sort = document.getElementById('sort-by');
  const marginBadge = document.getElementById('margin-badge');
  const storeBadge = document.getElementById('active-store-badge');

  function render(){
    if(!grid) return;
    const items = QM.getProducts().slice();
    const margin = QM.getStoreMargin();
    if(marginBadge) marginBadge.textContent = 'Marża: ' + margin + '%';
    if(storeBadge) storeBadge.textContent = 'Sklep: ' + QM.getActiveStoreSlug();

    let filtered = items.filter(item => {
      const byText = !q?.value || item.name.toLowerCase().includes(q.value.toLowerCase());
      const byCat = !cat?.value || cat.value === 'all' || item.category === cat.value;
      return byText && byCat;
    });

    if(sort?.value === 'price-asc') filtered.sort((a,b)=>a.price-b.price);
    if(sort?.value === 'price-desc') filtered.sort((a,b)=>b.price-a.price);
    if(sort?.value === 'name-asc') filtered.sort((a,b)=>a.name.localeCompare(b.name,'pl'));

    if(!filtered.length){
      grid.innerHTML = '<div class="card pad center">Brak produktów. Wejdź do hurtownie.html i zaimportuj produkty.</div>';
      return;
    }

    grid.innerHTML = filtered.map(item => {
      const finalPrice = QM.marginPrice(item.price, margin);
      return `
        <article class="product-card">
          <div class="product-media">${item.img || '📦'}</div>
          <div class="product-body">
            <div class="product-top">
              <span class="badge">${item.supplier || 'Supplier'}</span>
              <span class="store-pill">${item.category || 'Produkt'}</span>
            </div>
            <h3>${item.name}</h3>
            <div class="muted">Cena bazowa: ${QM.money(item.price)}</div>
            <div class="product-price">${QM.money(finalPrice)}</div>
            <div class="product-actions">
              <button class="btn primary" data-add-cart="${item.id}">Dodaj do koszyka</button>
              <a class="btn" href="koszyk.html">Koszyk</a>
            </div>
          </div>
        </article>
      `;
    }).join('');

    grid.querySelectorAll('[data-add-cart]').forEach(btn => {
      btn.addEventListener('click', () => addToCart(btn.getAttribute('data-add-cart')));
    });
  }

  function addToCart(id){
    const product = QM.getProducts().find(p => p.id === id);
    if(!product) return;
    const margin = QM.getStoreMargin();
    const cart = QM.getCart();
    const existing = cart.find(i => i.id === id);
    if(existing){
      existing.qty += 1;
    } else {
      cart.push({...product, qty:1, finalPrice: QM.marginPrice(product.price, margin)});
    }
    QM.setCart(cart);
    alert('Dodano do koszyka');
  }

  [q, cat, sort].forEach(el => el && el.addEventListener('input', render));
  render();
});
