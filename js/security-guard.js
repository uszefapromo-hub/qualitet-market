/**
 * security-guard.js – Runtime protection against external iframes and unauthorized redirects.
 *
 * - Removes any iframe whose src points outside our own domain or known trusted embeds.
 * - Observes DOM mutations to catch dynamically injected iframes.
 * - Exposes window.QMSafeRedirect() for validated navigation in inline scripts.
 * - Must be loaded as early as possible (no defer/async).
 */
(function () {
  'use strict';

  var ALLOWED_HOSTS = [
    window.location.hostname,
    'www.youtube.com',
    'youtube.com',
    'www.tiktok.com',
    'tiktok.com',
    'js.stripe.com',
    'hooks.stripe.com',
    'checkout.stripe.com',
    'przelewy24.pl',
    'secure.przelewy24.pl'
  ];

  function isAllowedHost(url) {
    if (!url || url === '' || url === 'about:blank') return true;
    try {
      var parsed = new URL(url, window.location.origin);
      if (parsed.origin === window.location.origin) return true;
      for (var i = 0; i < ALLOWED_HOSTS.length; i++) {
        if (parsed.hostname === ALLOWED_HOSTS[i] ||
            parsed.hostname.endsWith('.' + ALLOWED_HOSTS[i])) {
          return true;
        }
      }
      return false;
    } catch (e) {
      return false;
    }
  }

  /**
   * Safe redirect: follow url only if it points to our own origin or a known payment gateway.
   * Falls back to `fallback` (default '#') when the url is blocked.
   */
  window.QMSafeRedirect = function safeRedirect(url, fallback) {
    fallback = fallback || '#';
    if (isAllowedHost(url)) {
      window.location.href = url;
    } else {
      if (typeof console !== 'undefined') {
        console.warn('[QualitetMarket] Blocked external redirect to:', url);
      }
      window.location.href = fallback;
    }
  };

  function sanitizeIframe(el) {
    var src = el.getAttribute('src') || '';
    if (!isAllowedHost(src)) {
      if (typeof console !== 'undefined') {
        console.warn('[QualitetMarket] Blocked external iframe:', src);
      }
      el.parentNode && el.parentNode.removeChild(el);
    }
  }

  function sanitizeAll() {
    var iframes = document.querySelectorAll('iframe');
    for (var i = 0; i < iframes.length; i++) {
      sanitizeIframe(iframes[i]);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', sanitizeAll);
  } else {
    sanitizeAll();
  }

  // Watch for dynamically added iframes
  if (window.MutationObserver) {
    var observer = new MutationObserver(function (mutations) {
      for (var m = 0; m < mutations.length; m++) {
        var nodes = mutations[m].addedNodes;
        for (var n = 0; n < nodes.length; n++) {
          var node = nodes[n];
          if (node.nodeType !== 1) continue;
          if (node.tagName && node.tagName.toUpperCase() === 'IFRAME') {
            sanitizeIframe(node);
          } else if (node.querySelectorAll) {
            var nested = node.querySelectorAll('iframe');
            for (var k = 0; k < nested.length; k++) {
              sanitizeIframe(nested[k]);
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
