/**
 * api-client.js — compatibility shim
 *
 * The canonical API client is window.QMApi (js/api.js).
 * This file re-exports QMApi under the legacy QualitetAPI name so that any
 * existing code depending on window.QualitetAPI continues to work without
 * changes.
 *
 * Load js/api.js BEFORE this file.
 */
(function (global) {
  'use strict';

  // Wait for QMApi to be defined (api.js loads before this file)
  function exposeAlias() {
    if (!global.QMApi) {
      // Should not happen if scripts are ordered correctly, but guard anyway
      console.warn('QualitetAPI shim: window.QMApi not found. Ensure js/api.js is loaded first.');
      return;
    }

    var api = global.QMApi;

    /**
     * QualitetAPI — legacy alias for window.QMApi.
     * Maps the old camelCase shape (auth, products, orders, cart…)
     * to the corresponding QMApi modules.
     */
    global.QualitetAPI = {
      // Auth
      auth: {
        register:       function (e, p, n, r)  { return api.Auth.register(e, p, n, r); },
        login:          function (e, p)         { return api.Auth.login(e, p); },
        logout:         function ()             { return api.Auth.logout(); },
        me:             function ()             { return api.Auth.me(); },
        updateProfile:  function (d)            { return api.Auth.updateProfile(d); },
        changePassword: function (c, n)         { return api.Auth.changePassword(c, n); },
        getToken:       function ()             { return api._request ? api._request._getToken && api._request._getToken() : null; },
        isLoggedIn:     function ()             { return api.Auth.isLoggedIn(); },
      },

      // Stores
      stores: {
        list:   function (p)    { return api.Stores.list(p); },
        get:    function (id)   { return api.Stores.get(id); },
        create: function (d)    { return api.Stores.create(d); },
        update: function (id,d) { return api.Stores.update(id, d); },
        delete: function (id)   { return api.Stores.remove(id); },
      },

      // Products
      products: {
        list:   function (p)    { return api.Products.list(p); },
        get:    function (id)   { return api.Products.get(id); },
        create: function (d)    { return api.Products.create(d); },
        update: function (id,d) { return api.Products.update(id, d); },
        delete: function (id)   { return api.Products.remove(id); },
      },

      // Shop products
      shopProducts: {
        list:   function (sid,p)      { return api.ShopProducts.list(sid, p); },
        add:    function (sid,pid,ov) { return api.ShopProducts.add({store_id:sid,product_id:pid,...(ov||{})}); },
        update: function (id,d)       { return api.ShopProducts.update(id, d); },
        remove: function (id)         { return api.ShopProducts.remove(id); },
      },

      // Orders
      orders: {
        list:         function (p)       { return api.Orders.list(p); },
        get:          function (id)      { return api.Orders.get(id); },
        create:       function (sid,items,addr,notes) {
          return api.Orders.create({store_id:sid, items:items, shipping_address:addr, notes:notes||''});
        },
        updateStatus: function (id,s)   { return api.Orders.updateStatus(id, s); },
      },

      // Cart
      cart: {
        get:        function (sid)        { return api.Cart.get(sid); },
        addItem:    function (sid,pid,qty){ return api.Cart.addItem(sid, pid, qty); },
        updateItem: function (sid,pid,qty){ return api.Cart.setItem(sid, pid, qty); },
        removeItem: function (sid,pid)    { return api.Cart.removeItem(sid, pid); },
        clear:      function (sid)        { return api.Cart.clear(sid); },
      },

      // Subscriptions
      subscriptions: {
        list:   function ()              { return api.Subscriptions.list(); },
        active: function ()              { return api.Subscriptions.active(); },
        create: function (plan,ref,days) { return api.Subscriptions.create(plan, {payment_reference:ref,duration_days:days}); },
        cancel: function (id)            { return api.Subscriptions.cancel(id); },
      },

      // Suppliers
      suppliers: {
        list:   function ()      { return api.Suppliers.list(); },
        get:    function (id)    { return api.Suppliers.get(id); },
        create: function (d)     { return api.Suppliers.create(d); },
        update: function (id,d)  { return api.Suppliers.update(id, d); },
        import: function (id,f,s){ return api.Suppliers.importFile(id, s, f); },
        sync:   function (id,s)  { return api.Suppliers.sync(id, s); },
      },

      // Categories
      categories: {
        list: function ()   { return api.Categories.list(); },
        get:  function (id) { return api.Categories.get(id); },
      },

      // Payments
      payments: {
        list: function (p)  { return api.Payments.list(p); },
        get:  function (id) { return api.Payments.get(id); },
      },

      // Admin
      admin: {
        stats:              function ()    { return api.Admin.stats(); },
        listUsers:          function (p)   { return api.Admin.users(p); },
        updateUser:         function (id,d){ return api.Admin.updateUser(id, d); },
        listOrders:         function (p)   { return api.Admin.orders(p); },
        listStores:         function (p)   { return api.Admin.stores(p); },
        updateStore:        function (id,d){ return api.Admin.updateStoreStatus(id, d.status); },
        listSubscriptions:  function (p)   { return api.Admin.subscriptions(p); },
        auditLogs:          function (p)   { return api.Admin.auditLogs(p); },
      },
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', exposeAlias);
  } else {
    exposeAlias();
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
