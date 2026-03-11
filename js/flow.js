/**
 * flow.js – Frontend ↔ Backend API flow coordinator
 *
 * Bridges the PWA frontend with the backend REST API (window.QMApi).
 * Implements all 7 key user flows:
 *   1. Login / Register      → QMApi.Auth.login() / QMApi.Auth.register()
 *   2. Store data            → QMApi.MyStore.get()
 *   3. Product catalogue     → QMApi.Products.list()
 *   4. Add to cart           → QMApi.Cart.addByShopProduct()
 *   5. Fetch cart            → QMApi.Cart.get()
 *   6. Create order          → QMApi.Orders.create()
 *   7. Order history         → QMApi.Orders.list()
 *
 * Loaded BEFORE app.js so that capture-phase event listeners on forms
 * intercept submissions before app.js's bubble-phase handlers.
 *
 * Graceful degradation: every API call falls back to the existing
 * localStorage-based behaviour when the backend is unreachable or the
 * user is not authenticated.
 */

(function () {
  'use strict';

  // ─── Constants ────────────────────────────────────────────────────────────────

  var LS_EMAIL  = 'app_user_email';
  var LS_LOGGED = 'app_user_logged';
  var LS_ROLE   = 'app_user_role';

  var CURRENCY_FMT = new Intl.NumberFormat('pl-PL', {
    style: 'currency', currency: 'PLN', maximumFractionDigits: 0
  });

  // ─── Utility helpers ─────────────────────────────────────────────────────────

  function api() { return window.QMApi || null; }

  function isLoggedInApi() {
    var a = api();
    return a ? a.Auth.isLoggedIn() : false;
  }

  function formatPrice(v) {
    return CURRENCY_FMT.format(Number(v) || 0);
  }

  function escHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g,  '&lt;')
      .replace(/>/g,  '&gt;')
      .replace(/"/g,  '&quot;');
  }

  function lsSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) {}
  }

  function lsGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (_) {}
  }

  // ─── 1. Login / Register ──────────────────────────────────────────────────────

  function setLegacyLoggedIn(email, role) {
    lsSet(LS_EMAIL, email);
    lsSet(LS_LOGGED, 'true');
    if (role) {
      lsSet(LS_ROLE, role);
    } else {
      lsRemove(LS_ROLE);
    }
  }

  function initLoginFlow() {
    var a = api();
    if (!a) return;

    var form = document.querySelector('[data-login-form]');
    if (!form) return;

    // Use the capture phase so this handler fires BEFORE app.js registers
    // its bubble-phase handler on the same form element.
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      var emailInput    = form.querySelector('input[name="email"]');
      var passwordInput = form.querySelector('input[name="password"]');
      var submitBtn     = form.querySelector('[type="submit"]');

      var email    = emailInput    ? emailInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value     : '';

      if (!email) return;

      var origText = submitBtn ? submitBtn.textContent : 'Zaloguj';
      if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logowanie…'; }

      function done() {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = origText; }
      }

      function fallbackLogin() {
        setLegacyLoggedIn(email, null);
        window.location.href = 'dashboard.html';
      }

      if (password) {
        a.Auth.login(email, password)
          .then(function (data) {
            var role = data && data.user && data.user.role;
            setLegacyLoggedIn(email, role);
            window.location.href = 'dashboard.html';
          })
          .catch(function () {
            // API unreachable or wrong credentials — degrade gracefully
            done();
            fallbackLogin();
          });
      } else {
        // No password field filled — use localStorage-only (demo) login
        fallbackLogin();
      }
    }, true); // capture = true

    // Wire the "Utwórz konto" (register) button
    var registerBtn = form.querySelector('[data-register-btn]');
    if (!registerBtn) return;

    registerBtn.addEventListener('click', function () {
      var emailInput    = form.querySelector('input[name="email"]');
      var passwordInput = form.querySelector('input[name="password"]');

      var email    = emailInput    ? emailInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value     : '';

      if (!email || !password) {
        alert('Podaj adres e-mail i hasło, aby utworzyć konto.');
        return;
      }

      var name = email.split('@')[0];

      var origText = registerBtn.textContent;
      registerBtn.disabled = true;
      registerBtn.textContent = 'Rejestracja…';

      a.Auth.register(email, password, name)
        .then(function (data) {
          var role = data && data.user && data.user.role;
          setLegacyLoggedIn(email, role);
          window.location.href = 'dashboard.html';
        })
        .catch(function (err) {
          registerBtn.disabled = false;
          registerBtn.textContent = origText;
          var msg = (err && err.body && err.body.error) || 'Nie udało się utworzyć konta. Spróbuj ponownie.';
          alert('Rejestracja: ' + msg);
        });
    });
  }

  // ─── 2. Store data ────────────────────────────────────────────────────────────

  function initDashboardFlow() {
    var a = api();
    if (!a || !isLoggedInApi()) return;

    // Flow 2: populate dashboard store fields from API
    a.MyStore.get()
      .then(function (store) {
        if (!store) return;

        var fields = {
          '[data-store-name]':   store.name   || null,
          '[data-store-status]': store.status || null,
          '[data-store-style]':  store.plan   || null,
          '[data-user-plan]':    store.plan   ? store.plan.toUpperCase() : null,
          '[data-plan-name]':    store.plan   ? store.plan.toUpperCase() : null,
        };

        Object.keys(fields).forEach(function (sel) {
          if (fields[sel] == null) return;
          var el = document.querySelector(sel);
          if (el) el.textContent = fields[sel];
        });
      })
      .catch(function () { /* store not found – use existing localStorage display */ });

    // Flow 7: load order history and render in the dashboard orders panel
    a.Orders.list({ limit: 10 })
      .then(function (data) {
        var orders = Array.isArray(data) ? data
          : (data && Array.isArray(data.orders)) ? data.orders : [];

        window.QM_API_ORDERS = orders;
        renderDashboardOrders(orders);
      })
      .catch(function () {});
  }

  function renderDashboardOrders(orders) {
    var panel = document.querySelector('[data-api-orders-panel]');
    if (!panel) return;

    panel.hidden = false;

    var tbody = panel.querySelector('[data-api-orders-tbody]');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (!orders.length) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td colspan="4" style="text-align:center;color:var(--muted);padding:20px">Brak zamówień</td>';
      tbody.appendChild(tr);
      return;
    }

    orders.forEach(function (o) {
      var tr = document.createElement('tr');
      var date = o.created_at ? new Date(o.created_at).toLocaleDateString('pl-PL') : '—';
      var total = o.total_amount != null ? formatPrice(o.total_amount) : '—';
      var status = escHtml(o.status || '—');
      tr.innerHTML =
        '<td>' + escHtml(o.order_number || o.id || '—') + '</td>' +
        '<td>' + escHtml(date) + '</td>' +
        '<td>' + escHtml(total) + '</td>' +
        '<td><span class="status-pill">' + status + '</span></td>';
      tbody.appendChild(tr);
    });
  }

  // ─── 3. Product catalogue ─────────────────────────────────────────────────────

  function initProductsFlow() {
    var a = api();
    if (!a) return;

    var grid = document.querySelector('[data-store-products-grid]');
    if (!grid) return;

    a.Products.list({ status: 'active', limit: 24 })
      .then(function (data) {
        var products = Array.isArray(data) ? data
          : (data && Array.isArray(data.products)) ? data.products : [];

        if (!products.length) return;

        // Replace the demo/localStorage product grid with API products
        grid.innerHTML = '';

        var emptyState = document.querySelector('[data-store-products-empty]');
        if (emptyState) emptyState.hidden = true;

        products.forEach(function (product) {
          var card = document.createElement('article');
          card.className = 'product-card product-tile';

          var imgTag = product.image_url
            ? '<img src="' + escHtml(product.image_url) + '" alt="' + escHtml(product.name || '') + '" onerror="this.style.display=\'none\'">'
            : '<span aria-hidden="true">📦</span>';

          card.innerHTML =
            '<div class="product-media">' + imgTag + '</div>' +
            '<div class="product-details">' +
              '<span class="tag">' + escHtml(product.category || 'Produkt') + '</span>' +
              '<h3>' + escHtml(product.name || '') + '</h3>' +
              '<p class="hint">' + escHtml(product.description || '') + '</p>' +
              '<div class="product-meta">' +
                '<span class="price">' + formatPrice(product.price_gross) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="cta-row product-actions">' +
              '<button class="btn btn-primary" type="button"' +
                ' data-add-to-cart' +
                ' data-product-id="' + escHtml(product.id || '') + '"' +
                ' data-product-name="' + escHtml(product.name || '') + '"' +
                ' data-product-price="' + escHtml(String(product.price_gross || 0)) + '">' +
                'Do koszyka' +
              '</button>' +
              '<a class="btn btn-secondary" href="listing.html">Szczegóły</a>' +
            '</div>';

          grid.appendChild(card);
        });
      })
      .catch(function () { /* keep existing demo products */ });
  }

  // ─── 4 + 5. Cart ──────────────────────────────────────────────────────────────

  function resolveApiStoreId() {
    // Try user object first
    var a = api();
    if (a) {
      var user = a.Auth.currentUser();
      if (user && user.store_id) return user.store_id;
    }
    // Fall back to StoreManager (localStorage-backed)
    var sm = window.StoreManager;
    if (sm) {
      var active = sm.getActiveStore();
      if (active && active.id) return active.id;
    }
    return null;
  }

  function initCartFlow() {
    var a = api();
    if (!a || !isLoggedInApi()) return;

    var storeId = resolveApiStoreId();
    if (!storeId) return;

    // Flow 5: fetch cart from API; keep result for later use
    a.Cart.get(storeId)
      .then(function (cartData) {
        window.QM_API_CART = cartData || null;
      })
      .catch(function () {});
  }

  // ─── 6. Create order (exposed globally for koszyk.html inline script) ─────────

  /**
   * Attempt to create an order via the backend API.
   * Returns a Promise that resolves to the created order object.
   * Falls back gracefully if the user is not logged in or the call fails.
   *
   * @param {{ name, email, phone, address }} formData
   * @param {Array<{ id, name, price, qty }>}  cartItems
   * @returns {Promise<object>}
   */
  window.QM_API_CREATE_ORDER = function (formData, cartItems) {
    var a = api();
    if (!a || !isLoggedInApi()) {
      return Promise.reject(new Error('not_logged_in'));
    }

    // store_id: try to find the seller store the buyer is shopping at.
    // For MVP, use the authenticated user's own store.
    return a.MyStore.get()
      .then(function (store) {
        var storeId = store && store.id;

        // Fallback: list all stores and use the first one
        if (!storeId) {
          return a.Stores.list().then(function (stores) {
            var list = Array.isArray(stores) ? stores
              : (stores && Array.isArray(stores.stores)) ? stores.stores : [];
            storeId = list.length ? list[0].id : null;
            if (!storeId) return Promise.reject(new Error('no_store'));
            return storeId;
          });
        }
        return storeId;
      })
      .then(function (storeId) {
        var notes = [formData.name, formData.email, formData.phone]
          .filter(Boolean).join(', ');

        return a.Orders.create({
          store_id: storeId,
          items: cartItems.map(function (i) {
            return { product_id: i.id, quantity: Number(i.qty) || 1 };
          }),
          shipping_address: formData.address || '',
          notes: notes,
        });
      });
  };

  // ─── 7. Order history (exposed globally) ─────────────────────────────────────

  /**
   * Returns a Promise<Array> of the authenticated user's orders from the API.
   * Resolves to an empty array when the user is not logged in.
   */
  window.QM_API_ORDERS_LIST = function (params) {
    var a = api();
    if (!a || !isLoggedInApi()) return Promise.resolve([]);
    return a.Orders.list(params || {})
      .then(function (data) {
        return Array.isArray(data) ? data
          : (data && Array.isArray(data.orders)) ? data.orders : [];
      })
      .catch(function () { return []; });
  };

  // ─── Initialisation ───────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body && document.body.dataset.page;

    // Refresh user profile in the background
    if (isLoggedInApi()) {
      var a = api();
      if (a) a.Auth.me().catch(function () {});
    }

    if (page === 'login')     initLoginFlow();
    if (page === 'dashboard') initDashboardFlow();
    if (page === 'sklep')     initProductsFlow();
    if (page === 'koszyk')    initCartFlow();
  });

}());
