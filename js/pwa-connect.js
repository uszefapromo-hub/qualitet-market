/**
 * pwa-connect.js – bridges the QualitetMarket PWA frontend to the backend REST API.
 *
 * Requires js/api.js to be loaded first (provides window.QMApi).
 * Gracefully degrades: if the API is unavailable, the existing localStorage
 * flow from app.js / cart.js continues to work unchanged.
 *
 * Pages handled:
 *   login.html   – email/password login + account registration via QMApi.Auth
 *   sklep.html   – product listing via QMApi.Products with mock fallback
 *   koszyk.html  – order submission via QMApi.Orders for logged-in users
 *   dashboard.html – real user profile & order history via QMApi.Auth + QMApi.Orders
 */
(function () {
  'use strict';

  var CURRENCY_FMT = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0 });

  var MS_PER_DAY = 86400000;
    return CURRENCY_FMT.format(Number(value) || 0);
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Login / Register ────────────────────────────────────────────────────────

  /**
   * Intercept the email login form at document-capture level so our handler
   * runs BEFORE the app.js bubble-phase handler on the form element itself.
   * Calling stopImmediatePropagation() during capture prevents the event
   * from reaching the form's own bubble handlers.
   */
  function initLoginPage() {
    var api = window.QMApi;
    if (!api) return;

    // Intercept form submit in capture phase at document level
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.hasAttribute('data-login-form')) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      var emailInput = form.querySelector('input[name="email"]');
      var passwordInput = form.querySelector('input[name="password"]');
      var email = emailInput ? emailInput.value.trim() : '';
      var password = passwordInput ? passwordInput.value : '';

      if (!email || !password) {
        showFormError(form, 'Podaj adres e-mail i has\u0142o.');
        return;
      }

      var submitBtn = form.querySelector('button[type="submit"]');
      var origText = submitBtn ? submitBtn.textContent : '';
      setButtonLoading(submitBtn, 'Logowanie\u2026');
      hideFormError(form);

      api.Auth.login(email, password)
        .then(function () {
          // Also set the legacy localStorage flag so app.js guards still pass
          try { localStorage.setItem('app_user_logged', 'true'); } catch (_) {}
          try { localStorage.setItem('app_user_email', email); } catch (_) {}
          window.location.href = 'dashboard.html';
        })
        .catch(function (err) {
          restoreButton(submitBtn, origText);
          // Show error for API-level failures (wrong credentials, etc.)
          // Only fall back to localStorage when the API is completely unreachable
          if (err && err.status) {
            var msg = (err.body && err.body.error) || 'B\u0142\u0105d logowania. Sprawd\u017a e-mail i has\u0142o.';
            showFormError(form, msg);
          } else {
            // Network/API unreachable – graceful degradation
            try { localStorage.setItem('app_user_logged', 'true'); } catch (_) {}
            try { localStorage.setItem('app_user_email', email); } catch (_) {}
            window.location.href = 'dashboard.html';
          }
        });
    }, true /* capture */);

    // Wire the "Utwórz konto" (registration) button
    document.addEventListener('DOMContentLoaded', function () {
      var loginForm = document.querySelector('[data-login-form]');
      if (!loginForm) return;

      var registerBtn = loginForm.querySelector('[data-register-btn]');
      if (registerBtn) {
        registerBtn.addEventListener('click', function () {
          showRegisterPanel();
        });
      }
    });

    // Intercept registration form submit (panel created dynamically)
    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.hasAttribute('data-register-form')) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      var name = (form.querySelector('input[name="name"]') || {}).value || '';
      var email = (form.querySelector('input[name="email"]') || {}).value || '';
      var password = (form.querySelector('input[name="password"]') || {}).value || '';
      var password2 = (form.querySelector('input[name="password2"]') || {}).value || '';

      if (!name.trim()) { showFormError(form, 'Podaj imi\u0119 i nazwisko.'); return; }
      if (!email) { showFormError(form, 'Podaj adres e-mail.'); return; }
      if (password.length < 8) { showFormError(form, 'Has\u0142o musi mie\u0107 co najmniej 8 znak\u00f3w.'); return; }
      if (password !== password2) { showFormError(form, 'Has\u0142a nie s\u0105 zgodne.'); return; }

      var submitBtn = form.querySelector('button[type="submit"]');
      var origText = submitBtn ? submitBtn.textContent : '';
      setButtonLoading(submitBtn, 'Tworz\u0119 konto\u2026');
      hideFormError(form);

      api.Auth.register(email, password, name.trim(), 'buyer')
        .then(function () {
          try { localStorage.setItem('app_user_logged', 'true'); } catch (_) {}
          try { localStorage.setItem('app_user_email', email); } catch (_) {}
          window.location.href = 'dashboard.html';
        })
        .catch(function (err) {
          restoreButton(submitBtn, origText);
          var msg = (err && err.body && err.body.error) || 'Rejestracja nie powiod\u0142a si\u0119. Spr\u00f3buj ponownie.';
          showFormError(form, msg);
        });
    }, true /* capture */);
  }

  function showRegisterPanel() {
    var loginPanel = document.getElementById('auth-panel-email');
    if (!loginPanel) return;

    var existing = document.getElementById('auth-panel-register');
    if (existing) {
      loginPanel.hidden = true;
      existing.hidden = false;
      return;
    }

    var panel = document.createElement('div');
    panel.id = 'auth-panel-register';
    panel.className = 'auth-tab-panel';
    panel.innerHTML =
      '<form class="form-card" data-register-form>' +
        '<label>Imi\u0119 i nazwisko<input type="text" name="name" placeholder="Jan Kowalski" autocomplete="name" required></label>' +
        '<label>E-mail<input type="email" name="email" placeholder="jan@przyk\u0142ad.pl" autocomplete="email" required></label>' +
        '<label>Has\u0142o (min. 8 znak\u00f3w)<input type="password" name="password" placeholder="\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7" autocomplete="new-password" required></label>' +
        '<label>Powt\u00f3rz has\u0142o<input type="password" name="password2" placeholder="\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7\u00b7" autocomplete="new-password" required></label>' +
        '<div class="cta-row auth-actions">' +
          '<button class="btn btn-primary" type="submit">Utw\u00f3rz konto</button>' +
          '<button class="btn btn-secondary" type="button" data-back-to-login>Mam ju\u017c konto</button>' +
        '</div>' +
        '<p class="hint pwa-form-error" hidden></p>' +
      '</form>';

    loginPanel.parentNode.insertBefore(panel, loginPanel.nextSibling);

    panel.querySelector('[data-back-to-login]').addEventListener('click', function () {
      panel.hidden = true;
      loginPanel.hidden = false;
    });

    loginPanel.hidden = true;
  }

  // ─── Products page ───────────────────────────────────────────────────────────

  function initProductsPage() {
    var api = window.QMApi;
    if (!api) return;

    api.Products.list({ status: 'active', limit: 48 })
      .then(function (data) {
        var products = Array.isArray(data) ? data : (data.products || []);
        if (!products.length) return;
        renderApiProducts(products);
      })
      .catch(function () {
        // API unavailable – let app.js mock data render (no action needed)
      });
  }

  function renderApiProducts(products) {
    var grid = document.querySelector('[data-store-products-grid]');
    if (!grid) return;

    var demoSection = document.querySelector('[data-store-demo-products]');
    if (demoSection) demoSection.hidden = true;

    grid.innerHTML = '';
    grid.hidden = false;
    var emptyEl = document.querySelector('[data-store-products-empty]');
    if (emptyEl) emptyEl.hidden = true;

    products.forEach(function (product) {
      var card = buildProductCard(product);
      grid.appendChild(card);
    });
  }

  function buildProductCard(product) {
    var id = product.id || '';
    var name = product.name || 'Produkt';
    var price = Number(product.selling_price || product.price_gross || product.price || 0);
    var img = product.image_url || product.img || '';
    var category = product.category_name || product.category || '';
    var description = product.description || '';

    var card = document.createElement('article');
    card.className = 'product-card product-tile';

    var imgHtml = img
      ? '<img src="' + escapeHtml(img) + '" alt="' + escapeHtml(name) + '" loading="lazy">'
      : '<span role="img" aria-label="Brak zdj\u0119cia produktu" style="font-size:42px">\ud83d\udce6</span>';

    card.innerHTML =
      '<div class="product-media">' + imgHtml + '</div>' +
      '<div class="product-details">' +
        '<span class="tag">' + escapeHtml(category) + '</span>' +
        '<h3>' + escapeHtml(name) + '</h3>' +
        (description ? '<p class="hint">' + escapeHtml(description.slice(0, 80)) + (description.length > 80 ? '\u2026' : '') + '</p>' : '') +
        '<div class="product-meta"><span class="price">' + formatPrice(price) + '</span></div>' +
        '<div class="cta-row product-actions">' +
          '<button class="btn btn-primary" type="button"' +
            ' data-add-to-cart' +
            ' data-product-id="' + escapeHtml(id) + '"' +
            ' data-product-name="' + escapeHtml(name) + '"' +
            ' data-product-price="' + price + '"' +
            ' data-product-img="' + escapeHtml(img) + '">' +
            'Dodaj do koszyka' +
          '</button>' +
        '</div>' +
      '</div>';

    return card;
  }

  // ─── Cart / Checkout page ────────────────────────────────────────────────────

  /**
   * If the user is logged in, intercept the checkout form during capture phase
   * and submit the order via the API.  The existing inline handler (localStorage)
   * is bypassed only when we can actually reach the API.
   * On API failure we re-enable the button and let the user retry.
   */
  function initCartPage() {
    var api = window.QMApi;
    if (!api || !api.Auth.isLoggedIn()) return;

    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || !form.hasAttribute('data-checkout-form')) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      var cart = window.QMCart;
      if (!cart) return;

      var items = cart.getCart();
      if (!items || !items.length) return;

      var submitBtn = form.querySelector('[data-checkout-btn]');
      setButtonLoading(submitBtn, 'Sk\u0142adam zam\u00f3wienie\u2026');

      var fd = new FormData(form);

      var shipping = [
        fd.get('name') || '',
        fd.get('address') || ''
      ].filter(Boolean).join(', ');

      var notes = [
        fd.get('email') ? 'E-mail: ' + fd.get('email') : '',
        fd.get('phone') ? 'Tel: ' + fd.get('phone') : ''
      ].filter(Boolean).join('; ');

      var orderItems = items.map(function (item) {
        return { product_id: item.id, quantity: Number(item.qty) || 1 };
      });

      var storeId = null;
      try {
        var activeStore = JSON.parse(localStorage.getItem('activeStore') || 'null');
        storeId = activeStore && activeStore.id ? activeStore.id : null;
      } catch (_) {}

      if (!storeId) {
        restoreButton(submitBtn, 'Z\u0142\u00f3\u017c zam\u00f3wienie');
        submitLocalOrder(form, cart, items, fd);
        return;
      }

      api.Orders.create({
        store_id: storeId,
        items: orderItems,
        shipping_address: shipping,
        notes: notes
      })
        .then(function (order) {
          cart.clearCart();
          var numEl = document.querySelector('[data-order-number]');
          if (numEl) {
            numEl.textContent = 'Numer zam\u00f3wienia: ' + (order.number || order.id || '');
          }
          showOrderSuccess();
        })
        .catch(function () {
          restoreButton(submitBtn, 'Z\u0142\u00f3\u017c zam\u00f3wienie');
          submitLocalOrder(form, cart, items, fd);
        });
    }, true /* capture */);
  }

  function submitLocalOrder(form, cart, items, fd) {
    var formData = {
      name: fd.get('name') || '',
      email: fd.get('email') || '',
      phone: fd.get('phone') || '',
      address: fd.get('address') || ''
    };
    var order = cart.saveOrder(formData, items);
    try { sessionStorage.setItem('qm_last_order', order.number); } catch (_) {}
    cart.clearCart();
    var numEl = document.querySelector('[data-order-number]');
    if (numEl) numEl.textContent = 'Numer zam\u00f3wienia: ' + order.number;
    showOrderSuccess();
  }

  function showOrderSuccess() {
    var contentEl = document.querySelector('[data-cart-content]');
    var successEl = document.querySelector('[data-order-success]');
    if (contentEl) contentEl.hidden = true;
    if (successEl) successEl.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ─── Dashboard page ──────────────────────────────────────────────────────────

  function initDashboardPage() {
    var api = window.QMApi;
    if (!api || !api.Auth.isLoggedIn()) {
      return;
    }

    api.Auth.me()
      .then(function (user) {
        updateDashboardUser(user);
      })
      .catch(function (err) {
        if (err && err.status === 401) {
          api.Auth.logout();
          try { localStorage.removeItem('app_user_logged'); } catch (_) {}
        }
      });

    loadDashboardOrders();
  }

  function updateDashboardUser(user) {
    var welcomeEl = document.querySelector('.dashboard-welcome h1');
    if (welcomeEl && user.name) {
      welcomeEl.textContent = 'Witaj, ' + user.name + '!';
    }

    var plan = (user.plan || 'trial').toUpperCase();
    document.querySelectorAll('[data-user-plan],[data-plan-name]').forEach(function (el) {
      el.textContent = plan;
    });

    if (user.trial_ends_at || user.trialEndsAt) {
      var endsAt = new Date(user.trial_ends_at || user.trialEndsAt);
      var daysLeft = Math.max(0, Math.ceil((endsAt - Date.now()) / MS_PER_DAY));
      document.querySelectorAll('[data-trial-remaining],[data-plan-trial]').forEach(function (el) {
        el.textContent = daysLeft;
      });
    }
  }

  function loadDashboardOrders() {
    var api = window.QMApi;
    if (!api) return;

    var ordersSection = document.querySelector('[data-api-orders]');
    if (!ordersSection) return;

    api.Orders.list({ limit: 5 })
      .then(function (data) {
        var orders = Array.isArray(data) ? data : (data.orders || []);
        renderDashboardOrders(ordersSection, orders);
      })
      .catch(function () {
        var loadingEl = ordersSection.querySelector('[data-orders-loading]');
        if (loadingEl) loadingEl.hidden = true;
      });
  }

  function renderDashboardOrders(container, orders) {
    var loadingEl = container.querySelector('[data-orders-loading]');
    var listEl = container.querySelector('[data-orders-list]');
    var emptyEl = container.querySelector('[data-orders-empty]');

    if (loadingEl) loadingEl.hidden = true;

    if (!orders.length) {
      if (emptyEl) emptyEl.hidden = false;
      return;
    }

    if (!listEl) return;

    listEl.innerHTML = '';
    orders.forEach(function (order) {
      var date = order.created_at ? new Date(order.created_at).toLocaleDateString('pl-PL') : '\u2014';
      var total = order.total_amount != null ? formatPrice(order.total_amount) : '\u2014';
      var status = translateStatus(order.status || 'pending');
      var row = document.createElement('div');
      row.className = 'order-row';
      row.innerHTML =
        '<span class="order-num">' + escapeHtml(order.number || (order.id || '').slice(0, 8)) + '</span>' +
        '<span class="order-date">' + date + '</span>' +
        '<span class="order-total">' + total + '</span>' +
        '<span class="order-status badge-pill">' + escapeHtml(status) + '</span>';
      listEl.appendChild(row);
    });
    if (emptyEl) emptyEl.hidden = true;
  }

  function translateStatus(status) {
    var map = {
      pending: 'Oczekuj\u0105ce',
      confirmed: 'Potwierdzone',
      shipped: 'Wys\u0142ane',
      delivered: 'Dostarczone',
      cancelled: 'Anulowane'
    };
    return map[status] || status;
  }

  // ─── Shared UI helpers ───────────────────────────────────────────────────────

  function showFormError(form, msg) {
    var el = form.querySelector('.pwa-form-error');
    if (!el) {
      el = document.createElement('p');
      el.className = 'hint pwa-form-error';
      form.appendChild(el);
    }
    el.textContent = msg;
    el.hidden = false;
  }

  function hideFormError(form) {
    var el = form.querySelector('.pwa-form-error');
    if (el) el.hidden = true;
  }

  function setButtonLoading(btn, text) {
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = text;
  }

  function restoreButton(btn, origText) {
    if (!btn) return;
    btn.disabled = false;
    btn.textContent = origText || 'Wy\u015blij';
  }

  // ─── Store panel page (panel-sklepu.html) ────────────────────────────────────

  function initStorePanelPage() {
    var api = window.QMApi;
    if (!api || !api.Auth.isLoggedIn()) {
      return;
    }

    var contentEl = document.querySelector('[data-store-content]');
    var emptyEl = document.querySelector('[data-store-empty]');

    api.MyStore.get()
      .then(function (store) {
        if (!store || !store.id) {
          if (contentEl) contentEl.hidden = true;
          if (emptyEl) emptyEl.hidden = false;
          return;
        }

        if (contentEl) contentEl.hidden = false;
        if (emptyEl) emptyEl.hidden = true;

        var nameEl = document.querySelector('[data-store-name]');
        if (nameEl) nameEl.textContent = store.name || 'Panel sklepu';

        var planEl = document.querySelector('[data-store-plan]');
        if (planEl) planEl.textContent = (store.plan || 'trial').toUpperCase();

        var marginEl = document.querySelector('[data-store-margin]');
        if (marginEl) marginEl.textContent = (store.margin != null ? store.margin : 0) + '%';

        var subdomainEl = document.querySelector('[data-store-subdomain]');
        if (subdomainEl && store.subdomain) subdomainEl.textContent = store.subdomain;

        var slugEl = document.querySelector('[data-store-slug]');
        if (slugEl && store.slug) slugEl.textContent = store.slug;
      })
      .catch(function () {
        // Keep whatever the localStorage-based shop.js already rendered;
        // only show the empty state when there is genuinely no store data.
        var hasLocalStore = window.StoreManager && window.StoreManager.getActiveStore();
        if (!hasLocalStore) {
          if (contentEl) contentEl.hidden = true;
          if (emptyEl) emptyEl.hidden = false;
        }
      });
  }

  // ─── Owner panel page (owner-panel.html) ─────────────────────────────────────

  function initOwnerPanelPage() {
    var api = window.QMApi;
    if (!api || !api.Auth.isLoggedIn()) {
      return;
    }

    api.MyStore.get()
      .then(function (store) {
        if (!store) return;
        var nameEl = document.querySelector('[data-store-name]');
        if (nameEl) nameEl.textContent = store.name || '';
      })
      .catch(function (err) {
        console.warn('[pwa-connect] owner-panel: could not load store data', err);
      });
  }

  // ─── Entry point ─────────────────────────────────────────────────────────────

  var page = document.body ? document.body.dataset.page : null;

  if (page === 'login') {
    initLoginPage();
  }

  if (page === 'sklep') {
    document.addEventListener('DOMContentLoaded', function () {
      initProductsPage();
    });
  }

  if (page === 'koszyk') {
    initCartPage();
  }

  if (page === 'dashboard') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(function () {
        initDashboardPage();
      }, 0);
    });
  }

  if (page === 'panel-sklepu') {
    document.addEventListener('DOMContentLoaded', function () {
      initStorePanelPage();
    });
  }

  if (page === 'owner-panel') {
    document.addEventListener('DOMContentLoaded', function () {
      initOwnerPanelPage();
    });
  }

}());
