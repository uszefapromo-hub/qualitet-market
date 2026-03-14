/**
 * homepage.js — Dynamic marketplace sections for QualitetVerse homepage
 *
 * Fetches data from the backend API and renders:
 *  - Trending Products
 *  - Creator Picks
 *  - Top Stores
 *  - Art Auctions
 *  - Top Sellers
 */
(function () {
  'use strict';

  const API_BASE = (typeof window !== 'undefined' && window.QM_API_BASE)
    || 'https://api.uszefaqualitet.pl/api';

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function formatPrice(value) {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', minimumFractionDigits: 2 });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function apiGet(path, params) {
    const url = new URL(API_BASE + path);
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v);
      });
    }
    return fetch(url.toString(), { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); });
  }

  function renderSkeletons(container, count, height) {
    var h = height || 200;
    container.innerHTML = Array.from({ length: count }, function () {
      return '<div class="mkt-skeleton" style="height:' + h + 'px;border-radius:18px"></div>';
    }).join('');
  }

  // ── Product Card ─────────────────────────────────────────────────────────────

  function productCard(p) {
    var img = p.image_url
      ? '<img class="mkt-card-img" src="' + escHtml(p.image_url) + '" alt="' + escHtml(p.name) + '" loading="lazy">'
      : '<div class="mkt-card-img" aria-hidden="true">📦</div>';
    var price = p.price_gross || p.selling_price || p.platform_price || p.supplier_price || '';
    var oldPrice = (p.original_price && parseFloat(p.original_price) > parseFloat(price))
      ? '<span class="old-price">' + formatPrice(p.original_price) + '</span>'
      : '';
    return '<a class="mkt-card" href="listing.html?product=' + escHtml(p.id) + '" style="display:block;text-decoration:none;color:inherit">'
      + img
      + '<div class="mkt-card-body">'
      + '<h4>' + escHtml(p.name) + '</h4>'
      + (price ? '<div class="price">' + formatPrice(price) + oldPrice + '</div>' : '')
      + (p.store_name ? '<div class="store-name">' + escHtml(p.store_name) + '</div>' : '')
      + '</div></a>';
  }

  // ── Store Card ────────────────────────────────────────────────────────────────

  function storeCard(s) {
    var initials = (s.name || 'S').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var logo = s.logo_url
      ? '<img src="' + escHtml(s.logo_url) + '" alt="' + escHtml(s.name) + '" style="width:100%;height:100%;object-fit:cover;border-radius:14px">'
      : initials;
    var products = s.product_count !== undefined ? s.product_count + ' produktów' : '';
    return '<a class="store-card" href="sklep.html?slug=' + escHtml(s.slug || s.id) + '" style="text-decoration:none;color:inherit">'
      + '<div class="store-card-logo">' + logo + '</div>'
      + '<h4>' + escHtml(s.name) + '</h4>'
      + (s.description ? '<p>' + escHtml(s.description) + '</p>' : '')
      + (products ? '<span class="store-badge">📦 ' + escHtml(products) + '</span>' : '<span class="store-badge">✅ Aktywny</span>')
      + '</a>';
  }

  // ── Auction Card ─────────────────────────────────────────────────────────────

  function auctionCard(a) {
    var img = (a.artwork && a.artwork.image_url)
      ? '<img class="auction-card-img" src="' + escHtml(a.artwork.image_url) + '" alt="' + escHtml(a.artwork.title || 'Dzieło sztuki') + '" loading="lazy">'
      : '<div class="auction-card-img" aria-hidden="true">🎨</div>';
    var title = (a.artwork && a.artwork.title) || a.title || 'Aukcja';
    var currentBid = a.current_price || a.starting_price || 0;
    var endsAt = a.ends_at ? new Date(a.ends_at) : null;
    var timeLeft = '';
    if (endsAt) {
      var diff = endsAt - Date.now();
      if (diff > 0) {
        var h = Math.floor(diff / 3600000);
        var m = Math.floor((diff % 3600000) / 60000);
        timeLeft = h > 24
          ? Math.floor(h / 24) + 'd ' + (h % 24) + 'h'
          : h + 'h ' + m + 'm';
      } else {
        timeLeft = 'Zakończona';
      }
    }
    return '<a class="auction-card" href="auctions.html?id=' + escHtml(a.id) + '" style="display:block;text-decoration:none;color:inherit">'
      + '<span class="auction-badge">🔥 Aktywna</span>'
      + img
      + '<div class="auction-card-body">'
      + '<h4>' + escHtml(title) + '</h4>'
      + '<div class="auction-bid">'
      + '<div><span style="font-size:11px;color:var(--muted)">Aktualna oferta</span><br><strong>' + formatPrice(currentBid) + '</strong></div>'
      + (timeLeft ? '<div class="auction-timer">⏱ ' + escHtml(timeLeft) + '</div>' : '')
      + '</div>'
      + '</div></a>';
  }

  // ── Seller Card ───────────────────────────────────────────────────────────────

  function sellerCard(s, rank) {
    var initials = (s.name || s.shop_name || 'S').trim().split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
    var medals = ['🥇', '🥈', '🥉'];
    var medal = rank < 3 ? medals[rank] : '#' + (rank + 1);
    var rating = s.avg_rating ? parseFloat(s.avg_rating).toFixed(1) : '';
    var sales = s.total_sales || s.orders_count || '';
    return '<a class="seller-card" href="sklep.html?seller=' + escHtml(s.user_id || s.id || '') + '" style="text-decoration:none">'
      + '<div class="seller-avatar">' + escHtml(initials) + '</div>'
      + '<h4>' + escHtml(medal) + ' ' + escHtml(s.name || s.shop_name || 'Sprzedawca') + '</h4>'
      + (sales ? '<p>' + escHtml(String(sales)) + ' zamówień</p>' : '<p>Aktywny sprzedawca</p>')
      + (rating ? '<div class="seller-rating">★ ' + escHtml(rating) + '</div>' : '')
      + '</a>';
  }

  // ── Fallback placeholder cards ────────────────────────────────────────────────

  function placeholderProducts() {
    var items = [
      { id: '1', name: 'Słuchawki bezprzewodowe BT Pro', price_gross: '149.99', image_url: '' },
      { id: '2', name: 'Kurtka zimowa Premium', price_gross: '299.00', image_url: '' },
      { id: '3', name: 'Zestaw do kawy Barista', price_gross: '89.50', image_url: '' },
      { id: '4', name: 'Smartwatch Fit Plus', price_gross: '199.00', image_url: '' }
    ];
    return items.map(productCard).join('');
  }

  function placeholderStores() {
    var items = [
      { id: '1', name: 'TechZone PL', slug: 'techzone', description: 'Elektronika i gadżety', product_count: 142 },
      { id: '2', name: 'ModaHouse', slug: 'modahouse', description: 'Odzież i akcesoria', product_count: 87 },
      { id: '3', name: 'SportPro', slug: 'sportpro', description: 'Sprzęt sportowy', product_count: 65 },
      { id: '4', name: 'HomeDecor', slug: 'homedecor', description: 'Dom i dekoracje', product_count: 234 }
    ];
    return items.map(storeCard).join('');
  }

  function placeholderAuctions() {
    var items = [
      { id: '1', title: 'Pejzaż Mazurski', current_price: 850, ends_at: new Date(Date.now() + 3600000 * 14).toISOString() },
      { id: '2', title: 'Portret — Nieznajoma', current_price: 1200, ends_at: new Date(Date.now() + 3600000 * 6).toISOString() },
      { id: '3', title: 'Abstrakcja Złota', current_price: 650, ends_at: new Date(Date.now() + 3600000 * 26).toISOString() }
    ];
    return items.map(auctionCard).join('');
  }

  function placeholderSellers() {
    var items = [
      { name: 'Marek K.', total_sales: 412, avg_rating: 4.9 },
      { name: 'Anna W.', total_sales: 289, avg_rating: 4.8 },
      { name: 'Piotr J.', total_sales: 178, avg_rating: 4.7 },
      { name: 'Kasia B.', total_sales: 134, avg_rating: 4.8 }
    ];
    return items.map(function(item, index) { return sellerCard(item, index); }).join('');
  }

  // ── Section loaders ───────────────────────────────────────────────────────────

  function loadTrendingProducts() {
    var container = document.getElementById('homepage-trending-products');
    if (!container) return;
    renderSkeletons(container, 4, 220);
    apiGet('/products', { limit: 8, sort: 'created_at', order: 'desc' })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.products || data.data || data.items || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 4).map(productCard).join('');
      })
      .catch(function () {
        container.innerHTML = placeholderProducts();
      });
  }

  function loadCreatorPicks() {
    var container = document.getElementById('homepage-creator-picks');
    if (!container) return;
    renderSkeletons(container, 4, 220);
    apiGet('/products', { limit: 8, sort: 'created_at', order: 'desc' })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.products || data.data || data.items || []);
        if (items.length === 0) throw new Error('empty');
        // Show next 4 products as "creator picks" (offset)
        var picks = items.length > 4 ? items.slice(4, 8) : items.slice(0, 4);
        container.innerHTML = picks.map(productCard).join('');
      })
      .catch(function () {
        container.innerHTML = placeholderProducts();
      });
  }

  function loadTopStores() {
    var container = document.getElementById('homepage-top-stores');
    if (!container) return;
    renderSkeletons(container, 4, 160);
    apiGet('/admin/shops', { limit: 8 })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.shops || data.data || data.items || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 4).map(storeCard).join('');
      })
      .catch(function () {
        // Try public shop endpoint as fallback
        return apiGet('/shops', { limit: 8 })
          .then(function (data) {
            var items = Array.isArray(data) ? data : (data.shops || data.data || []);
            if (items.length === 0) throw new Error('empty');
            container.innerHTML = items.slice(0, 4).map(storeCard).join('');
          });
      })
      .catch(function () {
        container.innerHTML = placeholderStores();
      });
  }

  function loadArtAuctions() {
    var container = document.getElementById('homepage-art-auctions');
    if (!container) return;
    renderSkeletons(container, 3, 260);
    apiGet('/auctions', { status: 'active', limit: 6 })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.auctions || data.data || data.items || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 3).map(auctionCard).join('');
      })
      .catch(function () {
        container.innerHTML = placeholderAuctions();
      });
  }

  function loadTopSellers() {
    var container = document.getElementById('homepage-top-sellers');
    if (!container) return;
    renderSkeletons(container, 4, 140);
    apiGet('/reputation/sellers', { limit: 8 })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.sellers || data.data || data.items || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 4).map(function(item, index) { return sellerCard(item, index); }).join('');
      })
      .catch(function () {
        container.innerHTML = placeholderSellers();
      });
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  function init() {
    // Stagger requests to avoid hammering the API simultaneously
    loadTrendingProducts();
    setTimeout(loadTopStores, 150);
    setTimeout(loadArtAuctions, 300);
    setTimeout(loadCreatorPicks, 450);
    setTimeout(loadTopSellers, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
