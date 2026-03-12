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

  // ─── 3. Product catalogue (sklep.html grid) ──────────────────────────────────

  var _sklep_page = 1;
  var _sklep_total = 0;
  var _sklep_limit = 24;
  var _sklep_category = '';
  var _sklep_search = '';

  function renderProductCard(product) {
    var card = document.createElement('article');
    card.className = 'product-card product-tile';

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
    return card;
  }

  function loadSklepProducts(page) {
    var a = api();
    if (!a) return;

    var grid = document.querySelector('[data-store-products-grid]');
    if (!grid) return;

    var params = { status: 'active', limit: _sklep_limit, page: page || 1 };
    if (_sklep_category) params.category = _sklep_category;
    if (_sklep_search)   params.search   = _sklep_search;

    a.Products.list(params)
      .then(function (data) {
        var products = Array.isArray(data) ? data
          : (data && Array.isArray(data.products)) ? data.products : [];
        _sklep_total = (data && data.total) ? data.total : products.length;
        _sklep_page  = page || 1;

        if (!products.length && _sklep_page === 1) {
          var emptyState = document.querySelector('[data-store-products-empty]');
          if (emptyState) emptyState.hidden = false;
          grid.innerHTML = '';
          return;
        }

        grid.innerHTML = '';
        var emptyState = document.querySelector('[data-store-products-empty]');
        if (emptyState) emptyState.hidden = true;

        products.forEach(function (product) {
          grid.appendChild(renderProductCard(product));
        });

        updateSklepPagination();
      })
      .catch(function () { /* keep existing demo products */ });
  }

  function updateSklepPagination() {
    var wrap = document.querySelector('[data-sklep-pagination]');
    if (!wrap) return;

    var totalPages = Math.ceil(_sklep_total / _sklep_limit) || 1;
    wrap.innerHTML = '';
    if (totalPages <= 1) { wrap.hidden = true; return; }
    wrap.hidden = false;

    if (_sklep_page > 1) {
      var prev = document.createElement('button');
      prev.className = 'btn btn-secondary';
      prev.textContent = '← Poprzednia';
      prev.addEventListener('click', function () { loadSklepProducts(_sklep_page - 1); });
      wrap.appendChild(prev);
    }

    var info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = 'Strona ' + _sklep_page + ' / ' + totalPages;
    wrap.appendChild(info);

    if (_sklep_page < totalPages) {
      var next = document.createElement('button');
      next.className = 'btn btn-secondary';
      next.textContent = 'Następna →';
      next.addEventListener('click', function () { loadSklepProducts(_sklep_page + 1); });
      wrap.appendChild(next);
    }
  }

  function initProductsFlow() {
    var a = api();
    if (!a) return;

    var grid = document.querySelector('[data-store-products-grid]');
    if (!grid) return;

    // Search input
    var searchInput = document.querySelector('[data-sklep-search]');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        _sklep_search = this.value.trim();
        loadSklepProducts(1);
      });
    }

    // Category filter
    var catFilter = document.querySelector('[data-sklep-category]');
    if (catFilter) {
      catFilter.addEventListener('change', function () {
        _sklep_category = this.value;
        loadSklepProducts(1);
      });
    }

    // Populate category select from API
    if (catFilter) {
      a.Categories.list()
        .then(function (data) {
          var cats = Array.isArray(data) ? data
            : (data && Array.isArray(data.categories)) ? data.categories : [];
          cats.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.name || c.id;
            opt.textContent = escHtml(c.name || c.id);
            catFilter.appendChild(opt);
          });
        })
        .catch(function () {});
    }

    loadSklepProducts(1);
  }

  // ─── 3b. Shop page (shop slug → products) ────────────────────────────────────

  function initShopFlow() {
    var a = api();
    if (!a) return;

    // Resolve slug from URL param or data attribute
    var params = new URLSearchParams(
      typeof location !== 'undefined' ? location.search : ''
    );
    var slug = params.get('slug')
      || (document.body && document.body.dataset.shopSlug)
      || null;

    if (!slug) return;

    // Populate shop header fields
    a.Shops.getBySlug(slug)
      .then(function (shop) {
        if (!shop) return;
        var nameEls = document.querySelectorAll('[data-store-name]');
        nameEls.forEach(function (el) { el.textContent = escHtml(shop.name || ''); });

        var descEls = document.querySelectorAll('[data-store-description]');
        descEls.forEach(function (el) { el.textContent = escHtml(shop.description || ''); });

        var slugEls = document.querySelectorAll('[data-store-slug]');
        slugEls.forEach(function (el) { el.textContent = escHtml(shop.slug || ''); });

        var planEls = document.querySelectorAll('[data-store-plan]');
        planEls.forEach(function (el) {
          el.textContent = shop.plan ? 'Plan: ' + escHtml(shop.plan.toUpperCase()) : 'Plan: Basic';
        });
      })
      .catch(function () {});

    // Load shop products into [data-store-products-grid]
    a.Shops.products(slug, { limit: 24 })
      .then(function (data) {
        var products = Array.isArray(data) ? data
          : (data && Array.isArray(data.products)) ? data.products : [];

        if (!products.length) return;

        var grid = document.querySelector('[data-store-products-grid]');
        if (!grid) return;

        grid.innerHTML = '';
        var emptyState = document.querySelector('[data-store-products-empty]');
        if (emptyState) emptyState.hidden = true;

        products.forEach(function (product) {
          grid.appendChild(renderProductCard(product));
        });
      })
      .catch(function () {});
  }

  // ─── 3c. Listing page (listing.html) ─────────────────────────────────────────

  var _listing_page  = 1;
  var _listing_total = 0;
  var _listing_limit = 20;
  var _listing_category = '';
  var _listing_search   = '';

  function loadListingProducts(page) {
    var a = api();
    if (!a) return;

    var tbody = document.querySelector('[data-listing-tbody]');
    if (!tbody) return;

    var loader = document.querySelector('[data-listing-loader]');
    if (loader) loader.hidden = false;

    var params = { status: 'active', limit: _listing_limit, page: page || 1 };
    if (_listing_category) params.category = _listing_category;
    if (_listing_search)   params.search   = _listing_search;

    a.Products.list(params)
      .then(function (data) {
        var products = Array.isArray(data) ? data
          : (data && Array.isArray(data.products)) ? data.products : [];
        _listing_total = (data && data.total) ? data.total : products.length;
        _listing_page  = page || 1;

        if (loader) loader.hidden = true;

        tbody.innerHTML = '';

        if (!products.length) {
          var tr = document.createElement('tr');
          tr.innerHTML = '<td colspan="6" style="text-align:center;color:var(--muted);padding:20px">Brak produktów</td>';
          tbody.appendChild(tr);
          updateListingPagination();
          return;
        }

        products.forEach(function (p) {
          var tr = document.createElement('tr');
          var price = p.price_gross != null ? formatPrice(p.price_gross) : '—';
          var margin = p.margin_percent != null ? p.margin_percent + '%' : '—';
          var status = escHtml(p.status || 'active');
          var statusClass = p.status === 'active' ? 'status-active'
            : p.status === 'pending' ? 'status-pending' : 'status-draft';
          var statusLabel = p.status === 'active' ? '✓ Opublikowany'
            : p.status === 'pending' ? '⏳ Oczekujący' : '○ Szkic';
          tr.innerHTML =
            '<td><strong>' + escHtml(p.name || '—') + '</strong></td>' +
            '<td>' + escHtml(p.category || '—') + '</td>' +
            '<td>' + escHtml(p.supplier_name || p.supplier_id || '—') + '</td>' +
            '<td>' + escHtml(price) + '</td>' +
            '<td>' + escHtml(margin) + '</td>' +
            '<td><span class="' + statusClass + '">' + statusLabel + '</span></td>';
          tbody.appendChild(tr);
        });

        updateListingPagination();
      })
      .catch(function () {
        if (loader) loader.hidden = true;
      });
  }

  function updateListingPagination() {
    var wrap = document.querySelector('[data-listing-pagination]');
    if (!wrap) return;

    var totalPages = Math.ceil(_listing_total / _listing_limit) || 1;
    wrap.innerHTML = '';
    if (totalPages <= 1) { wrap.hidden = true; return; }
    wrap.hidden = false;

    if (_listing_page > 1) {
      var prev = document.createElement('button');
      prev.className = 'btn btn-secondary';
      prev.textContent = '← Poprzednia';
      prev.addEventListener('click', function () { loadListingProducts(_listing_page - 1); });
      wrap.appendChild(prev);
    }

    var info = document.createElement('span');
    info.className = 'pagination-info';
    info.textContent = 'Strona ' + _listing_page + ' / ' + totalPages;
    wrap.appendChild(info);

    if (_listing_page < totalPages) {
      var next = document.createElement('button');
      next.className = 'btn btn-secondary';
      next.textContent = 'Następna →';
      next.addEventListener('click', function () { loadListingProducts(_listing_page + 1); });
      wrap.appendChild(next);
    }
  }

  function initListingFlow() {
    var a = api();
    if (!a) return;

    var tbody = document.querySelector('[data-listing-tbody]');
    if (!tbody) return;

    // Search input
    var searchInput = document.querySelector('[data-listing-search]');
    if (searchInput) {
      var searchTimer = null;
      searchInput.addEventListener('input', function () {
        clearTimeout(searchTimer);
        var val = this.value.trim();
        searchTimer = setTimeout(function () {
          _listing_search = val;
          loadListingProducts(1);
        }, 320);
      });
    }

    // Category filter
    var catFilter = document.querySelector('[data-listing-category]');
    if (catFilter) {
      catFilter.addEventListener('change', function () {
        _listing_category = this.value;
        loadListingProducts(1);
      });

      // Populate options from API
      a.Categories.list()
        .then(function (data) {
          var cats = Array.isArray(data) ? data
            : (data && Array.isArray(data.categories)) ? data.categories : [];
          cats.forEach(function (c) {
            var opt = document.createElement('option');
            opt.value = c.name || c.id;
            opt.textContent = escHtml(c.name || c.id);
            catFilter.appendChild(opt);
          });
        })
        .catch(function () {});
    }

    loadListingProducts(1);
  }

  // ─── 6. Store panel (panel-sklepu.html) ──────────────────────────────────────

  function initPanelSklepuFlow() {
    var a = api();
    if (!a || !isLoggedInApi()) return;

    a.MyStore.get()
      .then(function (store) {
        if (!store) return;

        var nameEls = document.querySelectorAll('[data-store-name]');
        nameEls.forEach(function (el) { el.textContent = escHtml(store.name || 'Panel sklepu'); });

        var planEl = document.querySelector('[data-store-plan]');
        if (planEl) planEl.textContent = escHtml((store.plan || 'basic').toUpperCase());

        var marginEl = document.querySelector('[data-store-margin]');
        if (marginEl) marginEl.textContent = escHtml(String(store.margin_default || 0)) + '%';

        // Load products count
        return a.MyStore.products(store.id, { limit: 1 })
          .then(function (pd) {
            var total = (pd && pd.total) ? pd.total
              : (Array.isArray(pd) ? pd.length : 0);
            var prodEl = document.querySelector('[data-store-products]');
            if (prodEl) prodEl.textContent = total;
            return total;
          })
          .catch(function () {});
      })
      .catch(function () {
        var emptyEl = document.querySelector('[data-store-empty]');
        var contentEl = document.querySelector('[data-store-content]');
        if (emptyEl) emptyEl.hidden = false;
        if (contentEl) contentEl.hidden = true;
      });
  }

  // ─── 6b. Owner / Superadmin panel (owner-panel.html) ─────────────────────────

  function initOwnerPanelFlow() {
    var a = api();
    if (!a || !isLoggedInApi()) return;

    a.Admin.dashboard()
      .then(function (d) {
        if (!d) return;

        function setMetric(sel, val) {
          var el = document.querySelector(sel);
          if (el) el.textContent = val != null ? String(val) : '—';
        }

        setMetric('[data-owner-users]',         d.users_total   || d.total_users   || 0);
        setMetric('[data-owner-stores]',        d.stores_total  || d.total_stores  || 0);
        setMetric('[data-owner-products]',      d.products_total|| d.total_products|| 0);
        setMetric('[data-owner-orders]',        d.orders_total  || d.total_orders  || 0);
        setMetric('[data-owner-revenue]',       d.revenue_total || d.total_revenue || 0);
        setMetric('[data-owner-platform-margin]', d.platform_commission_total || 0);
        setMetric('[data-owner-active-subs]',   d.active_subscriptions || 0);
        setMetric('[data-owner-revenue-today]', d.revenue_today  != null ? formatPrice(d.revenue_today)  : '—');
        setMetric('[data-owner-revenue-month]', d.revenue_month  != null ? formatPrice(d.revenue_month)  : '—');
        setMetric('[data-owner-reg-today]',     d.registrations_today != null ? d.registrations_today  : '—');
        setMetric('[data-owner-reg-month]',     d.registrations_month != null ? d.registrations_month  : '—');
        setMetric('[data-owner-plan-basic]',    d.plan_basic  || 0);
        setMetric('[data-owner-plan-pro]',      d.plan_pro    || 0);
        setMetric('[data-owner-plan-elite]',    d.plan_elite  || 0);
      })
      .catch(function () { /* admin endpoint needs superadmin role */ });
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

    if (page === 'login')          initLoginFlow();
    if (page === 'dashboard')      initDashboardFlow();
    if (page === 'sklep')          { initShopFlow(); initProductsFlow(); }
    if (page === 'koszyk')         initCartFlow();
    if (page === 'listing')        initListingFlow();
    if (page === 'panel-sklepu')   initPanelSklepuFlow();
    if (page === 'owner-panel')    initOwnerPanelFlow();
  });

}());
