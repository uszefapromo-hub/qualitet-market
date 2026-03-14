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

  function loadProfitableProducts() {
    var container = document.getElementById('homepage-profitable-products');
    if (!container) return;
    renderSkeletons(container, 4, 220);
    // Fetch products sorted by margin descending (highest margin first)
    apiGet('/products', { limit: 8, sort: 'margin', order: 'desc', is_central: 'true' })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.products || data.data || data.items || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 4).map(productCard).join('');
      })
      .catch(function () {
        // Fallback: show regular products
        return apiGet('/products', { limit: 4 })
          .then(function (data) {
            var items = Array.isArray(data) ? data : (data.products || data.data || data.items || []);
            if (items.length === 0) throw new Error('empty');
            container.innerHTML = items.slice(0, 4).map(productCard).join('');
          });
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

  // ── New Products ─────────────────────────────────────────────────────────────

  function loadNewProducts() {
    var container = document.getElementById('homepage-new-products');
    if (!container) return;
    renderSkeletons(container, 4, 220);
    apiGet('/products', { limit: 8, sort: 'new', is_central: 'true' })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.products || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 4).map(productCard).join('');
      })
      .catch(function () {
        container.innerHTML = placeholderProducts();
      });
  }

  // ── Bestsellers ─────────────────────────────────────────────────────────────

  function loadBestsellers() {
    var container = document.getElementById('homepage-bestsellers');
    if (!container) return;
    renderSkeletons(container, 4, 220);
    apiGet('/products', { limit: 8, sort: 'bestsellers', is_central: 'true' })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data.products || []);
        if (items.length === 0) throw new Error('empty');
        container.innerHTML = items.slice(0, 4).map(productCard).join('');
      })
      .catch(function () {
        container.innerHTML = placeholderProducts();
      });
  }

  // ── Viral Products ───────────────────────────────────────────────────────────

  function loadViralProducts() {
    var container = document.getElementById('homepage-viral-products');
    if (!container) return;
    renderSkeletons(container, 4, 220);
    // Use trending social posts to find promoted products; fall back to newest central products
    apiGet('/social/trending', { limit: 10 })
      .then(function (data) {
        var posts = Array.isArray(data) ? data : (data.posts || []);
        var withProduct = posts.filter(function (p) { return p.product_id; });
        if (withProduct.length === 0) throw new Error('no viral products');
        var products = withProduct.map(function (p) {
          return {
            id: p.product_id,
            name: p.product_name || 'Produkt viral',
            price_gross: p.product_price,
            image_url: (p.media_urls && p.media_urls[0]) || '',
            store_name: p.author_name,
          };
        });
        container.innerHTML = products.slice(0, 4).map(productCard).join('');
      })
      .catch(function () {
        // Fallback: newest central products
        return apiGet('/products', { limit: 4, is_central: 'true', sort: 'new' })
          .then(function (data) {
            var items = Array.isArray(data) ? data : (data.products || []);
            container.innerHTML = items.length > 0 ? items.slice(0, 4).map(productCard).join('') : placeholderProducts();
          });
      })
      .catch(function () {
        container.innerHTML = placeholderProducts();
      });
  }

  // ── Social Video Embed ───────────────────────────────────────────────────────

  /**
   * Build an inline iframe embed URL for TikTok or YouTube.
   * Uses the oembed/embed URL format. For privacy, no autoplay.
   */
  function buildVideoEmbed(videoUrl, videoType) {
    if (!videoUrl) return null;

    // YouTube / Shorts
    if (videoType === 'youtube' || videoType === 'short') {
      var ytMatch = videoUrl.match(/(?:v=|\/embed\/|\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
      if (ytMatch) {
        return {
          src: 'https://www.youtube.com/embed/' + ytMatch[1] + '?rel=0',
          aspect: videoType === 'short' ? 'aspect-vertical' : 'aspect-horizontal',
        };
      }
    }

    // TikTok – use the tiktok embed player
    if (videoType === 'tiktok') {
      var ttMatch = videoUrl.match(/video\/(\d+)/);
      if (ttMatch) {
        return {
          src: 'https://www.tiktok.com/embed/v2/' + ttMatch[1],
          aspect: 'aspect-vertical',
        };
      }
    }

    // Instagram Reels – Instagram doesn't allow iframes from external domains,
    // so we show a link-out card instead
    if (videoType === 'reel') return { external: true, url: videoUrl, aspect: 'aspect-vertical' };

    return null;
  }

  function socialVideoCard(post) {
    var embed = buildVideoEmbed(post.video_url, post.video_type);
    var productLink = post.product_id
      ? '<a class="social-video-product-link" href="listing.html?product=' + escHtml(post.product_id) + '">🛒 Kup produkt</a>'
      : '';
    var label = escHtml(post.content ? post.content.substring(0, 80) : 'Video post');

    if (!embed) return '';

    if (embed.external) {
      return '<div class="social-video-card">'
        + '<div class="social-video-iframe-wrap ' + embed.aspect + '" style="background:linear-gradient(135deg,rgba(225,48,108,.3),rgba(139,92,246,.2));display:flex;align-items:center;justify-content:center">'
        + '<a href="' + escHtml(embed.url) + '" target="_blank" rel="noopener noreferrer" style="color:#fff;text-align:center;padding:20px">'
        + '<div style="font-size:40px">📱</div><div style="margin-top:8px;font-size:14px">Obejrzyj Reel na Instagram</div>'
        + '</a></div>'
        + '<p class="social-video-label">' + label + '</p>'
        + productLink
        + '</div>';
    }

    return '<div class="social-video-card">'
      + '<div class="social-video-iframe-wrap ' + embed.aspect + '">'
      + '<iframe src="' + escHtml(embed.src) + '" loading="lazy" allowfullscreen title="' + label + '" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>'
      + '</div>'
      + '<p class="social-video-label">' + label + '</p>'
      + productLink
      + '</div>';
  }

  function loadSocialVideo() {
    var container = document.getElementById('homepage-social-video');
    if (!container) return;

    // Static demo video cards — will be replaced with API data when posts with video_url exist
    var demoVideos = [
      {
        id: 'demo-1',
        content: 'Sprawdź te bezprzewodowe słuchawki — najlepszy deal tygodnia!',
        video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        video_type: 'youtube',
        product_id: null,
      },
      {
        id: 'demo-2',
        content: 'TikTok viral — modne sneakersy w promocji!',
        video_url: 'https://www.tiktok.com/@example/video/7123456789012345678',
        video_type: 'tiktok',
        product_id: null,
      },
      {
        id: 'demo-3',
        content: 'YouTube Shorts — gadżety które musisz mieć',
        video_url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ',
        video_type: 'short',
        product_id: null,
      },
    ];

    apiGet('/social/feed', { type: 'video', limit: 6 })
      .then(function (data) {
        var posts = Array.isArray(data) ? data : (data.posts || []);
        var withVideo = posts.filter(function (p) { return p.video_url; });
        var items = withVideo.length > 0 ? withVideo : demoVideos;
        var html = items.slice(0, 3).map(socialVideoCard).join('');
        container.innerHTML = html || container.innerHTML;
      })
      .catch(function () {
        var html = demoVideos.map(socialVideoCard).join('');
        container.innerHTML = html || container.innerHTML;
      });
  }

  // ── Social Product Posts ─────────────────────────────────────────────────────

  function socialPostCard(post) {
    var hasVideo = !!post.video_url;
    var imgSrc = (post.media_urls && post.media_urls[0]) || '';
    var mediaSrc = imgSrc || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60';
    var embed = hasVideo ? buildVideoEmbed(post.video_url, post.video_type) : null;
    var price = post.product_price ? formatPrice(post.product_price) : '';

    var mediaHtml;
    if (embed && !embed.external) {
      mediaHtml = '<div class="social-post-media">'
        + '<div class="social-video-iframe-wrap aspect-horizontal" style="aspect-ratio:4/3">'
        + '<iframe src="' + escHtml(embed.src) + '" loading="lazy" allowfullscreen title="' + escHtml(post.content || '') + '" sandbox="allow-scripts allow-same-origin allow-popups"></iframe>'
        + '</div>'
        + '<span class="social-post-video-badge">▶ Video</span>'
        + '</div>';
    } else {
      mediaHtml = '<div class="social-post-media">'
        + '<img src="' + escHtml(mediaSrc) + '" alt="' + escHtml(post.product_name || post.content || '') + '" loading="lazy">'
        + (hasVideo ? '<span class="social-post-video-badge">▶ Video</span>' : '')
        + '</div>';
    }

    var buyLink = post.product_id
      ? '<a class="btn btn-primary social-post-buy" href="listing.html?product=' + escHtml(post.product_id) + '">🛒 Kup produkt</a>'
      : '<a class="btn btn-secondary social-post-buy" href="qualitetmarket.html">Przeglądaj →</a>';

    return '<div class="social-post-card">'
      + mediaHtml
      + '<div class="social-post-body">'
      + (post.product_name ? '<h4 class="social-post-title">' + escHtml(post.product_name) + '</h4>' : '')
      + '<p class="social-post-desc">' + escHtml((post.content || '').substring(0, 120)) + '</p>'
      + (price ? '<div class="social-post-price">' + price + '</div>' : '')
      + '<div class="social-post-actions">' + buyLink + '</div>'
      + '</div></div>';
  }

  var demoSocialPosts = [
    {
      id: 'demo-p1',
      content: 'Viral produkt — bezprzewodowe słuchawki z redukcją szumów. Tysiące pozytywnych recenzji na TikTok!',
      product_name: 'Słuchawki BT Pro X',
      product_price: '149.99',
      media_urls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=60'],
      video_url: null,
      product_id: null,
    },
    {
      id: 'demo-p2',
      content: 'Ten smartwatch bije rekordy sprzedaży! Sprawdź zanim skończy się promocja 🔥',
      product_name: 'Smartwatch Fit Ultra',
      product_price: '199.00',
      media_urls: ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=800&q=60'],
      video_url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      video_type: 'youtube',
      product_id: null,
    },
    {
      id: 'demo-p3',
      content: 'Modne sneakersy z najnowszej kolekcji — polecane przez influencerów na Instagram i TikTok.',
      product_name: 'Sneakersy Urban Pro',
      product_price: '299.00',
      media_urls: ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=800&q=60'],
      video_url: null,
      product_id: null,
    },
  ];

  function loadSocialPosts() {
    var container = document.getElementById('homepage-social-posts');
    if (!container) return;
    apiGet('/social/feed', { type: 'product', limit: 6 })
      .then(function (data) {
        var posts = Array.isArray(data) ? data : (data.posts || []);
        var items = posts.length > 0 ? posts : demoSocialPosts;
        container.innerHTML = items.slice(0, 3).map(socialPostCard).join('');
      })
      .catch(function () {
        container.innerHTML = demoSocialPosts.map(socialPostCard).join('');
      });
  }

  function init() {
    // Stagger requests to avoid hammering the API simultaneously
    loadTrendingProducts();
    setTimeout(loadTopStores, 150);
    setTimeout(loadProfitableProducts, 300);
    setTimeout(loadTopSellers, 450);
    setTimeout(loadNewProducts, 600);
    setTimeout(loadBestsellers, 750);
    setTimeout(loadViralProducts, 900);
    setTimeout(loadSocialVideo, 1050);
    setTimeout(loadSocialPosts, 1200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
}());
