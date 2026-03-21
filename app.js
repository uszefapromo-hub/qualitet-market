(() => {
  const API_URL = 'https://dummyjson.com/products';
  const CART_KEY = 'qm_prod_cart';
  const ORDERS_KEY = 'qm_prod_orders';

  const FALLBACK_PRODUCTS = [
    {id:101,title:'Smartfon Pro Max',description:'Bestseller do sklepu z dobrą marżą.',price:2999,compareAt:3499,category:'smartfony',brand:'Qualitet',stock:18,image:'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=80'},
    {id:102,title:'Słuchawki ANC Elite',description:'Bezprzewodowe słuchawki z redukcją szumów.',price:449,compareAt:599,category:'audio',brand:'Qualitet',stock:26,image:'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=80'},
    {id:103,title:'Smartwatch Active',description:'Modny zegarek do codziennego użytku.',price:699,compareAt:899,category:'wearables',brand:'Qualitet',stock:21,image:'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80'},
    {id:104,title:'Głośnik Bluetooth Boom',description:'Głośnik mobilny idealny do social commerce.',price:279,compareAt:349,category:'audio',brand:'Qualitet',stock:30,image:'https://images.unsplash.com/photo-1589003077984-894e133dabab?auto=format&fit=crop&w=900&q=80'},
    {id:105,title:'Kamera Sportowa 4K',description:'Produkt premium do mocnych kampanii.',price:899,compareAt:1099,category:'elektronika',brand:'Qualitet',stock:9,image:'https://images.unsplash.com/photo-1502982720700-bfff97f2ecac?auto=format&fit=crop&w=900&q=80'},
    {id:106,title:'Powerbank 20000 mAh',description:'Pewny produkt do bundli i cross-sellu.',price:199,compareAt:249,category:'akcesoria',brand:'Qualitet',stock:33,image:'https://images.unsplash.com/photo-1583394838336-acd977736f90?auto=format&fit=crop&w=900&q=80'},
    {id:107,title:'Laptop Air 14',description:'Lekki laptop do pracy i nauki.',price:3699,compareAt:4199,category:'laptopy',brand:'Qualitet',stock:7,image:'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=80'},
    {id:108,title:'Mysz Gaming RGB',description:'Popularne akcesorium o wysokiej rotacji.',price:149,compareAt:199,category:'akcesoria',brand:'Qualitet',stock:40,image:'https://images.unsplash.com/photo-1527814050087-3793815479db?auto=format&fit=crop&w=900&q=80'}
  ];

  const state = {
    products: [],
    filtered: [],
    cart: safeJson(localStorage.getItem(CART_KEY), [])
  };

  const els = {
    productsGrid: document.getElementById('productsGrid'),
    productsInfo: document.getElementById('productsInfo'),
    categorySelect: document.getElementById('categorySelect'),
    sortSelect: document.getElementById('sortSelect'),
    searchInput: document.getElementById('searchInput'),
    statusBox: document.getElementById('statusBox'),
    sourceLabel: document.getElementById('sourceLabel'),
    statProducts: document.getElementById('statProducts'),
    statCartCount: document.getElementById('statCartCount'),
    statCartTotal: document.getElementById('statCartTotal'),
    statMode: document.getElementById('statMode'),
    cartItems: document.getElementById('cartItems'),
    sumItems: document.getElementById('sumItems'),
    sumSubtotal: document.getElementById('sumSubtotal'),
    sumShipping: document.getElementById('sumShipping'),
    sumTotal: document.getElementById('sumTotal'),
    customerName: document.getElementById('customerName'),
    customerEmail: document.getElementById('customerEmail'),
    customerAddress: document.getElementById('customerAddress'),
    checkoutStatus: document.getElementById('checkoutStatus'),
    reloadProductsBtn: document.getElementById('reloadProductsBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    clearCartBtn: document.getElementById('clearCartBtn'),
    checkoutBtn: document.getElementById('checkoutBtn'),
    scrollCartBtn: document.getElementById('scrollCartBtn'),
    cartPanel: document.getElementById('cartPanel')
  };

  function safeJson(value, fallback){
    try {
      return value ? JSON.parse(value) : fallback;
    } catch {
      return fallback;
    }
  }

  function currency(value){
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      maximumFractionDigits: 2
    }).format(Number(value || 0));
  }

  function escapeHtml(value = ''){
    return String(value).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  function setStatus(message, type = 'ok', target = els.statusBox){
    if (!target) return;
    target.textContent = message;
    target.className = 'status show ' + (type === 'err' ? 'err' : 'ok');
    window.setTimeout(() => target.classList.remove('show'), 2600);
  }

  function withTimeout(promise, ms){
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
    ]);
  }

  function normalizeProduct(p, i = 0){
    const rawPrice = Number(p.price || 0);
    const price = rawPrice > 100 ? rawPrice : Math.round(rawPrice * 4.2 * 100) / 100;
    const compareAt = Number(
      p.compareAt ||
      p.compare_at ||
      Math.round(price * 1.18 * 100) / 100
    );

    return {
      id: p.id || ('p-' + i),
      title: p.title || p.name || ('Produkt ' + (i + 1)),
      description: p.description || 'Produkt gotowy do sprzedaży.',
      price,
      compareAt,
      category: p.category || 'ogólne',
      brand: p.brand || 'API',
      stock: Number(p.stock || 99),
      image: p.image || p.thumbnail || (Array.isArray(p.images) ? p.images[0] : '') || 'https://via.placeholder.com/600x600?text=Produkt'
    };
  }

  async function loadProducts(){
    if (els.productsGrid) {
      els.productsGrid.innerHTML = '<div class="empty">Ładowanie produktów...</div>';
    }
    if (els.productsInfo) {
      els.productsInfo.textContent = 'Ładowanie...';
    }

    try {
      const response = await withTimeout(fetch(API_URL, {
        method: 'GET',
        mode: 'cors',
        cache: 'no-store'
      }), 3000);

      if (!response.ok) {
        throw new Error('HTTP ' + response.status);
      }

      const data = await response.json();
      const rows = Array.isArray(data.products) ? data.products.map(normalizeProduct) : [];
      if (!rows.length) {
        throw new Error('Brak produktów');
      }

      state.products = rows.slice(0, 24);
      if (els.statMode) els.statMode.textContent = 'LIVE';
      if (els.sourceLabel) els.sourceLabel.textContent = 'publiczne API';
      setStatus('Produkty pobrane z API.');
    } catch (error) {
      state.products = FALLBACK_PRODUCTS.map(normalizeProduct);
      if (els.statMode) els.statMode.textContent = 'FALLBACK';
      if (els.sourceLabel) els.sourceLabel.textContent = 'lokalne produkty awaryjne';
      setStatus('API nie odpowiedziało. Wczytano lokalne produkty.', 'err');
    }

    state.filtered = [...state.products];
    hydrateCategories();
    applyFilters();

    if (els.statProducts) {
      els.statProducts.textContent = String(state.products.length);
    }
  }

  function hydrateCategories(){
    if (!els.categorySelect) return;
    const categories = [...new Set(state.products.map((p) => p.category))].sort((a, b) => a.localeCompare(b, 'pl'));
    els.categorySelect.innerHTML = '<option value="">Wszystkie kategorie</option>' +
      categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
  }

  function applyFilters(){
    const q = (els.searchInput?.value || '').trim().toLowerCase();
    const cat = els.categorySelect?.value || '';
    const sort = els.sortSelect?.value || 'featured';

    let rows = state.products.filter((p) => {
      const haystack = `${p.title} ${p.description} ${p.brand} ${p.category}`.toLowerCase();
      return (!q || haystack.includes(q)) && (!cat || p.category === cat);
    });

    if (sort === 'price-asc') rows.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') rows.sort((a, b) => b.price - a.price);
    if (sort === 'name-asc') rows.sort((a, b) => a.title.localeCompare(b.title, 'pl'));
    if (sort === 'featured') rows.sort((a, b) => (b.compareAt - b.price) - (a.compareAt - a.price));

    state.filtered = rows;
    renderProducts();
  }

  function renderProducts(){
    if (els.productsInfo) {
      els.productsInfo.textContent = `Pokazuję ${state.filtered.length} z ${state.products.length} produktów`;
    }

    if (!els.productsGrid) return;

    if (!state.filtered.length) {
      els.productsGrid.innerHTML = '<div class="empty">Brak produktów dla wybranych filtrów.</div>';
      return;
    }

    els.productsGrid.innerHTML = state.filtered.map((p) => `
      <article class="product-card">
        <div class="product-media">
          <img src="${escapeHtml(p.image)}" alt="${escapeHtml(p.title)}" loading="lazy">
        </div>
        <div class="product-body">
          <div class="chips">
            <span class="chip">${escapeHtml(p.category)}</span>
            <span class="chip">${escapeHtml(p.brand)}</span>
            <span class="chip">Stan: ${Math.max(0, p.stock)}</span>
          </div>
          <div class="product-title">${escapeHtml(p.title)}</div>
          <div class="product-desc">${escapeHtml((p.description || '').slice(0, 90))}</div>
          <div>
            <span class="product-price">${currency(p.price)}</span>
            ${p.compareAt > p.price ? `<span class="product-old">${currency(p.compareAt)}</span>` : ''}
          </div>
          <div class="product-actions">
            <input class="field qty-input" type="number" min="1" max="${Math.max(1, p.stock)}" value="1" id="qty-${p.id}">
            <button class="btn btn-primary" type="button" data-add-id="${String(p.id)}">Dodaj</button>
          </div>
        </div>
      </article>
    `).join('');

    els.productsGrid.querySelectorAll('[data-add-id]').forEach((btn) => {
      btn.addEventListener('click', () => addToCart(btn.getAttribute('data-add-id')));
    });
  }

  function saveCart(){
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
    renderCart();
  }

  function addToCart(productId){
    const product = state.products.find((p) => String(p.id) === String(productId));
    if (!product) return;

    const qtyInput = document.getElementById(`qty-${product.id}`);
    const qty = Math.max(1, Number(qtyInput?.value || 1));
    const existing = state.cart.find((item) => String(item.id) === String(product.id));

    if (existing) {
      existing.qty += qty;
    } else {
      state.cart.push({ ...product, qty });
    }

    saveCart();
    setStatus(`Dodano do koszyka: ${product.title}`);
  }

  function removeFromCart(productId){
    state.cart = state.cart.filter((item) => String(item.id) !== String(productId));
    saveCart();
  }

  function changeQty(productId, qty){
    const item = state.cart.find((i) => String(i.id) === String(productId));
    if (!item) return;
    item.qty = Math.max(1, Number(qty || 1));
    saveCart();
  }

  function renderCart(){
    if (!els.cartItems) return;

    if (!state.cart.length) {
      els.cartItems.innerHTML = '<div class="empty">Koszyk jest pusty.</div>';
    } else {
      els.cartItems.innerHTML = state.cart.map((item) => `
        <div class="cart-item">
          <img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.title)}">
          <div>
            <span class="cart-item-title">${escapeHtml(item.title)}</span>
            <div class="cart-price">${currency(item.price)} / szt.</div>
            <input
              class="field"
              style="width:74px;padding:8px 10px;margin-top:6px"
              type="number"
              min="1"
              value="${item.qty}"
              data-qty-id="${String(item.id)}"
            >
          </div>
          <div style="text-align:right">
            <strong>${currency(item.price * item.qty)}</strong>
            <button class="icon-btn" type="button" data-remove-id="${String(item.id)}">✕</button>
          </div>
        </div>
      `).join('');

      els.cartItems.querySelectorAll('[data-remove-id]').forEach((btn) => {
        btn.addEventListener('click', () => removeFromCart(btn.getAttribute('data-remove-id')));
      });

      els.cartItems.querySelectorAll('[data-qty-id]').forEach((input) => {
        input.addEventListener('change', () => changeQty(input.getAttribute('data-qty-id'), input.value));
      });
    }

    const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = count ? 19.99 : 0;
    const total = subtotal + shipping;

    if (els.sumItems) els.sumItems.textContent = String(count);
    if (els.sumSubtotal) els.sumSubtotal.textContent = currency(subtotal);
    if (els.sumShipping) els.sumShipping.textContent = currency(shipping);
    if (els.sumTotal) els.sumTotal.textContent = currency(total);
    if (els.statCartCount) els.statCartCount.textContent = String(count);
    if (els.statCartTotal) els.statCartTotal.textContent = currency(total);
  }

  function checkout(){
    if (!state.cart.length) {
      return setStatus('Koszyk jest pusty.', 'err', els.checkoutStatus);
    }

    const name = (els.customerName?.value || '').trim();
    const email = (els.customerEmail?.value || '').trim();
    const address = (els.customerAddress?.value || '').trim();

    if (!name || !email || !address) {
      return setStatus('Uzupełnij dane do zamówienia.', 'err', els.checkoutStatus);
    }

    const subtotal = state.cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    const shipping = state.cart.length ? 19.99 : 0;

    const order = {
      id: 'QM-' + Date.now(),
      name,
      email,
      address,
      items: state.cart,
      total: subtotal + shipping,
      created_at: new Date().toISOString()
    };

    const orders = safeJson(localStorage.getItem(ORDERS_KEY), []);
    orders.unshift(order);
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));

    state.cart = [];
    saveCart();

    if (els.customerName) els.customerName.value = '';
    if (els.customerEmail) els.customerEmail.value = '';
    if (els.customerAddress) els.customerAddress.value = '';

    setStatus(`Zamówienie zapisane. ID: ${order.id}`, 'ok', els.checkoutStatus);
  }

  function resetFilters(){
    if (els.searchInput) els.searchInput.value = '';
    if (els.categorySelect) els.categorySelect.value = '';
    if (els.sortSelect) els.sortSelect.value = 'featured';
    applyFilters();
  }

  els.searchInput?.addEventListener('input', applyFilters);
  els.categorySelect?.addEventListener('change', applyFilters);
  els.sortSelect?.addEventListener('change', applyFilters);
  els.reloadProductsBtn?.addEventListener('click', loadProducts);
  els.resetFiltersBtn?.addEventListener('click', resetFilters);
  els.clearCartBtn?.addEventListener('click', () => {
    state.cart = [];
    saveCart();
  });
  els.checkoutBtn?.addEventListener('click', checkout);
  els.scrollCartBtn?.addEventListener('click', () => {
    els.cartPanel?.scrollIntoView({ behavior: 'smooth' });
  });

  renderCart();
  loadProducts();
})();
