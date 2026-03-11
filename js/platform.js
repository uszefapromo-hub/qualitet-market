/* platform.js – shared data layer for HurtDetal Uszefa QUALITET
 * Exposes window.Platform with typed CRUD helpers backed by localStorage.
 */
(function (global) {
  'use strict';

  const KEYS = {
    products:      'platform_products',
    orders:        'platform_orders',
    cart:          'platform_cart',
    suppliers:     'platform_suppliers',
    users:         'platform_users',
    notifications: 'platform_notifications',
  };

  /* ── helpers ───────────────────────────────────────────────────────────── */

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function load(key) {
    try {
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }

  function save(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('[Platform] localStorage write failed:', e);
    }
  }

  function now() {
    return new Date().toISOString();
  }

  /* ── Products ───────────────────────────────────────────────────────────── */

  function getProducts() {
    return load(KEYS.products);
  }

  function saveProduct(product) {
    const list = getProducts();
    const ts = now();
    if (!product.id) {
      product = { ...product, id: uid(), createdAt: ts, updatedAt: ts };
      list.push(product);
    } else {
      const idx = list.findIndex(p => p.id === product.id);
      product = { ...product, updatedAt: ts };
      if (idx >= 0) {
        list[idx] = product;
      } else {
        list.push(product);
      }
    }
    save(KEYS.products, list);
    return product;
  }

  function deleteProduct(id) {
    save(KEYS.products, getProducts().filter(p => p.id !== id));
  }

  function importProductsFromSupplier(supplierId, products) {
    const existing = getProducts();
    const ts = now();
    const imported = [];
    for (const p of products) {
      const full = {
        supplierId,
        supplierName: p.supplierName || '',
        sku: p.sku || '',
        name: p.name || 'Produkt',
        description: p.description || '',
        images: p.images || [],
        price: p.price || 0,
        costPrice: p.costPrice || 0,
        margin: p.margin || 0,
        stock: p.stock ?? 0,
        category: p.category || '',
        active: p.active !== false,
        createdAt: ts,
        updatedAt: ts,
        ...p,
        id: uid(),
      };
      existing.push(full);
      imported.push(full);
    }
    save(KEYS.products, existing);
    return imported;
  }

  /* ── Orders ─────────────────────────────────────────────────────────────── */

  function getOrders() {
    return load(KEYS.orders);
  }

  function saveOrder(order) {
    const list = getOrders();
    const ts = now();
    if (!order.id) {
      order = { ...order, id: uid(), createdAt: ts, updatedAt: ts };
      if (!order.orderNumber) order.orderNumber = getNextOrderNumber();
      list.push(order);
    } else {
      const idx = list.findIndex(o => o.id === order.id);
      order = { ...order, updatedAt: ts };
      if (idx >= 0) {
        list[idx] = order;
      } else {
        list.push(order);
      }
    }
    save(KEYS.orders, list);
    return order;
  }

  function getOrderById(id) {
    return getOrders().find(o => o.id === id) || null;
  }

  function updateOrderStatus(id, status) {
    const list = getOrders();
    const idx = list.findIndex(o => o.id === id);
    if (idx >= 0) {
      list[idx] = { ...list[idx], status, updatedAt: now() };
      save(KEYS.orders, list);
      return list[idx];
    }
    return null;
  }

  function getNextOrderNumber() {
    const orders = getOrders();
    const year = new Date().getFullYear();
    const count = orders.filter(o => o.orderNumber && o.orderNumber.includes(`${year}`)).length + 1;
    return `ZAM-${year}-${String(count).padStart(4, '0')}`;
  }

  /* ── Cart ───────────────────────────────────────────────────────────────── */

  function getCart() {
    return load(KEYS.cart);
  }

  function addToCart(product, qty) {
    qty = Math.max(1, parseInt(qty, 10) || 1);
    const cart = getCart();
    const idx = cart.findIndex(c => c.productId === product.id);
    if (idx >= 0) {
      cart[idx].qty += qty;
    } else {
      cart.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty,
        image: (product.images && product.images[0]) || '',
      });
    }
    save(KEYS.cart, cart);
    return cart;
  }

  function removeFromCart(productId) {
    save(KEYS.cart, getCart().filter(c => c.productId !== productId));
  }

  function clearCart() {
    save(KEYS.cart, []);
  }

  function getCartTotal() {
    return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  /* ── Suppliers ───────────────────────────────────────────────────────────── */

  function getSuppliers() {
    return load(KEYS.suppliers);
  }

  function saveSupplier(supplier) {
    const list = getSuppliers();
    const ts = now();
    if (!supplier.id) {
      supplier = { ...supplier, id: uid(), createdAt: ts };
      list.push(supplier);
    } else {
      const idx = list.findIndex(s => s.id === supplier.id);
      if (idx >= 0) {
        list[idx] = supplier;
      } else {
        list.push(supplier);
      }
    }
    save(KEYS.suppliers, list);
    return supplier;
  }

  /* ── Users ───────────────────────────────────────────────────────────────── */

  function getUsers() {
    // Merge with legacy app_users_list when present
    const platform = load(KEYS.users);
    try {
      const legacy = JSON.parse(localStorage.getItem('app_users_list')) || [];
      const allEmails = new Set(platform.map(u => u.email));
      for (const lu of legacy) {
        if (lu.email && !allEmails.has(lu.email)) {
          platform.push({ id: uid(), email: lu.email, name: lu.name || '', role: 'partner', plan: lu.plan || 'trial', createdAt: lu.createdAt || now(), storeIds: [] });
        }
      }
    } catch { /* ignore */ }
    return platform;
  }

  function saveUser(user) {
    const list = load(KEYS.users);
    const ts = now();
    if (!user.id) {
      user = { ...user, id: uid(), createdAt: ts };
      list.push(user);
    } else {
      const idx = list.findIndex(u => u.id === user.id);
      if (idx >= 0) {
        list[idx] = user;
      } else {
        list.push(user);
      }
    }
    save(KEYS.users, list);
    return user;
  }

  function getCurrentUser() {
    try {
      const email = localStorage.getItem('app_user_email');
      if (!email) return null;
      const users = getUsers();
      const found = users.find(u => u.email === email);
      if (found) return found;
      // Build from legacy keys
      return {
        id: null,
        email,
        name: email,
        role: localStorage.getItem('app_user_role') || 'partner',
        plan: localStorage.getItem('app_user_plan') || 'trial',
        storeIds: [],
      };
    } catch {
      return null;
    }
  }

  /* ── Notifications ───────────────────────────────────────────────────────── */

  function addNotification(msg, type) {
    const list = load(KEYS.notifications);
    const n = { id: uid(), type: type || 'info', message: msg, read: false, createdAt: now() };
    list.unshift(n);
    save(KEYS.notifications, list.slice(0, 200)); // cap at 200
    return n;
  }

  function getNotifications() {
    return load(KEYS.notifications);
  }

  function markNotificationRead(id) {
    const list = load(KEYS.notifications);
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].read = true;
      save(KEYS.notifications, list);
    }
  }

  /* ── Expose ──────────────────────────────────────────────────────────────── */

  global.Platform = {
    // Products
    getProducts,
    saveProduct,
    deleteProduct,
    importProductsFromSupplier,
    // Orders
    getOrders,
    saveOrder,
    getOrderById,
    updateOrderStatus,
    getNextOrderNumber,
    // Cart
    getCart,
    addToCart,
    removeFromCart,
    clearCart,
    getCartTotal,
    // Suppliers
    getSuppliers,
    saveSupplier,
    // Users
    getUsers,
    saveUser,
    getCurrentUser,
    // Notifications
    addNotification,
    getNotifications,
    markNotificationRead,
    // Internal helpers (useful for tests / debug)
    _keys: KEYS,
    _uid: uid,
  };
}(window));
