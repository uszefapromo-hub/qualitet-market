'use strict';

/**
 * feed.js – Buyer-Facing Product Feed (TikTok / Instagram style)
 *
 * Full-screen vertical snap-scroll: one product per viewport slide.
 * Pressing "Kup teraz" adds the item to the cart and redirects to koszyk.html.
 *
 * Depends on: window.QMApi (js/api.js), window.QMCart (js/cart.js)
 */

(function () {
  var MAX_PRODUCTS = 30;

  // ─── Helpers ──────────────────────────────────────────────────────────────

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatPrice(val) {
    if (val == null) return '—';
    return parseFloat(val).toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
  }

  function getRetailPrice(p) {
    return p.selling_price || p.price_gross || p.platform_price || null;
  }

  // ─── Slide rendering ──────────────────────────────────────────────────────

  function renderSlide(p) {
    var price = getRetailPrice(p);

    var imgHtml = p.image_url
      ? '<img class="product-img" src="' + escHtml(p.image_url) + '" alt="' + escHtml(p.name) + '" loading="lazy">'
      : '<div class="product-placeholder">🛍️</div>';

    return '<article class="product" data-product-id="' + escHtml(p.id) + '">'
      + imgHtml
      + '<div class="product-overlay"></div>'
      + '<div class="product-content">'
      +   '<h2 class="product-name">' + escHtml(p.name) + '</h2>'
      +   '<div class="product-price">' + escHtml(formatPrice(price)) + '</div>'
      +   '<button class="btn-buy"'
      +     ' data-product-id="' + escHtml(p.id) + '"'
      +     ' data-product-name="' + escHtml(p.name) + '"'
      +     ' data-product-price="' + escHtml(String(price != null ? price : 0)) + '"'
      +     ' data-product-img="' + escHtml(p.image_url || '') + '"'
      +     ' type="button">'
      +     '👉 Kup teraz'
      +   '</button>'
      + '</div>'
      + '</article>';
  }

  // ─── Buy-now handler ──────────────────────────────────────────────────────

  function handleBuyNow(btn) {
    var id    = btn.dataset.productId;
    var name  = btn.dataset.productName;
    var price = parseFloat(btn.dataset.productPrice);
    if (isNaN(price)) price = 0;
    var img   = btn.dataset.productImg || '';

    if (!id || !name) return;

    btn.textContent = '⏳ Dodawanie…';
    btn.disabled = true;

    // Add to cart via QMCart (localStorage + optional API sync)
    if (window.QMCart && typeof window.QMCart.addToCart === 'function') {
      window.QMCart.addToCart({ id: id, name: name, price: price, img: img });
    }

    // Redirect to checkout
    window.location.href = 'koszyk.html';
  }

  // ─── Load & render ────────────────────────────────────────────────────────

  function showError() {
    var feed = document.getElementById('feed');
    if (!feed) return;
    feed.innerHTML = '<div class="feed-state">'
      + '<p>Nie udało się załadować produktów.<br>Sprawdź połączenie z internetem.</p>'
      + '<a href="sklep.html">Przejdź do sklepu</a>'
      + '</div>';
  }

  async function loadFeed() {
    var feed    = document.getElementById('feed');
    var loading = document.getElementById('feed-loading');

    try {
      var products = [];

      if (window.QMApi && window.QMApi.Products) {
        var data = await window.QMApi.Products.list({
          limit:  MAX_PRODUCTS,
          status: 'active',
          sort:   'featured',
        });
        products = (data && data.products) ? data.products : [];
      } else {
        var base = (window.QM_API_BASE || '/api').replace(/\/api$/, '');
        var res  = await fetch(base + '/api/products?limit=' + MAX_PRODUCTS + '&status=active&sort=featured');
        if (!res.ok) throw new Error('network ' + res.status);
        var json = await res.json();
        products = json.products || [];
      }

      // Remove loading placeholder
      if (loading) loading.remove();

      if (!products.length) {
        feed.innerHTML = '<div class="feed-state">'
          + '<p>Brak dostępnych produktów.</p>'
          + '<a href="sklep.html">Przejdź do sklepu</a>'
          + '</div>';
        return;
      }

      // Render slides
      var html = products.map(renderSlide).join('');
      feed.insertAdjacentHTML('beforeend', html);

      // Delegate click on buy buttons
      feed.addEventListener('click', function (e) {
        var btn = e.target.closest('.btn-buy');
        if (btn) handleBuyNow(btn);
      });

    } catch (err) {
      console.error('[feed] load error:', err);
      if (loading) loading.remove();
      showError();
    }
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadFeed);
  } else {
    loadFeed();
  }
})();
