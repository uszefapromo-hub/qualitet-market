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

  // ─── Token refresh state ─────────────────────────────────────────────────────
  // When a 401 is returned for a non-auth endpoint we attempt one silent token
  // refresh before clearing credentials and redirecting to the login page.
  // _refreshPromise serialises concurrent refresh attempts so that only one
  // POST /auth/refresh request is in flight at any time.
  let _refreshPromise = null;

  async function attemptRefresh() {
    if (_refreshPromise) return _refreshPromise;
    _refreshPromise = (async () => {
      try {
        const token = getToken();
        if (!token) throw new Error('no token');
        const headers = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        };
        const res = await fetch(`${API_BASE}/auth/refresh`, { method: 'POST', headers });
        if (!res.ok) throw new Error('refresh failed');
        const data = await res.json();
        if (data && data.token) {
          setToken(data.token);
          if (data.user) saveUser(data.user);
          return true;
        }
        throw new Error('no token in refresh response');
      } catch {
        removeToken();
        return false;
      } finally {
        _refreshPromise = null;
      }
    })();
    return _refreshPromise;
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
      // When the token has expired the server returns 401.
      // Attempt one silent token refresh before clearing credentials and
      // redirecting to the login page.  Skip for auth endpoints to avoid loops.
      if (res.status === 401 && !path.startsWith('/auth/')) {
        const refreshed = await attemptRefresh();
        if (refreshed) {
          // Retry the original request with the new token
          return request(path, options);
        }
        if (typeof window !== 'undefined' && window.location) {
          const loginPage = window.location.origin + '/login.html';
          if (!window.location.href.includes('login.html')) {
            window.location.href = loginPage;
          }
        }
      }
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

    /**
     * Proactively refresh the session token.
     * Call this on page load to keep the session alive without requiring
     * the user to re-login every 7 days.
     * @returns {Promise<boolean>} true if the token was refreshed successfully.
     */
    refresh() {
      return attemptRefresh();
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
     * @param {{ store_id?, category?, search?, is_central?, status?, sort?, page?, limit? }} params
     * sort: 'new' | 'bestsellers' | 'price_asc' | 'price_desc'
     */
    list(params)          { return get('/products', params); },
    get(id)               { return get(`/products/${id}`); },
    create(data)          { return post('/products', data); },
    update(id, data)      { return put(`/products/${id}`, data); },
    remove(id)            { return del(`/products/${id}`); },
    /** Newest central catalogue products. GET /api/products?sort=new&is_central=true */
    listNew(params)       { return get('/products', { is_central: 'true', sort: 'new', ...params }); },
    /** Best-selling central catalogue products. GET /api/products?sort=bestsellers&is_central=true */
    listBestsellers(params) { return get('/products', { is_central: 'true', sort: 'bestsellers', ...params }); },
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
    /** Dry-run a system script (no changes applied). POST /api/admin/scripts/:id/run?dryRun=true */
    runScriptDryRun(id)        { return post(`/admin/scripts/${id}/run?dryRun=true`, {}); },
    /** Enable or disable a system script. PATCH /api/admin/scripts/:id */
    toggleScript(id, enabled)  { return patch(`/admin/scripts/${id}`, { enabled }); },
    /** List announcements. GET /api/admin/announcements */
    announcements(params)      { return get('/admin/announcements', params); },
    /** Create an announcement. POST /api/admin/announcements */
    createAnnouncement(data)   { return post('/admin/announcements', data); },
    /** Update an announcement. PATCH /api/admin/announcements/:id */
    updateAnnouncement(id, data) { return patch(`/admin/announcements/${id}`, data); },
    /** Delete an announcement. DELETE /api/admin/announcements/:id */
    deleteAnnouncement(id)     { return del(`/admin/announcements/${id}`); },
    /** List mail messages. GET /api/admin/mail */
    mailMessages(params)       { return get('/admin/mail', params); },
    /** Send a mail message. POST /api/admin/mail */
    sendMail(data)             { return post('/admin/mail', data); },
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
    /**
     * Generate store name, description, and theme suggestions.
     * POST /api/my/store/generate
     * @param {{ interests?, product_types?, style?, margin? }} data
     */
    generateStore(data)        { return post('/my/store/generate', data); },
    /**
     * Generate promotion content (social media post + product description).
     * POST /api/my/promotion/generate
     * @param {{ product_name, price?, store_url?, platform? }} data
     */
    generatePromotion(data)    { return post('/my/promotion/generate', data); },
  };

  // ─── Health ───────────────────────────────────────────────────────────────────

  function health() {
    return fetch(HEALTH_URL).then((r) => r.json());
  }

  // ─── Public announcements feed ────────────────────────────────────────────────

  const Announcements = {
    /** List active announcements (public). GET /api/announcements */
    list(params)               { return get('/announcements', params); },
  };

  // ─── Affiliate Creator System ─────────────────────────────────────────────────

  const Affiliate = {
    /** Creator dashboard stats. GET /api/affiliate/dashboard */
    dashboard()                            { return get('/affiliate/dashboard'); },
    /** List creator's affiliate links. GET /api/affiliate/links */
    links(params)                          { return get('/affiliate/links', params); },
    /** Create a new affiliate link. POST /api/affiliate/links */
    createLink(data)                       { return post('/affiliate/links', data); },
    /** Deactivate an affiliate link. DELETE /api/affiliate/links/:id */
    deleteLink(id)                         { return del(`/affiliate/links/${id}`); },
    /** Creator earnings/conversions. GET /api/affiliate/earnings */
    earnings(params)                       { return get('/affiliate/earnings', params); },
    /** Creator's withdrawable balance. GET /api/affiliate/balance */
    balance()                              { return get('/affiliate/balance'); },
    /** Request a payout. POST /api/affiliate/withdraw */
    withdraw(data)                         { return post('/affiliate/withdraw', data); },
    /** Browse affiliate-enabled products. GET /api/affiliate/products */
    products(params)                       { return get('/affiliate/products', params); },
    /** Seller: list affiliate settings. GET /api/affiliate/seller/settings */
    sellerSettings()                       { return get('/affiliate/seller/settings'); },
    /** Seller: set commission for a product. PUT /api/affiliate/seller/products/:pid */
    sellerSetProduct(pid, data)            { return put(`/affiliate/seller/products/${pid}`, data); },
    /** Seller: top creators for their products. GET /api/affiliate/seller/creators */
    sellerCreators(params)                 { return get('/affiliate/seller/creators', params); },
    /** Seller: affiliate stats. GET /api/affiliate/seller/stats */
    sellerStats()                          { return get('/affiliate/seller/stats'); },
    /** Admin: list withdrawal requests. GET /api/affiliate/admin/withdrawals */
    adminWithdrawals(params)               { return get('/affiliate/admin/withdrawals', params); },
    /** Admin: approve/reject a withdrawal. PATCH /api/affiliate/admin/withdrawals/:id */
    adminUpdateWithdrawal(id, data)        { return patch(`/affiliate/admin/withdrawals/${id}`, data); },
    /** Admin: platform-wide stats. GET /api/affiliate/admin/stats */
    adminStats()                           { return get('/affiliate/admin/stats'); },
  };

  // ─── User Referral System ────────────────────────────────────────────────────

  const UserReferrals = {
    /** Generate (or return existing) user invite link. POST /api/referrals/generate */
    generate()            { return post('/referrals/generate'); },
    /** Referral stats (invited count, earnings, link). GET /api/referrals/stats */
    stats()               { return get('/referrals/stats'); },
    /** List users invited via the referral link. GET /api/referrals/invites */
    invites(params)       { return get('/referrals/invites', params); },
  };

  // ─── Creator Referral System ──────────────────────────────────────────────────

  const CreatorReferrals = {
    /** Generate (or return existing) creator referral link. POST /api/creator/referrals/generate-link */
    generateLink()            { return post('/creator/referrals/generate-link'); },
    /** List creators invited by the authenticated creator. GET /api/creator/referrals */
    list(params)              { return get('/creator/referrals', params); },
    /** Referral stats (invited, active, earnings, link). GET /api/creator/referrals/stats */
    stats()                   { return get('/creator/referrals/stats'); },
  };

  // ─── Live Commerce ────────────────────────────────────────────────────────────

  const Live = {
    /** List live streams (public). GET /api/live/streams */
    listStreams(params)                          { return get('/live/streams', params); },
    /** Get a single stream. GET /api/live/streams/:id */
    getStream(id)                               { return get(`/live/streams/${id}`); },
    /** Create a new stream (seller/creator). POST /api/live/streams */
    createStream(data)                          { return post('/live/streams', data); },
    /** Update stream status. PATCH /api/live/streams/:id/status */
    updateStatus(id, status)                    { return patch(`/live/streams/${id}/status`, { status }); },
    /** Get chat messages (polling). GET /api/live/streams/:id/messages */
    getMessages(id, params)                     { return get(`/live/streams/${id}/messages`, params); },
    /** Post a chat message. POST /api/live/streams/:id/messages */
    sendMessage(id, content)                    { return post(`/live/streams/${id}/messages`, { content }); },
    /** Get pinned products. GET /api/live/streams/:id/products */
    getPinnedProducts(id)                       { return get(`/live/streams/${id}/products`); },
    /** Pin a product to the stream. POST /api/live/streams/:id/products */
    pinProduct(id, product_id)                  { return post(`/live/streams/${id}/products`, { product_id }); },
    /** Unpin a product. DELETE /api/live/streams/:id/products/:productId */
    unpinProduct(id, productId)                 { return del(`/live/streams/${id}/products/${productId}`); },
    /** Get active live promotions. GET /api/live/streams/:id/promotions */
    getPromotions(id)                           { return get(`/live/streams/${id}/promotions`); },
    /** Create a live promotion. POST /api/live/streams/:id/promotions */
    createPromotion(id, data)                   { return post(`/live/streams/${id}/promotions`, data); },
    /** Buy directly from live stream. POST /api/live/streams/:id/orders */
    buyNow(id, data)                            { return post(`/live/streams/${id}/orders`, data); },
  };

  // ─── Reputation & Ratings ─────────────────────────────────────────────────────

  const Reputation = {
    /** Rate a seller after purchase (buyer). POST /api/reputation/sellers/:id/rate */
    rateSeller(sellerId, data)                  { return post(`/reputation/sellers/${sellerId}/rate`, data); },
    /** Get seller reputation summary (public). GET /api/reputation/sellers/:id */
    getSeller(sellerId)                         { return get(`/reputation/sellers/${sellerId}`); },
    /** Submit a product review (authenticated). POST /api/reputation/products/:id/review */
    reviewProduct(productId, data)              { return post(`/reputation/products/${productId}/review`, data); },
    /** Get product reviews (public). GET /api/reputation/products/:id/reviews */
    getProductReviews(productId, params)        { return get(`/reputation/products/${productId}/reviews`, params); },
    /** Get creator reputation score (public). GET /api/reputation/creators/:id/score */
    getCreatorScore(creatorId)                  { return get(`/reputation/creators/${creatorId}/score`); },
    /** Get badges earned by a user (public). GET /api/reputation/users/:id/badges */
    getUserBadges(userId)                       { return get(`/reputation/users/${userId}/badges`); },
    /** List all active badge definitions (public). GET /api/reputation/badges */
    listBadges()                                { return get('/reputation/badges'); },
    /** Award a badge to a user (admin). POST /api/reputation/badges/award */
    awardBadge(data)                            { return post('/reputation/badges/award', data); },
    /** Update creator reputation score (admin). PUT /api/reputation/creators/:id/score */
    updateCreatorScore(creatorId, data)         { return put(`/reputation/creators/${creatorId}/score`, data); },
  };

  // ─── Art Auctions ─────────────────────────────────────────────────────────────

  const Auctions = {
    /** List active auctions (public). GET /api/auctions */
    list(params)                                { return get('/auctions', params); },
    /** Get single auction details (public). GET /api/auctions/:id */
    get(id)                                     { return get(`/auctions/${id}`); },
    /** Create a new auction (artist). POST /api/auctions */
    create(data)                                { return post('/auctions', data); },
    /** Place a bid (authenticated). POST /api/auctions/:id/bid */
    placeBid(id, amount)                        { return post(`/auctions/${id}/bid`, { amount }); },
    /** List bids for an auction (public). GET /api/auctions/:id/bids */
    listBids(id, params)                        { return get(`/auctions/${id}/bids`, params); },
    /** List all artist profiles (public). GET /api/auctions/artists */
    listArtists(params)                         { return get('/auctions/artists', params); },
    /** Create or update own artist profile (authenticated). POST /api/auctions/artists */
    saveArtistProfile(data)                     { return post('/auctions/artists', data); },
    /** List artworks (public). GET /api/auctions/artworks */
    listArtworks(params)                        { return get('/auctions/artworks', params); },
    /** Add an artwork (artist). POST /api/auctions/artworks */
    addArtwork(data)                            { return post('/auctions/artworks', data); },
  };

  // ─── Scripts (seller tracking integrations: FB Pixel, GA4, custom) ──────────
  const Scripts = {
    /** List scripts for the current seller's stores. GET /api/scripts */
    list()                          { return get('/scripts'); },
    /** Get scripts for a specific store (public). GET /api/scripts/store/:storeId */
    listForStore(storeId)           { return get(`/scripts/store/${storeId}`); },
    /** Get single script. GET /api/scripts/:id */
    get(id)                         { return get(`/scripts/${id}`); },
    /** Create a script. POST /api/scripts */
    create(data)                    { return post('/scripts', data); },
    /** Update a script. PATCH /api/scripts/:id */
    update(id, data)                { return patch(`/scripts/${id}`, data); },
    /** Delete a script. DELETE /api/scripts/:id */
    delete(id)                      { return del(`/scripts/${id}`); },
    /** Toggle script active state. PATCH /api/scripts/:id */
    toggle(id, data)                { return patch(`/scripts/${id}`, data); },
  };

  // ─── Campaigns ────────────────────────────────────────────────────────────────
  const Campaigns = {
    /** List active campaigns (public). GET /api/campaigns */
    list(params)                                { return get('/campaigns', params); },
    /** Get single campaign. GET /api/campaigns/:id */
    get(id)                                     { return get(`/campaigns/${id}`); },
    /** Create campaign (authenticated). POST /api/campaigns */
    create(data)                                { return post('/campaigns', data); },
    /** Update campaign. PUT /api/campaigns/:id */
    update(id, data)                            { return put(`/campaigns/${id}`, data); },
    /** Delete campaign. DELETE /api/campaigns/:id */
    delete(id)                                  { return del(`/campaigns/${id}`); },
    /** Join campaign as creator. POST /api/campaigns/:id/join */
    join(id)                                    { return post(`/campaigns/${id}/join`); },
    /** Approve/reject participant. PATCH /api/campaigns/:id/participants/:pid */
    updateParticipant(id, pid, data)            { return patch(`/campaigns/${id}/participants/${pid}`, data); },
    /** My campaigns (owner). GET /api/campaigns/my/campaigns */
    myCampaigns()                               { return get('/campaigns/my/campaigns'); },
    /** My participations (creator). GET /api/campaigns/my/participations */
    myParticipations()                          { return get('/campaigns/my/participations'); },
    /** Create promoted listing. POST /api/campaigns/promoted */
    promoteProduct(data)                        { return post('/campaigns/promoted', data); },
    /** List promoted listings (public). GET /api/campaigns/promoted */
    listPromoted()                              { return get('/campaigns/promoted'); },
  };

  // ─── Social Commerce ──────────────────────────────────────────────────────────
  const Social = {
    /** Paginated post feed (public). GET /api/social/feed */
    feed(params)               { return get('/social/feed', params); },
    /** Trending posts by viral score (public). GET /api/social/trending */
    trending(params)           { return get('/social/trending', params); },
    /** Create a post (auth). POST /api/social/posts */
    createPost(data)           { return post('/social/posts', data); },
    /** Get single post with comments (public). GET /api/social/posts/:id */
    getPost(id)                { return get(`/social/posts/${id}`); },
    /** Delete own post (auth). DELETE /api/social/posts/:id */
    deletePost(id)             { return del(`/social/posts/${id}`); },
    /** Toggle like on a post (auth). POST /api/social/posts/:id/like */
    likePost(id)               { return post(`/social/posts/${id}/like`); },
    /** Comment on a post (auth). POST /api/social/posts/:id/comment */
    commentPost(id, content)   { return post(`/social/posts/${id}/comment`, { content }); },
    /** Share a post (auth). POST /api/social/posts/:id/share */
    sharePost(id, platform)    { return post(`/social/posts/${id}/share`, { platform }); },
    /**
     * Create a video post with product link (auth).
     * POST /api/social/posts
     * @param {{ content, video_url, video_type, product_id?, store_id?, media_urls? }} data
     */
    createVideoPost(data)      { return post('/social/posts', { post_type: 'video', ...data }); },
    /** Feed filtered to video posts only (public). GET /api/social/feed?type=video */
    videoFeed(params)          { return get('/social/feed', { ...params, type: 'video' }); },
  };

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
    Announcements,
    Affiliate,
    UserReferrals,
    CreatorReferrals,
    Live,
    Reputation,
    Auctions,
    Campaigns,
    Scripts,
    Social,
    health,
    /** Expose for advanced use cases. */
    _request: request,
  };
}));
