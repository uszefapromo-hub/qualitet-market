/**
 * Qualitet Platform – API Client
 * ================================
 * Thin, promise-based wrapper around the Qualitet REST API.
 * Stores the JWT token in localStorage under the key `qualitet_token`.
 *
 * Usage (progressive migration from localStorage):
 *
 *   // Authenticate once
 *   const { token, user } = await QualitetAPI.auth.login(email, password);
 *
 *   // Then use any resource method
 *   const { products } = await QualitetAPI.products.list({ central: true });
 *
 * If the API is unreachable (e.g. offline / dev-mode with no backend),
 * each method rejects with an error – callers should fall back to localStorage
 * data as needed.
 */

(function (global) {
  'use strict';

  // ─── Configuration ──────────────────────────────────────────────────────────

  const TOKEN_KEY = 'qualitet_token';
  const USER_KEY  = 'qualitet_user';

  // Resolve API base URL from meta tag, window variable or default
  function getBaseUrl() {
    if (typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="api-base-url"]');
      if (meta) return meta.getAttribute('content').replace(/\/$/, '');
    }
    if (global.QUALITET_API_URL) return global.QUALITET_API_URL.replace(/\/$/, '');
    return '/api';
  }

  // ─── Token helpers ───────────────────────────────────────────────────────────

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || null;
  }

  function setToken(token) {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  function setUser(user) {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
    } catch {
      return null;
    }
  }

  // ─── Core fetch helper ───────────────────────────────────────────────────────

  async function apiFetch(method, path, body, options = {}) {
    const base = getBaseUrl();
    const url  = base + path;

    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;

    const init = { method, headers, ...options };
    if (body !== undefined) init.body = JSON.stringify(body);

    const response = await fetch(url, init);

    // Parse JSON regardless of status
    let data;
    try {
      data = await response.json();
    } catch {
      data = { error: 'Nieprawidłowa odpowiedź serwera' };
    }

    if (!response.ok) {
      const msg = data.error || data.message || `HTTP ${response.status}`;
      const err = new Error(msg);
      err.status = response.status;
      err.data   = data;
      throw err;
    }

    return data;
  }

  // Convenience shortcuts
  const get    = (path, qs)   => apiFetch('GET', path + buildQS(qs));
  const post   = (path, body) => apiFetch('POST',   path, body);
  const put    = (path, body) => apiFetch('PUT',    path, body);
  const patch  = (path, body) => apiFetch('PATCH',  path, body);
  const del    = (path, body) => apiFetch('DELETE', path, body);

  function buildQS(params) {
    if (!params || !Object.keys(params).length) return '';
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(v))
      .join('&');
    return qs ? '?' + qs : '';
  }

  // ─── Auth ────────────────────────────────────────────────────────────────────

  const auth = {
    /** POST /api/users/register */
    register(email, password, name, role = 'buyer') {
      return post('/users/register', { email, password, name, role }).then((d) => {
        setToken(d.token);
        setUser(d.user);
        return d;
      });
    },

    /** POST /api/users/login */
    login(email, password) {
      return post('/users/login', { email, password }).then((d) => {
        setToken(d.token);
        setUser(d.user);
        return d;
      });
    },

    /** Remove token and user from localStorage */
    logout() {
      setToken(null);
      setUser(null);
    },

    /** GET /api/users/me */
    me() {
      return get('/users/me').then((d) => { setUser(d); return d; });
    },

    /** PUT /api/users/me */
    updateProfile(data) {
      return put('/users/me', data);
    },

    /** PUT /api/users/me/password */
    changePassword(currentPassword, newPassword) {
      return put('/users/me/password', { currentPassword, newPassword });
    },

    getToken,
    getUser,
    isLoggedIn: () => !!getToken(),
  };

  // ─── Stores ──────────────────────────────────────────────────────────────────

  const stores = {
    /** GET /api/stores */
    list(params) { return get('/stores', params); },

    /** GET /api/stores/:id */
    get(id) { return get('/stores/' + id); },

    /** POST /api/stores */
    create(data) { return post('/stores', data); },

    /** PUT /api/stores/:id */
    update(id, data) { return put('/stores/' + id, data); },

    /** DELETE /api/stores/:id */
    delete(id) { return del('/stores/' + id); },
  };

  // ─── Products (central catalogue + store-scoped) ─────────────────────────────

  const products = {
    /**
     * GET /api/products
     * @param {{ store_id?, central?, category?, search?, page?, limit? }} params
     */
    list(params) { return get('/products', params); },

    /** GET /api/products/:id */
    get(id) { return get('/products/' + id); },

    /**
     * POST /api/products
     * Omit store_id to create a central-catalogue product (admin/owner only).
     */
    create(data) { return post('/products', data); },

    /** PUT /api/products/:id */
    update(id, data) { return put('/products/' + id, data); },

    /** DELETE /api/products/:id */
    delete(id) { return del('/products/' + id); },
  };

  // ─── Shop products (store ↔ catalogue bridge) ─────────────────────────────────

  const shopProducts = {
    /**
     * GET /api/shop-products?store_id=&page=&limit=
     */
    list(storeId, params) { return get('/shop-products', { store_id: storeId, ...params }); },

    /** POST /api/shop-products */
    add(storeId, productId, overrides = {}) {
      return post('/shop-products', { store_id: storeId, product_id: productId, ...overrides });
    },

    /** PUT /api/shop-products/:id */
    update(id, data) { return put('/shop-products/' + id, data); },

    /** DELETE /api/shop-products/:id */
    remove(id) { return del('/shop-products/' + id); },
  };

  // ─── Orders ──────────────────────────────────────────────────────────────────

  const orders = {
    /** GET /api/orders */
    list(params) { return get('/orders', params); },

    /** GET /api/orders/:id */
    get(id) { return get('/orders/' + id); },

    /** POST /api/orders */
    create(storeId, items, shippingAddress, notes = '') {
      return post('/orders', { store_id: storeId, items, shipping_address: shippingAddress, notes });
    },

    /** PATCH /api/orders/:id/status */
    updateStatus(id, status) { return patch('/orders/' + id + '/status', { status }); },
  };

  // ─── Cart ────────────────────────────────────────────────────────────────────

  const cart = {
    /** GET /api/cart?store_id= */
    get(storeId) { return get('/cart', { store_id: storeId }); },

    /** POST /api/cart/items */
    addItem(storeId, productId, quantity) {
      return post('/cart/items', { store_id: storeId, product_id: productId, quantity });
    },

    /** PUT /api/cart/items/:productId */
    updateItem(storeId, productId, quantity) {
      return put('/cart/items/' + productId, { store_id: storeId, quantity });
    },

    /** DELETE /api/cart/items/:productId */
    removeItem(storeId, productId) {
      return del('/cart/items/' + productId, { store_id: storeId });
    },

    /** DELETE /api/cart */
    clear(storeId) { return del('/cart', { store_id: storeId }); },
  };

  // ─── Subscriptions ───────────────────────────────────────────────────────────

  const subscriptions = {
    /** GET /api/subscriptions */
    list() { return get('/subscriptions'); },

    /** GET /api/subscriptions/active */
    active() { return get('/subscriptions/active'); },

    /** POST /api/subscriptions */
    create(plan, paymentReference, durationDays = 30) {
      return post('/subscriptions', { plan, payment_reference: paymentReference, duration_days: durationDays });
    },

    /** DELETE /api/subscriptions/:id */
    cancel(id) { return del('/subscriptions/' + id); },
  };

  // ─── Suppliers ───────────────────────────────────────────────────────────────

  const suppliers = {
    /** GET /api/suppliers */
    list() { return get('/suppliers'); },

    /** GET /api/suppliers/:id */
    get(id) { return get('/suppliers/' + id); },

    /** POST /api/suppliers */
    create(data) { return post('/suppliers', data); },

    /** PUT /api/suppliers/:id */
    update(id, data) { return put('/suppliers/' + id, data); },

    /**
     * POST /api/suppliers/:id/import  (multipart/form-data)
     * @param {string}   id       – supplier UUID
     * @param {File}     file     – CSV or XML file
     * @param {string}   [storeId] – omit to import into central catalogue (admin)
     */
    import(id, file, storeId = null) {
      const form = new FormData();
      form.append('file', file);
      if (storeId) form.append('store_id', storeId);
      const token = getToken();
      const headers = token ? { Authorization: 'Bearer ' + token } : {};
      return fetch(getBaseUrl() + '/suppliers/' + id + '/import', {
        method: 'POST', headers, body: form,
      }).then(async (r) => {
        const d = await r.json();
        if (!r.ok) { const e = new Error(d.error || 'Import failed'); e.status = r.status; throw e; }
        return d;
      });
    },

    /** POST /api/suppliers/:id/sync */
    sync(id, storeId = null) {
      return post('/suppliers/' + id + '/sync', storeId ? { store_id: storeId } : {});
    },
  };

  // ─── Categories ──────────────────────────────────────────────────────────────

  const categories = {
    /** GET /api/categories */
    list() { return get('/categories'); },

    /** GET /api/categories/:id */
    get(id) { return get('/categories/' + id); },
  };

  // ─── Payments ────────────────────────────────────────────────────────────────

  const payments = {
    /** GET /api/payments */
    list(params) { return get('/payments', params); },

    /** GET /api/payments/:id */
    get(id) { return get('/payments/' + id); },
  };

  // ─── Admin (superadmin panel) ─────────────────────────────────────────────────

  const admin = {
    /** GET /api/admin/stats */
    stats() { return get('/admin/stats'); },

    /** GET /api/admin/users */
    listUsers(params) { return get('/admin/users', params); },

    /** PATCH /api/admin/users/:id */
    updateUser(id, data) { return patch('/admin/users/' + id, data); },

    /** GET /api/admin/orders */
    listOrders(params) { return get('/admin/orders', params); },

    /** GET /api/admin/stores */
    listStores(params) { return get('/admin/stores', params); },

    /** PATCH /api/admin/stores/:id */
    updateStore(id, data) { return patch('/admin/stores/' + id, data); },

    /** GET /api/admin/subscriptions */
    listSubscriptions(params) { return get('/admin/subscriptions', params); },

    /** GET /api/admin/catalogue */
    listCatalogue(params) { return get('/admin/catalogue', params); },

    /** GET /api/admin/audit-logs */
    auditLogs(params) { return get('/admin/audit-logs', params); },
  };

  // ─── Public namespace ────────────────────────────────────────────────────────

  const QualitetAPI = {
    auth,
    stores,
    products,
    shopProducts,
    orders,
    cart,
    subscriptions,
    suppliers,
    categories,
    payments,
    admin,
  };

  // Expose globally
  global.QualitetAPI = QualitetAPI;

  // Also support ES module-like usage when bundled
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualitetAPI;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
