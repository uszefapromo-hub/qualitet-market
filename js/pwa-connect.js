/**
 * pwa-connect.js – Frontend ↔ Backend API bridge
 *
 * Intercepts key user actions (login, register, checkout, dashboard refresh)
 * and routes them through the backend REST API (window.QMApi / js/api.js).
 *
 * Network errors fall back gracefully to the existing localStorage-based
 * flow so the app continues to work offline or when the backend is unreachable.
 *
 * Load order:  js/api.js → js/pwa-connect.js → js/app.js
 *
 * Exposes:
 *   window.QM_CONNECT.isOnline()
 *   window.QM_CONNECT.syncUser()
 *   window.QM_CONNECT.syncOrders()
 */
(function (global) {
  'use strict';

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function getApi() { return global.QMApi || null; }

  function showFormError(form, message) {
    let el = form && form.querySelector('[data-api-error]');
    if (!el && form) {
      el = document.createElement('p');
      el.setAttribute('data-api-error', '');
      el.style.cssText = 'color:#e53e3e;margin:.5rem 0;font-size:.9rem;';
      const firstInput = form.querySelector('input,button');
      if (firstInput) firstInput.parentNode.insertBefore(el, firstInput);
      else form.appendChild(el);
    }
    if (el) {
      el.textContent = message;
      el.hidden = false;
    }
  }

  function clearFormError(form) {
    const el = form && form.querySelector('[data-api-error]');
    if (el) { el.textContent = ''; el.hidden = true; }
  }

  function isOnline() {
    return typeof navigator !== 'undefined' ? navigator.onLine !== false : true;
  }

  // ─── Login intercept ──────────────────────────────────────────────────────────

  function interceptLoginForm() {
    document.addEventListener(
      'submit',
      async function handleLoginSubmit(e) {
        const form = e.target;
        if (!form || !form.matches('[data-login-form], #loginForm, form.login-form')) return;

        const api = getApi();
        if (!api || !isOnline()) return; // fall through to app.js localStorage handler

        e.preventDefault();
        e.stopImmediatePropagation();

        const emailEl    = form.querySelector('[name="email"], #loginEmail, input[type="email"]');
        const passwordEl = form.querySelector('[name="password"], #loginPassword, input[type="password"]');
        if (!emailEl || !passwordEl) return;

        const email    = emailEl.value.trim();
        const password = passwordEl.value;

        clearFormError(form);
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Logowanie…'; }

        try {
          const data = await api.Auth.login(email, password);
          // Success: let app.js pick up the stored token/user and redirect
          form.dispatchEvent(new CustomEvent('qm:login:success', { detail: data, bubbles: true }));
          // Trigger standard post-login redirect
          const redirect = new URLSearchParams(location.search).get('redirect') || 'dashboard.html';
          location.href = redirect;
        } catch (err) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Zaloguj się'; }
          if (err.status) {
            showFormError(form, err.message || 'Nieprawidłowy e-mail lub hasło');
          } else {
            // Network error – fall back to localStorage mode
            console.warn('pwa-connect: login API unreachable, falling back to localStorage');
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        }
      },
      true // capture phase – fires before app.js
    );
  }

  // ─── Register intercept ───────────────────────────────────────────────────────

  function interceptRegisterForm() {
    document.addEventListener(
      'submit',
      async function handleRegisterSubmit(e) {
        const form = e.target;
        if (!form || !form.matches('[data-register-form], #registerForm, form.register-form')) return;

        const api = getApi();
        if (!api || !isOnline()) return;

        e.preventDefault();
        e.stopImmediatePropagation();

        const emailEl    = form.querySelector('[name="email"], #regEmail, input[type="email"]');
        const passwordEl = form.querySelector('[name="password"], #regPassword, input[type="password"]');
        const nameEl     = form.querySelector('[name="name"], #regName, input[type="text"]');
        if (!emailEl || !passwordEl) return;

        const email    = emailEl.value.trim();
        const password = passwordEl.value;
        const name     = nameEl ? nameEl.value.trim() : email.split('@')[0];
        const roleEl   = form.querySelector('[name="role"]');
        const role     = roleEl ? roleEl.value : 'seller';

        clearFormError(form);
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Rejestracja…'; }

        try {
          const data = await api.Auth.register(email, password, name, role);
          form.dispatchEvent(new CustomEvent('qm:register:success', { detail: data, bubbles: true }));
          const redirect = data.next_step === 'create_shop'
            ? 'generator-sklepu.html'
            : (new URLSearchParams(location.search).get('redirect') || 'dashboard.html');
          location.href = redirect;
        } catch (err) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Zarejestruj się'; }
          if (err.status) {
            showFormError(form, err.message || 'Rejestracja nie powiodła się');
          } else {
            console.warn('pwa-connect: register API unreachable, falling back to localStorage');
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        }
      },
      true
    );
  }

  // ─── Checkout intercept ────────────────────────────────────────────────────────

  function interceptCheckoutForm() {
    document.addEventListener(
      'submit',
      async function handleCheckoutSubmit(e) {
        const form = e.target;
        if (!form || !form.matches('[data-checkout-form], #checkoutForm, form.checkout-form')) return;

        const api = getApi();
        if (!api || !isOnline()) return;

        const token = (api.Auth && api.Auth.getToken) ? api.Auth.getToken() : null;
        if (!token) return; // not logged in → fall through to app.js

        e.preventDefault();
        e.stopImmediatePropagation();

        const storeIdEl  = form.querySelector('[name="store_id"], [data-store-id]');
        const addressEl  = form.querySelector('[name="address"], [name="shipping_address"], textarea, input[placeholder*="adres"]');
        const storeId    = storeIdEl ? (storeIdEl.value || storeIdEl.dataset.storeId) : null;
        const address    = addressEl ? addressEl.value.trim() : '';
        const notes      = (form.querySelector('[name="notes"]') || {}).value || '';

        if (!storeId || !address) {
          showFormError(form, 'Podaj adres dostawy i wybierz sklep.');
          return;
        }

        // Build items from QMCart (localStorage cart)
        const cart = global.QMCart ? global.QMCart.getCart() : [];
        if (!cart.length) {
          showFormError(form, 'Koszyk jest pusty.');
          return;
        }
        const items = cart.map((i) => ({ product_id: i.id, quantity: i.qty || 1 }));

        clearFormError(form);
        const submitBtn = form.querySelector('[type="submit"]');
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Składanie zamówienia…'; }

        try {
          const order = await api.Orders.create(storeId, items, address, notes);
          if (global.QMCart) global.QMCart.clearCart();
          form.dispatchEvent(new CustomEvent('qm:order:created', { detail: order, bubbles: true }));
          location.href = `koszyk.html?order=${order.id}&status=success`;
        } catch (err) {
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Złóż zamówienie'; }
          if (err.status) {
            showFormError(form, err.message || 'Nie udało się złożyć zamówienia.');
          } else {
            console.warn('pwa-connect: order API unreachable, falling back to localStorage');
            form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          }
        }
      },
      true
    );
  }

  // ─── Dashboard sync ────────────────────────────────────────────────────────────

  async function syncUser() {
    const api = getApi();
    if (!api || !isOnline()) return null;
    const token = api.Auth && api.Auth.getToken ? api.Auth.getToken() : null;
    if (!token) return null;
    try {
      return await api.Auth.me();
    } catch {
      return null;
    }
  }

  async function syncOrders(params = {}) {
    const api = getApi();
    if (!api || !isOnline()) return null;
    const token = api.Auth && api.Auth.getToken ? api.Auth.getToken() : null;
    if (!token) return null;
    try {
      return await api.Orders.list(params);
    } catch {
      return null;
    }
  }

  // Expose QM_API_CREATE_ORDER / QM_API_ORDERS_LIST for inline scripts
  global.QM_API_CREATE_ORDER = async function (storeId, items, shippingAddress, notes) {
    const api = getApi();
    if (!api) throw new Error('QMApi not loaded');
    return api.Orders.create(storeId, items, shippingAddress, notes);
  };

  global.QM_API_ORDERS_LIST = async function (params) {
    const api = getApi();
    if (!api) throw new Error('QMApi not loaded');
    return api.Orders.list(params);
  };

  // ─── Init ─────────────────────────────────────────────────────────────────────

  function init() {
    interceptLoginForm();
    interceptRegisterForm();
    interceptCheckoutForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  global.QM_CONNECT = { isOnline, syncUser, syncOrders };

}(typeof globalThis !== 'undefined' ? globalThis : this));
