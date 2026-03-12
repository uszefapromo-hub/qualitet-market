/**
 * HurtDetalUszefaQUALITET – Frontend API client
 *
 * Thin wrapper over the backend REST API.  Provides the same conceptual
 * operations that the frontend currently satisfies through localStorage so
 * that pages can migrate one function at a time without a big-bang rewrite.
 *
 * Token storage:  localStorage key  `qm_token`
 * User cache:     localStorage key  `qm_user`
 *
 * Usage (as ES module or classic <script>):
 *   import { Auth, Products, Cart, Orders, Stores, Categories, Subscriptions, Admin } from './api.js';
 *   // or access window.QMApi.Auth, window.QMApi.Cart, …
 */

(function (root, factory) {
  /* UMD shim – works as ES module import and as a plain <script> tag */
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.QMApi = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ─── Configuration ────────────────────────────────────────────────────────────

  // Set window.QM_API_BASE before loading this script to point at your backend.
  // Example: <script>window.QM_API_BASE = 'https://api.uszefaqualitet.pl/api';</script>
  const API_BASE = (typeof window !== 'undefined' && window.QM_API_BASE)
    || 'http://localhost:3000/api';

  // Health endpoint lives one level above /api.
  // Override via window.QM_HEALTH_URL if your deployment differs.
  const HEALTH_URL = (typeof window !== 'undefined' && window.QM_HEALTH_URL)
    || API_BASE.replace(/\/api\/?$/, '') + '/health';

  const TOKEN_KEY = 'qm_token';
  const USER_KEY  = 'qm_user';

  // ─── Low-level helpers ────────────────────────────────────────────────────────

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  }

  function setToken(token) {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* noop */ }
  }

  function removeToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } catch { /* noop */ }
  }

  function saveUser(user) {
    try { localStorage.setItem(USER_KEY, JSON.stringify(user)); } catch { /* noop */ }
  }

  function getCachedUser() {
    try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch { return null; }
  }

  /**
   * Core fetch wrapper.
   * @param {string} path     - relative path, e.g. '/users/login'
   * @param {object} options  - fetch options override
   * @returns {Promise<any>}  - parsed JSON body
   * @throws  {Error}         - with `.status` and parsed `.body` attached
   */
  async function request(path, options = {}) {
    const token = getToken();
    const headers = Object.assign(
      { 'Content-Type': 'application/json' },
      token ? { Authorization: `Bearer ${token}` } : {},
      options.headers || {}
    );

    const res = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });

    let body;
    const contentType = res.headers.get('content-type') || '';
    body = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const err = new Error(
        (body && body.error) || (body && body.message) || `HTTP ${res.status}`
      );
      err.status = res.status;
      err.body   = body;
      throw err;
    }
    return body;
  }

  function get(path, params) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(path + qs);
  }

  function post(path, data)   { return request(path, { method: 'POST',   body: JSON.stringify(data) }); }
  function put(path, data)    { return request(path, { method: 'PUT',    body: JSON.stringify(data) }); }
  function patch(path, data)  { return request(path, { method: 'PATCH',  body: JSON.stringify(data) }); }
  function del(path, data)    { return request(path, { method: 'DELETE', body: data ? JSON.stringify(data) : undefined }); }

  // ─── Auth / Users ─────────────────────────────────────────────────────────────

  const Auth = {
    /**
     * Register a new account.
     * Uses /api/auth/register (default role: seller).
     * @returns {{ token: string, user: object }}
     */
    register(email, password, name, role = 'seller') {
      return post('/auth/register', { email, password, name, role }).then((data) => {
        setToken(data.token);
        saveUser(data.user);
        return data;
      });
    },

    /**
     * Log in.
     * @returns {{ token: string, user: object }}
     */
    login(email, password) {
      return post('/auth/login', { email, password }).then((data) => {
        setToken(data.token);
        saveUser(data.user);
        return data;
      });
    },

    /** Log out (clears local token & user cache). */
    logout() {
      removeToken();
    },

    /** Returns cached user or null. */
    currentUser() {
      return getCachedUser();
    },

    /** Fetch fresh profile from API. */
    me() {
      return get('/auth/me').then((user) => { saveUser(user); return user; });
    },

    updateProfile(data) {
      return put('/auth/me', data).then((user) => { saveUser(user); return user; });
    },

    changePassword(currentPassword, newPassword) {
      return put('/users/me/password', { currentPassword, newPassword });
    },

    isLoggedIn() {
      return Boolean(getToken());
    },
  };

  // ─── Stores ───────────────────────────────────────────────────────────────────

  const Stores = {
    list(params)          { return get('/stores', params); },
    get(id)               { return get(`/stores/${id}`); },
    create(data)          { return post('/stores', data); },
    update(id, data)      { return put(`/stores/${id}`, data); },
    remove(id)            { return del(`/stores/${id}`); },
  };

  // ─── Shops (seller onboarding endpoint) ──────────────────────────────────────

  const Shops = {
    /** Create a new shop (default margin 30%). POST /api/shops */
    create(data)          { return post('/shops', data); },
    /** Get public shop profile by slug. GET /api/shops/:slug */
    getBySlug(slug)       { return get(`/shops/${slug}`); },
    /** List products of a public shop. GET /api/shops/:slug/products */
    products(slug, params){ return get(`/shops/${slug}/products`, params); },
  };

  // ─── Products (central catalogue) ────────────────────────────────────────────

  const Products = {
    /**
     * List products.
     * @param {{ store_id?, category?, search?, is_central?, status?, page?, limit? }} params
     */
    list(params)          { return get('/products', params); },
    get(id)               { return get(`/products/${id}`); },
    create(data)          { return post('/products', data); },
    update(id, data)      { return put(`/products/${id}`, data); },
    remove(id)            { return del(`/products/${id}`); },
  };

  // ─── Shop products (seller's store ← central catalogue) ──────────────────────

  const ShopProducts = {
    /**
     * Get products listed in a store.
     * @param {string} storeId
     * @param {{ page?, limit? }} params
     */
    list(storeId, params) { return get('/shop-products', { store_id: storeId, ...params }); },
    add(data)             { return post('/shop-products', data); },
    update(id, data)      { return put(`/shop-products/${id}`, data); },
    remove(id)            { return del(`/shop-products/${id}`); },
  };

  // ─── Categories ───────────────────────────────────────────────────────────────

  const Categories = {
    list()                { return get('/categories'); },
    get(id)               { return get(`/categories/${id}`); },
    create(data)          { return post('/categories', data); },
    update(id, data)      { return put(`/categories/${id}`, data); },
    remove(id)            { return del(`/categories/${id}`); },
  };

  // ─── Cart ─────────────────────────────────────────────────────────────────────

  const Cart = {
    /**
     * Fetch active cart for a given store.
     * @param {string} storeId
     */
    get(storeId)               { return get('/cart', { store_id: storeId }); },

    /**
     * Add an item by shop_product_id (primary method).
     * POST /api/cart – customer purchase flow.
     * @param {string} shopProductId
     * @param {number} quantity
     */
    addByShopProduct(shopProductId, quantity = 1) {
      return post('/cart', { shop_product_id: shopProductId, quantity });
    },

    /**
     * Add an item by store_id + product_id (legacy method).
     * @param {string} storeId
     * @param {string} productId
     * @param {number} quantity
     */
    addItem(storeId, productId, quantity = 1) {
      return post('/cart/items', { store_id: storeId, product_id: productId, quantity });
    },

    /**
     * Set a specific quantity (0 removes the item).
     */
    setItem(storeId, productId, quantity) {
      return put(`/cart/items/${productId}`, { store_id: storeId, quantity });
    },

    /**
     * Remove a cart item by its UUID (preferred).
     * DELETE /api/cart/items/:itemId
     */
    removeItemById(itemId) {
      return del(`/cart/items/${itemId}`);
    },

    /**
     * Remove an item by product_id (legacy).
     */
    removeItem(storeId, productId) {
      return del(`/cart/items/${productId}`, { store_id: storeId });
    },

    clear(storeId) {
      return del('/cart', { store_id: storeId });
    },
  };

  // ─── Orders ───────────────────────────────────────────────────────────────────

  const Orders = {
    /**
     * List orders (own orders for buyers/sellers, all for admins).
     * @param {{ page?, limit? }} params
     */
    list(params)               { return get('/orders', params); },
    get(id)                    { return get(`/orders/${id}`); },

    /**
     * Place a new order.
     * @param {{ store_id, items: [{product_id, quantity}], shipping_address, notes? }} data
     */
    create(data)               { return post('/orders', data); },

    /**
     * Update order status (store owner / admin).
     * @param {string} id
     * @param {'pending'|'confirmed'|'shipped'|'delivered'|'cancelled'} status
     */
    updateStatus(id, status)   { return patch(`/orders/${id}/status`, { status }); },
  };

  // ─── Payments ─────────────────────────────────────────────────────────────────

  const Payments = {
    list(params)               { return get('/payments', params); },
    get(id)                    { return get(`/payments/${id}`); },

    /**
     * Record a new payment intent.
     * @param {{ order_id, amount, method: 'transfer'|'card'|'blik'|'p24', external_ref? }} data
     */
    create(data)               { return post('/payments', data); },

    /** Update payment status (admin only). */
    updateStatus(id, status, externalRef) {
      return put(`/payments/${id}/status`, { status, external_ref: externalRef });
    },

    /**
     * Initiate a payment for an order (returns redirect_url or provider payload).
     * POST /api/payments/:orderId/initiate
     * @param {string} orderId
     * @param {'transfer'|'card'|'blik'|'p24'} method
     * @param {string} [returnUrl]
     */
    initiate(orderId, method, returnUrl) {
      return post(`/payments/${orderId}/initiate`, { method, return_url: returnUrl });
    },
  };

  // ─── Subscriptions ────────────────────────────────────────────────────────────

  const Subscriptions = {
    list()                     { return get('/subscriptions'); },
    active()                   { return get('/subscriptions/active'); },

    /**
     * Purchase / upgrade a plan.
     * @param {'trial'|'basic'|'pro'|'elite'} plan
     * @param {{ payment_reference?, duration_days? }} opts
     */
    create(plan, opts = {})    { return post('/subscriptions', { plan, ...opts }); },
    cancel(id)                 { return del(`/subscriptions/${id}`); },
  };

  // ─── Suppliers ────────────────────────────────────────────────────────────────

  const Suppliers = {
    list()                     { return get('/suppliers'); },
    get(id)                    { return get(`/suppliers/${id}`); },
    create(data)               { return post('/suppliers', data); },
    update(id, data)           { return put(`/suppliers/${id}`, data); },

    /**
     * Import products from a CSV/XML file.
     * @param {string} supplierId
     * @param {string} storeId
     * @param {File}   file  – browser File object
     */
    importFile(supplierId, storeId, file) {
      const token = getToken();
      const form  = new FormData();
      form.append('store_id', storeId);
      form.append('file', file);
      return fetch(`${API_BASE}/suppliers/${supplierId}/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }).then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          const err = new Error(body.error || `HTTP ${res.status}`);
          err.status = res.status;
          err.body   = body;
          throw err;
        }
        return body;
      });
    },

    /** Sync products from supplier's API endpoint. */
    sync(supplierId, storeId) {
      return post(`/suppliers/${supplierId}/sync`, { store_id: storeId });
    },
  };

  // ─── Admin ────────────────────────────────────────────────────────────────────

  const Admin = {
    /** Rich dashboard metrics. GET /api/admin/dashboard */
    dashboard()                { return get('/admin/dashboard'); },
    /** Legacy stats alias. GET /api/admin/stats */
    stats()                    { return get('/admin/stats'); },
    users(params)              { return get('/admin/users', params); },
    /** Update user role / plan / name. */
    updateUser(id, data)       { return patch(`/admin/users/${id}`, data); },
    /** Delete a user (admin/owner only). */
    deleteUser(id)             { return del(`/admin/users/${id}`); },
    orders(params)             { return get('/admin/orders', params); },
    stores(params)             { return get('/admin/stores', params); },
    /** List shops (alias for stores). GET /api/admin/shops */
    shops(params)              { return get('/admin/shops', params); },
    /** Change shop status: 'active' | 'inactive' | 'suspended' | 'pending' | 'banned'. */
    updateStoreStatus(id, status) { return patch(`/admin/stores/${id}/status`, { status }); },
    products(params)           { return get('/admin/products', params); },
    /** Create a product in the central catalogue. POST /api/products */
    createProduct(data)        { return post('/products', data); },
    /** Update a product. PUT /api/products/:id */
    updateProduct(id, data)    { return put(`/products/${id}`, data); },
    /** Delete a product. DELETE /api/products/:id */
    deleteProduct(id)          { return del(`/products/${id}`); },
    /** Change product status: 'draft' | 'pending' | 'active' | 'archived'. */
    updateProductStatus(id, status) { return patch(`/admin/products/${id}/status`, { status }); },
    /** Set platform minimum price for a product. PATCH /api/admin/products/:id/platform-price */
    updateProductPlatformPrice(id, price) { return patch(`/admin/products/${id}/platform-price`, { platform_price: price }); },
    /**
     * Import products from a CSV or XML file into the central catalogue.
     * POST /api/admin/products/import
     * @param {File} file – browser File object (CSV or XML)
     */
    importProducts(file) {
      if (!(file instanceof File)) {
        return Promise.reject(new Error('Nieprawidłowy plik – wymagany obiekt File'));
      }
      const allowedTypes = ['text/csv', 'text/xml', 'application/xml', 'text/plain'];
      const allowedExts  = ['.csv', '.xml'];
      const ext = file.name ? file.name.slice(file.name.lastIndexOf('.')).toLowerCase() : '';
      if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
        return Promise.reject(new Error('Dozwolone są tylko pliki CSV lub XML'));
      }
      const token = getToken();
      const form  = new FormData();
      form.append('file', file);
      return fetch(`${API_BASE}/admin/products/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }).then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          const err = new Error(body.error || `HTTP ${res.status}`);
          err.status = res.status;
          err.body   = body;
          throw err;
        }
        return body;
      });
    },
    /** List suppliers via admin endpoint. GET /api/admin/suppliers */
    suppliers(params)          { return get('/admin/suppliers', params); },
    /**
     * Create a new supplier (admin only). POST /api/admin/suppliers
     * @param {{ name, type?, integration_type?, country?, api_endpoint?, xml_endpoint?, csv_endpoint?, api_key?, margin?, notes?, status? }} data
     */
    createSupplier(data)       { return post('/admin/suppliers', data); },
    /**
     * Import products from a CSV/XML file or the supplier's API endpoint.
     * POST /api/admin/suppliers/import
     * @param {string} supplierId
     * @param {File|null} file – browser File object (CSV or XML); omit to fetch from supplier API
     */
    importSupplier(supplierId, file = null) {
      const token = getToken();
      const form  = new FormData();
      form.append('supplier_id', supplierId);
      if (file) form.append('file', file);
      return fetch(`${API_BASE}/admin/suppliers/import`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }).then(async (res) => {
        const body = await res.json();
        if (!res.ok) {
          const err = new Error(body.error || `HTTP ${res.status}`);
          err.status = res.status;
          err.body   = body;
          throw err;
        }
        return body;
      });
    },
    /**
     * Sync products from a supplier's API endpoint into the central catalogue.
     * POST /api/admin/suppliers/sync
     * @param {string} supplierId
     */
    syncSupplier(supplierId)   { return post('/admin/suppliers/sync', { supplier_id: supplierId }); },
    subscriptions(params)      { return get('/admin/subscriptions', params); },
    auditLogs(params)          { return get('/admin/audit-logs', params); },
    /** Get platform margin tiers. GET /api/admin/platform-margins */
    platformMargins(params)    { return get('/admin/platform-margins', params); },
    /** Replace platform margin tiers. PUT /api/admin/platform-margins */
    updatePlatformMargins(data){ return put('/admin/platform-margins', data); },
    /** List all referral codes with stats. GET /api/admin/referrals */
    referrals(params)          { return get('/referral/admin', params); },
    /** List system scripts. GET /api/admin/scripts */
    scripts()                  { return get('/admin/scripts'); },
    /** Run a system script. POST /api/admin/scripts/:id/run */
    runScript(id)              { return post(`/admin/scripts/${id}/run`, {}); },
  };

  // ─── Referral ─────────────────────────────────────────────────────────────────

  const Referral = {
    /** Get or auto-create the authenticated user's referral code. GET /api/referral/my */
    my()                       { return get('/referral/my'); },
    /** Record that the current user used a referral code. POST /api/referral/use */
    use(data)                  { return post('/referral/use', data); },
  };

  // ─── My Store (seller convenience) ──────────────────────────────────────────

  const MyStore = {
    /** Get the seller's primary store. */
    get()                      { return get('/my/store'); },
    /** Update the seller's primary store. */
    update(data)               { return patch('/my/store', data); },
    /** Get dashboard stats for the seller's store. */
    stats()                    { return get('/my/store/stats'); },
    /** List orders for the seller's store. */
    storeOrders(params)        { return get('/my/store/orders', params); },
    /** Get the seller's order history (as buyer). */
    orders(params)             { return get('/my/orders', params); },
    /**
     * List shop products for a seller's store.
     * @param {string} storeId – required; a seller may own multiple stores
     * @param {{ page?, limit? }} params
     */
    products(storeId, params)  { return get('/my/store/products', { store_id: storeId, ...params }); },
    /** Add a product to seller's store. */
    addProduct(data)           { return post('/my/store/products', data); },
    /**
     * Add multiple products to seller's store in one request.
     * @param {{ store_id: string, product_ids: string[] }} data
     */
    bulkAddProducts(data)      { return post('/my/store/products/bulk', data); },
    /** Update a shop product in seller's store. */
    updateProduct(id, data)    { return patch(`/my/store/products/${id}`, data); },
    /** Remove a product from seller's store. */
    removeProduct(id)          { return del(`/my/store/products/${id}`); },
  };

  // ─── Health ───────────────────────────────────────────────────────────────────

  function health() {
    return fetch(HEALTH_URL).then((r) => r.json());
  }

  // ─── Public API surface ───────────────────────────────────────────────────────

  return {
    Auth,
    Stores,
    Shops,
    Products,
    ShopProducts,
    Categories,
    Cart,
    Orders,
    Payments,
    Subscriptions,
    Suppliers,
    Admin,
    MyStore,
    Referral,
    health,
    /** Expose for advanced use cases. */
    _request: request,
  };
}));
