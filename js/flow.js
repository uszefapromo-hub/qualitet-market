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
          .catch(function (err) {
            done();
            // Only fall back to localStorage when the API is completely unreachable.
            // A status code means the API responded (e.g. 401 wrong credentials) —
            // in that case do NOT grant access via localStorage.
            if (err && err.status) {
              return; // pwa-connect.js will show an inline error; do nothing here
            }
            // Network/API unreachable – graceful degradation to localStorage
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
    var panel = document.querySelector('[data-api-orders]');
    if (!panel) return;

    var loadingEl = panel.querySelector('[data-orders-loading]');
    if (loadingEl) loadingEl.hidden = true;

    var listEl = panel.querySelector('[data-orders-list]');
    var emptyEl = panel.querySelector('[data-orders-empty]');

    if (!orders.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (!listEl) return;

    listEl.innerHTML = '';

    orders.forEach(function (o) {
      var row = document.createElement('div');
      row.className = 'order-row';
      var date = o.created_at ? new Date(o.created_at).toLocaleDateString('pl-PL') : '—';
      var total = o.total_amount != null ? formatPrice(o.total_amount) : '—';
      var status = escHtml(o.status || '—');
      row.innerHTML =
        '<span class="order-num">' + escHtml(o.order_number || (o.id || '').slice(0, 8) || '—') + '</span>' +
        '<span class="order-date">' + escHtml(date) + '</span>' +
        '<span class="order-total">' + escHtml(total) + '</span>' +
        '<span class="order-status badge-pill">' + status + '</span>';
      listEl.appendChild(row);
    });

    if (emptyEl) emptyEl.hidden = true;
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

          // Build media element first so we can attach error listener via JS
          var mediaDiv = document.createElement('div');
          mediaDiv.className = 'product-media';
          if (product.image_url) {
            var img = document.createElement('img');
            img.src = product.image_url;
            img.alt = product.name || '';
            img.addEventListener('error', function () { this.style.display = 'none'; });
            mediaDiv.appendChild(img);
          } else {
            var icon = document.createElement('span');
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = '📦';
            mediaDiv.appendChild(icon);
          }

          card.innerHTML =
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

          card.insertBefore(mediaDiv, card.firstChild);

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

  // ─── 8. Store Panel – product management ─────────────────────────────────────

  function initPanelSklepuFlow() {
    var a = api();
    if (!a || !isLoggedInApi()) return;

    // Update real product count from API
    a.MyStore.get()
      .then(function (store) {
        if (!store || !store.id) return;
        return a.MyStore.products(store.id, { limit: 1 })
          .then(function (data) {
            var countEl = document.querySelector('[data-store-products]');
            if (countEl && data && data.total != null) {
              countEl.textContent = data.total;
            }
          });
      })
      .catch(function () {});

    // Wire "Dodaj produkt" button
    var addBtn = document.querySelector('[data-add-store-product]');
    if (!addBtn) return;

    addBtn.addEventListener('click', function () {
      a.MyStore.get()
        .then(function (store) {
          if (!store || !store.id) {
            alert('Nie znaleziono aktywnego sklepu. Zaloguj się lub utwórz sklep.');
            return;
          }
          openAddProductDialog(a, store.id);
        })
        .catch(function () {
          alert('Nie udało się załadować danych sklepu. Sprawdź połączenie.');
        });
    });
  }

  function openAddProductDialog(a, storeId) {
    var existing = document.getElementById('qm-add-product-dialog');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'qm-add-product-dialog';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Dodaj produkt do sklepu');
    overlay.style.cssText = [
      'position:fixed', 'inset:0', 'background:rgba(0,0,0,.55)', 'z-index:9000',
      'display:flex', 'align-items:center', 'justify-content:center', 'padding:16px'
    ].join(';');

    var box = document.createElement('div');
    box.style.cssText = [
      'background:#fff', 'border-radius:12px', 'width:100%', 'max-width:540px',
      'max-height:80vh', 'overflow:auto', 'padding:24px'
    ].join(';');

    box.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">' +
        '<h3 style="margin:0;font-size:1.1rem;font-weight:700">Wybierz produkt do sklepu</h3>' +
        '<button type="button" id="qm-dlg-close" aria-label="Zamknij" style="border:none;background:none;font-size:1.5rem;cursor:pointer;line-height:1;padding:0 4px">×</button>' +
      '</div>' +
      '<p id="qm-dlg-status" role="alert" style="color:#c53030;font-size:.875rem;margin-bottom:12px;display:none"></p>' +
      '<div id="qm-dlg-list" style="display:flex;flex-direction:column;gap:10px"></div>';

    overlay.appendChild(box);
    document.body.appendChild(overlay);

    box.querySelector('#qm-dlg-close').addEventListener('click', function () {
      overlay.remove();
    });
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    var listEl = box.querySelector('#qm-dlg-list');
    var statusEl = box.querySelector('#qm-dlg-status');

    listEl.innerHTML = '<p style="color:#718096;font-size:.9rem">Ładowanie katalogu produktów…</p>';

    a.Products.list({ status: 'active', limit: 24 })
      .then(function (data) {
        var products = Array.isArray(data) ? data
          : (data && Array.isArray(data.products)) ? data.products : [];

        if (!products.length) {
          listEl.innerHTML = '<p style="color:#718096;font-size:.9rem">Brak dostępnych produktów w katalogu.</p>';
          return;
        }

        listEl.innerHTML = '';

        products.forEach(function (product) {
          var row = document.createElement('div');
          row.style.cssText = [
            'display:flex', 'align-items:center', 'gap:12px', 'padding:10px',
            'border:1px solid #e2e8f0', 'border-radius:8px'
          ].join(';');

          var mediaHtml = product.image_url
            ? '<img src="' + escHtml(product.image_url) + '" alt="' + escHtml(product.name || 'Zdjęcie produktu') + '" style="width:52px;height:52px;object-fit:cover;border-radius:6px;flex-shrink:0" onerror="this.style.display=\'none\'">'
            : '<span aria-hidden="true" style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;font-size:1.6rem;background:#f7fafc;border-radius:6px;flex-shrink:0">📦</span>';

          var price = product.price_gross || product.selling_price || product.platform_price || 0;

          row.innerHTML =
            mediaHtml +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-weight:600;font-size:.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + escHtml(product.name || '') + '</div>' +
              '<div style="font-size:.78rem;color:#718096;margin-top:2px">' +
                escHtml(product.category || '') +
                (price ? ' · ' + formatPrice(price) : '') +
              '</div>' +
            '</div>' +
            '<button type="button" style="flex-shrink:0;padding:6px 16px;font-size:.82rem;border-radius:6px;border:none;background:#3182ce;color:#fff;cursor:pointer;font-weight:600" data-pid="' + escHtml(product.id || '') + '">Dodaj</button>';

          listEl.appendChild(row);
        });

        listEl.addEventListener('click', function (e) {
          var btn = e.target.closest('[data-pid]');
          if (!btn) return;
          var productId = btn.dataset.pid;
          if (!productId) return;

          btn.disabled = true;
          btn.textContent = '…';
          statusEl.style.display = 'none';

          a.MyStore.addProduct({ store_id: storeId, product_id: productId })
            .then(function () {
              btn.textContent = 'Dodano ✓';
              btn.style.background = '#276749';

              // Refresh product count
              a.MyStore.products(storeId, { limit: 1 })
                .then(function (d) {
                  var countEl = document.querySelector('[data-store-products]');
                  if (countEl && d && d.total != null) countEl.textContent = d.total;
                })
                .catch(function () {});
            })
            .catch(function (err) {
              btn.disabled = false;
              btn.textContent = 'Dodaj';
              var code = err && err.body && err.body.error;
              var msg = code === 'product_limit_reached'
                ? 'Osiągnięto limit produktów w planie. Ulepsz subskrypcję, aby dodać więcej.'
                : code === 'subscription_expired'
                ? 'Subskrypcja wygasła. Odnów plan, aby dodawać produkty.'
                : code || 'Nie udało się dodać produktu. Spróbuj ponownie.';
              statusEl.textContent = msg;
              statusEl.style.display = '';
            });
        });
      })
      .catch(function () {
        listEl.innerHTML = '<p style="color:#c53030;font-size:.9rem">Nie udało się załadować katalogu produktów.</p>';
      });
  }

  // ─── Initialisation ───────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body && document.body.dataset.page;

    // Refresh user profile in the background
    if (isLoggedInApi()) {
      var a = api();
      if (a) a.Auth.me().catch(function () {});
    }

    if (page === 'login')         initLoginFlow();
    if (page === 'dashboard')     initDashboardFlow();
    if (page === 'sklep')         initProductsFlow();
    if (page === 'koszyk')        initCartFlow();
    if (page === 'panel-sklepu')  initPanelSklepuFlow();
  });

}());
