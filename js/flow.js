/**
 * flow.js – Page flow coordinator
 *
 * Detects the current page and wires up the appropriate UI ↔ API flows.
 * Loaded after js/api.js and js/pwa-connect.js, before js/app.js.
 *
 * Exposes window.QM_API_CREATE_ORDER and window.QM_API_ORDERS_LIST
 * for inline <script> usage in HTML pages.
 *
 * Supported page handlers
 * ────────────────────────
 *   login         → initLoginFlow
 *   dashboard     → initDashboardFlow
 *   sklep         → initShopFlow + initProductsFlow
 *   koszyk        → initCartFlow
 *   listing       → initListingFlow
 *   panel-sklepu  → initPanelSklepuFlow
 *   owner-panel   → initOwnerPanelFlow
 */
(function (global) {
  'use strict';

  // ─── Utilities ────────────────────────────────────────────────────────────────

  function getApi()  { return global.QMApi || null; }
  function getUser() {
    const api = getApi();
    return api && api.Auth && api.Auth.getCachedUser ? api.Auth.getCachedUser() : null;
  }
  function getToken() {
    const api = getApi();
    return api && api.Auth && api.Auth.getToken ? api.Auth.getToken() : null;
  }
  function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  }

  function setText(sel, text) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) el.textContent = text;
  }
  function showEl(sel)  { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (el) el.hidden = false; }
  function hideEl(sel)  { const el = typeof sel === 'string' ? document.querySelector(sel) : sel; if (el) el.hidden = true; }

  function formatPLN(val) {
    return new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(Number(val) || 0);
  }

  // ─── Login page ───────────────────────────────────────────────────────────────

  function initLoginFlow() {
    // If already logged in, redirect to dashboard
    if (getToken()) {
      const params = new URLSearchParams(location.search);
      location.replace(params.get('redirect') || 'dashboard.html');
      return;
    }
    // pwa-connect.js handles the form submit interception.
  }

  // ─── Dashboard page ────────────────────────────────────────────────────────────

  async function initDashboardFlow() {
    const api = getApi();
    if (!api || !isOnline()) return;
    const token = getToken();
    if (!token) return;

    try {
      // Refresh user profile
      const user = await api.Auth.me();
      setText('[data-user-name]',  user.name  || user.email || '');
      setText('[data-user-email]', user.email || '');
      setText('[data-user-plan]',  user.plan  || '');

      // Load recent orders
      const { orders = [] } = await api.Orders.list({ limit: 5 }) || {};
      const ordersContainer = document.querySelector('[data-dashboard-orders]');
      if (ordersContainer && orders.length) {
        ordersContainer.innerHTML = orders.map((o) => `
          <div class="order-row" data-order-id="${o.id}">
            <span class="order-id">${o.id.slice(0, 8)}…</span>
            <span class="order-status">${o.status}</span>
            <span class="order-total">${formatPLN(o.total)}</span>
          </div>`).join('');
      }
    } catch (err) {
      if (err.status === 401) {
        // Token expired
        if (api.Auth && api.Auth.logout) api.Auth.logout();
        location.replace('login.html');
      }
    }
  }

  // ─── Shop (sklep) page ─────────────────────────────────────────────────────────

  async function initShopFlow() {
    const api = getApi();
    if (!api || !isOnline()) return;

    const params = new URLSearchParams(location.search);
    const slug = params.get('sklep') || params.get('shop') || params.get('slug');
    if (!slug) return;

    try {
      const shop = await api.Shops.get(slug);
      setText('[data-store-name]',        shop.name        || '');
      setText('[data-store-description]', shop.description || '');
      const logoEl = document.querySelector('[data-store-logo]');
      if (logoEl && shop.logo_url) logoEl.src = shop.logo_url;
      document.title = shop.name || document.title;
    } catch { /* shop not found – app.js handles */ }
  }

  async function initProductsFlow() {
    const api = getApi();
    if (!api || !isOnline()) return;

    const params = new URLSearchParams(location.search);
    const slug = params.get('sklep') || params.get('shop') || params.get('slug');
    if (!slug) return;

    const container = document.querySelector('[data-products-grid], #productsGrid, .products-grid');
    if (!container) return;

    try {
      const page  = parseInt(params.get('page') || '1', 10);
      const limit = parseInt(params.get('limit') || '20', 10);
      const data  = await api.Shops.getProducts(slug, { page, limit,
        category: params.get('category') || undefined,
        search:   params.get('q')        || undefined,
      });
      if (!data || !data.products || !data.products.length) return; // keep existing render

      container.innerHTML = data.products.map((p) => `
        <div class="product-card" data-product-id="${p.product_id || p.id}">
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">` : ''}
          <h3>${p.name}</h3>
          ${p.description ? `<p>${p.description}</p>` : ''}
          <div class="product-price">${formatPLN(p.price)}</div>
          <button
            data-add-to-cart
            data-product-id="${p.product_id || p.id}"
            data-product-name="${p.name}"
            data-product-price="${p.price}"
            ${p.image_url ? `data-product-img="${p.image_url}"` : ''}>
            Dodaj do koszyka
          </button>
        </div>`).join('');
    } catch { /* keep app.js render */ }
  }

  // ─── Cart (koszyk) page ────────────────────────────────────────────────────────

  async function initCartFlow() {
    const api = getApi();

    // Show order confirmation if returning from checkout
    const params = new URLSearchParams(location.search);
    const orderId = params.get('order');
    const status  = params.get('status');

    if (orderId && status === 'success' && api && isOnline() && getToken()) {
      const banner = document.querySelector('[data-order-success]');
      if (banner) {
        try {
          const order = await api.Orders.get(orderId);
          setText('[data-order-number]', order.id.slice(0, 8).toUpperCase());
          setText('[data-order-total]',  formatPLN(order.total));
          showEl(banner);
        } catch { showEl(banner); }
      }
    }

    // Sync cart badge
    if (global.QMCart) global.QMCart.updateCartBadge();
  }

  // ─── Product listing page ──────────────────────────────────────────────────────

  async function initListingFlow() {
    const api = getApi();
    if (!api || !isOnline()) return;

    const params  = new URLSearchParams(location.search);
    const page    = parseInt(params.get('page') || '1', 10);
    const limit   = 20;
    const search  = params.get('q')        || undefined;
    const cat     = params.get('category') || undefined;

    const container = document.querySelector('[data-listing-products], #listingProducts, .listing-products');
    if (!container) return;

    try {
      const data = await api.Products.list({
        is_central: true,
        status: 'active',
        page,
        limit,
        search,
        category: cat,
      });
      if (!data || !data.products || !data.products.length) return;

      container.innerHTML = data.products.map((p) => `
        <div class="product-card" data-product-id="${p.id}">
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">` : ''}
          <h3>${p.name}</h3>
          <div class="product-price">${formatPLN(p.selling_price)}</div>
          <a href="sklep.html?p=${p.id}" class="btn btn-outline-sm">Zobacz</a>
        </div>`).join('');
    } catch { /* keep existing render */ }
  }

  // ─── Seller panel (panel-sklepu) page ──────────────────────────────────────────

  async function initPanelSklepuFlow() {
    const api = getApi();
    if (!api || !isOnline() || !getToken()) return;

    try {
      // Load seller's store
      const store = await api.MyStore.get();
      setText('[data-store-name]',  store.name  || '');
      setText('[data-store-plan]',  store.plan  || '');
      setText('[data-store-slug]',  store.slug  || '');

      // Load shop products
      const data = await api.MyStore.products(store.id, { limit: 50 });
      const products = data.products || [];
      const tbody = document.querySelector('[data-shop-products-table] tbody, #shopProductsTable tbody');
      if (tbody && products.length) {
        tbody.innerHTML = products.map((p) => `
          <tr data-sp-id="${p.id}">
            <td>${p.custom_title || p.name}</td>
            <td>${formatPLN(p.price)}</td>
            <td>${p.stock}</td>
            <td>${p.active ? '✓' : '–'}</td>
            <td>
              <button data-sp-remove="${p.id}" class="btn-icon btn-danger-sm">Usuń</button>
            </td>
          </tr>`).join('');

        tbody.addEventListener('click', async (e) => {
          const btn = e.target.closest('[data-sp-remove]');
          if (!btn) return;
          const spId = btn.dataset.spRemove;
          if (!confirm('Usunąć produkt ze sklepu?')) return;
          try {
            await api.MyStore.removeProduct(spId);
            btn.closest('tr').remove();
          } catch (err) {
            alert(err.message || 'Błąd usuwania produktu');
          }
        });
      }
    } catch (err) {
      if (err.status === 401) {
        if (api.Auth && api.Auth.logout) api.Auth.logout();
        location.replace('login.html?redirect=panel-sklepu.html');
      }
    }
  }

  // ─── Owner admin panel page ────────────────────────────────────────────────────

  async function initOwnerPanelFlow() {
    const api = getApi();
    if (!api || !isOnline() || !getToken()) return;

    const user = getUser();
    if (!user || !['owner', 'admin'].includes(user.role)) return;

    try {
      const stats = await api.Admin.stats();
      setText('[data-stat-users]',  stats.total_users  || 0);
      setText('[data-stat-shops]',  stats.total_shops  || 0);
      setText('[data-stat-orders]', stats.total_orders || 0);
      setText('[data-stat-revenue]', formatPLN(stats.revenue_30d || 0));
    } catch { /* keep static render */ }
  }

  // ─── Page detection & init ─────────────────────────────────────────────────────

  const PAGE_HANDLERS = {
    'login':        () => initLoginFlow(),
    'register':     () => initLoginFlow(),
    'dashboard':    () => initDashboardFlow(),
    'sklep':        () => { initShopFlow(); initProductsFlow(); },
    'koszyk':       () => initCartFlow(),
    'listing':      () => initListingFlow(),
    'panel-sklepu': () => initPanelSklepuFlow(),
    'owner-panel':  () => initOwnerPanelFlow(),
  };

  function detectPage() {
    // Try data-page attribute on <body> first
    const bodyPage = document.body && document.body.dataset.page;
    if (bodyPage && PAGE_HANDLERS[bodyPage]) return bodyPage;

    // Derive from filename
    const filename = location.pathname.split('/').pop().replace(/\.html?$/, '');
    if (filename && PAGE_HANDLERS[filename]) return filename;

    return null;
  }

  function init() {
    const page = detectPage();
    if (page && PAGE_HANDLERS[page]) {
      PAGE_HANDLERS[page]();
    }

    // Always sync cart badge if QMCart is available
    if (global.QMCart) {
      document.addEventListener('DOMContentLoaded', () => global.QMCart.updateCartBadge(), { once: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  global.QM_FLOW = { init, detectPage };

  // Convenience globals expected by koszyk.html inline scripts
  global.QM_API_CREATE_ORDER = global.QM_API_CREATE_ORDER || async function (storeId, items, address, notes) {
    const api = getApi();
    if (!api) throw new Error('QMApi not loaded');
    return api.Orders.create(storeId, items, address, notes);
  };

  global.QM_API_ORDERS_LIST = global.QM_API_ORDERS_LIST || async function (params) {
    const api = getApi();
    if (!api) throw new Error('QMApi not loaded');
    return api.Orders.list(params);
  };

}(typeof globalThis !== 'undefined' ? globalThis : this));
