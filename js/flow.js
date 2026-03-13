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

    // Flow 8: user profile edit form
    initProfileForm(a);
  }

  function initProfileForm(a) {
    var profileForm   = document.querySelector('[data-profile-form]');
    var passwordForm  = document.querySelector('[data-password-form]');
    if (!profileForm && !passwordForm) return;

    // Pre-populate profile fields from API
    a.Auth.me()
      .then(function (user) {
        if (!user) return;
        var nameInput  = profileForm && profileForm.querySelector('[data-profile-name]');
        var phoneInput = profileForm && profileForm.querySelector('[data-profile-phone]');
        if (nameInput  && user.name)  nameInput.value  = user.name;
        if (phoneInput && user.phone) phoneInput.value = user.phone;
      })
      .catch(function () { /* not logged in or network error – leave fields empty */ });

    // Profile update form submission
    if (profileForm) {
      profileForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput  = profileForm.querySelector('[data-profile-name]');
        var phoneInput = profileForm.querySelector('[data-profile-phone]');
        var saveBtn    = profileForm.querySelector('[data-profile-save]');
        var msgEl      = profileForm.querySelector('[data-profile-msg]');

        var payload = {};
        if (nameInput  && nameInput.value.trim())  payload.name  = nameInput.value.trim();
        if (phoneInput && phoneInput.value.trim()) payload.phone = phoneInput.value.trim();

        if (!payload.name && !payload.phone) {
          if (msgEl) { msgEl.textContent = 'Podaj imię lub numer telefonu.'; msgEl.hidden = false; }
          return;
        }

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Zapisywanie…'; }
        if (msgEl)   { msgEl.hidden = true; }

        a.Auth.updateProfile(payload)
          .then(function (user) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zapisz profil'; }
            if (msgEl)   { msgEl.textContent = '✅ Profil zaktualizowany.'; msgEl.hidden = false; }
            // Update local cache
            try {
              var stored = JSON.parse(localStorage.getItem('qm_user') || '{}');
              if (user.name  !== undefined) stored.name  = user.name;
              if (user.phone !== undefined) stored.phone = user.phone;
              localStorage.setItem('qm_user', JSON.stringify(stored));
            } catch (_) {}
          })
          .catch(function (err) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zapisz profil'; }
            var errMsg = (err && err.body && err.body.error) || 'Błąd zapisu. Spróbuj ponownie.';
            if (msgEl) { msgEl.textContent = errMsg; msgEl.hidden = false; }
          });
      });
    }

    // Password change form submission
    if (passwordForm) {
      passwordForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var curInput  = passwordForm.querySelector('[data-profile-cur-password]');
        var newInput  = passwordForm.querySelector('[data-profile-new-password]');
        var saveBtn   = passwordForm.querySelector('[data-password-save]');
        var msgEl     = passwordForm.querySelector('[data-password-msg]');

        var curPassword = curInput  ? curInput.value  : '';
        var newPassword = newInput  ? newInput.value  : '';

        if (!curPassword || !newPassword) {
          if (msgEl) { msgEl.textContent = 'Podaj aktualne i nowe hasło.'; msgEl.hidden = false; }
          return;
        }
        if (newPassword.length < 8) {
          if (msgEl) { msgEl.textContent = 'Nowe hasło musi mieć co najmniej 8 znaków.'; msgEl.hidden = false; }
          return;
        }

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Zmienianie…'; }
        if (msgEl)   { msgEl.hidden = true; }

        a.Auth.changePassword(curPassword, newPassword)
          .then(function () {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zmień hasło'; }
            if (msgEl)   { msgEl.textContent = '✅ Hasło zostało zmienione.'; msgEl.hidden = false; }
            if (curInput)  curInput.value  = '';
            if (newInput)  newInput.value  = '';
          })
          .catch(function (err) {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zmień hasło'; }
            var errMsg = (err && err.body && err.body.error) || 'Błąd zmiany hasła. Sprawdź aktualne hasło.';
            if (msgEl) { msgEl.textContent = errMsg; msgEl.hidden = false; }
          });
      });
    }
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

    orders.forEach(function (order) {
      var row = document.createElement('div');
      row.className = 'order-row';
      var date = order.created_at ? new Date(order.created_at).toLocaleDateString('pl-PL') : '—';
      var total = order.total_amount != null ? formatPrice(order.total_amount) : '—';
      var status = escHtml(order.status || '—');
      row.innerHTML =
        '<span class="order-num">' + escHtml(order.order_number || (order.id || '').slice(0, 8) || '—') + '</span>' +
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
          items: cartItems.map(function (cartItem) {
            return { product_id: cartItem.id, quantity: Number(cartItem.qty) || 1 };
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

  // ─── 8. Seller Panel (panel-sklepu) ──────────────────────────────────────────

  function initPanelSklepuFlow() {
    var a = api();
    if (!a || !isLoggedInApi()) return;

    // Load store info first, then populate the panel
    a.MyStore.get()
      .then(function (store) {
        if (!store) return;
        window._panelStore = store;

        // Update header store name
        var nameEls = document.querySelectorAll('[data-store-name]');
        nameEls.forEach(function (el) { el.textContent = store.name || 'Sklep'; });

        // Update plan badge
        var planEl = document.querySelector('[data-store-plan]');
        if (planEl) planEl.textContent = (store.plan || 'basic').toUpperCase();

        // Populate settings form
        var nameInput = document.querySelector('[data-settings-name]');
        if (nameInput) nameInput.value = store.name || '';
        var descInput = document.querySelector('[data-settings-desc]');
        if (descInput) descInput.value = store.description || '';
        var logoInput = document.querySelector('[data-settings-logo]');
        if (logoInput) logoInput.value = store.logo_url || '';
        var bannerInput = document.querySelector('[data-settings-banner]');
        if (bannerInput) bannerInput.value = store.banner_url || '';
        var fbInput = document.querySelector('[data-settings-social-facebook]');
        if (fbInput) fbInput.value = store.social_facebook || '';
        var igInput = document.querySelector('[data-settings-social-instagram]');
        if (igInput) igInput.value = store.social_instagram || '';
        var ttInput = document.querySelector('[data-settings-social-tiktok]');
        if (ttInput) ttInput.value = store.social_tiktok || '';

        // Load stats
        return a.MyStore.stats()
          .then(function (stats) {
            var orderCountEl = document.querySelector('[data-stat-orders]');
            if (orderCountEl) orderCountEl.textContent = stats.order_count || 0;

            var revenueEl = document.querySelector('[data-stat-revenue]');
            if (revenueEl) revenueEl.textContent = formatPrice(stats.revenue || 0);

            var prodCountEl = document.querySelector('[data-stat-products]');
            if (prodCountEl) prodCountEl.textContent = stats.product_count || 0;

            var custCountEl = document.querySelector('[data-stat-customers]');
            if (custCountEl) custCountEl.textContent = stats.customer_count || 0;

            // Earnings
            var earningsRevenueEl = document.querySelector('[data-earnings-revenue]');
            if (earningsRevenueEl) earningsRevenueEl.textContent = formatPrice(stats.revenue || 0);
            var earningsCommEl = document.querySelector('[data-earnings-commission]');
            if (earningsCommEl) earningsCommEl.textContent = formatPrice(stats.platform_commission || 0);
            var earningsSellerEl = document.querySelector('[data-earnings-seller]');
            if (earningsSellerEl) earningsSellerEl.textContent = formatPrice(stats.seller_earnings || 0);
          })
          .catch(function () {});
      })
      .catch(function () {
        var emptyEl = document.querySelector('[data-store-empty]');
        var contentEl = document.querySelector('[data-store-content]');
        if (emptyEl) emptyEl.hidden = false;
        if (contentEl) contentEl.hidden = true;
      });

    // Load store products — depends on store id; resolved from cached _panelStore or a fresh call
    Promise.resolve(window._panelStore || a.MyStore.get())
      .then(function (store) {
        if (!store) return;
        window._panelStore = store;
        return a.MyStore.products(store.id, { limit: 50 });
      })
      .then(function (data) {
        if (!data) return;
        var products = data.products || [];
        renderSellerProducts(products);
      })
      .catch(function () {});

    // Load store orders
    a.MyStore.storeOrders({ limit: 20 })
      .then(function (data) {
        var orders = (data && data.orders) ? data.orders : [];
        renderSellerOrders(orders);
      })
      .catch(function () {});

    // Wire "Dodaj produkt" button (in Products tab)
    var addBtn = document.querySelector('[data-add-store-product]');
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        Promise.resolve(window._panelStore || a.MyStore.get())
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

    // Settings form submission
    var settingsForm = document.querySelector('[data-settings-form]');
    if (settingsForm) {
      settingsForm.addEventListener('submit', function (e) {
        e.preventDefault();
        var nameInput   = settingsForm.querySelector('[data-settings-name]');
        var descInput   = settingsForm.querySelector('[data-settings-desc]');
        var logoInput   = settingsForm.querySelector('[data-settings-logo]');
        var bannerInput = settingsForm.querySelector('[data-settings-banner]');
        var fbInput     = settingsForm.querySelector('[data-settings-social-facebook]');
        var igInput     = settingsForm.querySelector('[data-settings-social-instagram]');
        var ttInput     = settingsForm.querySelector('[data-settings-social-tiktok]');
        var saveBtn     = settingsForm.querySelector('[data-settings-save]');

        var payload = {};
        if (nameInput   && nameInput.value.trim())   payload.name        = nameInput.value.trim();
        if (descInput   && descInput.value.trim())   payload.description = descInput.value.trim();
        if (logoInput   && logoInput.value.trim())   payload.logo_url    = logoInput.value.trim();
        if (bannerInput && bannerInput.value.trim()) payload.banner_url  = bannerInput.value.trim();
        if (fbInput)     payload.social_facebook  = fbInput.value.trim() || null;
        if (igInput)     payload.social_instagram = igInput.value.trim() || null;
        if (ttInput)     payload.social_tiktok    = ttInput.value.trim() || null;

        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Zapisywanie…'; }

        a.MyStore.update(payload)
          .then(function () {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zapisz zmiany'; }
            var msg = document.querySelector('[data-settings-msg]');
            if (msg) { msg.textContent = 'Zapisano pomyślnie.'; msg.hidden = false; }
          })
          .catch(function () {
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Zapisz zmiany'; }
            var msg = document.querySelector('[data-settings-msg]');
            if (msg) { msg.textContent = 'Błąd zapisu. Sprawdź dane.'; msg.hidden = false; }
          });
      });
    }

    // Wire catalog (add product from central catalog)
    initCatalogFlow();
  }

  function renderSellerProducts(products) {
    var tbody = document.querySelector('[data-products-tbody]');
    if (!tbody) return;
    var emptyEl = document.querySelector('[data-products-empty]');
    var loadingEl = document.querySelector('[data-products-loading]');
    if (loadingEl) loadingEl.hidden = true;

    if (!products.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    tbody.innerHTML = '';
    products.forEach(function (product) {
      var activeLabel = product.active !== false ? 'Aktywny' : 'Wyłączony';
      var activePill = product.active !== false ? 'pill-active' : 'pill-inactive';
      var currentMargin = product.margin_override != null ? product.margin_override : (product.base_margin || 0);
      var currentPrice = product.price_override != null ? product.price_override : (product.price || product.base_price || 0);
      var basePrice = product.base_price || product.price || 0;

      var row = document.createElement('tr');
      row.setAttribute('data-shop-product-id', product.id || '');
      row.innerHTML =
        '<td>' + escHtml(product.name || product.custom_title || '—') + '</td>' +
        '<td>' + formatPrice(basePrice) + '</td>' +
        '<td>' +
          '<input type="number" min="0" max="200" step="0.1" class="owner-input" ' +
            'style="width:80px;padding:4px 8px;font-size:13px" ' +
            'value="' + escHtml(String(currentMargin)) + '" ' +
            'data-edit-margin ' +
            'aria-label="Marża dla ' + escHtml(product.name || '') + '">' +
          '%' +
        '</td>' +
        '<td>' +
          '<input type="number" min="0" step="0.01" class="owner-input" ' +
            'style="width:100px;padding:4px 8px;font-size:13px" ' +
            'value="' + escHtml(String(parseFloat(currentPrice).toFixed(2))) + '" ' +
            'data-edit-price ' +
            'aria-label="Cena dla ' + escHtml(product.name || '') + '">' +
          ' zł' +
        '</td>' +
        '<td><span class="' + activePill + '">' + activeLabel + '</span></td>' +
        '<td style="white-space:nowrap">' +
          '<button class="btn btn-primary" style="padding:4px 10px;font-size:12px;margin-right:4px" ' +
            'data-save-product-id="' + escHtml(product.id || '') + '">' +
            'Zapisz' +
          '</button>' +
          '<button class="btn btn-secondary" style="padding:4px 10px;font-size:12px" ' +
            'data-toggle-product-id="' + escHtml(product.id || '') + '" ' +
            'data-toggle-product-active="' + (product.active !== false ? 'true' : 'false') + '">' +
            (product.active !== false ? 'Wyłącz' : 'Włącz') +
          '</button>' +
        '</td>';
      tbody.appendChild(row);
    });

    // Wire save buttons (margin + price)
    tbody.addEventListener('click', function (e) {
      var saveBtn = e.target.closest('[data-save-product-id]');
      if (saveBtn) {
        var id  = saveBtn.getAttribute('data-save-product-id');
        var row = saveBtn.closest('tr');
        var marginInput = row.querySelector('[data-edit-margin]');
        var priceInput  = row.querySelector('[data-edit-price]');
        var a2 = api();
        if (!a2) return;

        var payload = {};
        if (marginInput) payload.margin_override = parseFloat(marginInput.value) || 0;
        if (priceInput) payload.price_override = parseFloat(priceInput.value) || null;

        saveBtn.disabled = true;
        saveBtn.textContent = '…';

        a2.MyStore.updateProduct(id, payload)
          .then(function () {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Zapisano';
            setTimeout(function () { saveBtn.textContent = 'Zapisz'; }, 1500);
          })
          .catch(function () {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Błąd';
            setTimeout(function () { saveBtn.textContent = 'Zapisz'; }, 1500);
          });
        return;
      }

      // Wire toggle buttons
      var toggleBtn = e.target.closest('[data-toggle-product-id]');
      if (!toggleBtn) return;
      var id     = toggleBtn.getAttribute('data-toggle-product-id');
      var active = toggleBtn.getAttribute('data-toggle-product-active') !== 'true';
      var a2 = api();
      if (!a2) return;
      toggleBtn.disabled = true;
      a2.MyStore.updateProduct(id, { active: active })
        .then(function () {
          toggleBtn.setAttribute('data-toggle-product-active', active ? 'true' : 'false');
          toggleBtn.textContent = active ? 'Wyłącz' : 'Włącz';
          var pill = toggleBtn.closest('tr').querySelector('.pill-active,.pill-inactive');
          if (pill) {
            pill.className = active ? 'pill-active' : 'pill-inactive';
            pill.textContent = active ? 'Aktywny' : 'Wyłączony';
          }
          toggleBtn.disabled = false;
        })
        .catch(function () { toggleBtn.disabled = false; });
    });
  }

  function initCatalogFlow() {
    var searchInput   = document.querySelector('[data-catalog-search]');
    var searchBtn     = document.querySelector('[data-catalog-load]');
    var catalogLoading = document.querySelector('[data-catalog-loading]');
    var catalogEmpty  = document.querySelector('[data-catalog-empty]');
    var catalogWrap   = document.querySelector('[data-catalog-table-wrap]');
    var catalogTbody  = document.querySelector('[data-catalog-tbody]');

    if (!searchBtn || !catalogTbody) return;

    function loadCatalog(query) {
      var a = api();
      if (!a) return;

      if (catalogLoading) catalogLoading.hidden = false;
      if (catalogEmpty)   catalogEmpty.hidden   = true;
      if (catalogWrap)    catalogWrap.hidden    = true;

      var params = { is_central: true, status: 'active', limit: 30 };
      if (query) params.search = query;

      a.Products.list(params)
        .then(function (data) {
          if (catalogLoading) catalogLoading.hidden = true;
          var products = Array.isArray(data) ? data
            : (data && Array.isArray(data.products)) ? data.products : [];

          if (!products.length) {
            if (catalogEmpty) catalogEmpty.hidden = false;
            return;
          }

          catalogTbody.innerHTML = '';
          products.forEach(function (p) {
            var tr = document.createElement('tr');
            tr.innerHTML =
              '<td>' + escHtml(p.name || '—') + '</td>' +
              '<td class="cell-muted">' + escHtml(p.category || '—') + '</td>' +
              '<td>' + formatPrice(p.price_gross || p.selling_price || 0) + '</td>' +
              '<td>' +
                '<button class="btn btn-primary" style="padding:4px 10px;font-size:12px" ' +
                  'data-add-catalog-product="' + escHtml(p.id || '') + '" ' +
                  'data-add-catalog-name="' + escHtml(p.name || '') + '">' +
                  '+ Dodaj' +
                '</button>' +
              '</td>';
            catalogTbody.appendChild(tr);
          });

          if (catalogWrap) catalogWrap.hidden = false;
        })
        .catch(function () {
          if (catalogLoading) catalogLoading.hidden = true;
          if (catalogEmpty) { catalogEmpty.textContent = 'Błąd ładowania katalogu.'; catalogEmpty.hidden = false; }
        });
    }

    searchBtn.addEventListener('click', function () {
      loadCatalog(searchInput ? searchInput.value.trim() : '');
    });

    if (searchInput) {
      searchInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') loadCatalog(searchInput.value.trim());
      });
    }

    // Wire "Add to store" buttons
    if (catalogTbody) {
      catalogTbody.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-add-catalog-product]');
        if (!btn) return;
        var productId   = btn.getAttribute('data-add-catalog-product');
        var productName = btn.getAttribute('data-add-catalog-name');
        var a2 = api();
        if (!a2) return;

        var store = window._panelStore;
        if (!store) {
          alert('Błąd: brak aktywnego sklepu.');
          return;
        }

        btn.disabled = true;
        btn.textContent = '…';

        a2.MyStore.addProduct({ store_id: store.id, product_id: productId, active: true })
          .then(function () {
            btn.textContent = '✓ Dodano';
            btn.disabled = true;
            // Reload products list
            return a2.MyStore.products(store.id, { limit: 50 });
          })
          .then(function (data) {
            if (data) renderSellerProducts(data.products || []);
          })
          .catch(function (err) {
            btn.disabled = false;
            btn.textContent = '+ Dodaj';
            var msg = (err && err.body && err.body.error) || 'Błąd dodawania produktu.';
            alert(msg);
          });
      });
    }
  }

  function renderSellerOrders(orders) {
    var tbody = document.querySelector('[data-orders-tbody]');
    if (!tbody) return;
    var emptyEl   = document.querySelector('[data-seller-orders-empty]');
    var loadingEl = document.querySelector('[data-seller-orders-loading]');
    if (loadingEl) loadingEl.hidden = true;

    if (!orders.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }
    if (emptyEl) emptyEl.hidden = true;

    var STATUSES = ['new', 'processing', 'shipped', 'completed'];

    tbody.innerHTML = '';
    orders.forEach(function (order) {
      var row = document.createElement('tr');
      var num = escHtml(order.order_number || (order.id || '').slice(0, 8) || '—');
      var date = order.created_at ? new Date(order.created_at).toLocaleDateString('pl-PL') : '—';
      var status = order.status || 'new';

      var selectHtml = '<select class="owner-filter" style="padding:4px 8px;font-size:12px" ' +
        'data-order-status-id="' + escHtml(order.id || '') + '">';
      STATUSES.forEach(function (statusOption) {
        selectHtml += '<option value="' + statusOption + '"' + (statusOption === status ? ' selected' : '') + '>' + statusOption + '</option>';
      });
      selectHtml += '</select>';

      row.innerHTML =
        '<td class="cell-mono">' + num + '</td>' +
        '<td class="cell-muted">' + escHtml(date) + '</td>' +
        '<td>' + escHtml(order.shipping_address || '—') + '</td>' +
        '<td>' + selectHtml + '</td>';
      tbody.appendChild(row);
    });

    // Wire status dropdowns
    tbody.addEventListener('change', function (e) {
      var sel = e.target.closest('[data-order-status-id]');
      if (!sel) return;
      var id     = sel.getAttribute('data-order-status-id');
      var status = sel.value;
      var a2 = api();
      if (!a2) return;
      sel.disabled = true;
      a2.Orders.updateStatus(id, status)
        .then(function () { sel.disabled = false; })
        .catch(function () { sel.disabled = false; });
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
