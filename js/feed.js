'use strict';

/**
 * feed.js – Social Commerce Product Feed
 *
 * TikTok-style vertical product discovery feed.
 * Sections: recommended | trending | new | best_margin | bestsellers
 *
 * Depends on: window.QMApi (js/api.js)
 */

(function () {
  // ─── State ───────────────────────────────────────────────────────────────────
  let currentSection = 'recommended';
  let currentPage    = 1;
  let isLoading      = false;
  let hasMore        = true;
  let totalLoaded    = 0;

  const LIMIT         = 10;
  const FEED_SECTIONS = [
    { key: 'recommended', label: '⭐ Dla Ciebie' },
    { key: 'trending',    label: '🔥 Trending'  },
    { key: 'new',         label: '✨ Nowości'    },
    { key: 'best_margin', label: '💰 Marża'      },
    { key: 'bestsellers', label: '🏆 Bestsellery' },
  ];

  // ─── Utilities ───────────────────────────────────────────────────────────────

  function escHtml(str) {
    if (!str) return '';
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

  // ─── Badge rendering ─────────────────────────────────────────────────────────

  const BADGE_MAP = {
    new:         { label: 'Nowość',     cls: 'badge-new'        },
    featured:    { label: 'Wyróżniony', cls: 'badge-featured'   },
    bestseller:  { label: 'Bestseller', cls: 'badge-bestseller' },
    high_margin: { label: 'Wysoka Marża', cls: 'badge-margin'   },
  };

  function renderBadges(badges) {
    if (!badges || badges.length === 0) return '';
    return badges.map((b) => {
      const cfg = BADGE_MAP[b];
      if (!cfg) return '';
      return `<span class="feed-badge ${escHtml(cfg.cls)}">${escHtml(cfg.label)}</span>`;
    }).join('');
  }

  // ─── Card rendering ──────────────────────────────────────────────────────────

  function renderCard(p) {
    const profitHtml = p.expected_reseller_profit != null
      ? `<div class="feed-profit">💰 Zysk dla Ciebie: <strong>${escHtml(formatPrice(p.expected_reseller_profit))}</strong></div>`
      : '';

    const resellerPriceHtml = p.recommended_reseller_price != null
      ? `<div class="feed-reseller-price">🏷 Proponowana cena sprzedaży: ${escHtml(formatPrice(p.recommended_reseller_price))}</div>`
      : '';

    const supplierHtml = p.supplier_name
      ? `<div class="feed-supplier">📦 Dostawca: ${escHtml(p.supplier_name)}</div>`
      : '';

    const imgHtml = p.image_url
      ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.name)}" class="feed-card-img" loading="lazy">`
      : `<div class="feed-card-img feed-card-img-placeholder">🛍️</div>`;

    return `
      <article class="feed-card" data-product-id="${escHtml(p.id)}">
        <div class="feed-card-media">
          ${imgHtml}
          <div class="feed-card-badges">${renderBadges(p.badges)}</div>
        </div>
        <div class="feed-card-body">
          <h3 class="feed-card-name">${escHtml(p.name)}</h3>
          ${supplierHtml}
          <div class="feed-card-pricing">
            <div class="feed-platform-price">Cena hurtowa: <strong>${escHtml(formatPrice(p.platform_price))}</strong></div>
            ${resellerPriceHtml}
            ${profitHtml}
          </div>
          <div class="feed-card-actions">
            <button class="feed-btn feed-btn-add" data-action="add" data-product-id="${escHtml(p.id)}">
              ➕ Dodaj do sklepu
            </button>
            <a href="listing.html?id=${escHtml(p.id)}" class="feed-btn feed-btn-view">
              🔍 Szczegóły
            </a>
          </div>
        </div>
      </article>`;
  }

  // ─── Section tabs ────────────────────────────────────────────────────────────

  function renderTabs() {
    const container = document.getElementById('feed-tabs');
    if (!container) return;
    container.innerHTML = FEED_SECTIONS.map((s) => `
      <button
        class="feed-tab${s.key === currentSection ? ' active' : ''}"
        data-section="${escHtml(s.key)}">
        ${escHtml(s.label)}
      </button>`
    ).join('');

    container.querySelectorAll('.feed-tab').forEach((btn) => {
      btn.addEventListener('click', () => {
        const section = btn.dataset.section;
        if (section === currentSection) return;
        switchSection(section);
      });
    });
  }

  function switchSection(section) {
    currentSection = section;
    currentPage    = 1;
    hasMore        = true;
    totalLoaded    = 0;

    const container = document.getElementById('feed-container');
    if (container) container.innerHTML = '';

    renderTabs();
    loadNextPage();
  }

  // ─── Loading state ────────────────────────────────────────────────────────────

  function showLoader(show) {
    const loader = document.getElementById('feed-loader');
    if (loader) loader.style.display = show ? 'flex' : 'none';
  }

  function showEndMessage(show) {
    const el = document.getElementById('feed-end');
    if (el) el.style.display = show ? 'block' : 'none';
  }

  function showError(msg) {
    const el = document.getElementById('feed-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  // ─── API call ────────────────────────────────────────────────────────────────

  async function loadNextPage() {
    if (isLoading || !hasMore) return;
    isLoading = true;
    showLoader(true);

    try {
      const params = new URLSearchParams({
        section: currentSection,
        page:    currentPage,
        limit:   LIMIT,
      });

      const endpoint = `/api/feed?${params}`;
      let data;

      if (window.QMApi && window.QMApi.get) {
        data = await window.QMApi.get(endpoint);
      } else {
        const res = await fetch(endpoint);
        if (!res.ok) throw new Error('Błąd sieci');
        data = await res.json();
      }

      const products  = data.products || [];
      const container = document.getElementById('feed-container');

      if (products.length === 0 && currentPage === 1) {
        if (container) container.innerHTML = '<p class="feed-empty">Brak produktów w tej sekcji.</p>';
        hasMore = false;
      } else {
        products.forEach((p) => {
          const div = document.createElement('div');
          div.innerHTML = renderCard(p).trim();
          const card = div.firstChild;
          if (container) container.appendChild(card);
        });

        totalLoaded += products.length;
        hasMore = totalLoaded < (data.total || 0);
        currentPage++;
      }

      if (!hasMore) showEndMessage(true);
    } catch (err) {
      console.error('feed load error:', err);
      showError('Nie udało się załadować produktów. Spróbuj ponownie.');
    } finally {
      isLoading = false;
      showLoader(false);
    }
  }

  // ─── Infinite scroll ─────────────────────────────────────────────────────────

  function setupInfiniteScroll() {
    const sentinel = document.getElementById('feed-sentinel');
    if (!sentinel || !('IntersectionObserver' in window)) {
      // Fallback: scroll listener
      window.addEventListener('scroll', () => {
        const scrolledToBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
        if (scrolledToBottom) loadNextPage();
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadNextPage(); },
      { rootMargin: '200px' }
    );
    observer.observe(sentinel);
  }

  // ─── Add to store action ─────────────────────────────────────────────────────

  async function addToStore(productId, btn) {
    const api  = window.QMApi;
    const user = api && api.Auth ? api.Auth.currentUser() : null;
    if (!user) {
      window.location.href = 'login.html?redirect=feed.html';
      return;
    }

    const originalText = btn.textContent;
    btn.disabled    = true;
    btn.textContent = '⏳ Dodawanie…';

    try {
      // Fetch seller's store via QMApi (includes auth header automatically)
      const store = await api.get('/my/store');

      if (!store || !store.id) {
        showError('Nie znaleziono Twojego sklepu. Utwórz sklep w dashboardzie.');
        btn.disabled    = false;
        btn.textContent = originalText;
        return;
      }

      // Add product to store via QMApi
      await api.post('/my/store/products', { product_id: productId, store_id: store.id });

      btn.textContent = '✅ Dodano!';
      btn.classList.add('added');
      setTimeout(() => { btn.textContent = '✅ W sklepie'; }, 2000);
    } catch (err) {
      console.error('add-to-store error:', err);
      const msg = (err && err.error) ? err.error : 'Nie udało się dodać produktu.';
      showError(msg);
      btn.disabled    = false;
      btn.textContent = originalText;
    }
  }

  // ─── Event delegation ────────────────────────────────────────────────────────

  function setupCardEvents() {
    const container = document.getElementById('feed-container');
    if (!container) return;

    container.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-action="add"]');
      if (btn) {
        e.preventDefault();
        addToStore(btn.dataset.productId, btn);
      }
    });
  }

  // ─── Init ────────────────────────────────────────────────────────────────────

  function init() {
    renderTabs();
    setupCardEvents();
    setupInfiniteScroll();
    loadNextPage();
  }

  // ─── Auto-refresh feed every 60 seconds ──────────────────────────────────────
  // Only reloads when the user is still on the first page of results so that
  // actively browsing users are not interrupted. New products that arrive in the
  // catalogue will appear on the next natural load.
  function startFeedAutoRefresh() {
    setInterval(() => {
      // Skip the refresh if the user has scrolled past the first page
      if (currentPage > 2) return;
      currentPage = 1;
      hasMore = true;
      totalLoaded = 0;
      const container = document.getElementById('feed-container');
      if (container) container.innerHTML = '';
      loadNextPage();
    }, 60_000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { init(); startFeedAutoRefresh(); });
  } else {
    init();
    startFeedAutoRefresh();
  }
})();
