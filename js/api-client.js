/**
 * Qualitet Platform – API Client (compatibility shim)
 *
 * This file is a thin wrapper that delegates all calls to window.QMApi
 * (the canonical API client defined in js/api.js).
 *
 * Pages that previously used `QualitetAPI.*` continue to work without changes.
 * Token storage is handled by js/api.js under the key `qm_token`.
 */
(function (global) {
  'use strict';

  /**
   * Map QualitetAPI module names → QMApi module names.
   * QualitetAPI uses camelCase; QMApi uses PascalCase.
   */
  const MODULE_MAP = {
    auth:          'Auth',
    stores:        'Stores',
    products:      'Products',
    shopProducts:  'ShopProducts',
    orders:        'Orders',
    cart:          'Cart',
    subscriptions: 'Subscriptions',
    suppliers:     'Suppliers',
    categories:    'Categories',
    payments:      'Payments',
    admin:         'Admin',
    myStore:       'MyStore',
  };

  function buildShim() {
    const api = global.QMApi;
    if (!api) return null;
    const shim = {};
    for (const [legacyKey, newKey] of Object.entries(MODULE_MAP)) {
      shim[legacyKey] = api[newKey] || api[legacyKey] || null;
    }
    return shim;
  }

  let _shim = buildShim();

  // Proxy: re-resolves QMApi on every property access so that scripts loaded
  // after this file (including QMApi itself) are automatically discovered.
  const QualitetAPI = new Proxy({}, {
    get(_, prop) {
      if (!_shim) _shim = buildShim();
      if (_shim && prop in _shim) return _shim[prop];
      if (global.QMApi) return global.QMApi[MODULE_MAP[prop]] || global.QMApi[prop];
      return undefined;
    },
  });

  global.QualitetAPI = QualitetAPI;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = QualitetAPI;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this));
