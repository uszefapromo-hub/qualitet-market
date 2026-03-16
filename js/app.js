(function(){
  const STORAGE_KEYS = {
    email: 'app_user_email',
    logged: 'app_user_logged',
    usersCount: 'app_users_count',
    usersList: 'app_users_list',
    trialDays: 'app_user_trial_days',
    trialStart: 'app_user_trial_start',
    plan: 'app_user_plan',
    role: 'app_user_role',
    storeSettings: 'app_store_settings',
    storeReady: 'app_store_ready',
    surveyResponses: 'app_survey_responses',
    surveySeen: 'app_survey_seen',
    pendingPlan: 'app_pending_plan',
    landingSeen: 'app_landing_seen',
    calculatorResults: 'calculatorResults',
    userProfile: 'app_user_profile'
  };
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const SURVEY_AUTO_OPEN_DELAY = 4500;
  const LANDING_AUTO_OPEN_DELAY = 2400;
  const SURVEY_SUCCESS_TIMEOUT = 1500;
  const SPLASH_STORAGE_KEY = 'app_splash_seen';
  const INSTALL_BANNER_DISMISSED_KEY = 'app_install_banner_dismissed';
  const INSTALL_BANNER_DISMISSED_UNTIL_KEY = 'app_install_banner_until';
  const INSTALL_BANNER_REAPPEAR_DAYS = 3;
  const APP_INSTALL_BAR_DISMISSED_KEY = 'pwa_banner_closed';
  const APP_PROMO_LAST_SHOWN_KEY = 'app_promo_last_shown';
  const APP_PROMO_INDEX_KEY = 'app_promo_index';
  const APP_PROMO_MIN_INTERVAL = 1000 * 60 * 4;
  const APP_PROMO_REPEAT_INTERVAL = 1000 * 60 * 7;
  const APP_PROMO_SCROLL_TRIGGER = 260;
  const APP_PROMO_DEFAULT_DELAY = 3800;
  const APP_PROMO_FOCUS_DELAY = 2200;
  const APP_INSTALL_BAR_AUTO_DISMISS_MS = 6000;
  const DEFAULT_LOCALE = 'pl-PL';
  const DEFAULT_TEST_SLOTS = 20;
  const DEFAULT_LIVE_STEP_MIN = 1;
  const DEFAULT_LIVE_STEP_MAX = 3;
  const DEFAULT_LIVE_INTERVAL_MS = 6500;
  const TOAST_INTERVAL_MS = 5200;
  const TOAST_INTERVAL_REDUCED_MS = 9000;
  const TOAST_DISPLAY_MS = 4200;
  const TOAST_DISPLAY_REDUCED_MS = 3600;
  const PROMO_MOTION_IDLE_MS = 20000;
  const PROMO_MOTION_INTERSECTION_THRESHOLD = 0.35;
  const SUCCESS_STATUSES = ['success', 'paid', 'true', '1', 'ok'];
  const SAMPLE_USER_NAMES = ['Jan', 'Anna', 'Marek', 'Ola', 'Kamil', 'Ewa', 'Tomasz', 'Klara', 'Paweł', 'Lena'];
  const ACTIVITY_TOAST_MESSAGES = [
    {title: 'Nowy użytkownik otworzył sklep', detail: 'Aktywacja ukończona'},
    {title: '{name} dodał produkt', detail: 'Nowa kolekcja premium', useName: true},
    {title: 'Ktoś kupił plan PRO', detail: 'Subskrypcja aktywna'},
    {title: 'Nowy sklep aktywowany', detail: 'Integracja płatności gotowa'},
    {title: 'Sprzedaż zakończona', detail: 'Zamówienie wysłane'}
  ];
  const liveCounterIntervals = new Map();
  let activityToastIntervalId = null;
  let upgradeModal = null;
  let upgradeModalInitialized = false;
  let storefrontFallbackProducts = null;
  const isUUID = id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id));
  const DEFAULT_TRIAL_DAYS = 7;
  const PLAN_LEVELS = {
    free: 0,
    trial: 0,          // legacy alias for free
    basic: 1,          // Seller PRO
    pro: 2,            // Seller Business
    elite: 3,          // Elite
    supplier_basic: 1,
    supplier_pro: 2,
    brand: 2,
    artist_basic: 0,
    artist_pro: 1,
  };
  const PLAN_LABELS = {
    free:           'Seller Free',
    trial:          'Seller Free',
    basic:          'Seller PRO',
    pro:            'Seller Business',
    elite:          'ELITE',
    supplier_basic: 'Supplier Basic',
    supplier_pro:   'Supplier Pro',
    brand:          'Brand Plan',
    artist_basic:   'Artist Basic',
    artist_pro:     'Artist Pro',
  };
  const PLAN_DEFAULT_MARGINS = {
    free: 15,
    trial: 15,     // legacy alias
    basic: 20,     // Seller PRO
    pro: 28,       // Seller Business
    elite: 35,     // Elite
  };
  const OWNER_EMAIL = 'uszefaqualitetpromo@gmail.com';
  const OWNER_EMAIL_NORMALIZED = OWNER_EMAIL.trim().toLowerCase();
  const OWNER_PHONE = '+48882914429';
  const OWNER_PHONE_NORMALIZED = OWNER_PHONE.replace(/\s+/g, '');
  const PRICE_LINKS = {
    basic: 'https://buy.stripe.com/28E4gz3qP0er3AL2P0ak000',
    pro: 'https://buy.stripe.com/aFa5kD9PdgdpgnxdtEak001',
    elite: 'https://buy.stripe.com/7sY4gz5yX6CP0ozdtEak002'
  };
  const PLAN_RECOMMENDATION_THRESHOLDS = {
    profit: {pro: 8000, elite: 20000},
    budget: {pro: 15000, elite: 35000},
    traffic: {pro: 12000, elite: 30000}
  };
  const OWNER_STORAGE_KEYS = {
    users: 'users',
    stores: 'stores',
    leads: 'leads',
    products: 'products',
    subscriptions: 'subscriptions',
    suppliers: 'suppliers',
    activeStore: 'activeStore',
    orders: 'qm_orders',
    operators: 'qm_operators',
    referrals: 'qm_referrals',
    adminLogs: 'qm_admin_logs',
    supplierApps: 'qm_supplier_applications',
    salesLinks: 'qm_sales_links',
    tasks: 'qm_tasks'
  };
  const SALES_LINK_TOKEN_SESSION_KEY = 'qm_sales_link_token';
  const PRICING_STORAGE_KEYS = {
    productsBySupplier: 'qm_products_by_supplier_v1',
    storeMargin: 'qm_store_margin_pct'
  };
  const PLATFORM_MARGIN_PCT = 5;
  const SUPPLIER_MARKUP_PCT = {
    detal: 8,
    hurt: 6
  };
  const DEFAULT_PRODUCT_IMAGE = 'https://placehold.co/400x280/0f1837/FFFFFF?text=Produkt';
  const ESTIMATED_PRICE_MARKUP_PCT = 18;
  const COST_DISCOUNT_FACTOR = 1 - ESTIMATED_PRICE_MARKUP_PCT / 100;
  const PRICE_MARKUP_FACTOR = 1 + ESTIMATED_PRICE_MARKUP_PCT / 100;

  function bindMenu(){
    const button = document.querySelector('[data-menu-toggle]');
    const nav = document.querySelector('.nav');
    if(button && nav){
      button.addEventListener('click', () => nav.classList.toggle('open'));
    }
    const page = document.body.dataset.page;
    if(!page) return;
    document.querySelectorAll('.nav a').forEach(link => {
      const href = link.getAttribute('href');
      if(href === `${page}.html` || (page === 'index' && href === 'index.html')){
      link.classList.add('active');
    }
  });
}

  function initServiceWorker(){
    if(!('serviceWorker' in navigator)){
      return;
    }
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }

  function initInstallBanner(){
    if(!('onbeforeinstallprompt' in window)){
      return;
    }
    const supportsDisplayMode = typeof window.matchMedia === 'function';
    const isStandalone = (supportsDisplayMode && window.matchMedia('(display-mode: standalone)').matches)
      || window.navigator.standalone === true;
    if(isStandalone){
      return;
    }
    let dismissed = false;
    try{
      const until = parseInt(localStorage.getItem(INSTALL_BANNER_DISMISSED_UNTIL_KEY) || '0', 10);
      dismissed = until > Date.now();
    } catch (_error){
      dismissed = false;
    }
    if(dismissed){
      return;
    }
    let deferredPrompt = null;
    let banner = null;

    const hideBanner = (persistDismissal = false) => {
      if(banner){
        banner.classList.add('install-banner--hiding');
        window.setTimeout(() => {
          if(banner){
            banner.remove();
            banner = null;
          }
          document.body.classList.remove('has-install-banner');
        }, 300);
      }
      if(persistDismissal){
        try{
          const until = Date.now() + INSTALL_BANNER_REAPPEAR_DAYS * MS_PER_DAY;
          localStorage.setItem(INSTALL_BANNER_DISMISSED_UNTIL_KEY, String(until));
        } catch (_error){
        }
      }
    };

    const showBanner = () => {
      if(banner || !document.body){
        return;
      }
      banner = document.createElement('div');
      banner.className = 'install-banner';
      banner.setAttribute('role', 'dialog');
      banner.setAttribute('aria-live', 'polite');

      const closeButton = document.createElement('button');
      closeButton.type = 'button';
      closeButton.className = 'install-banner__close';
      closeButton.setAttribute('aria-label', 'Zamknij');
      closeButton.textContent = '×';

      const content = document.createElement('div');
      content.className = 'install-banner__content';
      const title = document.createElement('strong');
      title.id = 'install-banner-title';
      title.textContent = 'Zainstaluj aplikację';
      banner.setAttribute('aria-labelledby', title.id);
      const description = document.createElement('span');
      description.textContent = 'Dodaj QualitetMarket na ekran główny i korzystaj szybciej.';
      content.append(title, description);

      const actions = document.createElement('div');
      actions.className = 'install-banner__actions';
      const installButton = document.createElement('button');
      installButton.type = 'button';
      installButton.className = 'btn btn-primary install-banner__install';
      installButton.textContent = 'Zainstaluj';
      actions.append(installButton);

      closeButton.addEventListener('click', () => {
        hideBanner(true);
      });

      installButton.addEventListener('click', async () => {
        if(!deferredPrompt){
          return;
        }
        try{
          await deferredPrompt.prompt();
          if(deferredPrompt.userChoice){
            await deferredPrompt.userChoice;
          }
        } catch (_error){
        } finally {
          deferredPrompt = null;
          hideBanner(true);
        }
      });

      banner.append(closeButton, content, actions);
      document.body.appendChild(banner);
      document.body.classList.add('has-install-banner');
    };

    window.addEventListener('beforeinstallprompt', event => {
      event.preventDefault();
      deferredPrompt = event;
      showBanner();
    });

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      hideBanner();
    });
  }

  function ensureAppPromoModal(){
    let modal = document.querySelector('[data-app-promo-modal]');
    if(modal){
      return modal;
    }
    modal = document.createElement('div');
    modal.className = 'app-promo-modal';
    modal.setAttribute('data-app-promo-modal', '');
    modal.hidden = true;
    modal.innerHTML = `
      <div class="app-promo-window" role="dialog" aria-modal="true" aria-labelledby="app-promo-title">
        <button class="app-promo-close" type="button" data-app-promo-close aria-label="Zamknij okno">×</button>
        <div class="app-promo-grid">
          <div class="app-promo-copy">
            <span class="eyebrow" data-app-promo-eyebrow></span>
            <h2 id="app-promo-title" data-app-promo-title></h2>
            <p class="hint" data-app-promo-desc></p>
            <ul class="app-promo-list" data-app-promo-list></ul>
            <div class="app-promo-actions">
              <a class="btn btn-primary" href="dashboard.html">Otwórz aplikację</a>
              <a class="btn btn-secondary" href="cennik.html">Zobacz plany</a>
            </div>
            <div class="app-instructions">
              <div>
                <strong>iPhone</strong>
                <ul>
                  <li>Udostępnij stronę</li>
                  <li>Dodaj do ekranu głównego</li>
                </ul>
              </div>
              <div>
                <strong>Android</strong>
                <ul>
                  <li>Menu przeglądarki</li>
                  <li>Zainstaluj aplikację</li>
                  <li>Dodaj do ekranu głównego</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="app-promo-media">
            <span class="app-promo-tag" data-app-promo-tag>APP</span>
            <img src="" alt="" loading="lazy" decoding="async" data-app-promo-image>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  function getAppPromoVariants(){
    return [
      {
        eyebrow: 'Zainstaluj aplikację',
        title: 'Zainstaluj aplikację na telefonie',
        description: 'Otwórz platformę na telefonie i dodaj ją do ekranu głównego.',
        points: ['Otwórz platformę na telefonie', 'Dodaj do ekranu głównego', 'Uruchamiaj jak aplikację'],
        tag: 'App Install',
        image: 'https://github.com/user-attachments/assets/085d1513-747e-4d49-8334-5813ae0855a7',
        imageAlt: 'QualitetMarket Mobile App'
      },
      {
        eyebrow: 'Mobile',
        title: 'Uruchom sklep szybciej z aplikacji',
        description: 'Zarządzaj hurtowniami i ofertą sprzedaży bezpośrednio z telefonu.',
        points: ['Mobilne zarządzanie hurtowniami', 'Szybkie dodawanie produktów', 'Powiadomienia o sprzedaży'],
        tag: 'Sklep + Hurt',
        image: 'https://github.com/user-attachments/assets/bf1aaeec-617f-4741-9bd6-f4924b362ea8',
        imageAlt: 'Zarządzanie sklepem z telefonu'
      }
    ];
  }

  function getAppPromoIndex(total){
    let stored = 0;
    try{
      stored = Number.parseInt(sessionStorage.getItem(APP_PROMO_INDEX_KEY), 10);
    } catch (_error){
      stored = 0;
    }
    if(Number.isNaN(stored) || stored < 0){
      stored = 0;
    }
    const next = total ? (stored + 1) % total : 0;
    try{
      sessionStorage.setItem(APP_PROMO_INDEX_KEY, `${next}`);
    } catch (_error){
    }
    return total ? stored % total : 0;
  }

  function getAppPromoLastShown(){
    let lastShown = 0;
    try{
      lastShown = Number.parseInt(sessionStorage.getItem(APP_PROMO_LAST_SHOWN_KEY), 10);
    } catch (_error){
      lastShown = 0;
    }
    return Number.isNaN(lastShown) ? 0 : lastShown;
  }

  function canShowAppPromo(){
    const lastShown = getAppPromoLastShown();
    return !lastShown || (Date.now() - lastShown) > APP_PROMO_MIN_INTERVAL;
  }

  function markAppPromoShown(){
    try{
      sessionStorage.setItem(APP_PROMO_LAST_SHOWN_KEY, `${Date.now()}`);
    } catch (_error){
    }
  }

  function updateAppPromoModal(modal, variant){
    const eyebrow = modal.querySelector('[data-app-promo-eyebrow]');
    const title = modal.querySelector('[data-app-promo-title]');
    const desc = modal.querySelector('[data-app-promo-desc]');
    const list = modal.querySelector('[data-app-promo-list]');
    const tag = modal.querySelector('[data-app-promo-tag]');
    const image = modal.querySelector('[data-app-promo-image]');

    if(eyebrow){
      eyebrow.textContent = variant.eyebrow;
    }
    if(title){
      title.textContent = variant.title;
    }
    if(desc){
      desc.textContent = variant.description;
    }
    if(list){
      list.innerHTML = '';
      variant.points.forEach(point => {
        const item = document.createElement('li');
        item.textContent = point;
        list.appendChild(item);
      });
    }
    if(tag){
      tag.textContent = variant.tag;
    }
    if(image){
      image.src = variant.image;
      image.alt = variant.imageAlt || variant.title;
    }
  }

  function openAppPromo({force = false} = {}){
    const modal = ensureAppPromoModal();
    if(!modal){
      return false;
    }
    if(!force && !canShowAppPromo()){
      return false;
    }
    if(document.body.classList.contains('modal-open') && modal.hidden){
      return false;
    }
    const variants = getAppPromoVariants();
    const index = getAppPromoIndex(variants.length);
    updateAppPromoModal(modal, variants[index]);
    modal.hidden = false;
    document.body.classList.add('modal-open');
    markAppPromoShown();
    return true;
  }

  function initAppPromoModal(){
    const modal = ensureAppPromoModal();
    if(!modal){
      return;
    }
    const closeButtons = modal.querySelectorAll('[data-app-promo-close]');
    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    };
    closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', event => {
      if(event.target === modal){
        closeModal();
      }
    });
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && !modal.hidden){
        closeModal();
      }
    });
  }

  function initAppInstallBar(){
    // App install bar disabled — removed to prevent it from overlapping page content.
    return null;
  }

  function bindAppInstallOpeners(){
    const buttons = document.querySelectorAll('[data-app-install-open]');
    buttons.forEach(button => {
      button.addEventListener('click', event => {
        event.preventDefault();
        openAppPromo({force: true});
      });
    });
  }

  function scheduleAppPromoTriggers(){
    // Auto-triggers disabled — the app promo modal should only open
    // when the user explicitly clicks an "Otwórz aplikację" button.
    // This prevents the popup from blocking the screen and bottom menu.
  }

  function initAppInstallExperience(){
    initAppPromoModal();
    initAppInstallBar();
    bindAppInstallOpeners();
    scheduleAppPromoTriggers();
  }

  function initAppSplash(){
    const splash = document.querySelector('[data-app-splash]');
    if(!splash){
      return;
    }
    const hideSplash = () => {
      splash.classList.add('is-hidden');
      splash.setAttribute('aria-hidden', 'true');
    };
    let hasSeen = false;
    try{
      hasSeen = sessionStorage.getItem(SPLASH_STORAGE_KEY) === 'true';
    } catch (_error){
      hasSeen = false;
    }
    if(hasSeen){
      hideSplash();
      return;
    }
    try{
      sessionStorage.setItem(SPLASH_STORAGE_KEY, 'true');
    } catch (_error){
    }
    window.setTimeout(hideSplash, 1400);
  }

  function initBottomNav(){
    const nav = document.querySelector('[data-bottom-nav]');
    if(!nav){
      return;
    }
    const links = Array.from(nav.querySelectorAll('a[data-nav]'));
    if(!links.length){
      return;
    }
    const pageAliases = {
      cennik: 'index',
      qualitetmarket: 'index',
      crm: 'dashboard',
      intelligence: 'dashboard',
      listing: 'sklep',
      'store-generator': 'dashboard',
      'panel-sklepu': 'dashboard',
      'owner-panel': 'dashboard'
    };
    const rawPage = document.body.dataset.page || '';
    const fallbackPath = window.location.pathname.split('/').pop() || '';
    const fallbackKey = fallbackPath.replace('.html', '');
    const activeKey = pageAliases[rawPage] || rawPage || pageAliases[fallbackKey] || fallbackKey || 'index';
    links.forEach(link => {
      const key = link.dataset.nav;
      const isActive = key === activeKey;
      link.classList.toggle('is-active', isActive);
      if(isActive){
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  function getRandomElement(list){
    return list[Math.floor(Math.random() * list.length)];
  }

  function getRandomIncrement(minValue, maxValue){
    const range = Math.max(maxValue - minValue, 0);
    return minValue + Math.floor(Math.random() * (range + 1));
  }

  function getCounterTarget(el){
    const rawValue = el.dataset.counter;
    if(!rawValue) return null;
    const target = Number.parseInt(rawValue, 10);
    return Number.isNaN(target) ? null : target;
  }

  function formatCounterValue(el, value){
    const numericValue = typeof value === 'number' ? value : Number.parseInt(value, 10);
    const safeValue = Number.isNaN(numericValue) ? 0 : numericValue;
    const format = el.dataset.counterFormat;
    let formatted = `${safeValue}`;
    if(format === 'grouped' || format === 'currency'){
      const locale = document.documentElement.lang || DEFAULT_LOCALE;
      formatted = new Intl.NumberFormat(locale).format(safeValue);
    }
    if(format === 'currency'){
      formatted = `${formatted} zł`;
    }
    const suffix = el.dataset.counterSuffix;
    if(suffix && format !== 'currency'){
      formatted = `${formatted} ${suffix}`;
    }
    return formatted;
  }

  function formatCurrency(value){
    const numericValue = typeof value === 'number' ? value : Number.parseFloat(value);
    const safeValue = Number.isNaN(numericValue) ? 0 : numericValue;
    const locale = document.documentElement.lang || DEFAULT_LOCALE;
    return `${new Intl.NumberFormat(locale, {maximumFractionDigits: 2}).format(safeValue)} zł`;
  }

  function formatDate(value){
    if(!value){
      return '—';
    }
    const date = new Date(value);
    if(Number.isNaN(date.getTime())){
      return '—';
    }
    const locale = document.documentElement.lang || DEFAULT_LOCALE;
    return new Intl.DateTimeFormat(locale, {dateStyle: 'medium'}).format(date);
  }

  function setCounterValue(el, value){
    const formattedValue = formatCounterValue(el, value);
    el.textContent = formattedValue;
    if(el.dataset.counterLabel){
      el.setAttribute('aria-label', `${el.dataset.counterLabel}: ${formattedValue}`);
    }
  }

  function hasLiveCounter(el){
    return el.hasAttribute('data-counter-live');
  }

  function startLiveCounter(el){
    if(!hasLiveCounter(el) || el.dataset.counterLiveActive === 'true'){
      return;
    }
    const min = Number.parseInt(el.dataset.counterLiveMin, 10);
    const max = Number.parseInt(el.dataset.counterLiveMax, 10);
    const interval = Number.parseInt(el.dataset.counterLiveInterval, 10);
    const stepMin = Number.isNaN(min) ? DEFAULT_LIVE_STEP_MIN : min;
    const stepMax = Number.isNaN(max) ? DEFAULT_LIVE_STEP_MAX : max;
    const resolvedMin = Math.min(stepMin, stepMax);
    const resolvedMax = Math.max(stepMin, stepMax);
    const intervalMs = Number.isNaN(interval) ? DEFAULT_LIVE_INTERVAL_MS : interval;
    let currentValue = getCounterTarget(el);
    if(currentValue === null){
      currentValue = 0;
    }
    el.dataset.counterLiveActive = 'true';

    const intervalId = window.setInterval(() => {
      if(!document.body.contains(el)){
        clearInterval(intervalId);
        liveCounterIntervals.delete(el);
        return;
      }
      const delta = getRandomIncrement(resolvedMin, resolvedMax);
      currentValue += delta;
      el.dataset.counter = `${currentValue}`;
      setCounterValue(el, currentValue);
    }, intervalMs);
    liveCounterIntervals.set(el, intervalId);
  }

  function animateCounter(el, onComplete){
    const target = getCounterTarget(el);
    if(target === null){
      setCounterValue(el, 0);
      return;
    }
    const duration = 1200;
    const start = performance.now();

    function step(now){
      const progress = Math.min((now - start) / duration, 1);
      const value = Math.round(progress * target);
      setCounterValue(el, value);
      if(progress < 1){
        requestAnimationFrame(step);
      } else if(typeof onComplete === 'function'){
        onComplete();
      }
    }

    requestAnimationFrame(step);
  }

  function initCounters(){
    const counters = document.querySelectorAll('[data-counter]');
    if(!counters.length) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if(prefersReducedMotion || !('IntersectionObserver' in window)){
      counters.forEach(counter => {
        const target = getCounterTarget(counter);
        setCounterValue(counter, target === null ? 0 : target);
        counter.setAttribute('aria-live', 'polite');
        counter.setAttribute('aria-atomic', 'true');
        if(!prefersReducedMotion){
          startLiveCounter(counter);
        }
      });
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          const targetEl = entry.target;
          const onComplete = hasLiveCounter(targetEl) ? () => startLiveCounter(targetEl) : null;
          animateCounter(targetEl, onComplete);
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: 0.4});

    counters.forEach(counter => {
      const target = getCounterTarget(counter);
      setCounterValue(counter, 0);
      counter.setAttribute('aria-live', 'polite');
      counter.setAttribute('aria-atomic', 'true');
      if(target !== null){
        observer.observe(counter);
      }
    });
  }

  function initHelperBoxes(){
    const boxes = document.querySelectorAll('[data-helper]');
    if(!boxes.length) return;

    if(!('IntersectionObserver' in window)){
      boxes.forEach(box => box.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: 0.3});

    boxes.forEach(box => observer.observe(box));
  }

  function initPromoMotion(){
    const galleries = Array.from(document.querySelectorAll('[data-promo-motion]'));
    if(!galleries.length){
      return;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const controllers = [];

    galleries.forEach(gallery => {
      const toggle = gallery.querySelector('[data-promo-motion-toggle]');
      let idleTimeout = null;
      let manualPaused = false;
      let idlePaused = false;
      let visibilityPaused = false;
      let intersectionPaused = false;

      const updateToggleButton = isPaused => {
        if(!toggle){
          return;
        }
        toggle.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
        toggle.textContent = isPaused ? 'Wznów animację' : 'Zatrzymaj animację';
      };

      const setPaused = isPaused => {
        gallery.classList.toggle('is-paused', isPaused);
        if(isPaused && idleTimeout){
          clearTimeout(idleTimeout);
          idleTimeout = null;
        }
        updateToggleButton(isPaused);
      };

      const scheduleIdlePause = () => {
        if(prefersReducedMotion || manualPaused || visibilityPaused || intersectionPaused){
          return;
        }
        if(idlePaused){
          idlePaused = false;
          setPaused(false);
        }
        if(idleTimeout){
          clearTimeout(idleTimeout);
        }
        idleTimeout = window.setTimeout(() => {
          idlePaused = true;
          setPaused(true);
        }, PROMO_MOTION_IDLE_MS);
      };

      const applyPauseState = () => {
        if(manualPaused || visibilityPaused || intersectionPaused || idlePaused){
          setPaused(true);
          return;
        }
        setPaused(false);
        scheduleIdlePause();
      };

      const handleVisibilityChange = isHidden => {
        visibilityPaused = isHidden;
        applyPauseState();
      };

      if(prefersReducedMotion){
        if(toggle){
          toggle.disabled = true;
          toggle.textContent = 'Animacja wyłączona';
          toggle.setAttribute('aria-pressed', 'true');
        }
        gallery.classList.add('is-paused');
        return;
      }

      scheduleIdlePause();

      if(toggle){
        toggle.addEventListener('click', () => {
          const isPaused = gallery.classList.contains('is-paused');
          const shouldPause = !isPaused;
          manualPaused = shouldPause;
          if(shouldPause){
            idlePaused = false;
          }
          applyPauseState();
        });
      }

      if('IntersectionObserver' in window){
        const observer = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            intersectionPaused = !entry.isIntersecting;
            applyPauseState();
          });
        }, {threshold: PROMO_MOTION_INTERSECTION_THRESHOLD});
        observer.observe(gallery);
      }

      ['mouseenter', 'focusin', 'pointerdown'].forEach(eventName => {
        gallery.addEventListener(eventName, scheduleIdlePause);
      });

      controllers.push({handleVisibilityChange});
    });

    if(controllers.length){
      document.addEventListener('visibilitychange', () => {
        const isHidden = document.hidden;
        controllers.forEach(controller => controller.handleVisibilityChange(isHidden));
      });
    }
  }

  function initActivityToasts(){
    const container = document.querySelector('[data-activity-toasts]');
    if(!container){
      return;
    }
    if(activityToastIntervalId){
      return;
    }
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const intervalMs = prefersReducedMotion ? TOAST_INTERVAL_REDUCED_MS : TOAST_INTERVAL_MS;
    const displayMs = prefersReducedMotion ? TOAST_DISPLAY_REDUCED_MS : TOAST_DISPLAY_MS;

    const showToast = () => {
      if(!document.body.contains(container)){
        if(activityToastIntervalId){
          clearInterval(activityToastIntervalId);
          activityToastIntervalId = null;
        }
        return;
      }
      const message = getRandomElement(ACTIVITY_TOAST_MESSAGES);
      const toast = document.createElement('div');
      toast.className = 'activity-toast';
      const title = document.createElement('strong');
      const randomUserName = getRandomElement(SAMPLE_USER_NAMES);
      const titleText = message.useName ? message.title.replace(/\{name\}/g, randomUserName) : message.title;
      title.textContent = titleText;
      const detail = document.createElement('span');
      detail.textContent = message.detail;
      toast.append(title, detail);
      container.appendChild(toast);
      requestAnimationFrame(() => toast.classList.add('is-visible'));

      setTimeout(() => {
        toast.classList.remove('is-visible');
        setTimeout(() => toast.remove(), 400);
      }, displayMs);
    };

    showToast();
    activityToastIntervalId = window.setInterval(showToast, intervalMs);
  }

  function initSlotsBanner(){
    const banners = document.querySelectorAll('[data-slots-total]');
    if(!banners.length){
      return;
    }
    banners.forEach(banner => {
      const totalValue = Number.parseInt(banner.dataset.slotsTotal, 10);
      const target = banner.querySelector('[data-slots-total-value]');
      const resolvedTotal = Number.isNaN(totalValue) ? DEFAULT_TEST_SLOTS : totalValue;
      if(target){
        target.textContent = `${resolvedTotal}`;
      }
    });
  }

  function initSurveyModal(){
    const modal = document.querySelector('[data-survey-modal]');
    if(!modal){
      return;
    }
    const openButtons = document.querySelectorAll('[data-survey-open]');
    const closeButtons = modal.querySelectorAll('[data-survey-close]');
    const form = modal.querySelector('[data-survey-form]');
    const successMessage = modal.querySelector('[data-survey-success]');

    const openModal = (markSeen = true) => {
      modal.hidden = false;
      document.body.classList.add('modal-open');
      if(successMessage){
        successMessage.hidden = true;
      }
      if(markSeen){
        localStorage.setItem(STORAGE_KEYS.surveySeen, 'true');
      }
    };

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    };

    openButtons.forEach(button => {
      button.addEventListener('click', () => openModal(true));
    });

    closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', event => {
      if(event.target === modal){
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && !modal.hidden){
        closeModal();
      }
    });

    if(form){
      form.addEventListener('submit', event => {
        event.preventDefault();
        if(typeof form.reportValidity === 'function' && !form.reportValidity()){
          return;
        }
        const payload = Object.fromEntries(new FormData(form).entries());
        const responses = getStoredList(STORAGE_KEYS.surveyResponses) || [];
        responses.push({
          ...payload,
          submittedAt: new Date().toISOString()
        });
        localStorage.setItem(STORAGE_KEYS.surveyResponses, JSON.stringify(responses));
        localStorage.setItem(STORAGE_KEYS.surveySeen, 'true');
        if(successMessage){
          successMessage.hidden = false;
        }
        form.reset();
        setTimeout(() => {
          closeModal();
          if(successMessage){
            successMessage.hidden = true;
          }
        }, SURVEY_SUCCESS_TIMEOUT);
      });
    }

    const alreadySeen = localStorage.getItem(STORAGE_KEYS.surveySeen) === 'true';
    if(!alreadySeen){
      setTimeout(() => {
        const landingModal = document.querySelector('[data-landing-modal]');
        const isLandingVisible = landingModal && !landingModal.hidden;
        if(!isLandingVisible){
          openModal(true);
        }
      }, SURVEY_AUTO_OPEN_DELAY);
    }
  }

  function initLandingModal(){
    if(document.body.dataset.page !== 'index'){
      return;
    }
    const modal = document.querySelector('[data-landing-modal]');
    if(!modal){
      return;
    }
    const closeButtons = modal.querySelectorAll('[data-landing-close]');
    const surveyButtons = modal.querySelectorAll('[data-landing-survey]');

    const openModal = () => {
      modal.hidden = false;
      document.body.classList.add('modal-open');
      localStorage.setItem(STORAGE_KEYS.landingSeen, 'true');
    };

    const closeModal = () => {
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    };

    closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', event => {
      if(event.target === modal){
        closeModal();
      }
    });

    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && !modal.hidden){
        closeModal();
      }
    });

    surveyButtons.forEach(button => {
      button.addEventListener('click', () => {
        closeModal();
        const surveyButton = document.querySelector('[data-survey-open]');
        if(surveyButton){
          surveyButton.click();
        }
      });
    });

    const alreadySeen = localStorage.getItem(STORAGE_KEYS.landingSeen) === 'true';
    if(!alreadySeen){
      setTimeout(() => {
        const surveyModal = document.querySelector('[data-survey-modal]');
        const surveyVisible = surveyModal && !surveyModal.hidden;
        if(!surveyVisible){
          openModal();
        }
      }, LANDING_AUTO_OPEN_DELAY);
    }
  }

  function getStoredNumber(key, fallback = 0){
    const value = parseInt(localStorage.getItem(key), 10);
    return Number.isNaN(value) ? fallback : value;
  }

  function getStoredList(key){
    const raw = localStorage.getItem(key);
    if(!raw){
      return null;
    }
    try{
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error){
      return [];
    }
  }

  function saveStoredList(key, list){
    if(!Array.isArray(list)){
      return;
    }
    localStorage.setItem(key, JSON.stringify(list));
  }

  function resolveCostAndPrice(product){
    if(!product || typeof product !== 'object'){
      return {
        cost: 0,
        price: 0,
        costEstimated: false
      };
    }
    const costRaw = Number.parseFloat(product.cost);
    const priceRaw = Number.parseFloat(product.price);
    const hasCost = Number.isFinite(costRaw);
    const hasPrice = Number.isFinite(priceRaw);
    const estimatedFromPrice = !hasCost && hasPrice;
    let cost = 0;
    if(hasCost){
      cost = costRaw;
    } else if(hasPrice){
      cost = roundCurrency(priceRaw * COST_DISCOUNT_FACTOR);
    }
    const priceCandidate = hasPrice ? priceRaw : null;
    const priceIsValid = priceCandidate !== null && (!hasCost || priceCandidate > cost);
    const price = priceIsValid ? priceCandidate : roundCurrency(cost * PRICE_MARKUP_FACTOR);
    return {
      cost,
      price,
      costEstimated: estimatedFromPrice
    };
  }

  function resolveProductImage(product){
    if(!product || typeof product !== 'object'){
      return DEFAULT_PRODUCT_IMAGE;
    }
    return product.image || product.img || DEFAULT_PRODUCT_IMAGE;
  }

  function ensureSeedList(key, seedList){
    const existing = getStoredList(key);
    if(Array.isArray(existing) && existing.length){
      return existing;
    }
    saveStoredList(key, seedList);
    return seedList;
  }

  function loadProductsBySupplier(){
    const list = getStoredList(PRICING_STORAGE_KEYS.productsBySupplier) || [];
    return list.map(item => {
      if(!item || typeof item !== 'object'){
        return item;
      }
      const resolvedImage = resolveProductImage(item);
      const {cost, price, costEstimated} = resolveCostAndPrice(item);
      return {
        ...item,
        cost,
        price,
        costEstimated,
        image: resolvedImage,
        img: resolvedImage
      };
    });
  }

  function saveProductsBySupplier(list){
    saveStoredList(PRICING_STORAGE_KEYS.productsBySupplier, list);
  }

  function buildProductsFromSuppliers(suppliers){
    if(!Array.isArray(suppliers)){
      return [];
    }
    const now = Date.now();
    let index = 0;
    return suppliers.flatMap(supplier => {
      if(!Array.isArray(supplier.products)){
        return [];
      }
      return supplier.products.map(product => {
        const margin = 30 + (index % 4) * 5;
        const createdAt = new Date(now - (index + 1) * MS_PER_DAY).toISOString();
        const resolvedImage = resolveProductImage(product);
        const {cost, price, costEstimated} = resolveCostAndPrice(product);
        const mapped = {
          id: `catalog_${product.id}`,
          name: product.name,
          cost,
          price,
          costEstimated,
          margin,
          supplier: supplier.name,
          category: product.category,
          image: resolvedImage,
          img: resolvedImage,
          description: product.description,
          storeId: index % 2 === 0 ? 'store_elektronika' : 'store_moda',
          createdAt
        };
        index += 1;
        return mapped;
      });
    });
  }

  function buildProductsByStore(stores){
    if(!Array.isArray(stores)){
      return [];
    }
    const now = Date.now();
    let index = 0;
    return stores.flatMap(store => {
      if(!Array.isArray(store.products)){
        return [];
      }
      return store.products.map(product => {
        const createdAt = new Date(now - (index + 1) * MS_PER_DAY).toISOString();
        const resolvedImage = resolveProductImage(product);
        const {cost, price, costEstimated} = resolveCostAndPrice(product);
        const mapped = {
          id: product.id,
          name: product.name,
          cost,
          price,
          costEstimated,
          margin: product.margin,
          supplierMode: product.supplierMode,
          supplier: product.supplier,
          category: product.category,
          image: resolvedImage,
          img: resolvedImage,
          description: product.description,
          storeId: store.id,
          createdAt
        };
        index += 1;
        return mapped;
      });
    });
  }

  function ensureOwnerDemoData(){
    // plan: basic/pro/elite controls access level for suppliers in the hurtownie module.
    const seedSuppliers = [
      {
        id: 'supplier_aliexpress',
        name: 'AliExpress',
        slug: 'aliexpress',
        plan: 'basic',
        category: 'Marketplace globalny',
        description: 'Największy marketplace z elektroniką i akcesoriami w cenach hurtowych.',
        logo: 'https://logo.clearbit.com/aliexpress.com',
        products: [
          {
            id: 'aliexpress_powerbank',
            name: 'Powerbank 20000 mAh Voltix',
            cost: 119,
            price: 119,
            img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            description: 'Szybkie ładowanie PD 22.5W, dwa porty USB-C.',
            supplier: 'AliExpress',
            category: 'Elektronika',
            sourceUrl: 'https://www.aliexpress.com/item/1005006440213.html'
          },
          {
            id: 'aliexpress_dashcam',
            name: 'Kamera samochodowa RoadEye 4K',
            cost: 189,
            price: 189,
            img: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
            description: 'Nagrywanie nocne, sensor Sony, Wi-Fi w aplikacji.',
            supplier: 'AliExpress',
            category: 'Auto',
            sourceUrl: 'https://www.aliexpress.com/item/1005006498872.html'
          },
          {
            id: 'aliexpress_usbkit',
            name: 'Zestaw kabli USB-C 3w1',
            cost: 39,
            price: 39,
            img: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1517466787929-bc90951d0974?auto=format&fit=crop&w=600&q=80',
            description: 'Kable 1.2m, oplot nylonowy, szybkie ładowanie.',
            supplier: 'AliExpress',
            category: 'Akcesoria',
            sourceUrl: 'https://www.aliexpress.com/item/1005006361429.html'
          },
          {
            id: 'aliexpress_lamps',
            name: 'Lampy solarne ogrodowe SolarGlow',
            cost: 79,
            price: 79,
            img: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=600&q=80',
            description: 'Zestaw 8 lamp, czujnik zmierzchu, wodoodporne.',
            supplier: 'AliExpress',
            category: 'Dom i ogród',
            sourceUrl: 'https://www.aliexpress.com/item/1005005821222.html'
          }
        ]
      },
      {
        id: 'supplier_cj',
        name: 'CJ Dropshipping',
        slug: 'cj-dropshipping',
        plan: 'basic',
        category: 'Dropshipping globalny',
        description: 'Szeroki katalog ubrań, sportu i akcesoriów gotowych do importu.',
        logo: 'https://logo.clearbit.com/cjdropshipping.com',
        products: [
          {
            id: 'cj_softshell',
            name: 'Kurtka Softshell Arctic',
            cost: 169,
            price: 169,
            img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            description: 'Wodoodporny softshell, odpinany kaptur.',
            supplier: 'CJ Dropshipping',
            category: 'Moda',
            sourceUrl: 'https://cjdropshipping.com/product/softshell-jacket-389232'
          },
          {
            id: 'cj_backpack',
            name: 'Plecak miejski UrbanLine',
            cost: 129,
            price: 129,
            img: 'https://images.unsplash.com/photo-1514474959185-1472d4b98f6b?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1514474959185-1472d4b98f6b?auto=format&fit=crop&w=600&q=80',
            description: 'Pojemność 18L, kieszeń na laptop 15".',
            supplier: 'CJ Dropshipping',
            category: 'Akcesoria',
            sourceUrl: 'https://cjdropshipping.com/product/urbanline-backpack-239001'
          },
          {
            id: 'cj_bottle',
            name: 'Bidon termiczny SportFlow',
            cost: 49,
            price: 49,
            img: 'https://images.unsplash.com/photo-1526402462723-6c3b7b78c816?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1526402462723-6c3b7b78c816?auto=format&fit=crop&w=600&q=80',
            description: 'Stal nierdzewna, utrzymuje temperaturę 12h.',
            supplier: 'CJ Dropshipping',
            category: 'Sport',
            sourceUrl: 'https://cjdropshipping.com/product/sportflow-thermo-bottle-238772'
          }
        ]
      },
      {
        id: 'supplier_eprolo',
        name: 'EPROLO',
        slug: 'eprolo',
        plan: 'basic',
        category: 'Import dziecięcy',
        description: 'Produkty dziecięce oraz wyposażenie domu do szybkiego dropshippingu.',
        logo: 'https://logo.clearbit.com/eprolo.com',
        products: [
          {
            id: 'eprolo_blocks',
            name: 'Klocki STEM Explorer 320 el.',
            cost: 99,
            price: 99,
            img: 'https://images.unsplash.com/photo-1555529771-122e5d9f2345?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1555529771-122e5d9f2345?auto=format&fit=crop&w=600&q=80',
            description: 'Kreatywny zestaw edukacyjny, wiek 6+.',
            supplier: 'EPROLO',
            category: 'Dzieci',
            sourceUrl: 'https://eprolo.com/product/stem-explorer-blocks-320'
          },
          {
            id: 'eprolo_mat',
            name: 'Mata edukacyjna SoftPlay',
            cost: 139,
            price: 139,
            img: 'https://images.unsplash.com/photo-1504151932400-72d4384f04b3?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1504151932400-72d4384f04b3?auto=format&fit=crop&w=600&q=80',
            description: 'Miękka mata, kontrastowe kolory, zabawki sensoryczne.',
            supplier: 'EPROLO',
            category: 'Dzieci',
            sourceUrl: 'https://www.aliexpress.com/item/1005002331201.html'
          },
          {
            id: 'eprolo_organizer',
            name: 'Organizer do szafy FlexiBox',
            cost: 59,
            price: 59,
            img: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80',
            description: 'Modułowe kosze do garderoby i szuflad.',
            supplier: 'EPROLO',
            category: 'Wyposażenie domu',
            sourceUrl: 'https://eprolo.com/product/flexibox-wardrobe-organizer'
          }
        ]
      },
      {
        id: 'supplier_vidaxl',
        name: 'VidaXL',
        slug: 'vidaxl',
        plan: 'pro',
        category: 'Dom i ogród',
        description: 'Europejski dostawca mebli i wyposażenia domowego.',
        logo: 'https://logo.clearbit.com/vidaxl.com',
        products: [
          {
            id: 'vidaxl_garden_set',
            name: 'Zestaw mebli ogrodowych Porto',
            cost: 1290,
            price: 1290,
            img: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80',
            description: '4 krzesła, stół hartowany, poduszki outdoor.',
            supplier: 'VidaXL',
            category: 'Dom i ogród',
            sourceUrl: 'https://www.vidaxl.pl/e/zestaw-mebli-ogrodowych-porto/123456'
          },
          {
            id: 'vidaxl_sofa',
            name: 'Sofa modułowa Loft 3w1',
            cost: 1890,
            price: 1890,
            img: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=80',
            description: 'Tapicerka łatwoczyszcząca, 4 moduły.',
            supplier: 'VidaXL',
            category: 'Wyposażenie domu',
            sourceUrl: 'https://www.vidaxl.pl/e/sofa-modulowa-loft/7891011'
          },
          {
            id: 'vidaxl_rack',
            name: 'Regał industrialny LoftLine',
            cost: 590,
            price: 590,
            img: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=600&q=80',
            description: 'Metal i drewno, 5 półek, łatwy montaż.',
            supplier: 'VidaXL',
            category: 'Wyposażenie domu',
            sourceUrl: 'https://www.vidaxl.pl/e/regal-industrialny/554433'
          }
        ]
      },
      {
        id: 'supplier_banggood',
        name: 'Banggood',
        slug: 'banggood',
        plan: 'pro',
        category: 'Elektronika i RTV AGD',
        description: 'Popularny dostawca elektroniki i sprzętu RTV.',
        logo: 'https://logo.clearbit.com/banggood.com',
        products: [
          {
            id: 'banggood_robot',
            name: 'Robot sprzątający CleanBot',
            cost: 799,
            price: 799,
            img: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80',
            description: 'Mapowanie laserowe, funkcja mopowania.',
            supplier: 'Banggood',
            category: 'RTV AGD',
            sourceUrl: 'https://www.banggood.com/robot-sprzatajacy-cleanbot-p-1966202.html'
          },
          {
            id: 'banggood_drone',
            name: 'Dron sportowy AirFlash',
            cost: 699,
            price: 699,
            img: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=600&q=80',
            description: 'Kamera 2K, stabilizacja obrazu, zasięg 1200m.',
            supplier: 'Banggood',
            category: 'Elektronika',
            sourceUrl: 'https://www.banggood.com/sport-drone-airflash-p-1978821.html'
          },
          {
            id: 'banggood_induction',
            name: 'Kuchenka indukcyjna SlimCook',
            cost: 459,
            price: 459,
            img: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1506368249639-73a05d6f6488?auto=format&fit=crop&w=600&q=80',
            description: 'Panel dotykowy, 9 poziomów mocy.',
            supplier: 'Banggood',
            category: 'RTV AGD',
            sourceUrl: 'https://www.banggood.com/induction-cooker-slimcook-p-2011301.html'
          }
        ]
      },
      {
        id: 'supplier_costway',
        name: 'Costway',
        slug: 'costway',
        plan: 'pro',
        category: 'Wyposażenie domu',
        description: 'Dostawca mebli i artykułów do domu w segmencie value.',
        logo: 'https://logo.clearbit.com/costway.com',
        products: [
          {
            id: 'costway_rocker',
            name: 'Fotel bujany Nordic',
            cost: 620,
            price: 620,
            img: 'https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=600&q=80',
            description: 'Drewniana podstawa, tapicerka boucle.',
            supplier: 'Costway',
            category: 'Wyposażenie domu',
            sourceUrl: 'https://www.costway.com/fotel-bujany-nordic.html'
          },
          {
            id: 'costway_gazebo',
            name: 'Altana ogrodowa GardenLux',
            cost: 980,
            price: 980,
            img: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=600&q=80',
            description: 'Stalowa konstrukcja, moskitiery i zasłony.',
            supplier: 'Costway',
            category: 'Dom i ogród',
            sourceUrl: 'https://www.costway.com/altana-ogrodowa-gardenlux.html'
          }
        ]
      },
      {
        id: 'supplier_hertwill',
        name: 'Hertwill',
        slug: 'hertwill',
        plan: 'pro',
        category: 'Narzędzia i auto',
        description: 'Specjalistyczny dostawca narzędzi oraz wyposażenia automotive.',
        logo: 'https://logo.clearbit.com/hertwill.com',
        products: [
          {
            id: 'hertwill_drill',
            name: 'Zestaw wkrętarek DualPower',
            cost: 430,
            price: 430,
            img: 'https://images.unsplash.com/photo-1504306660926-3ec4b92f91b1?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1504306660926-3ec4b92f91b1?auto=format&fit=crop&w=600&q=80',
            description: '2 akumulatory, walizka transportowa, 42 bity.',
            supplier: 'Hertwill',
            category: 'Narzędzia',
            sourceUrl: 'https://www.hertwill.com/zestaw-wkretarek-dualpower.html'
          },
          {
            id: 'hertwill_toolcase',
            name: 'Walizka narzędziowa ProBox 120',
            cost: 260,
            price: 260,
            img: 'https://images.unsplash.com/photo-1580894894513-541e068a3d76?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1580894894513-541e068a3d76?auto=format&fit=crop&w=600&q=80',
            description: '120 elementów, stal chromowana, organizer.',
            supplier: 'Hertwill',
            category: 'Narzędzia',
            sourceUrl: 'https://www.hertwill.com/walizka-narzedziowa-probox-120.html'
          },
          {
            id: 'hertwill_jack',
            name: 'Podnośnik hydrauliczny AutoLift',
            cost: 310,
            price: 310,
            img: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=600&q=80',
            description: 'Udźwig 2T, szybki zawór spustowy.',
            supplier: 'Hertwill',
            category: 'Auto',
            sourceUrl: 'https://www.hertwill.com/podnosnik-hydrauliczny-autolift.html'
          }
        ]
      },
      {
        id: 'supplier_bigbuy',
        name: 'BigBuy',
        slug: 'bigbuy',
        plan: 'elite',
        category: 'Sport i lifestyle',
        description: 'Europejski hurtowy partner sportowy i lifestyle.',
        logo: 'https://logo.clearbit.com/bigbuy.eu',
        products: [
          {
            id: 'bigbuy_dumbbells',
            name: 'Hantle regulowane FlexGym 20kg',
            cost: 450,
            price: 450,
            img: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80',
            description: 'Regulacja 4-20 kg, ergonomiczny uchwyt.',
            supplier: 'BigBuy',
            category: 'Sport',
            sourceUrl: 'https://www.bigbuy.eu/hantle-regulowane-flexgym.html'
          },
          {
            id: 'bigbuy_mat',
            name: 'Mata fitness GripPro',
            cost: 85,
            price: 85,
            img: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80',
            description: 'Antypoślizgowa mata do treningu i jogi.',
            supplier: 'BigBuy',
            category: 'Sport',
            sourceUrl: 'https://www.bigbuy.eu/mata-fitness-grippro.html'
          },
          {
            id: 'bigbuy_kitchen',
            name: 'Zestaw akcesoriów kuchennych ChefKit',
            cost: 120,
            price: 120,
            img: 'https://images.unsplash.com/photo-1498579809087-ef1e558fd1da?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1498579809087-ef1e558fd1da?auto=format&fit=crop&w=600&q=80',
            description: '15 elementów, silikon premium, stojak.',
            supplier: 'BigBuy',
            category: 'Akcesoria',
            sourceUrl: 'https://www.bigbuy.eu/zestaw-akcesoriow-chefkit.html'
          }
        ]
      },
      {
        id: 'supplier_spocket',
        name: 'Spocket',
        slug: 'spocket',
        plan: 'elite',
        category: 'Moda premium',
        description: 'Dostawca odzieży i akcesoriów premium z USA i EU.',
        logo: 'https://logo.clearbit.com/spocket.co',
        products: [
          {
            id: 'spocket_hoodie',
            name: 'Bluza premium StreetCloud',
            cost: 199,
            price: 199,
            img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            description: 'Bawełna 400g, oversize fit, haft 3D.',
            supplier: 'Spocket',
            category: 'Moda',
            sourceUrl: 'https://www.spocket.co/product/premium-hoodie-streetcloud'
          },
          {
            id: 'spocket_bag',
            name: 'Torba skórzana Milano',
            cost: 280,
            price: 280,
            img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
            description: 'Skóra naturalna, pasek crossbody, 3 kieszenie.',
            supplier: 'Spocket',
            category: 'Akcesoria',
            sourceUrl: 'https://www.spocket.co/product/torba-skorzana-milano'
          }
        ]
      },
      {
        id: 'supplier_syncee',
        name: 'Syncee',
        slug: 'syncee',
        plan: 'elite',
        category: 'RTV AGD premium',
        description: 'Dostawca sprzętu RTV AGD i smart home w segmencie premium.',
        logo: 'https://logo.clearbit.com/syncee.co',
        products: [
          {
            id: 'syncee_coffee',
            name: 'Ekspres do kawy AromaOne',
            cost: 860,
            price: 860,
            img: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=600&q=80',
            description: 'System parzenia 15 bar, młynek stalowy.',
            supplier: 'Syncee',
            category: 'RTV AGD',
            sourceUrl: 'https://www.syncee.co/product/ekspres-aromaone'
          },
          {
            id: 'syncee_purifier',
            name: 'Oczyszczacz powietrza AirPure',
            cost: 920,
            price: 920,
            img: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=600&q=80',
            description: 'Filtr HEPA 13, tryb nocny, czujnik PM2.5.',
            supplier: 'Syncee',
            category: 'RTV AGD',
            sourceUrl: 'https://www.syncee.co/product/oczyszczacz-airpure'
          },
          {
            id: 'syncee_smartplug',
            name: 'Smart gniazdko HomeLink',
            cost: 59,
            price: 59,
            img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            description: 'Sterowanie aplikacją, sceny smart home.',
            supplier: 'Syncee',
            category: 'Elektronika',
            sourceUrl: 'https://www.syncee.co/product/smart-gniazdko-homelink'
          }
        ]
      }
    ];

    const seedStores = [
      {
        id: 'store_elektronika',
        name: 'Qualitet Elektronika',
        slug: 'qualitet-elektronika',
        description: 'Sklep z elektroniką premium dla wymagających.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=QE',
        email: 'elektronika@uszefaqualitet.pl',
        phone: '+48 690 220 111',
        delivery: 'Wysyłka 24h',
        primaryColor: '#35d9ff',
        accentColor: '#54ffb0',
        backgroundColor: '#0f1837',
        theme: 'modern',
        margin: 22,
        plan: 'pro',
        trial: false,
        products: [
          {
            id: 'aliexpress_powerbank',
            name: 'Powerbank 20000 mAh Voltix',
            cost: 119,
            price: 119,
            margin: 28,
            supplier: 'AliExpress',
            category: 'Elektronika',
            img: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            description: 'Szybkie ładowanie PD 22.5W, dwa porty USB-C.'
          },
          {
            id: 'banggood_drone',
            name: 'Dron sportowy AirFlash',
            cost: 699,
            price: 699,
            margin: 32,
            supplier: 'Banggood',
            category: 'Elektronika',
            img: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1473968512647-3e447244af8f?auto=format&fit=crop&w=600&q=80',
            description: 'Kamera 2K, stabilizacja obrazu, zasięg 1200m.'
          },
          {
            id: 'syncee_coffee',
            name: 'Ekspres do kawy AromaOne',
            cost: 860,
            price: 860,
            margin: 26,
            supplier: 'Syncee',
            category: 'RTV AGD',
            img: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?auto=format&fit=crop&w=600&q=80',
            description: 'System parzenia 15 bar, młynek stalowy.'
          }
        ],
        createdAt: '2026-02-12T09:18:00Z'
      },
      {
        id: 'store_moda',
        name: 'Qualitet Moda',
        slug: 'qualitet-moda',
        description: 'Trendy streetwear i kolekcje premium.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=QM',
        email: 'moda@uszefaqualitet.pl',
        phone: '+48 690 220 222',
        delivery: 'Wysyłka 48h',
        primaryColor: '#ff4fd8',
        accentColor: '#ffd84d',
        backgroundColor: '#0f1837',
        theme: 'royal',
        margin: 30,
        plan: 'elite',
        trial: false,
        products: [
          {
            id: 'cj_softshell',
            name: 'Kurtka Softshell Arctic',
            cost: 169,
            price: 169,
            margin: 38,
            supplier: 'CJ Dropshipping',
            category: 'Moda',
            img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            description: 'Wodoodporny softshell, odpinany kaptur.'
          },
          {
            id: 'spocket_hoodie',
            name: 'Bluza premium StreetCloud',
            cost: 199,
            price: 199,
            margin: 42,
            supplier: 'Spocket',
            category: 'Moda',
            img: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80',
            description: 'Bawełna 400g, oversize fit, haft 3D.'
          },
          {
            id: 'spocket_bag',
            name: 'Torba skórzana Milano',
            cost: 280,
            price: 280,
            margin: 36,
            supplier: 'Spocket',
            category: 'Akcesoria',
            img: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?auto=format&fit=crop&w=600&q=80',
            description: 'Skóra naturalna, pasek crossbody, 3 kieszenie.'
          }
        ],
        createdAt: '2026-02-19T13:05:00Z'
      },
      {
        id: 'store_dom',
        name: 'Dom & Lifestyle',
        slug: 'dom-lifestyle',
        description: 'Nowoczesne produkty do domu i ogrodu.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=DL',
        email: 'dom@uszefaqualitet.pl',
        phone: '+48 690 220 333',
        delivery: 'Wysyłka 72h',
        primaryColor: '#9e77ff',
        accentColor: '#5fff9d',
        backgroundColor: '#0f1837',
        theme: 'clean',
        margin: 25,
        plan: 'basic',
        trial: true,
        products: [
          {
            id: 'vidaxl_garden_set',
            name: 'Zestaw mebli ogrodowych Porto',
            cost: 1290,
            price: 1290,
            margin: 24,
            supplier: 'VidaXL',
            category: 'Dom i ogród',
            img: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=600&q=80',
            description: '4 krzesła, stół hartowany, poduszki outdoor.'
          },
          {
            id: 'costway_rocker',
            name: 'Fotel bujany Nordic',
            cost: 620,
            price: 620,
            margin: 26,
            supplier: 'Costway',
            category: 'Wyposażenie domu',
            img: 'https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1487014679447-9f8336841d58?auto=format&fit=crop&w=600&q=80',
            description: 'Drewniana podstawa, tapicerka boucle.'
          },
          {
            id: 'eprolo_organizer',
            name: 'Organizer do szafy FlexiBox',
            cost: 59,
            price: 59,
            margin: 20,
            supplier: 'EPROLO',
            category: 'Wyposażenie domu',
            img: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80',
            image: 'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=600&q=80',
            description: 'Modułowe kosze do garderoby i szuflad.'
          }
        ],
        createdAt: '2026-02-24T08:22:00Z'
      }
    ];

    const seedUsers = [
      {
        id: 'user_anna',
        name: 'Anna Nowak',
        email: 'anna@uszefaqualitet.pl',
        phone: '+48 601 111 001',
        country: 'PL',
        role: 'partner',
        plan: 'pro',
        sales: 5,
        turnover: 1850,
        createdAt: '2026-02-08T07:40:00Z'
      },
      {
        id: 'user_marek',
        name: 'Marek Kowalski',
        email: 'marek@uszefaqualitet.pl',
        phone: '+48 601 111 002',
        country: 'PL',
        role: 'partner',
        plan: 'basic',
        sales: 2,
        turnover: 320,
        createdAt: '2026-02-11T11:20:00Z'
      },
      {
        id: 'user_ola',
        name: 'Ola Zielińska',
        email: 'ola@uszefaqualitet.pl',
        phone: '+48 601 111 003',
        country: 'PL',
        role: 'partner',
        plan: 'elite',
        sales: 9,
        turnover: 4200,
        createdAt: '2026-02-15T14:10:00Z'
      },
      {
        id: 'user_tomasz',
        name: 'Tomasz Kaczmarek',
        email: 'tomasz@uszefaqualitet.pl',
        phone: '+48 601 111 004',
        country: 'PL',
        role: 'partner',
        plan: 'pro',
        sales: 3,
        turnover: 1370,
        createdAt: '2026-02-21T09:55:00Z'
      },
      {
        id: 'user_klaudia',
        name: 'Klaudia Nowicka',
        email: 'klaudia@uszefaqualitet.pl',
        phone: '+48 601 111 005',
        country: 'PL',
        role: 'client',
        plan: 'basic',
        sales: 0,
        turnover: 0,
        createdAt: '2026-02-25T16:05:00Z'
      }
    ];

    const seedLeads = [
      {
        id: 'lead_anna',
        name: 'Anna Grochowska',
        email: 'anna.g@firma.pl',
        source: 'Landing',
        status: 'hot',
        createdAt: '2026-02-26T08:15:00Z'
      },
      {
        id: 'lead_tomasz',
        name: 'Tomasz K.',
        email: 'tomek@handel.pl',
        source: 'Webinar',
        status: 'warm',
        createdAt: '2026-02-27T12:40:00Z'
      },
      {
        id: 'lead_kinga',
        name: 'Kinga Brzoza',
        email: 'kinga@atelier.pl',
        source: 'Facebook',
        status: 'cold',
        createdAt: '2026-02-28T14:05:00Z'
      },
      {
        id: 'lead_daniel',
        name: 'Daniel P.',
        email: 'daniel@startup.pl',
        source: 'Polecenie',
        status: 'warm',
        createdAt: '2026-03-01T10:30:00Z'
      }
    ];

    const seedSubscriptions = [
      {
        id: 'sub_anna',
        userId: 'user_anna',
        plan: 'pro',
        status: 'active',
        amount: 79,
        createdAt: '2026-02-09T08:00:00Z'
      },
      {
        id: 'sub_marek',
        userId: 'user_marek',
        plan: 'basic',
        status: 'active',
        amount: 29,
        createdAt: '2026-02-12T12:10:00Z'
      },
      {
        id: 'sub_ola',
        userId: 'user_ola',
        plan: 'elite',
        status: 'active',
        amount: 199,
        createdAt: '2026-02-16T14:40:00Z'
      },
      {
        id: 'sub_tomasz',
        userId: 'user_tomasz',
        plan: 'pro',
        status: 'active',
        amount: 79,
        createdAt: '2026-02-21T10:10:00Z'
      },
      {
        id: 'sub_klaudia',
        userId: 'user_klaudia',
        plan: 'basic',
        status: 'trial',
        amount: 0,
        createdAt: '2026-02-26T17:20:00Z'
      }
    ];

    const seedOrders = [
      {
        id: 'ord_001',
        number: 'QM-2026-001',
        storeId: 'store_elektronika',
        storeName: 'Qualitet Elektronika',
        client: 'Jan Wiśniewski',
        clientEmail: 'jan.w@email.pl',
        product: 'Powerbank 20000 mAh Voltix',
        amount: 149,
        status: 'paid',
        createdAt: '2026-03-01T10:12:00Z'
      },
      {
        id: 'ord_002',
        number: 'QM-2026-002',
        storeId: 'store_moda',
        storeName: 'Qualitet Moda',
        client: 'Maria Kowalczyk',
        clientEmail: 'maria.k@mail.pl',
        product: 'Kurtka Softshell Arctic',
        amount: 239,
        status: 'shipped',
        createdAt: '2026-03-02T14:05:00Z'
      },
      {
        id: 'ord_003',
        number: 'QM-2026-003',
        storeId: 'store_dom',
        storeName: 'Dom & Lifestyle',
        client: 'Piotr Nowak',
        clientEmail: 'piotr.n@firma.pl',
        product: 'Fotel bujany Nordic',
        amount: 890,
        status: 'pending',
        createdAt: '2026-03-03T09:30:00Z'
      },
      {
        id: 'ord_004',
        number: 'QM-2026-004',
        storeId: 'store_elektronika',
        storeName: 'Qualitet Elektronika',
        client: 'Anna Grochowska',
        clientEmail: 'anna.g@firma.pl',
        product: 'Dron sportowy AirFlash',
        amount: 1050,
        status: 'paid',
        createdAt: '2026-03-04T11:20:00Z'
      },
      {
        id: 'ord_005',
        number: 'QM-2026-005',
        storeId: 'store_moda',
        storeName: 'Qualitet Moda',
        client: 'Tomasz Kaczmarek',
        clientEmail: 'tomasz@uszefaqualitet.pl',
        product: 'Bluza premium StreetCloud',
        amount: 320,
        status: 'shipped',
        createdAt: '2026-03-05T16:40:00Z'
      },
      {
        id: 'ord_006',
        number: 'QM-2026-006',
        storeId: 'store_dom',
        storeName: 'Dom & Lifestyle',
        client: 'Kinga Brzoza',
        clientEmail: 'kinga@atelier.pl',
        product: 'Zestaw mebli ogrodowych Porto',
        amount: 1690,
        status: 'paid',
        createdAt: '2026-03-06T08:15:00Z'
      },
      {
        id: 'ord_007',
        number: 'QM-2026-007',
        storeId: 'store_elektronika',
        storeName: 'Qualitet Elektronika',
        client: 'Daniel P.',
        clientEmail: 'daniel@startup.pl',
        product: 'Smart gniazdko HomeLink',
        amount: 79,
        status: 'cancelled',
        createdAt: '2026-03-07T12:55:00Z'
      }
    ];

    const seedOperators = [
      {
        id: 'op_001',
        name: 'Kamil Operatorski',
        email: 'kamil.op@uszefaqualitet.pl',
        status: 'active',
        tasksOpen: 4,
        activityToday: 12,
        partners: 3,
        lastActive: '2026-03-11T07:30:00Z'
      },
      {
        id: 'op_002',
        name: 'Ewa Zarządzająca',
        email: 'ewa.op@uszefaqualitet.pl',
        status: 'active',
        tasksOpen: 2,
        activityToday: 8,
        partners: 2,
        lastActive: '2026-03-11T06:50:00Z'
      },
      {
        id: 'op_003',
        name: 'Bartek Wsparcie',
        email: 'bartek.op@uszefaqualitet.pl',
        status: 'inactive',
        tasksOpen: 0,
        activityToday: 0,
        partners: 1,
        lastActive: '2026-03-09T14:00:00Z'
      }
    ];

    const seedReferrals = [
      {
        id: 'ref_anna',
        userId: 'user_anna',
        userName: 'Anna Nowak',
        refCode: 'ANNA2026',
        referred: 2,
        activeStores: 1,
        commission: 79,
        status: 'active'
      },
      {
        id: 'ref_marek',
        userId: 'user_marek',
        userName: 'Marek Kowalski',
        refCode: 'MAREK26',
        referred: 1,
        activeStores: 1,
        commission: 29,
        status: 'active'
      },
      {
        id: 'ref_ola',
        userId: 'user_ola',
        userName: 'Ola Zielińska',
        refCode: 'OLA26EL',
        referred: 3,
        activeStores: 2,
        commission: 199,
        status: 'active'
      }
    ];

    const seedAdminLogs = [
      {
        id: 'log_001',
        time: '2026-03-11T08:10:00Z',
        user: 'uszefaqualitetpromo@gmail.com',
        role: 'superadmin',
        action: 'Logowanie',
        object: 'Panel Superadmina',
        details: 'Pomyślne logowanie'
      },
      {
        id: 'log_002',
        time: '2026-03-10T15:30:00Z',
        user: 'kamil.op@uszefaqualitet.pl',
        role: 'operator',
        action: 'Edycja sklepu',
        object: 'Qualitet Elektronika',
        details: 'Zaktualizowano opis sklepu'
      },
      {
        id: 'log_003',
        time: '2026-03-10T12:05:00Z',
        user: 'ewa.op@uszefaqualitet.pl',
        role: 'operator',
        action: 'Dodanie produktu',
        object: 'Qualitet Moda',
        details: 'Dodano Kurtka Softshell Arctic'
      },
      {
        id: 'log_004',
        time: '2026-03-09T09:20:00Z',
        user: 'uszefaqualitetpromo@gmail.com',
        role: 'superadmin',
        action: 'Zmiana planu',
        object: 'user_ola',
        details: 'Upgrade do ELITE'
      },
      {
        id: 'log_005',
        time: '2026-03-08T17:45:00Z',
        user: 'kamil.op@uszefaqualitet.pl',
        role: 'operator',
        action: 'Obsługa leadu',
        object: 'Anna Grochowska',
        details: 'Status zmieniony na: gorący'
      }
    ];

    const suppliers = ensureSeedList(OWNER_STORAGE_KEYS.suppliers, seedSuppliers);
    const stores = ensureSeedList(OWNER_STORAGE_KEYS.stores, seedStores);
    if(!localStorage.getItem(OWNER_STORAGE_KEYS.activeStore) && stores.length){
      localStorage.setItem(OWNER_STORAGE_KEYS.activeStore, stores[0].id);
    }
    const allSupplierProducts = buildProductsFromSuppliers(suppliers);
    const products = ensureSeedList(OWNER_STORAGE_KEYS.products, allSupplierProducts);
    const productsBySupplier = ensureSeedList(
      PRICING_STORAGE_KEYS.productsBySupplier,
      allSupplierProducts.map(p => ({...p, storeId: (stores[0] && stores[0].id) || p.storeId}))
    );
    const users = ensureSeedList(OWNER_STORAGE_KEYS.users, seedUsers);
    const leads = ensureSeedList(OWNER_STORAGE_KEYS.leads, seedLeads);
    const subscriptions = ensureSeedList(OWNER_STORAGE_KEYS.subscriptions, seedSubscriptions);
    const orders = ensureSeedList(OWNER_STORAGE_KEYS.orders, seedOrders);
    const operators = ensureSeedList(OWNER_STORAGE_KEYS.operators, seedOperators);
    const referrals = ensureSeedList(OWNER_STORAGE_KEYS.referrals, seedReferrals);
    const adminLogs = ensureSeedList(OWNER_STORAGE_KEYS.adminLogs, seedAdminLogs);
    resolveStoreMargin({store: stores[0], plan: stores[0] && stores[0].plan});

    return {
      users,
      stores,
      leads,
      products,
      productsBySupplier,
      subscriptions,
      suppliers,
      orders,
      operators,
      referrals,
      adminLogs
    };
  }

  function ensureFinalStorage(){
    const data = ensureOwnerDemoData();
    ensureCalculatorResults();
    ensureStoreSettingsSeed();
    return data;
  }

  function getActiveStore(stores){
    if(!Array.isArray(stores) || !stores.length){
      return null;
    }
    const activeId = localStorage.getItem(OWNER_STORAGE_KEYS.activeStore);
    let activeStore = stores.find(store => store.id === activeId);
    if(!activeStore){
      activeStore = stores[stores.length - 1];
      localStorage.setItem(OWNER_STORAGE_KEYS.activeStore, activeStore.id);
    }
    return activeStore;
  }

  function createFallbackStore(){
    return {
      id: `store_${Date.now().toString(36)}`,
      name: 'Mój sklep',
      slug: 'moj-sklep',
      description: 'Sklep uruchomiony automatycznie po imporcie produktów.',
      logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=MS',
      email: 'kontakt@twojsklep.pl',
      phone: '+48 500 000 000',
      delivery: 'Wysyłka 24h',
      primaryColor: '#35d9ff',
      accentColor: '#54ffb0',
      backgroundColor: '#0f1837',
      theme: 'modern',
      margin: getPlanDefaultMargin('basic'),
      plan: 'basic',
      trial: true,
      products: [],
      createdAt: new Date().toISOString()
    };
  }

  function ensureStoresList(){
    const stores = getStoredList(OWNER_STORAGE_KEYS.stores);
    if(Array.isArray(stores) && stores.length){
      return stores;
    }
    const fallback = createFallbackStore();
    saveStoredList(OWNER_STORAGE_KEYS.stores, [fallback]);
    localStorage.setItem(OWNER_STORAGE_KEYS.activeStore, fallback.id);
    return [fallback];
  }

  function normalizeMarginValue(value, fallback = 0){
    const parsed = Number.parseFloat(value);
    if(Number.isNaN(parsed)){
      return fallback;
    }
    return Math.max(0, parsed);
  }

  function normalizeNumberValue(value, fallback = 0){
    const parsed = Number.parseFloat(value);
    if(Number.isNaN(parsed)){
      return fallback;
    }
    return parsed;
  }

  function parseMarginPercentage(value){
    const parsed = Number.parseFloat(value);
    if(!Number.isFinite(parsed) || parsed < 0){
      return null;
    }
    return parsed;
  }

  function getPlanDefaultMargin(plan){
    const normalized = normalizePlan(plan);
    if(normalized === 'trial'){
      return PLAN_DEFAULT_MARGINS.basic;
    }
    return PLAN_DEFAULT_MARGINS[normalized] ?? PLAN_DEFAULT_MARGINS.basic;
  }

  function resolveStoreMargin(options = {}){
    const storedMargin = parseMarginPercentage(localStorage.getItem(PRICING_STORAGE_KEYS.storeMargin));
    if(storedMargin !== null){
      return storedMargin;
    }
    const storeMargin = parseMarginPercentage(options.store && options.store.margin);
    const settingsMargin = parseMarginPercentage(options.settings && options.settings.margin);
    const resolvedPlan = normalizePlan(
      options.plan
      || (options.store && options.store.plan)
      || (options.settings && (options.settings.plan || options.settings.suggestedPlan))
      || getCurrentPlan()
    );
    const fallbackMargin = getPlanDefaultMargin(resolvedPlan);
    const resolvedMargin = storeMargin !== null ? storeMargin : (settingsMargin !== null ? settingsMargin : fallbackMargin);
    localStorage.setItem(PRICING_STORAGE_KEYS.storeMargin, `${resolvedMargin}`);
    return resolvedMargin;
  }

  function setStoreMargin(value){
    const resolved = parseMarginPercentage(value);
    if(resolved === null){
      return resolveStoreMargin();
    }
    localStorage.setItem(PRICING_STORAGE_KEYS.storeMargin, `${resolved}`);
    return resolved;
  }

  function normalizeTradeMode(value){
    const normalized = normalizeQueryParam(value);
    if(['hurt', 'hurtowy', 'b2b'].includes(normalized)){
      return 'hurt';
    }
    if(['detal', 'detaliczny', 'handel', 'b2c'].includes(normalized)){
      return 'detal';
    }
    return '';
  }

  function getUserProfileMode(){
    const rawProfile = localStorage.getItem(STORAGE_KEYS.userProfile);
    if(!rawProfile){
      return '';
    }
    try{
      const parsed = JSON.parse(rawProfile);
      return normalizeTradeMode(parsed && (parsed.profile || parsed.mode || parsed.role));
    } catch (_error){
      return '';
    }
  }

  function resolveSupplierMode(options = {}){
    const candidates = [
      options.product && (options.product.mode || options.product.tradeMode || options.product.supplierMode),
      options.store && (options.store.mode || options.store.tradeMode),
      options.settings && (options.settings.mode || options.settings.tradeMode || options.settings.profile),
      getUserProfileMode()
    ];
    const resolved = candidates.map(normalizeTradeMode).find(value => value);
    return resolved || 'detal';
  }

  function resolveSupplierMarkupPct(mode){
    return SUPPLIER_MARKUP_PCT[mode] ?? SUPPLIER_MARKUP_PCT.detal;
  }

  function roundCurrency(value){
    return Math.round(value * 100) / 100;
  }

  function calculatePricing(cost, margin){
    const safeCost = Number.parseFloat(cost);
    const resolvedCost = Number.isNaN(safeCost) ? 0 : safeCost;
    const resolvedMargin = normalizeMarginValue(margin, 0);
    const finalPrice = resolvedCost * (1 + resolvedMargin / 100);
    const profit = finalPrice - resolvedCost;
    return {
      cost: resolvedCost,
      margin: resolvedMargin,
      finalPrice: Math.round(finalPrice * 100) / 100,
      profit: Math.round(profit * 100) / 100
    };
  }

  function calculateTieredPricing(cost, options = {}){
    const safeCost = Number.parseFloat(cost);
    const resolvedCost = Number.isNaN(safeCost) ? 0 : safeCost;
    const supplierMode = resolveSupplierMode(options);
    const supplierMarginPct = resolveSupplierMarkupPct(supplierMode);
    const platformMarginPct = PLATFORM_MARGIN_PCT;
    const defaultMargin = resolveStoreMargin(options);
    const userMarginPct = normalizeMarginValue(options.userMargin, defaultMargin);
    const priceAfterSupplier = resolvedCost * (1 + supplierMarginPct / 100);
    const priceAfterPlatform = priceAfterSupplier * (1 + platformMarginPct / 100);
    const finalPrice = priceAfterPlatform * (1 + userMarginPct / 100);
    const supplierMarginValue = priceAfterSupplier - resolvedCost;
    const platformMarginValue = priceAfterPlatform - priceAfterSupplier;
    const userMarginValue = finalPrice - priceAfterPlatform;
    return {
      cost: resolvedCost,
      supplierMode,
      supplierMarginPct,
      platformMarginPct,
      userMarginPct,
      priceAfterSupplier: roundCurrency(priceAfterSupplier),
      priceAfterPlatform: roundCurrency(priceAfterPlatform),
      finalPrice: roundCurrency(finalPrice),
      supplierMarginValue: roundCurrency(supplierMarginValue),
      platformMarginValue: roundCurrency(platformMarginValue),
      userMarginValue: roundCurrency(userMarginValue)
    };
  }

  function loadCalculatorResults(){
    const raw = localStorage.getItem(STORAGE_KEYS.calculatorResults);
    if(!raw){
      return null;
    }
    try{
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error){
      return null;
    }
  }

  function saveCalculatorResults(results){
    if(!results || typeof results !== 'object'){
      return;
    }
    localStorage.setItem(STORAGE_KEYS.calculatorResults, JSON.stringify(results));
  }

  function getPlanRecommendationForValue(value, thresholds){
    const numericValue = normalizeNumberValue(value, 0);
    if(numericValue >= thresholds.elite){
      return 'elite';
    }
    if(numericValue >= thresholds.pro){
      return 'pro';
    }
    return 'basic';
  }

  function resolvePlanDecision(results){
    const plans = [];
    const currentDecision = normalizeDecision(results && results.decision);
    if(currentDecision){
      plans.push(currentDecision);
    }
    const profitCalc = results && results.profitCalc ? results.profitCalc : null;
    if(profitCalc && profitCalc.monthlyProfit !== undefined){
      plans.push(getPlanRecommendationForValue(profitCalc.monthlyProfit, PLAN_RECOMMENDATION_THRESHOLDS.profit));
    }
    const storeCalc = results && results.storeCalc ? results.storeCalc : null;
    if(storeCalc){
      const budget = normalizeNumberValue(storeCalc.budget, 0);
      const goal = normalizeNumberValue(storeCalc.goal, 0);
      const storeSignal = Math.max(budget, goal, 0);
      if(storeSignal > 0){
        plans.push(getPlanRecommendationForValue(storeSignal, PLAN_RECOMMENDATION_THRESHOLDS.budget));
      }
      const storeSuggested = normalizeDecision(storeCalc.suggestedPlan);
      if(storeSuggested){
        plans.push(storeSuggested);
      }
    }
    const trafficCalc = results && results.trafficCalc ? results.trafficCalc : null;
    if(trafficCalc && trafficCalc.visits !== undefined){
      const trafficSignal = normalizeNumberValue(trafficCalc.visits, 0);
      if(trafficSignal > 0){
        plans.push(getPlanRecommendationForValue(trafficSignal, PLAN_RECOMMENDATION_THRESHOLDS.traffic));
      }
    }
    const validPlans = plans.filter(plan => getPlanLevel(plan) >= 0);
    if(!validPlans.length){
      return 'basic';
    }
    return validPlans.reduce((best, plan) => {
      const bestLevel = getPlanLevel(best);
      const planLevel = getPlanLevel(plan);
      return planLevel > bestLevel ? plan : best;
    }, 'basic');
  }

  function getPlanFromUrl(){
    const params = new URLSearchParams(window.location.search);
    const planParam = normalizePlan(params.get('plan'));
    return planParam && getPlanLevel(planParam) >= 0 ? planParam : '';
  }

  function applyPlanRecommendation(results){
    const resolved = results || loadCalculatorResults() || {};
    const decision = normalizeDecision(getPlanFromUrl() || resolved.decision);
    const label = formatPlanLabel(decision);
    document.querySelectorAll('[data-recommended-plan]').forEach(target => {
      target.textContent = label;
    });
    document.querySelectorAll('[data-recommended-cta]').forEach(target => {
      target.dataset.plan = decision;
      target.setAttribute('href', `cennik.html?plan=${decision}`);
      target.textContent = `Wybierz plan ${label}`;
    });
    document.querySelectorAll('[data-plan-card]').forEach(card => {
      const cardPlan = normalizePlan(card.dataset.plan);
      card.classList.toggle('is-recommended', cardPlan === decision);
    });
  }

  function updateCalculatorResults(partial){
    const existing = loadCalculatorResults() || {};
    const merged = {
      ...existing,
      ...partial
    };
    ['profitCalc', 'storeCalc', 'trafficCalc'].forEach(key => {
      if(merged[key] === undefined){
        merged[key] = null;
      }
    });
    merged.decision = resolvePlanDecision(merged);
    saveCalculatorResults(merged);
    applyPlanRecommendation(merged);
    return merged;
  }

  function ensureCalculatorResults(){
    const existing = loadCalculatorResults();
    if(existing){
      return existing;
    }
    const storeSettings = loadStoreSettings();
    const suggestedPlan = normalizeDecision(storeSettings && (storeSettings.suggestedPlan || storeSettings.plan));
    const seed = {
      profitCalc: null,
      storeCalc: null,
      trafficCalc: null,
      decision: suggestedPlan || 'basic'
    };
    saveCalculatorResults(seed);
    return seed;
  }

  function initSalesCalculator(){
    const calculator = document.querySelector('[data-sales-calculator]');
    if(!calculator){
      return;
    }
    const costInput = calculator.querySelector('[data-calc-cost]');
    const marginInput = calculator.querySelector('[data-calc-margin]');
    const unitsInput = calculator.querySelector('[data-calc-units]');
    const finalTarget = calculator.querySelector('[data-calc-final]');
    const profitTarget = calculator.querySelector('[data-calc-profit]');
    const monthlyTarget = calculator.querySelector('[data-calc-monthly]');
    const defaultMargin = normalizeMarginValue(marginInput ? marginInput.value : 0, 0);

    const updateResults = () => {
      const costValue = costInput ? Number.parseFloat(costInput.value) : 0;
      const resolvedCost = Number.isNaN(costValue) ? 0 : Math.max(0, costValue);
      const marginValue = marginInput ? marginInput.value : defaultMargin;
      const resolvedMargin = normalizeMarginValue(marginValue, defaultMargin);
      const unitsValue = unitsInput ? Number.parseFloat(unitsInput.value) : 0;
      const resolvedUnits = Number.isNaN(unitsValue) ? 0 : Math.max(0, unitsValue);
      const pricing = calculatePricing(resolvedCost, resolvedMargin);
      const monthlyProfit = pricing.profit * resolvedUnits;
      if(finalTarget){
        finalTarget.textContent = formatCurrency(pricing.finalPrice);
      }
      if(profitTarget){
        profitTarget.textContent = formatCurrency(pricing.profit);
      }
      if(monthlyTarget){
        monthlyTarget.textContent = formatCurrency(monthlyProfit);
      }
      updateCalculatorResults({
        profitCalc: {
          cost: pricing.cost,
          margin: pricing.margin,
          units: resolvedUnits,
          finalPrice: pricing.finalPrice,
          profit: pricing.profit,
          monthlyProfit: Math.round(monthlyProfit * 100) / 100
        }
      });
    };

    [costInput, marginInput, unitsInput].forEach(input => {
      if(input){
        input.addEventListener('input', updateResults);
      }
    });
    updateResults();
  }

  function resolveStoreCalculatorPlan(payload){
    const budget = normalizeNumberValue(payload && payload.budget, 0);
    const goal = normalizeNumberValue(payload && payload.goal, 0);
    const signal = Math.max(budget, goal, 0);
    return getPlanRecommendationForValue(signal, PLAN_RECOMMENDATION_THRESHOLDS.budget);
  }

  function initStoreCalculator(){
    const calculator = document.querySelector('[data-store-calculator]');
    if(!calculator){
      return;
    }
    const nicheInput = calculator.querySelector('[data-store-niche]');
    const budgetInput = calculator.querySelector('[data-store-budget]');
    const marginInput = calculator.querySelector('[data-store-margin]');
    const goalInput = calculator.querySelector('[data-store-goal]');
    const planTarget = calculator.querySelector('[data-store-plan]');
    const storedSettings = loadStoreSettings();
    const activeStore = getActiveStore(ensureStoresList());
    const defaultMargin = resolveStoreMargin({store: activeStore, settings: storedSettings, plan: getCurrentPlan()});
    if(marginInput){
      marginInput.value = `${defaultMargin}`;
    }

    const update = () => {
      const niche = nicheInput ? nicheInput.value.trim() : '';
      const budgetValue = Math.max(0, normalizeNumberValue(budgetInput ? budgetInput.value : 0, 0));
      const marginValue = normalizeMarginValue(marginInput ? marginInput.value : 0, defaultMargin);
      const goalValue = Math.max(0, normalizeNumberValue(goalInput ? goalInput.value : 0, 0));
      const payload = {
        niche,
        budget: budgetValue,
        margin: marginValue,
        goal: goalValue
      };
      const suggestedPlan = resolveStoreCalculatorPlan(payload);
      if(planTarget){
        planTarget.textContent = formatPlanLabel(suggestedPlan);
      }
      updateCalculatorResults({
        storeCalc: {
          ...payload,
          suggestedPlan
        }
      });
      setStoreMargin(marginValue);
      saveStoreSettings({
        ...payload,
        suggestedPlan,
        updatedAt: new Date().toISOString()
      });
    };

    [nicheInput, budgetInput, marginInput, goalInput].forEach(input => {
      if(input){
        input.addEventListener('input', update);
      }
    });
    update();
  }

  function initTrafficCalculator(){
    const calculator = document.querySelector('[data-traffic-calculator]');
    if(!calculator){
      return;
    }
    const visitsInput = calculator.querySelector('[data-traffic-visits]');
    const conversionInput = calculator.querySelector('[data-traffic-conversion]');
    const orderInput = calculator.querySelector('[data-traffic-order]');
    const revenueTarget = calculator.querySelector('[data-traffic-revenue]');
    const ordersTarget = calculator.querySelector('[data-traffic-orders]');

    const update = () => {
      const visits = Math.max(0, normalizeNumberValue(visitsInput ? visitsInput.value : 0, 0));
      const conversion = Math.max(0, normalizeNumberValue(conversionInput ? conversionInput.value : 0, 0));
      const orderValue = Math.max(0, normalizeNumberValue(orderInput ? orderInput.value : 0, 0));
      const conversionRate = Math.max(0, Math.min(conversion / 100, 1));
      const orders = Math.round(visits * conversionRate);
      const revenue = Math.round(orders * orderValue);
      if(ordersTarget){
        ordersTarget.textContent = `${orders}`;
      }
      if(revenueTarget){
        revenueTarget.textContent = formatCurrency(revenue);
      }
      updateCalculatorResults({
        trafficCalc: {
          visits,
          conversion,
          orderValue,
          orders,
          revenue
        }
      });
    };

    [visitsInput, conversionInput, orderInput].forEach(input => {
      if(input){
        input.addEventListener('input', update);
      }
    });
    update();
  }

  function addProductToStore(product, margin){
    if(!product){
      return null;
    }
    const resolvedImage = resolveProductImage(product);
    const {cost: resolvedCost, price: resolvedPrice, costEstimated} = resolveCostAndPrice(product);
    const stores = ensureStoresList();
    let activeStore = getActiveStore(stores);
    if(!activeStore){
      const fallback = createFallbackStore();
      stores.push(fallback);
      localStorage.setItem(OWNER_STORAGE_KEYS.activeStore, fallback.id);
      activeStore = fallback;
    }
    const storeIndex = stores.findIndex(store => store.id === activeStore.id);
    const existingProducts = Array.isArray(activeStore.products) ? [...activeStore.products] : [];
    const storeSettings = loadStoreSettings();
    const pricing = calculateTieredPricing(resolvedCost, {
      userMargin: margin,
      store: activeStore,
      settings: storeSettings,
      product
    });
    const entry = {
      id: product.id,
      name: product.name,
      cost: pricing.cost,
      price: resolvedPrice || pricing.finalPrice,
      costEstimated,
      margin: pricing.userMarginPct,
      supplierMode: pricing.supplierMode,
      supplierMarginPct: pricing.supplierMarginPct,
      platformMarginPct: pricing.platformMarginPct,
      supplierMarginValue: pricing.supplierMarginValue,
      platformMarginValue: pricing.platformMarginValue,
      userMarginValue: pricing.userMarginValue,
      finalPrice: pricing.finalPrice,
      supplier: product.supplier,
      category: product.category,
      image: resolvedImage,
      img: resolvedImage,
      description: product.description,
      addedAt: new Date().toISOString()
    };
    const existingIndex = existingProducts.findIndex(item => item.id === entry.id && item.supplier === entry.supplier);
    if(existingIndex >= 0){
      existingProducts[existingIndex] = {
        ...existingProducts[existingIndex],
        ...entry
      };
    } else {
      existingProducts.push(entry);
    }
    const updatedStore = {
      ...activeStore,
      products: existingProducts,
      updatedAt: new Date().toISOString()
    };
    if(storeIndex >= 0){
      stores[storeIndex] = updatedStore;
    } else {
      stores.push(updatedStore);
    }
    saveStoredList(OWNER_STORAGE_KEYS.stores, stores);

    const catalog = getStoredList(OWNER_STORAGE_KEYS.products) || [];
    const catalogEntry = {
      ...entry,
      storeId: updatedStore.id,
      createdAt: new Date().toISOString()
    };
    const catalogIndex = catalog.findIndex(item => item.id === entry.id && item.storeId === updatedStore.id);
    if(catalogIndex >= 0){
      catalog[catalogIndex] = {
        ...catalog[catalogIndex],
        ...catalogEntry
      };
    } else {
      catalog.push(catalogEntry);
    }
    saveStoredList(OWNER_STORAGE_KEYS.products, catalog);

    const supplierCatalog = loadProductsBySupplier();
    const supplierEntry = {
      id: entry.id,
      name: entry.name,
      cost: entry.cost,
      price: entry.price,
      costEstimated: entry.costEstimated,
      margin: entry.margin,
      supplierMode: entry.supplierMode,
      supplierMarginPct: entry.supplierMarginPct,
      platformMarginPct: entry.platformMarginPct,
      supplierMarginValue: entry.supplierMarginValue,
      platformMarginValue: entry.platformMarginValue,
      userMarginValue: entry.userMarginValue,
      finalPrice: entry.finalPrice,
      supplier: entry.supplier,
      category: entry.category,
      image: entry.image,
      img: entry.img,
      description: entry.description,
      storeId: updatedStore.id,
      createdAt: entry.addedAt
    };
    const supplierIndex = supplierCatalog.findIndex(item => item.id === entry.id && item.storeId === updatedStore.id);
    if(supplierIndex >= 0){
      supplierCatalog[supplierIndex] = {
        ...supplierCatalog[supplierIndex],
        ...supplierEntry
      };
    } else {
      supplierCatalog.push(supplierEntry);
    }
    saveProductsBySupplier(supplierCatalog);

    return {
      store: updatedStore,
      product: entry
    };
  }

  function createOrder(product, store, options){
    if(!product){
      return null;
    }
    const orders = getStoredList(OWNER_STORAGE_KEYS.orders) || [];
    const now = new Date().toISOString();
    const year = new Date().getFullYear();
    const maxSeq = orders.reduce((max, o) => {
      const match = o.number && o.number.match(/QM-\d{4}-(\d+)/);
      const sequenceNumber = match ? parseInt(match[1], 10) : 0;
      return sequenceNumber > max ? sequenceNumber : max;
    }, 0);
    const seq = String(maxSeq + 1).padStart(3, '0');
    const randomSuffix = Math.floor(Math.random() * 900 + 100);
    const orderId = `ord_${Date.now()}_${randomSuffix}`;
    const orderNumber = `QM-${year}-${seq}`;
    let resolvedStore = store;
    if(!resolvedStore){
      const storesList = ensureStoresList();
      resolvedStore = getActiveStore(storesList) || {};
    }
    const rawAmount = (options && options.amount != null) ? options.amount : (product.finalPrice != null ? product.finalPrice : product.price);
    const parsedAmount = Number.parseFloat(rawAmount);
    const order = {
      id: orderId,
      number: orderNumber,
      storeId: resolvedStore.id || '',
      storeName: resolvedStore.name || '',
      client: (options && options.client) || 'Klient sklepu',
      clientEmail: (options && options.clientEmail) || '',
      product: product.name || '',
      productId: product.id || '',
      amount: Number.isFinite(parsedAmount) ? parsedAmount : 0,
      status: 'pending',
      createdAt: now
    };
    orders.push(order);
    saveStoredList(OWNER_STORAGE_KEYS.orders, orders);

    const catalog = getStoredList(OWNER_STORAGE_KEYS.products) || [];
    const catalogIndex = catalog.findIndex(item => item.id === product.id && (item.storeId === resolvedStore.id || !item.storeId));
    if(catalogIndex >= 0){
      catalog[catalogIndex] = {
        ...catalog[catalogIndex],
        sales: (catalog[catalogIndex].sales || 0) + 1
      };
      saveStoredList(OWNER_STORAGE_KEYS.products, catalog);
    }

    const supplierCatalog = loadProductsBySupplier();
    const supplierIndex = supplierCatalog.findIndex(item => item.id === product.id && (item.storeId === resolvedStore.id || !item.storeId));
    if(supplierIndex >= 0){
      supplierCatalog[supplierIndex] = {
        ...supplierCatalog[supplierIndex],
        sales: (supplierCatalog[supplierIndex].sales || 0) + 1
      };
      saveProductsBySupplier(supplierCatalog);
    }

    attributeSalesToLink(product, parsedAmount);

    return order;
  }

  function loadSalesLinks(){
    return getStoredList(OWNER_STORAGE_KEYS.salesLinks) || [];
  }

  function saveSalesLinks(list){
    saveStoredList(OWNER_STORAGE_KEYS.salesLinks, list);
  }

  function generateSalesLinkToken(){
    if(typeof crypto !== 'undefined' && crypto.getRandomValues){
      const arr = new Uint8Array(16);
      crypto.getRandomValues(arr);
      return Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
    }
    return Date.now().toString(36) + Math.floor(Math.random() * 0xffffff).toString(36) + Math.floor(Math.random() * 0xffffff).toString(36);
  }

  function buildSalesLinkUrl(token){
    const base = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    return `${base}sklep.html?ref=${encodeURIComponent(token)}`;
  }

  function generateSalesLink(product, margin){
    if(!product){
      return null;
    }
    const existingLinks = loadSalesLinks();
    const email = localStorage.getItem(STORAGE_KEYS.email) || '';
    const stores = ensureStoresList();
    const activeStore = getActiveStore(stores);
    const storeSettings = loadStoreSettings();
    const resolvedMargin = margin != null ? margin : resolveStoreMargin({store: activeStore, settings: storeSettings, plan: activeStore && activeStore.plan});
    const {cost} = resolveCostAndPrice(product);
    const pricing = calculateTieredPricing(cost, {
      userMargin: resolvedMargin,
      store: activeStore,
      settings: storeSettings,
      product
    });
    const existingByProduct = existingLinks.find(link => link.productId === product.id && link.email === email);
    if(existingByProduct){
      return {link: existingByProduct, url: buildSalesLinkUrl(existingByProduct.token), isNew: false};
    }
    const token = generateSalesLinkToken();
    const newLink = {
      id: `link_${Date.now()}_${Math.floor(Math.random() * 900 + 100)}`,
      token,
      productId: product.id,
      productName: product.name || '',
      productImage: resolveProductImage(product),
      productCategory: product.category || '',
      supplierName: product.supplier || '',
      cost: pricing.cost,
      finalPrice: pricing.finalPrice,
      margin: pricing.userMarginPct,
      userMarginValue: pricing.userMarginValue,
      email,
      storeId: (activeStore && activeStore.id) || '',
      clicks: 0,
      sales: 0,
      earnings: 0,
      createdAt: new Date().toISOString()
    };
    existingLinks.push(newLink);
    saveSalesLinks(existingLinks);
    return {link: newLink, url: buildSalesLinkUrl(token), isNew: true};
  }

  function getSalesLinkToken(){
    try{
      return sessionStorage.getItem(SALES_LINK_TOKEN_SESSION_KEY) || null;
    } catch (_error){
      return null;
    }
  }

  function setSalesLinkToken(token){
    try{
      if(token){
        sessionStorage.setItem(SALES_LINK_TOKEN_SESSION_KEY, token);
      } else {
        sessionStorage.removeItem(SALES_LINK_TOKEN_SESSION_KEY);
      }
    } catch (_error){
    }
  }

  function trackSalesLinkClick(){
    const params = new URLSearchParams(window.location.search);
    const token = params.get('ref');
    if(!token){
      return;
    }
    setSalesLinkToken(token);
    const links = loadSalesLinks();
    const idx = links.findIndex(link => link.token === token);
    if(idx >= 0){
      links[idx] = {
        ...links[idx],
        clicks: (links[idx].clicks || 0) + 1
      };
      saveSalesLinks(links);
    }
  }

  function attributeSalesToLink(product, amount){
    const token = getSalesLinkToken();
    if(!token){
      return;
    }
    const links = loadSalesLinks();
    const idx = links.findIndex(link => link.token === token && link.productId === (product && product.id));
    if(idx < 0){
      return;
    }
    const earning = Number.isFinite(links[idx].userMarginValue) ? links[idx].userMarginValue : 0;
    links[idx] = {
      ...links[idx],
      sales: (links[idx].sales || 0) + 1,
      earnings: roundCurrency((links[idx].earnings || 0) + earning)
    };
    saveSalesLinks(links);
    setSalesLinkToken(null);
  }

  function initSalesLinksPage(){
    if(document.body.dataset.page !== 'linki-sprzedazowe'){
      return;
    }
    const logged = isAppLoggedIn();
    if(!logged){
      window.location.href = 'login.html';
      return;
    }
    const email = localStorage.getItem(STORAGE_KEYS.email) || '';
    const container = document.querySelector('[data-sales-links-list]');
    const empty = document.querySelector('[data-sales-links-empty]');
    const statsLinks = document.querySelector('[data-sl-total-links]');
    const statsClicks = document.querySelector('[data-sl-total-clicks]');
    const statsSales = document.querySelector('[data-sl-total-sales]');
    const statsEarnings = document.querySelector('[data-sl-total-earnings]');

    const renderLinks = () => {
      const links = loadSalesLinks().filter(link => link.email === email);
      const totalLinks = links.length;
      const totalClicks = links.reduce((sum, l) => sum + (l.clicks || 0), 0);
      const totalSales = links.reduce((sum, l) => sum + (l.sales || 0), 0);
      const totalEarnings = links.reduce((sum, l) => sum + (l.earnings || 0), 0);

      if(statsLinks){
        statsLinks.textContent = totalLinks;
      }
      if(statsClicks){
        statsClicks.textContent = totalClicks;
      }
      if(statsSales){
        statsSales.textContent = totalSales;
      }
      if(statsEarnings){
        statsEarnings.textContent = formatCurrency(totalEarnings);
      }

      if(!container){
        return;
      }
      container.innerHTML = '';
      if(!links.length){
        if(empty){
          empty.hidden = false;
        }
        return;
      }
      if(empty){
        empty.hidden = true;
      }
      links.slice().reverse().forEach(link => {
        const url = buildSalesLinkUrl(link.token);
        const row = document.createElement('article');
        row.className = 'sales-link-card panel-card';
        row.innerHTML = `
          <div class="sales-link-product">
            <img class="sales-link-img" src="${escapeHtml(link.productImage || DEFAULT_PRODUCT_IMAGE)}" alt="${escapeHtml(link.productName)}">
            <div class="sales-link-info">
              <span class="tag">${escapeHtml(link.productCategory)}</span>
              <strong class="sales-link-name">${escapeHtml(link.productName)}</strong>
              <span class="hint">Hurtownia: ${escapeHtml(link.supplierName || '—')}</span>
            </div>
          </div>
          <div class="sales-link-stats">
            <div class="sales-link-stat"><span>Kliknięcia</span><strong>${link.clicks || 0}</strong></div>
            <div class="sales-link-stat"><span>Sprzedaże</span><strong>${link.sales || 0}</strong></div>
            <div class="sales-link-stat"><span>Zarobek</span><strong>${formatCurrency(link.earnings || 0)}</strong></div>
            <div class="sales-link-stat"><span>Marża</span><strong>${link.margin || 0}%</strong></div>
          </div>
          <div class="sales-link-url-row">
            <input class="sales-link-url-input" type="text" readonly value="${escapeHtml(url)}" aria-label="Link sprzedażowy">
            <button class="btn btn-secondary sales-link-copy" type="button" data-copy-url="${escapeHtml(url)}">Kopiuj link</button>
          </div>
        `;
        const copyBtn = row.querySelector('.sales-link-copy');
        if(copyBtn){
          copyBtn.addEventListener('click', () => {
            const text = copyBtn.dataset.copyUrl;
            if(navigator.clipboard && text){
              navigator.clipboard.writeText(text).then(() => {
                const original = copyBtn.textContent;
                copyBtn.textContent = 'Skopiowano ✓';
                setTimeout(() => {
                  copyBtn.textContent = original;
                }, 2000);
              }).catch(() => {});
            }
          });
        }
        container.appendChild(row);
      });
    };

    renderLinks();
  }

  function loadStoreSettings(){
    const raw = localStorage.getItem(STORAGE_KEYS.storeSettings);
    if(!raw){
      return null;
    }
    try{
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (_error){
      return null;
    }
  }

  function saveStoreSettings(settings){
    if(!settings){
      return;
    }
    const existing = loadStoreSettings() || {};
    const merged = {
      ...existing,
      ...settings
    };
    if(merged.margin !== undefined && merged.margin !== null){
      setStoreMargin(merged.margin);
    }
    const calculatorResults = loadCalculatorResults();
    const suggestedPlan = normalizeDecision(
      merged.suggestedPlan
      || merged.plan
      || (calculatorResults && calculatorResults.decision)
    );
    if(suggestedPlan){
      merged.suggestedPlan = suggestedPlan;
    }
    localStorage.setItem(STORAGE_KEYS.storeSettings, JSON.stringify(merged));
    localStorage.setItem(STORAGE_KEYS.storeReady, 'true');
  }

  function ensureStoreSettingsSeed(){
    const existing = loadStoreSettings();
    if(existing){
      return existing;
    }
    const stores = ensureStoresList();
    const activeStore = getActiveStore(stores) || createFallbackStore();
    const resolvedMargin = resolveStoreMargin({store: activeStore, plan: activeStore.plan});
    const seed = {
      niche: activeStore.name,
      budget: 12000,
      margin: resolvedMargin,
      goal: 25000,
      suggestedPlan: normalizeDecision(activeStore.plan),
      storeName: activeStore.name,
      storeStyle: activeStore.theme,
      updatedAt: new Date().toISOString()
    };
    saveStoreSettings(seed);
    return seed;
  }

  function getStoreInitial(storeName){
    const trimmed = (storeName || '').trim();
    if(!trimmed){
      return 'S';
    }
    return trimmed.charAt(0).toUpperCase();
  }

  function updateLogoPreview(preview, image, placeholder, storeName, logoDataUrl){
    if(!preview || !image || !placeholder){
      return;
    }
    placeholder.textContent = getStoreInitial(storeName);
    if(logoDataUrl){
      image.src = logoDataUrl;
      preview.classList.add('has-image');
    } else {
      image.removeAttribute('src');
      preview.classList.remove('has-image');
    }
  }

  function updateColorChips(primaryInput, accentInput, primaryChip, accentChip){
    if(primaryInput && primaryChip){
      primaryChip.style.background = primaryInput.value;
    }
    if(accentInput && accentChip){
      accentChip.style.background = accentInput.value;
    }
  }

  function startTrialIfNeeded(email){
    const existingPlan = normalizePlan(localStorage.getItem(STORAGE_KEYS.plan));
    const hasTrialPlan = !existingPlan || existingPlan === 'trial';
    if(!hasTrialPlan){
      return;
    }
    if(localStorage.getItem(STORAGE_KEYS.trialStart)){
      return;
    }
    const storedCount = getStoredNumber(STORAGE_KEYS.usersCount, 0);
    const storedList = getStoredList(STORAGE_KEYS.usersList);
    const listExists = storedList !== null;
    const users = storedList || [];
    let currentCount = storedCount;
    const hasEmail = Boolean(email);
    const emailKnown = hasEmail && users.includes(email);

    if(hasEmail && !emailKnown){
      const shouldIncrement = listExists || storedCount === 0;
      users.push(email);
      if(shouldIncrement){
        currentCount = storedCount + 1;
      }
    } else if(!hasEmail && storedCount === 0){
      currentCount = 1;
    }

    localStorage.setItem(STORAGE_KEYS.usersCount, `${currentCount}`);
    if(users.length){
      localStorage.setItem(STORAGE_KEYS.usersList, JSON.stringify(users));
    }

    localStorage.setItem(STORAGE_KEYS.trialDays, `${DEFAULT_TRIAL_DAYS}`);
    localStorage.setItem(STORAGE_KEYS.trialStart, new Date().toISOString());
    localStorage.setItem(STORAGE_KEYS.plan, 'trial');
  }

  function getTrialRemainingDays(){
    const trialDays = getStoredNumber(STORAGE_KEYS.trialDays, 0);
    const trialStart = localStorage.getItem(STORAGE_KEYS.trialStart);
    if(!trialStart || trialDays <= 0){
      return 0;
    }
    const startDate = new Date(trialStart);
    if(Number.isNaN(startDate.getTime())){
      return 0;
    }
    const elapsedDays = Math.floor((Date.now() - startDate.getTime()) / MS_PER_DAY);
    const remaining = Math.max(trialDays - elapsedDays, 0);
    if(remaining === 0){
      localStorage.setItem(STORAGE_KEYS.plan, 'basic');
    }
    return remaining;
  }

  function getTrialLabel(remaining){
    if(remaining === 1){
      return 'dzień pozostał';
    }
    if(
      remaining % 10 >= 2
      && remaining % 10 <= 4
      && (remaining % 100 < 12 || remaining % 100 > 14)
    ){
      return 'dni pozostały';
    }
    return 'dni pozostało';
  }

  function normalizePlan(plan){
    return normalizeQueryParam(plan);
  }

  function normalizeDecision(plan){
    const normalized = normalizePlan(plan);
    if(normalized === 'basic' || normalized === 'pro' || normalized === 'elite'){
      return normalized;
    }
    if(normalized === 'free' || normalized === 'trial'){
      return 'free';
    }
    return 'basic';
  }

  /**
   * Normalizes query param values to lowercase trimmed strings,
   * returning an empty string when the value is missing.
   */
  function normalizeQueryParam(param) {
    return param ? param.toString().trim().toLowerCase() : '';
  }

  /**
   * Determines success for Stripe redirect callbacks using status/success flags or
   * a returned session id paired with a pending plan.
   * SUCCESS_STATUSES covers known success flags from Stripe return URLs, while
   * session-based success requires a pending plan saved before checkout.
   */
  function isCheckoutSuccess(statusParam, successParam, sessionId, pendingPlan) {
    const hasStatusSuccess = SUCCESS_STATUSES.includes(statusParam);
    const hasSuccessFlag = SUCCESS_STATUSES.includes(successParam);
    const hasPendingPlan = Boolean(pendingPlan);
    const hasSessionSuccess = Boolean(sessionId) && hasPendingPlan;
    return hasStatusSuccess || hasSuccessFlag || hasSessionSuccess;
  }

  /**
   * Returns the Stripe checkout session id from query parameters like
   * session_id or checkout_session_id.
   */
  function getStripeSessionId(params) {
    return params.get('session_id') || params.get('checkout_session_id');
  }

  function getAvailablePlans(){
    const plans = new Set(Object.keys(PLAN_LEVELS));
    const planElements = document.querySelectorAll('[data-plan-card],[data-plan-checkout]');
    planElements.forEach(element => {
      const plan = normalizePlan(element.dataset.plan);
      if(plan){
        plans.add(plan);
      }
    });
    return plans;
  }

  function formatPlanLabel(plan){
    const normalized = normalizePlan(plan);
    if(PLAN_LABELS[normalized]){
      return PLAN_LABELS[normalized];
    }
    if(!normalized){
      return PLAN_LABELS.basic;
    }
    const label = normalized.replace(/[-_]+/g, ' ').trim();
    return label.replace(/\b\w/g, char => char.toUpperCase());
  }

  function getPlanLevel(plan){
    const normalized = normalizePlan(plan);
    if(!normalized){
      return -1;
    }
    return PLAN_LEVELS[normalized] ?? -1;
  }

  function setPlan(plan){
    const normalized = normalizePlan(plan);
    if(!normalized){
      return;
    }
    localStorage.setItem(STORAGE_KEYS.plan, normalized);
    if(normalized !== 'trial' && normalized !== 'free'){
      localStorage.removeItem(STORAGE_KEYS.trialStart);
      localStorage.removeItem(STORAGE_KEYS.trialDays);
    }
  }

  function getCurrentPlan(){
    const logged = isAppLoggedIn();
    if(logged){
      startTrialIfNeeded(localStorage.getItem(STORAGE_KEYS.email));
    }
    const storedPlan = normalizePlan(localStorage.getItem(STORAGE_KEYS.plan));
    if(storedPlan){
      return storedPlan;
    }
    if(logged){
      return 'free';
    }
    return null;
  }

  function getPlanStatusLabel(plan, remaining){
    const normalized = normalizePlan(plan);
    if(!normalized){
      return 'Brak aktywnego planu';
    }
    if(normalized === 'trial' || normalized === 'free'){
      return 'Free';
    }
    return 'Aktywny';
  }

  function getPlanHint(plan, remaining){
    const normalized = normalizePlan(plan);
    if(normalized === 'trial' || normalized === 'free'){
      return 'Plan Seller Free — zacznij sprzedawać bez opłat. Ulepsz plan, aby odblokować więcej funkcji.';
    }
    if(normalized === 'basic'){
      return 'Seller PRO — nielimitowane produkty, analityka i narzędzia marketingowe.';
    }
    if(normalized === 'pro'){
      return 'Seller Business — pełny dostęp do modułów, narzędzia reklamowe i priorytetowe wsparcie.';
    }
    if(normalized === 'elite'){
      return 'ELITE — AI, analityka predykcyjna, nieograniczone sklepy i wsparcie VIP.';
    }
    return 'Plan aktywny. Sprawdź cennik, aby zobaczyć dostępne opcje.';
  }

  function getDisplayTrialDaysForPlan(plan, remaining){
    return plan === 'trial' ? remaining : 0;
  }

  function getDisplayTrialLabelForPlan(plan, remaining){
    return plan === 'trial' ? getTrialLabel(remaining) : 'Brak trialu';
  }

  function updateDashboardStatus(){
    const trialTargets = document.querySelectorAll('[data-trial-remaining]');
    const remaining = getTrialRemainingDays();
    const currentPlan = getCurrentPlan();
    if(trialTargets.length){
      trialTargets.forEach(target => {
        target.textContent = `${getDisplayTrialDaysForPlan(currentPlan, remaining)}`;
      });
    }
    const trialLabel = document.querySelector('[data-trial-label]');
    if(trialLabel){
      trialLabel.textContent = getDisplayTrialLabelForPlan(currentPlan, remaining);
    }
    const planTarget = document.querySelector('[data-user-plan]');
    if(planTarget){
      planTarget.textContent = formatPlanLabel(currentPlan);
    }
    const planName = document.querySelector('[data-plan-name]');
    if(planName){
      planName.textContent = formatPlanLabel(currentPlan);
    }
    const planStatus = document.querySelector('[data-plan-status]');
    if(planStatus){
      planStatus.textContent = getPlanStatusLabel(currentPlan, remaining);
    }
    const planTrial = document.querySelector('[data-plan-trial]');
    if(planTrial){
      planTrial.textContent = `${getDisplayTrialDaysForPlan(currentPlan, remaining)}`;
    }
    const planHint = document.querySelector('[data-plan-hint]');
    if(planHint){
      planHint.textContent = getPlanHint(currentPlan, remaining);
    }
    const planCta = document.querySelector('[data-plan-cta]');
    if(planCta){
      planCta.textContent = currentPlan === 'elite' ? 'Zarządzaj planem' : 'Ulepsz plan';
    }
  }

  function renderDashboardStoreSummary(){
    const summary = document.querySelector('[data-store-summary]');
    if(!summary){
      return;
    }
    const nameTarget = summary.querySelector('[data-store-name]');
    const styleTarget = summary.querySelector('[data-store-style]');
    const statusTarget = summary.querySelector('[data-store-status]');
    const helper = summary.querySelector('[data-store-helper]');
    const settings = loadStoreSettings();
    const ready = localStorage.getItem(STORAGE_KEYS.storeReady) === 'true' && settings;
    const resolvedStoreName = settings ? (settings.storeName || settings.niche) : '';
    const storeName = resolvedStoreName ? resolvedStoreName : 'Brak danych';
    const hasGoal = settings && settings.goal !== undefined && settings.goal !== null;
    const storeStyle = settings && (settings.storeStyle || hasGoal)
      ? (settings.storeStyle || `Cel: ${formatCurrency(settings.goal)}`)
      : '---';

    if(nameTarget){
      nameTarget.textContent = storeName;
    }
    if(styleTarget){
      styleTarget.textContent = storeStyle;
    }
    if(statusTarget){
      statusTarget.textContent = ready ? 'Gotowy' : 'Nieuzupełniony';
      statusTarget.classList.toggle('is-ready', ready);
      statusTarget.classList.toggle('is-pending', !ready);
    }
    if(helper){
      helper.hidden = Boolean(ready);
    }
  }

  function renderDashboardMarginSummary(){
    const summary = document.querySelector('[data-margin-summary]');
    if(!summary){
      return;
    }
    const store = getActiveStore(ensureStoresList());
    const settings = loadStoreSettings();
    const plan = normalizePlan(
      (store && store.plan)
      || (settings && (settings.plan || settings.suggestedPlan))
      || getCurrentPlan()
    );
    const defaultMargin = getPlanDefaultMargin(plan);
    const storeMargin = resolveStoreMargin({store, settings, plan});
    const userMarginTarget = summary.querySelector('[data-user-margin]');
    if(userMarginTarget){
      userMarginTarget.textContent = `${storeMargin}%`;
    }
    const planMarginTarget = summary.querySelector('[data-plan-default-margin]');
    if(planMarginTarget){
      planMarginTarget.textContent = `${defaultMargin}%`;
    }
    const infoTarget = summary.querySelector('[data-platform-margin-info]');
    if(infoTarget){
      infoTarget.textContent = 'Platforma automatycznie dolicza koszty hurtowni oraz marżę platformy.';
    }
  }

  function initPlanCheckoutReturn(){
    const params = new URLSearchParams(window.location.search);
    if(!params.size){
      return;
    }
    const planParam = normalizePlan(params.get('plan'));
    const statusParam = normalizeQueryParam(params.get('status'));
    const successParam = normalizeQueryParam(params.get('success'));
    const sessionId = getStripeSessionId(params);
    const pendingPlan = normalizePlan(localStorage.getItem(STORAGE_KEYS.pendingPlan));
    const resolvedPlan = planParam || pendingPlan;
    const isSuccess = isCheckoutSuccess(statusParam, successParam, sessionId, pendingPlan);

    const validPlans = getAvailablePlans();
    if(resolvedPlan && validPlans.has(resolvedPlan) && isSuccess){
      setPlan(resolvedPlan);
      localStorage.removeItem(STORAGE_KEYS.pendingPlan);
      const successPanel = document.querySelector('[data-plan-success]');
      if(successPanel){
        const nameTarget = successPanel.querySelector('[data-plan-success-name]');
        if(nameTarget){
          nameTarget.textContent = formatPlanLabel(resolvedPlan);
        }
        successPanel.hidden = false;
      }
      const cleanUrl = new URL(window.location.href);
      cleanUrl.search = '';
      window.history.replaceState({}, document.title, cleanUrl.toString());
    }
  }

  function initBillingToggle(){
    const buttons = document.querySelectorAll('[data-billing]');
    if(!buttons.length) return;
    const announcer = document.getElementById('billing-announcer');
    buttons.forEach(function(btn){
      btn.addEventListener('click', function(){
        buttons.forEach(function(billingBtn){ billingBtn.classList.remove('is-active'); });
        btn.classList.add('is-active');
        const isYearly = btn.dataset.billing === 'yearly';
        document.body.classList.toggle('billing-yearly', isYearly);
        if(announcer){
          announcer.textContent = isYearly
            ? 'Ceny roczne aktywne – oszczędzasz 20%'
            : 'Ceny miesięczne aktywne';
        }
      });
    });
  }

  function initPricingSelector(){
    const buttons = document.querySelectorAll('[data-plan-checkout]');
    if(buttons.length){
      buttons.forEach(button => {
        const plan = normalizePlan(button.dataset.plan);
        const fallbackUrl = button.getAttribute('href');
        const resolvedUrl = plan && PRICE_LINKS[plan] ? PRICE_LINKS[plan] : fallbackUrl;
        if(resolvedUrl){
          button.setAttribute('href', resolvedUrl);
        }
        button.addEventListener('click', () => {
          const checkoutPlan = normalizePlan(button.dataset.plan);
          const checkoutUrl = button.getAttribute('href');
          if(!checkoutPlan || !checkoutUrl){
            return;
          }
          localStorage.setItem(STORAGE_KEYS.pendingPlan, checkoutPlan);
        });
      });
    }
    const currentPlan = getCurrentPlan();
    const highlightPlan = (currentPlan === 'trial' || currentPlan === 'free') ? 'basic' : currentPlan;
    const cards = document.querySelectorAll('[data-plan-card]');
    if(cards.length){
      cards.forEach(card => {
        const cardPlan = normalizePlan(card.dataset.plan);
        const isCurrent = cardPlan && cardPlan === highlightPlan;
        card.classList.toggle('is-current', isCurrent);
        const badge = card.querySelector('[data-current-plan]');
        if(badge){
          badge.hidden = !isCurrent;
        }
      });
    }
  }

  function ensureUpgradeModal(){
    if(upgradeModal && document.body.contains(upgradeModal)){
      return upgradeModal;
    }
    upgradeModal = document.querySelector('[data-upgrade-modal]');
    if(upgradeModal){
      return upgradeModal;
    }
    const modal = document.createElement('div');
    modal.className = 'upgrade-modal';
    modal.dataset.upgradeModal = '';
    modal.hidden = true;
    modal.innerHTML = `
      <div class="upgrade-window" role="dialog" aria-modal="true" aria-labelledby="upgrade-title">
        <button class="upgrade-close" type="button" data-upgrade-close aria-label="Zamknij okno">×</button>
        <span class="eyebrow">Upgrade planu</span>
        <h2 id="upgrade-title">Odblokuj plan <span data-upgrade-plan>PRO</span></h2>
        <p class="hint" data-upgrade-message>Ta funkcja wymaga planu PRO</p>
        <div class="upgrade-plans">
          <div class="upgrade-pill">Basic <strong>29 zł / mies.</strong></div>
          <div class="upgrade-pill">PRO <strong>79 zł / mies.</strong></div>
          <div class="upgrade-pill">ELITE <strong>199 zł / mies.</strong></div>
        </div>
        <div class="upgrade-actions">
          <a class="btn btn-primary" href="cennik.html" data-upgrade-cta>Zobacz plany</a>
          <a class="btn btn-secondary" href="dashboard.html" data-upgrade-back hidden>Wróć do dashboardu</a>
          <button class="btn btn-secondary" type="button" data-upgrade-close>Wróć</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    upgradeModal = modal;
    return modal;
  }

  function initUpgradeModal(){
    const modal = ensureUpgradeModal();
    if(!modal || upgradeModalInitialized){
      return;
    }
    const closeButtons = modal.querySelectorAll('[data-upgrade-close]');
    const closeModal = () => {
      if(modal.hasAttribute('data-upgrade-locked-page')){
        return;
      }
      modal.hidden = true;
      document.body.classList.remove('modal-open');
    };
    closeButtons.forEach(button => {
      button.addEventListener('click', closeModal);
    });
    modal.addEventListener('click', event => {
      if(event.target === modal){
        closeModal();
      }
    });
    document.addEventListener('keydown', event => {
      if(event.key === 'Escape' && !modal.hidden){
        closeModal();
      }
    });
    upgradeModalInitialized = true;
  }

  function showUpgradeModal(requiredPlan, options = {}){
    const modal = ensureUpgradeModal();
    if(!modal){
      return;
    }
    initUpgradeModal();
    const planLabel = formatPlanLabel(requiredPlan);
    const titleTarget = modal.querySelector('[data-upgrade-plan]');
    if(titleTarget){
      titleTarget.textContent = planLabel;
    }
    const messageTarget = modal.querySelector('[data-upgrade-message]');
    if(messageTarget){
      messageTarget.textContent = `Ta funkcja wymaga planu ${planLabel}`;
    }
    modal.toggleAttribute('data-upgrade-locked-page', Boolean(options.lockPage));
    const logged = isAppLoggedIn();
    const backLink = modal.querySelector('[data-upgrade-back]');
    if(backLink){
      backLink.hidden = !options.lockPage;
      backLink.href = logged ? 'dashboard.html' : 'login.html';
    }
    modal.querySelectorAll('[data-upgrade-close]').forEach(button => {
      button.hidden = Boolean(options.lockPage);
    });
    modal.hidden = false;
    document.body.classList.add('modal-open');
  }

  function initPlanGates(){
    // Subscription plan gates removed — platform operates without Basic/PRO/Elite locks.
    // All features are available to all users.
    // Only remove the locked visual state from any elements that may have been marked.
    document.querySelectorAll('[data-require]').forEach(el => {
      el.classList.remove('is-locked');
      el.removeAttribute('aria-disabled');
    });
  }

  // ── isAppLoggedIn: checks both the API JWT token and the legacy localStorage flag ──
  function isAppLoggedIn(){
    try{
      if(localStorage.getItem('qm_token')){ return true; }
    } catch(_){}
    return localStorage.getItem(STORAGE_KEYS.logged) === 'true';
  }

  function guardDashboard(){
    if(document.body.dataset.page !== 'dashboard'){
      return;
    }
    if(!isAppLoggedIn()){
      window.location.href = 'login.html';
      return;
    }
    startTrialIfNeeded(localStorage.getItem(STORAGE_KEYS.email));
    updateDashboardStatus();
    renderDashboardStoreSummary();
    renderDashboardMarginSummary();
    renderDashboardSalesLinksSummary();
  }

  function renderDashboardSalesLinksSummary(){
    const email = localStorage.getItem(STORAGE_KEYS.email) || '';
    const links = loadSalesLinks().filter(link => link.email === email);
    const setText = (sel, val) => {
      const el = document.querySelector(sel);
      if(el){
        el.textContent = val;
      }
    };
    setText('[data-sl-dash-links]', links.length);
    setText('[data-sl-dash-clicks]', links.reduce((s, l) => s + (l.clicks || 0), 0));
    setText('[data-sl-dash-sales]', links.reduce((s, l) => s + (l.sales || 0), 0));
    setText('[data-sl-dash-earnings]', formatCurrency(links.reduce((s, l) => s + (l.earnings || 0), 0)));
  }

  function getStoredUserRole(){
    const storedRole = normalizeQueryParam(localStorage.getItem(STORAGE_KEYS.role));
    if(storedRole){
      return storedRole;
    }
    const rawProfile = localStorage.getItem(STORAGE_KEYS.userProfile);
    if(!rawProfile){
      return '';
    }
    try{
      const parsed = JSON.parse(rawProfile);
      const profileRole = normalizeQueryParam(parsed && parsed.role ? parsed.role : '');
      return profileRole;
    } catch (_error){
      return '';
    }
  }

  function hasOwnerAccess(){
    const role = getStoredUserRole();
    if(role === 'owner' || role === 'superadmin'){
      return true;
    }
    const email = normalizeQueryParam(localStorage.getItem(STORAGE_KEYS.email));
    return email && email === OWNER_EMAIL_NORMALIZED;
  }

  function applyOwnerAccessState(){
    if(document.body.dataset.page !== 'owner-panel'){
      return false;
    }
    const logged = isAppLoggedIn();
    if(!logged){
      window.location.replace('login.html');
      return false;
    }
    const accessGranted = hasOwnerAccess();
    if(!accessGranted){
      window.location.replace('dashboard.html');
      return false;
    }
    const lockedPanel = document.querySelector('[data-owner-locked]');
    const content = document.querySelector('[data-owner-content]');
    if(lockedPanel){
      lockedPanel.hidden = true;
    }
    if(content){
      content.hidden = false;
    }
    return true;
  }

  function escapeHtml(str){
    const stringValue = str == null ? '' : String(str);
    return stringValue
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;');
  }

  function statusPill(status){
    const map = {
      active: 'pill-active',
      paid: 'pill-paid',
      shipped: 'pill-shipped',
      trial: 'pill-trial',
      pending: 'pill-pending',
      inactive: 'pill-inactive',
      cancelled: 'pill-cancelled',
      superadmin: 'pill-superadmin',
      operator: 'pill-operator',
      partner: 'pill-partner',
      client: 'pill-client'
    };
    const cls = map[status] || 'pill-pending';
    const labels = {
      active: 'Aktywny',
      paid: 'Opłacone',
      shipped: 'Wysłane',
      trial: 'Trial',
      pending: 'Oczekujące',
      inactive: 'Nieaktywny',
      cancelled: 'Anulowane',
      superadmin: 'Superadmin',
      operator: 'Operator',
      partner: 'Partner',
      client: 'Klient'
    };
    const label = labels[status] || escapeHtml(status);
    return `<span class="${cls}">${label}</span>`;
  }

  function initOwnerPanel(){
    if(document.body.dataset.page !== 'owner-panel'){
      return;
    }
    if(!applyOwnerAccessState()){
      return;
    }

    const data = ensureFinalStorage();
    const users = data.users;
    const stores = data.stores;
    const leads = data.leads;
    const products = data.products;
    const subscriptions = data.subscriptions;
    const suppliers = data.suppliers;
    const orders = data.orders || [];
    const operators = data.operators || [];
    const referrals = data.referrals || [];
    const adminLogs = data.adminLogs || [];
    const storeMap = new Map(stores.map(store => [store.id, store]));
    const userMap = new Map(users.map(user => [user.id, user]));

    // ── Tab switching ──
    const tabNav = document.querySelector('[data-owner-tab-nav]');
    const tabPanels = document.querySelectorAll('[data-owner-tab-panel]');
    function showTab(tabId){
      let targetPanel = null;
      tabPanels.forEach(panel => {
        const isActive = panel.dataset.ownerTabPanel === tabId;
        panel.hidden = !isActive;
        if(isActive) targetPanel = panel;
      });
      if(tabNav){
        tabNav.querySelectorAll('[data-owner-tab]').forEach(link => {
          link.classList.toggle('active', link.dataset.ownerTab === tabId);
        });
      }
      if(targetPanel){
        targetPanel.setAttribute('tabindex', '-1');
        targetPanel.focus({preventScroll: false});
      }
    }
    if(tabNav){
      tabNav.addEventListener('click', event => {
        const link = event.target.closest('[data-owner-tab]');
        if(!link) return;
        event.preventDefault();
        showTab(link.dataset.ownerTab);
      });
    }
    showTab('overview');

    // ── Helpers ──
    const setText = (selector, value) => {
      const el = document.querySelector(selector);
      if(el) el.textContent = value;
    };

    const renderList = (container, items, builder, emptyMessage) => {
      if(!container) return;
      container.innerHTML = '';
      if(!items.length){
        const empty = document.createElement('p');
        empty.className = 'empty';
        empty.textContent = emptyMessage;
        container.appendChild(empty);
        return;
      }
      items.forEach(item => container.appendChild(builder(item)));
    };

    const filterTable = (tbody, rows, filterFn) => {
      tbody.innerHTML = '';
      rows.filter(filterFn).forEach(row => tbody.appendChild(row));
    };

    // ── OVERVIEW: counters ──
    const activeSubscriptions = subscriptions.filter(s => s.status === 'active');
    const planCounts = {basic: 0, pro: 0, elite: 0};
    activeSubscriptions.forEach(s => {
      const normalizedPlan = normalizePlan(s.plan);
      if(normalizedPlan && planCounts[normalizedPlan] !== undefined) planCounts[normalizedPlan] += 1;
    });
    const revenue = activeSubscriptions.reduce((sum, s) => {
      const parsedAmount = Number.parseFloat(s.amount);
      return sum + (Number.isNaN(parsedAmount) ? 0 : parsedAmount);
    }, 0);
    const platformMarginRate = 0.15;
    const platformMargin = revenue * platformMarginRate;

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const monthStr = now.toISOString().slice(0, 7);

    const ordersToday = orders.filter(o => (o.createdAt || '').startsWith(todayStr));
    const revenueToday = ordersToday.reduce((sum, o) => sum + (Number.parseFloat(o.amount) || 0), 0);
    const ordersThisMonth = orders.filter(o => (o.createdAt || '').startsWith(monthStr));
    const revenueMonth = ordersThisMonth.reduce((sum, o) => sum + (Number.parseFloat(o.amount) || 0), 0);
    const regsToday = users.filter(u => (u.createdAt || '').startsWith(todayStr)).length;
    const regsMonth = users.filter(u => (u.createdAt || '').startsWith(monthStr)).length;

    const counterData = [
      ['[data-owner-users]', users.length],
      ['[data-owner-stores]', stores.length],
      ['[data-owner-products]', products.length],
      ['[data-owner-orders]', orders.length],
      ['[data-owner-revenue]', Math.round(revenue)],
      ['[data-owner-platform-margin]', Math.round(platformMargin)],
      ['[data-owner-active-subs]', activeSubscriptions.length],
      ['[data-owner-referrals-count]', referrals.reduce((s, r) => s + (r.referred || 0), 0)],
      ['[data-owner-plan-basic]', planCounts.basic],
      ['[data-owner-plan-pro]', planCounts.pro],
      ['[data-owner-plan-elite]', planCounts.elite]
    ];
    counterData.forEach(([selector, value]) => {
      const target = document.querySelector(selector);
      if(target){
        target.dataset.counter = `${Math.max(0, Math.round(value))}`;
      }
    });
    window.setTimeout(() => {
      counterData.forEach(([selector, value]) => {
        const target = document.querySelector(selector);
        if(target) setCounterValue(target, value);
      });
    }, 1300);

    setText('[data-owner-revenue-today]', formatCurrency(revenueToday));
    setText('[data-owner-revenue-month]', formatCurrency(revenueMonth));
    setText('[data-owner-reg-today]', `${regsToday} os.`);
    setText('[data-owner-reg-month]', `${regsMonth} os.`);

    // ── OVERVIEW: charts ──
    const updateChart = (prefix, values) => {
      const total = Object.values(values).reduce((sum, v) => sum + v, 0) || 1;
      Object.entries(values).forEach(([key, value]) => {
        const percent = Math.round((value / total) * 100);
        const bar = document.querySelector(`[data-${prefix}-chart-bar="${key}"]`);
        const label = document.querySelector(`[data-${prefix}-chart-value="${key}"]`);
        if(bar) bar.style.setProperty('--value', `${percent}%`);
        if(label) label.textContent = `${value} (${percent}%)`;
      });
    };
    updateChart('plan', planCounts);
    const leadCounts = leads.reduce((acc, lead) => {
      const status = lead.status || 'cold';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {hot: 0, warm: 0, cold: 0});
    updateChart('lead', leadCounts);

    // ── OVERVIEW: lists ──
    const storeList = document.querySelector('[data-owner-stores-list]');
    const leadList = document.querySelector('[data-owner-leads-list]');
    const productList = document.querySelector('[data-owner-products-list]');
    const supplierList = document.querySelector('[data-owner-suppliers-list]');

    const sortedStores = [...stores].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    renderList(storeList, sortedStores, store => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const productCount = Array.isArray(store.products) ? store.products.length : 0;
      const name = document.createElement('strong');
      name.textContent = store.name;
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = `Plan ${formatPlanLabel(store.plan)} \u2022 ${productCount} produkt\u00f3w`;
      const small = document.createElement('small');
      small.textContent = `Dodano: ${formatDate(store.createdAt)}`;
      card.append(name, hint, small);
      return card;
    }, 'Brak ostatnich sklepów.');

    const leadStatusMeta = {
      hot: {label: 'Gorący lead', className: 'is-hot'},
      warm: {label: 'Ciepły lead', className: 'is-warm'},
      cold: {label: 'Zimny lead', className: 'is-cold'}
    };
    const sortedLeads = [...leads].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    renderList(leadList, sortedLeads, lead => {
      const meta = leadStatusMeta[lead.status] || {label: 'Nowy lead', className: 'is-pending'};
      const card = document.createElement('div');
      card.className = 'list-card';
      const name = document.createElement('strong');
      name.textContent = lead.name;
      const pill = document.createElement('span');
      pill.className = `status-pill ${meta.className}`;
      pill.textContent = meta.label;
      const small = document.createElement('small');
      small.textContent = `${lead.email} \u2022 ${lead.source}`;
      card.append(name, pill, small);
      return card;
    }, 'Brak nowych leadów.');

    const sortedProducts = [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    renderList(productList, sortedProducts, product => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const productStore = storeMap.get(product.storeId);
      const pricing = calculateTieredPricing(product.cost || 0, {
        userMargin: product.margin,
        store: productStore,
        settings: loadStoreSettings(),
        product
      });
      const name = document.createElement('strong');
      name.textContent = product.name;
      const hint = document.createElement('span');
      hint.className = 'hint';
      hint.textContent = `${product.category || 'Kategoria'} \u2022 ${product.supplier || 'Katalog'}`;
      const small = document.createElement('small');
      small.textContent = `Cena: ${formatCurrency(pricing.finalPrice)}`;
      card.append(name, hint, small);
      return card;
    }, 'Brak nowych produktów.');

    const topSuppliers = [...suppliers].slice(0, 4);
    renderList(supplierList, topSuppliers, supplier => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const productCount = Array.isArray(supplier.products) ? supplier.products.length : 0;
      const meta = document.createElement('div');
      meta.className = 'supplier-meta';
      const img = document.createElement('img');
      img.src = supplier.logo || '';
      img.alt = supplier.name || '';
      img.addEventListener('error', function(){ this.src = `https://placehold.co/48x48/0f1837/FFFFFF?text=${encodeURIComponent((supplier.name || 'H').slice(0, 2).toUpperCase())}`; });
      const info = document.createElement('div');
      const nameEl = document.createElement('strong');
      nameEl.textContent = supplier.name;
      const cat = document.createElement('small');
      cat.textContent = supplier.category;
      info.append(nameEl, cat);
      meta.append(img, info);
      const count = document.createElement('small');
      count.textContent = `${productCount} produktów w katalogu`;
      card.append(meta, count);
      return card;
    }, 'Brak aktywnych hurtowni.');

    // ── USERS TAB ──
    const usersTbody = document.querySelector('[data-users-tbody]');
    if(usersTbody){
      const buildUserRow = user => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(user.id)}</td>
          <td><strong>${escapeHtml(user.name)}</strong></td>
          <td>${escapeHtml(user.email)}</td>
          <td>${escapeHtml(user.phone || '—')}</td>
          <td>${escapeHtml(user.country || '—')}</td>
          <td>${statusPill(user.role || 'client')}</td>
          <td>${escapeHtml(formatPlanLabel(user.plan))}</td>
          <td class="cell-muted">${formatDate(user.createdAt)}</td>
          <td>${user.sales || 0}</td>
          <td>${formatCurrency(user.turnover || 0)}</td>
        `;
        return tr;
      };
      let userRows = users.map(buildUserRow);
      usersTbody.append(...userRows);

      const usersSearch = document.querySelector('[data-users-search]');
      const usersRoleFilter = document.querySelector('[data-users-role-filter]');
      const usersPlanFilter = document.querySelector('[data-users-plan-filter]');
      const applyUsersFilter = () => {
        const searchQuery = (usersSearch ? usersSearch.value.toLowerCase() : '');
        const role = usersRoleFilter ? usersRoleFilter.value : '';
        const plan = usersPlanFilter ? usersPlanFilter.value : '';
        usersTbody.innerHTML = '';
        users.filter(u => {
          const matchQ = !searchQuery || (u.name || '').toLowerCase().includes(searchQuery) || (u.email || '').toLowerCase().includes(searchQuery) || (u.country || '').toLowerCase().includes(searchQuery);
          const matchRole = !role || (u.role || 'client') === role;
          const matchPlan = !plan || normalizePlan(u.plan) === plan;
          return matchQ && matchRole && matchPlan;
        }).map(buildUserRow).forEach(row => usersTbody.appendChild(row));
      };
      if(usersSearch) usersSearch.addEventListener('input', applyUsersFilter);
      if(usersRoleFilter) usersRoleFilter.addEventListener('change', applyUsersFilter);
      if(usersPlanFilter) usersPlanFilter.addEventListener('change', applyUsersFilter);

      const exportBtn = document.querySelector('[data-export-users]');
      if(exportBtn){
        exportBtn.addEventListener('click', () => {
          const headers = ['ID','Nazwa','Email','Telefon','Kraj','Rola','Plan','Rejestracja','Sprzedaże','Obrót'];
          const rows = users.map(u => [u.id, u.name, u.email, u.phone || '', u.country || '', u.role || 'client', u.plan, u.createdAt, u.sales || 0, u.turnover || 0]);
          const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
          const blob = new Blob([csv], {type: 'text/csv'});
          const url = URL.createObjectURL(blob);
          const downloadLink = document.createElement('a');
          downloadLink.href = url;
          downloadLink.download = 'uzytkownicy.csv';
          downloadLink.click();
          URL.revokeObjectURL(url);
        });
      }
    }

    // ── STORES TAB ──
    const storesTbody = document.querySelector('[data-stores-tbody]');
    if(storesTbody){
      const buildStoreRow = store => {
        const owner = users.find(u => store.userId ? u.id === store.userId : false);
        const ownerName = owner ? owner.name : '—';
        const productCount = Array.isArray(store.products) ? store.products.length : 0;
        const storeOrders = orders.filter(o => o.storeId === store.id);
        const storeTurnover = storeOrders.reduce((sum, o) => sum + (Number.parseFloat(o.amount) || 0), 0);
        const storeStatus = store.trial ? 'trial' : 'active';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(store.id)}</td>
          <td><strong>${escapeHtml(store.name)}</strong></td>
          <td>${escapeHtml(ownerName)}</td>
          <td>${escapeHtml(formatPlanLabel(store.plan))}</td>
          <td>${productCount}</td>
          <td>${storeOrders.length}</td>
          <td>${formatCurrency(storeTurnover)}</td>
          <td>${statusPill(storeStatus)}</td>
          <td class="cell-muted">${formatDate(store.createdAt)}</td>
        `;
        return tr;
      };
      stores.map(buildStoreRow).forEach(row => storesTbody.appendChild(row));

      const storesSearch = document.querySelector('[data-stores-search]');
      const storesStatusFilter = document.querySelector('[data-stores-status-filter]');
      const applyStoresFilter = () => {
        const searchQuery = (storesSearch ? storesSearch.value.toLowerCase() : '');
        const status = storesStatusFilter ? storesStatusFilter.value : '';
        storesTbody.innerHTML = '';
        stores.filter(s => {
          const matchQ = !searchQuery || (s.name || '').toLowerCase().includes(searchQuery);
          const storeStatus = s.trial ? 'trial' : 'active';
          const matchStatus = !status || storeStatus === status || (!s.trial && status === 'active');
          return matchQ && matchStatus;
        }).map(buildStoreRow).forEach(row => storesTbody.appendChild(row));
      };
      if(storesSearch) storesSearch.addEventListener('input', applyStoresFilter);
      if(storesStatusFilter) storesStatusFilter.addEventListener('change', applyStoresFilter);
    }

    // ── PRODUCTS TAB ──
    const productsTbody = document.querySelector('[data-products-tbody]');
    if(productsTbody){
      // State for API-loaded products
      let apiProducts = null; // null = not loaded yet, [] = loaded but empty
      // WeakMap to track filter event handlers for proper cleanup on re-render
      const filterHandlers = new WeakMap();

      const buildProductRowFromApi = (product) => {
        const tr = document.createElement('tr');
        const sku = product.sku || String(product.id).slice(0, 8);
        const supplier = product.supplier_name || product.supplier || '—';
        const buyPrice = parseFloat(product.supplier_price || product.price_gross || 0);
        const sellPrice = parseFloat(product.selling_price || product.platform_price || 0);
        const stockVal = product.stock != null ? product.stock : '—';
        const statusVal = product.status || 'active';
        const productId = escapeHtml(String(product.id));
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(sku)}</td>
          <td><strong>${escapeHtml(product.name)}</strong>${product.description ? `<br><small class="cell-muted">${escapeHtml(product.description.slice(0, 60))}${product.description.length > 60 ? '\u2026' : ''}</small>` : ''}</td>
          <td>${escapeHtml(product.category || '—')}</td>
          <td>${escapeHtml(supplier)}</td>
          <td>${formatCurrency(buyPrice)}</td>
          <td>${formatCurrency(sellPrice)}</td>
          <td>${escapeHtml(String(stockVal))}</td>
          <td>${statusPill(statusVal)}</td>
          <td>
            <button class="btn btn-secondary btn-sm" type="button" data-product-edit="${productId}">Edytuj</button>
            <button class="btn btn-secondary btn-sm" type="button" data-product-delete="${productId}" style="margin-left:4px">Usuń</button>
          </td>
        `;
        return tr;
      };

      const buildProductRowFromLocal = (product) => {
        const pricing = calculateTieredPricing(product.cost || 0, {
          userMargin: product.margin,
          store: storeMap.get(product.storeId),
          settings: loadStoreSettings(),
          product
        });
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(product.sku || product.id)}</td>
          <td><strong>${escapeHtml(product.name)}</strong></td>
          <td>${escapeHtml(product.category || '—')}</td>
          <td>${escapeHtml(product.supplier || '—')}</td>
          <td>${formatCurrency(product.cost || 0)}</td>
          <td>${formatCurrency(pricing.finalPrice)}</td>
          <td>${product.stock != null ? product.stock : '—'}</td>
          <td>${statusPill('active')}</td>
          <td><span class="hint" style="font-size:11px">—</span></td>
        `;
        return tr;
      };

      const renderProductsTable = (list, isFromApi) => {
        const supplierFilter = document.querySelector('[data-products-supplier-filter]');
        const statusFilter = document.querySelector('[data-products-status-filter]');
        const productsSearch = document.querySelector('[data-products-search]');
        const apiSourceEl = document.querySelector('[data-products-api-source]');

        if(apiSourceEl) apiSourceEl.hidden = !isFromApi;

        // Populate supplier filter from list
        if(supplierFilter && isFromApi){
          // Remove non-default options
          while(supplierFilter.options.length > 1) supplierFilter.remove(1);
          const suppliersSet = [...new Set(list.map(p => p.supplier_name || p.supplier).filter(Boolean))];
          suppliersSet.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s;
            opt.textContent = s;
            supplierFilter.appendChild(opt);
          });
        }

        const applyFilter = () => {
          const q = productsSearch ? productsSearch.value.toLowerCase() : '';
          const sup = supplierFilter ? supplierFilter.value : '';
          const st = statusFilter ? statusFilter.value : '';
          productsTbody.innerHTML = '';
          const filtered = list.filter(p => {
            const matchQ = !q || (p.name || '').toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
            const matchSup = !sup || ((p.supplier_name || p.supplier || '') === sup);
            const matchSt = !st || (p.status || 'active') === st;
            return matchQ && matchSup && matchSt;
          });
          if(!filtered.length){
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="9" style="text-align:center;padding:24px;color:var(--muted)">Brak produktów spełniających kryteria</td>';
            productsTbody.appendChild(row);
          } else {
            filtered.forEach(p => productsTbody.appendChild(isFromApi ? buildProductRowFromApi(p) : buildProductRowFromLocal(p)));
          }
        };

        applyFilter();

        // Store filter function in a WeakMap to allow proper listener cleanup
        if(productsSearch){
          if(filterHandlers.has(productsSearch)) productsSearch.removeEventListener('input', filterHandlers.get(productsSearch));
          filterHandlers.set(productsSearch, applyFilter);
          productsSearch.addEventListener('input', applyFilter);
        }
        if(supplierFilter){
          if(filterHandlers.has(supplierFilter)) supplierFilter.removeEventListener('change', filterHandlers.get(supplierFilter));
          filterHandlers.set(supplierFilter, applyFilter);
          supplierFilter.addEventListener('change', applyFilter);
        }
        if(statusFilter){
          if(filterHandlers.has(statusFilter)) statusFilter.removeEventListener('change', filterHandlers.get(statusFilter));
          filterHandlers.set(statusFilter, applyFilter);
          statusFilter.addEventListener('change', applyFilter);
        }
      };

      // Load products from API
      const loadProductsFromApi = () => {
        const loadingEl = document.querySelector('[data-products-loading]');
        if(loadingEl) loadingEl.hidden = false;
        productsTbody.innerHTML = '';

        const api = window.QMApi;
        if(api && api.Admin && api.Auth && api.Auth.isLoggedIn && api.Auth.isLoggedIn()){
          api.Admin.products({ limit: 100, page: 1 })
            .then(resp => {
              const rows = (resp && resp.products) ? resp.products : (Array.isArray(resp) ? resp : []);
              apiProducts = rows;
              if(loadingEl) loadingEl.hidden = true;
              if(rows.length){
                renderProductsTable(rows, true);
                // Update overview counter with real count
                const counter = document.querySelector('[data-owner-products]');
                if(counter) setCounterValue(counter, rows.length);
              } else {
                // Fall back to local data
                renderProductsTable(products, false);
              }
            })
            .catch(() => {
              if(loadingEl) loadingEl.hidden = true;
              renderProductsTable(products, false);
            });
        } else {
          if(loadingEl) loadingEl.hidden = true;
          renderProductsTable(products, false);
        }
      };

      // Initial load
      loadProductsFromApi();

      // Reload button
      const reloadBtn = document.querySelector('[data-products-reload-btn]');
      if(reloadBtn) reloadBtn.addEventListener('click', () => loadProductsFromApi());

      // ── Product CRUD Modal ──
      const productModal = document.querySelector('[data-product-modal]');
      const productForm = document.querySelector('[data-product-form]');
      const productModalTitle = document.querySelector('[data-product-modal-title]');
      const productIdField = document.querySelector('[data-product-id]');
      const productFormMsg = document.querySelector('[data-product-form-msg]');

      const openProductModal = (editProduct = null) => {
        if(!productModal || !productForm) return;
        productForm.reset();
        if(productFormMsg){ productFormMsg.hidden = true; productFormMsg.textContent = ''; }
        if(editProduct){
          if(productModalTitle) productModalTitle.textContent = 'Edytuj produkt';
          if(productIdField) productIdField.value = editProduct.id || '';
          const f = (s) => productForm.querySelector(s);
          if(f('[data-pf-name]')) f('[data-pf-name]').value = editProduct.name || '';
          if(f('[data-pf-sku]')) f('[data-pf-sku]').value = editProduct.sku || '';
          if(f('[data-pf-category]')) f('[data-pf-category]').value = editProduct.category || '';
          if(f('[data-pf-description]')) f('[data-pf-description]').value = editProduct.description || '';
          if(f('[data-pf-price-net]')) f('[data-pf-price-net]').value = editProduct.price_net || '';
          if(f('[data-pf-tax-rate]')) f('[data-pf-tax-rate]').value = editProduct.tax_rate != null ? editProduct.tax_rate : 23;
          if(f('[data-pf-stock]')) f('[data-pf-stock]').value = editProduct.stock != null ? editProduct.stock : 0;
          if(f('[data-pf-status]')) f('[data-pf-status]').value = editProduct.status || 'active';
          if(f('[data-pf-image-url]')) f('[data-pf-image-url]').value = editProduct.image_url || '';
        } else {
          if(productModalTitle) productModalTitle.textContent = 'Dodaj produkt';
          if(productIdField) productIdField.value = '';
        }
        productModal.hidden = false;
        productModal.querySelector('input,textarea,select')?.focus();
      };

      const closeProductModal = () => {
        if(productModal) productModal.hidden = true;
      };

      // Open "Add" modal
      const addProductBtn = document.querySelector('[data-products-add-btn]');
      if(addProductBtn) addProductBtn.addEventListener('click', () => openProductModal(null));

      // Close modal buttons
      document.querySelectorAll('[data-product-modal-close]').forEach(btn => {
        btn.addEventListener('click', closeProductModal);
      });
      if(productModal){
        productModal.addEventListener('click', (e) => {
          if(e.target === productModal) closeProductModal();
        });
      }

      // Edit/Delete via event delegation on tbody
      productsTbody.addEventListener('click', (e) => {
        // Edit
        const editBtn = e.target.closest('[data-product-edit]');
        if(editBtn){
          const productId = editBtn.dataset.productEdit;
          const productData = apiProducts && apiProducts.find(p => String(p.id) === String(productId));
          if(productData) openProductModal(productData);
          return;
        }
        // Delete
        const deleteBtn = e.target.closest('[data-product-delete]');
        if(deleteBtn){
          const productId = deleteBtn.dataset.productDelete;
          if(!productId) return;
          if(!window.confirm('Czy na pewno usunąć ten produkt?')) return;
          const api = window.QMApi;
          if(!api || !api.Admin){ alert('Brak połączenia z API'); return; }
          api.Admin.deleteProduct(productId)
            .then(() => { loadProductsFromApi(); })
            .catch(err => alert('Błąd usuwania: ' + (err.message || 'Nieznany błąd')));
        }
      });

      // Save product form
      if(productForm){
        productForm.addEventListener('submit', (e) => {
          e.preventDefault();
          const api = window.QMApi;
          if(!api || !api.Admin){
            if(productFormMsg){ productFormMsg.textContent = 'Brak połączenia z API. Zaloguj się jako admin.'; productFormMsg.hidden = false; }
            return;
          }
          const f = (s) => productForm.querySelector(s);
          const id = productIdField ? productIdField.value : '';
          const data = {
            name: (f('[data-pf-name]') ? f('[data-pf-name]').value : '').trim(),
            sku: (f('[data-pf-sku]') ? f('[data-pf-sku]').value : '').trim() || undefined,
            category: (f('[data-pf-category]') ? f('[data-pf-category]').value : '').trim() || undefined,
            description: (f('[data-pf-description]') ? f('[data-pf-description]').value : '').trim() || undefined,
            price_net: parseFloat(f('[data-pf-price-net]') ? f('[data-pf-price-net]').value : 0),
            tax_rate: parseFloat(f('[data-pf-tax-rate]') ? f('[data-pf-tax-rate]').value : 23),
            stock: parseInt(f('[data-pf-stock]') ? f('[data-pf-stock]').value : 0, 10),
            status: f('[data-pf-status]') ? f('[data-pf-status]').value : 'active',
            image_url: (f('[data-pf-image-url]') ? f('[data-pf-image-url]').value : '').trim() || undefined,
            is_central: true,
          };
          const submitBtn = productForm.querySelector('[data-product-submit]');
          if(submitBtn) submitBtn.disabled = true;
          const action = id ? api.Admin.updateProduct(id, data) : api.Admin.createProduct(data);
          action
            .then(() => {
              closeProductModal();
              loadProductsFromApi();
            })
            .catch(err => {
              if(productFormMsg){
                productFormMsg.textContent = 'Błąd: ' + (err.message || 'Nieznany błąd');
                productFormMsg.hidden = false;
              }
            })
            .finally(() => {
              if(submitBtn) submitBtn.disabled = false;
            });
        });
      }
    }

    // ── IMPORT PRODUCTS TAB ──
    const importFileForm = document.querySelector('[data-import-file-form]');
    const importSyncForm = document.querySelector('[data-import-sync-form]');
    const importSupplierSelect = document.querySelector('[data-import-supplier-select]');
    const importResult = document.querySelector('[data-import-result]');
    const importResultMsg = document.querySelector('[data-import-result-msg]');

    // Populate supplier select – prefer API data, fall back to demo suppliers
    if(importSupplierSelect){
      const api = window.QMApi;
      if(api && api.Admin && api.Auth && api.Auth.isLoggedIn && api.Auth.isLoggedIn()){
        api.Admin.suppliers().then(resp => {
          const rows = (resp && resp.suppliers) ? resp.suppliers : (Array.isArray(resp) ? resp : []);
          if(rows.length){
            rows.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s.id;
              opt.textContent = s.name;
              importSupplierSelect.appendChild(opt);
            });
          } else if(suppliers.length){
            suppliers.forEach(s => {
              const opt = document.createElement('option');
              opt.value = s.id;
              opt.textContent = s.name;
              importSupplierSelect.appendChild(opt);
            });
          }
        }).catch(() => {
          suppliers.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            importSupplierSelect.appendChild(opt);
          });
        });
      } else if(suppliers.length){
        suppliers.forEach(s => {
          const opt = document.createElement('option');
          opt.value = s.id;
          opt.textContent = s.name;
          importSupplierSelect.appendChild(opt);
        });
      }
    }

    if(importFileForm){
      importFileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const api = window.QMApi;
        const fileInput = importFileForm.querySelector('[data-import-file]');
        const msgEl = document.querySelector('[data-import-file-msg]');
        const submitBtn = importFileForm.querySelector('[data-import-file-submit]');
        if(!fileInput || !fileInput.files || !fileInput.files[0]){
          if(msgEl){ msgEl.textContent = 'Wybierz plik CSV lub XML.'; msgEl.hidden = false; }
          return;
        }
        if(!api || !api.Admin){
          if(msgEl){ msgEl.textContent = 'Brak połączenia z API. Zaloguj się jako admin.'; msgEl.hidden = false; }
          return;
        }
        if(submitBtn) submitBtn.disabled = true;
        if(msgEl){ msgEl.textContent = 'Importowanie…'; msgEl.hidden = false; }
        api.Admin.importProducts(fileInput.files[0])
          .then(resp => {
            const count = resp.count || resp.imported || 0;
            if(importResult) importResult.hidden = false;
            if(importResultMsg) importResultMsg.textContent = `✅ Zaimportowano ${count} produktów do katalogu centralnego.`;
            if(msgEl){ msgEl.textContent = ''; msgEl.hidden = true; }
          })
          .catch(err => {
            if(msgEl){ msgEl.textContent = 'Błąd: ' + (err.message || 'Nieznany błąd'); msgEl.hidden = false; }
          })
          .finally(() => {
            if(submitBtn) submitBtn.disabled = false;
          });
      });
    }

    if(importSyncForm){
      importSyncForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const api = window.QMApi;
        const msgEl = document.querySelector('[data-import-sync-msg]');
        const submitBtn = importSyncForm.querySelector('[data-import-sync-submit]');
        const supplierId = importSupplierSelect ? importSupplierSelect.value : '';
        if(!supplierId){
          if(msgEl){ msgEl.textContent = 'Wybierz hurtownię.'; msgEl.hidden = false; }
          return;
        }
        if(!api || !api.Admin){
          if(msgEl){ msgEl.textContent = 'Brak połączenia z API. Zaloguj się jako admin.'; msgEl.hidden = false; }
          return;
        }
        if(submitBtn) submitBtn.disabled = true;
        if(msgEl){ msgEl.textContent = 'Synchronizacja w toku…'; msgEl.hidden = false; }
        api.Admin.syncSupplier(supplierId)
          .then(resp => {
            const count = (resp && resp.count) || 0;
            if(importResult) importResult.hidden = false;
            if(importResultMsg) importResultMsg.textContent = `✅ Zsynchronizowano ${count} produktów z hurtownią.`;
            if(msgEl){ msgEl.textContent = ''; msgEl.hidden = true; }
          })
          .catch(err => {
            if(msgEl){ msgEl.textContent = 'Błąd: ' + (err.message || 'Nieznany błąd'); msgEl.hidden = false; }
          })
          .finally(() => {
            if(submitBtn) submitBtn.disabled = false;
          });
      });
    }

    // ── ORDERS TAB ──
    const ordersTbody = document.querySelector('[data-orders-tbody]');
    if(ordersTbody){
      const buildOrderRow = order => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(order.number || order.id)}</td>
          <td>${escapeHtml(order.storeName || order.storeId || '—')}</td>
          <td>${escapeHtml(order.client || '—')}</td>
          <td>${escapeHtml(order.product || '—')}</td>
          <td>${formatCurrency(order.amount || 0)}</td>
          <td>${statusPill(order.status || 'pending')}</td>
          <td class="cell-muted">${formatDate(order.createdAt)}</td>
        `;
        return tr;
      };
      orders.map(buildOrderRow).forEach(row => ordersTbody.appendChild(row));

      const ordersSearch = document.querySelector('[data-orders-search]');
      const ordersStatusFilter = document.querySelector('[data-orders-status-filter]');
      const applyOrdersFilter = () => {
        const searchQuery = (ordersSearch ? ordersSearch.value.toLowerCase() : '');
        const status = ordersStatusFilter ? ordersStatusFilter.value : '';
        ordersTbody.innerHTML = '';
        orders.filter(order => {
          const matchQ = !searchQuery || (order.number || '').toLowerCase().includes(searchQuery) || (order.client || '').toLowerCase().includes(searchQuery) || (order.storeName || '').toLowerCase().includes(searchQuery);
          const matchStatus = !status || order.status === status;
          return matchQ && matchStatus;
        }).map(buildOrderRow).forEach(row => ordersTbody.appendChild(row));
      };
      if(ordersSearch) ordersSearch.addEventListener('input', applyOrdersFilter);
      if(ordersStatusFilter) ordersStatusFilter.addEventListener('change', applyOrdersFilter);
    }

    // ── SUBSCRIPTIONS TAB ──
    const subsTbody = document.querySelector('[data-subs-tbody]');
    if(subsTbody){
      const subsActive = subscriptions.filter(s => s.status === 'active').length;
      const subsTrial = subscriptions.filter(s => s.status === 'trial').length;
      const mrr = subscriptions.filter(s => s.status === 'active').reduce((sum, s) => sum + (Number.parseFloat(s.amount) || 0), 0);
      setText('[data-subs-total]', subscriptions.length);
      setText('[data-subs-active]', subsActive);
      setText('[data-subs-trial]', subsTrial);
      setText('[data-subs-mrr]', formatCurrency(mrr));

      subscriptions.forEach(sub => {
        const user = userMap.get(sub.userId);
        const userName = user ? user.name : sub.userId;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(sub.id)}</td>
          <td>${escapeHtml(userName)}</td>
          <td>${escapeHtml(formatPlanLabel(sub.plan))}</td>
          <td>${statusPill(sub.status || 'pending')}</td>
          <td>${formatCurrency(sub.amount || 0)}</td>
          <td class="cell-muted">${formatDate(sub.createdAt)}</td>
        `;
        subsTbody.appendChild(tr);
      });
    }

    // ── FINANCES TAB ──
    const partnerSales = orders.reduce((sum, o) => sum + (Number.parseFloat(o.amount) || 0), 0);
    const platformCommissionRate = 0.10;
    const platformCommission = partnerSales * platformCommissionRate;
    const totalRevenue = revenue + platformCommission;
    setText('[data-fin-partner-sales]', formatCurrency(partnerSales));
    setText('[data-fin-platform-margin]', formatCurrency(platformMargin));
    setText('[data-fin-platform-commission]', formatCurrency(platformCommission));
    setText('[data-fin-total-revenue]', formatCurrency(totalRevenue));

    const dailyChartEl = document.querySelector('[data-fin-daily-chart]');
    if(dailyChartEl){
      const days = [];
      for(let i = 6; i >= 0; i--){
        const dayDate = new Date(now);
        dayDate.setDate(dayDate.getDate() - i);
        days.push(dayDate.toISOString().slice(0, 10));
      }
      const dailyRevenue = days.map(day => ({
        day,
        amount: orders.filter(o => (o.createdAt || '').startsWith(day)).reduce((sum, o) => sum + (Number.parseFloat(o.amount) || 0), 0)
      }));
      const maxDaily = Math.max(...dailyRevenue.map(d => d.amount), 1);
      dailyChartEl.innerHTML = dailyRevenue.map(d => {
        const pct = Math.round((d.amount / maxDaily) * 100);
        const label = escapeHtml(d.day.slice(5));
        const val = escapeHtml(formatCurrency(d.amount));
        return `<div class="chart-row"><span>${label}</span><span>${val}</span></div><div class="chart-bar"><span style="--value:${pct}%"></span></div>`;
      }).join('');
    }

    const monthlyChartEl = document.querySelector('[data-fin-monthly-chart]');
    if(monthlyChartEl){
      const months = [];
      for(let i = 5; i >= 0; i--){
        const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
        months.push(monthDate.toISOString().slice(0, 7));
      }
      const monthlyRevenue = months.map(m => ({
        month: m,
        amount: orders.filter(o => (o.createdAt || '').startsWith(m)).reduce((sum, o) => sum + (Number.parseFloat(o.amount) || 0), 0)
      }));
      const maxMonthly = Math.max(...monthlyRevenue.map(m => m.amount), 1);
      monthlyChartEl.innerHTML = monthlyRevenue.map(m => {
        const pct = Math.round((m.amount / maxMonthly) * 100);
        const label = escapeHtml(m.month.slice(5));
        const val = escapeHtml(formatCurrency(m.amount));
        return `<div class="chart-row"><span>${label}</span><span>${val}</span></div><div class="chart-bar"><span style="--value:${pct}%"></span></div>`;
      }).join('');
    }

    const marginByPlan = {basic: 0, pro: 0, elite: 0};
    activeSubscriptions.forEach(s => {
      const normalizedPlan = normalizePlan(s.plan);
      if(normalizedPlan && marginByPlan[normalizedPlan] !== undefined){
        const rate = PLAN_DEFAULT_MARGINS[normalizedPlan] / 100;
        const parsedAmount = Number.parseFloat(s.amount) || 0;
        marginByPlan[normalizedPlan] += parsedAmount * rate;
      }
    });
    const totalMargin = Object.values(marginByPlan).reduce((s, v) => s + v, 0) || 1;
    Object.entries(marginByPlan).forEach(([key, value]) => {
      const pct = Math.round((value / totalMargin) * 100);
      const bar = document.querySelector(`[data-fin-margin-bar="${key}"]`);
      const label = document.querySelector(`[data-fin-margin-value="${key}"]`);
      if(bar) bar.style.setProperty('--value', `${pct}%`);
      if(label) label.textContent = formatCurrency(value);
    });

    // ── REFERRALS TAB ──
    const totalReferred = referrals.reduce((s, r) => s + (r.referred || 0), 0);
    const totalActiveStores = referrals.reduce((s, r) => s + (r.activeStores || 0), 0);
    const totalCommission = referrals.reduce((s, r) => s + (r.commission || 0), 0);
    setText('[data-ref-total-referrers]', referrals.length);
    setText('[data-ref-total-referred]', totalReferred);
    setText('[data-ref-active-stores]', totalActiveStores);
    setText('[data-ref-commissions]', formatCurrency(totalCommission));

    const refTbody = document.querySelector('[data-ref-tbody]');
    if(refTbody){
      referrals.forEach(ref => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(ref.userName)}</strong></td>
          <td class="cell-mono">${escapeHtml(ref.refCode || '')}</td>
          <td>${ref.referred || 0}</td>
          <td>${ref.activeStores || 0}</td>
          <td>${formatCurrency(ref.commission || 0)}</td>
          <td>${statusPill(ref.status || 'active')}</td>
        `;
        refTbody.appendChild(tr);
      });
    }

    const ownerRefLink = document.querySelector('[data-owner-referral-link]');
    if(ownerRefLink){
      const baseUrl = window.location.origin + window.location.pathname.replace('owner-panel.html', 'index.html');
      ownerRefLink.value = `${baseUrl}?ref=OWNER2026`;
    }
    const copyRefBtn = document.querySelector('[data-copy-referral-link]');
    if(copyRefBtn && ownerRefLink){
      copyRefBtn.addEventListener('click', () => {
        const linkValue = ownerRefLink.value;
        if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
          navigator.clipboard.writeText(linkValue).then(() => {
            copyRefBtn.textContent = 'Skopiowano!';
            window.setTimeout(() => { copyRefBtn.textContent = 'Kopiuj link'; }, 2000);
          }).catch(() => {
            ownerRefLink.select();
            try { document.execCommand('copy'); } catch(_e){/* ignore */}
            copyRefBtn.textContent = 'Skopiowano!';
            window.setTimeout(() => { copyRefBtn.textContent = 'Kopiuj link'; }, 2000);
          });
        } else {
          ownerRefLink.select();
          try { document.execCommand('copy'); } catch(_e){/* ignore */}
          copyRefBtn.textContent = 'Skopiowano!';
          window.setTimeout(() => { copyRefBtn.textContent = 'Kopiuj link'; }, 2000);
        }
      });
    }

    // ── OPERATORS TAB ──
    const totalOpTasksOpen = operators.reduce((s, o) => s + (o.tasksOpen || 0), 0);
    const totalOpActionsToday = operators.reduce((s, o) => s + (o.activityToday || 0), 0);
    const activeOperators = operators.filter(o => o.status === 'active').length;
    setText('[data-op-active]', activeOperators);
    setText('[data-op-tasks-open]', totalOpTasksOpen);
    setText('[data-op-actions-today]', totalOpActionsToday);

    const operatorsTbody = document.querySelector('[data-operators-tbody]');
    if(operatorsTbody){
      operators.forEach(op => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(op.id)}</td>
          <td><strong>${escapeHtml(op.name)}</strong></td>
          <td>${escapeHtml(op.email)}</td>
          <td>${statusPill(op.status || 'inactive')}</td>
          <td>${op.tasksOpen || 0}</td>
          <td class="cell-muted">${formatDate(op.lastActive)}</td>
          <td>${op.partners || 0}</td>
        `;
        operatorsTbody.appendChild(tr);
      });
    }

    const opActivityList = document.querySelector('[data-op-activity-list]');
    renderList(opActivityList, adminLogs.filter(l => l.role === 'operator').slice(0, 5), log => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const name = document.createElement('strong');
      name.textContent = log.user;
      const action = document.createElement('span');
      action.className = 'hint';
      action.textContent = `${log.action} — ${log.object}`;
      const time = document.createElement('small');
      time.textContent = formatDate(log.time);
      card.append(name, action, time);
      return card;
    }, 'Brak działań operatorów.');

    // ── SECURITY TAB ──
    const adminLogsTbody = document.querySelector('[data-admin-logs-tbody]');
    if(adminLogsTbody){
      adminLogs.forEach(log => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-muted">${formatDate(log.time)}</td>
          <td>${escapeHtml(log.user)}</td>
          <td>${statusPill(log.role || 'client')}</td>
          <td>${escapeHtml(log.action)}</td>
          <td>${escapeHtml(log.object || '—')}</td>
          <td class="cell-muted">${escapeHtml(log.details || '—')}</td>
        `;
        adminLogsTbody.appendChild(tr);
      });
    }

    const opLogsList = document.querySelector('[data-op-logs-list]');
    renderList(opLogsList, adminLogs.slice(0, 5), log => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const name = document.createElement('strong');
      name.textContent = `${log.action} — ${log.object}`;
      const detail = document.createElement('span');
      detail.className = 'hint';
      detail.textContent = `${log.user} (${log.role})`;
      const time = document.createElement('small');
      time.textContent = formatDate(log.time);
      card.append(name, detail, time);
      return card;
    }, 'Brak logów.');

    // ── QUICK NAV TILES (overview) ──
    const quickNavBtns = document.querySelectorAll('[data-owner-tab-trigger]');
    quickNavBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.ownerTabTrigger;
        if(tabId){
          showTab(tabId);
        }
      });
    });

    // ── PARTNERS TAB ──
    const partnerUsers = users.filter(u => (u.role || '') === 'partner');
    const partnersTbody = document.querySelector('[data-partners-tbody]');
    const partnersSearch = document.querySelector('[data-partners-search]');
    const partnersPlanFilter = document.querySelector('[data-partners-plan-filter]');

    function renderPartnersTable(list){
      if(!partnersTbody){
        return;
      }
      partnersTbody.innerHTML = '';
      if(!list.length){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Brak partnerów.</td>';
        partnersTbody.appendChild(tr);
        return;
      }
      list.forEach(u => {
        const userStores = stores.filter(s => s.userId === u.id);
        const userSales = userStores.reduce((s, st) => s + (st.sales || 0), 0);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(u.id)}</td>
          <td><strong>${escapeHtml(u.name)}</strong></td>
          <td>${escapeHtml(u.email)}</td>
          <td>${statusPill(normalizePlan(u.plan) || 'basic')}</td>
          <td>${userStores.length}</td>
          <td>${formatCurrency(userSales)}</td>
          <td>${statusPill(u.status || 'active')}</td>
          <td class="cell-muted">${formatDate(u.createdAt)}</td>
        `;
        partnersTbody.appendChild(tr);
      });
    }
    renderPartnersTable(partnerUsers);

    function filterPartners(){
      const query = partnersSearch ? partnersSearch.value.trim().toLowerCase() : '';
      const plan = partnersPlanFilter ? partnersPlanFilter.value : '';
      let list = partnerUsers;
      if(query){
        list = list.filter(u => (u.name + u.email).toLowerCase().includes(query));
      }
      if(plan){
        list = list.filter(u => normalizePlan(u.plan) === plan);
      }
      renderPartnersTable(list);
    }
    if(partnersSearch){
      partnersSearch.addEventListener('input', filterPartners);
    }
    if(partnersPlanFilter){
      partnersPlanFilter.addEventListener('change', filterPartners);
    }

    // ── WAREHOUSES TAB ──
    const warehousesTbody = document.querySelector('[data-warehouses-tbody]');
    const warehousesSearch = document.querySelector('[data-warehouses-search]');

    function renderWarehousesTable(list){
      if(!warehousesTbody){
        return;
      }
      warehousesTbody.innerHTML = '';
      if(!list.length){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Brak hurtowni.</td>';
        warehousesTbody.appendChild(tr);
        return;
      }
      list.forEach(s => {
        const country = s.country || 'Globalnie';
        const prodCount = Array.isArray(s.products) ? s.products.length : (s.productCount || 0);
        const mode = s.mode === 'hurt' ? 'Hurtownia' : 'Dropshipping';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-mono">${escapeHtml(s.id)}</td>
          <td><strong>${escapeHtml(s.name)}</strong></td>
          <td>${escapeHtml(country)}</td>
          <td>${prodCount}</td>
          <td>${escapeHtml(mode)}</td>
          <td>${statusPill(s.status || 'active')}</td>
        `;
        warehousesTbody.appendChild(tr);
      });
    }
    renderWarehousesTable(suppliers);

    if(warehousesSearch){
      warehousesSearch.addEventListener('input', () => {
        const searchQuery = warehousesSearch.value.trim().toLowerCase();
        renderWarehousesTable(searchQuery ? suppliers.filter(supplier => (supplier.name + (supplier.country || '')).toLowerCase().includes(searchQuery)) : suppliers);
      });
    }

    // ── SUPPLIER APPS TAB ──
    const supplierApps = getStoredList(OWNER_STORAGE_KEYS.supplierApps) || [];
    const pendingApps = supplierApps.filter(a => a.status === 'pending');
    const acceptedApps = supplierApps.filter(a => a.status === 'accepted');
    setText('[data-supplier-apps-total]', supplierApps.length);
    setText('[data-supplier-apps-pending]', pendingApps.length);
    setText('[data-supplier-apps-accepted]', acceptedApps.length);

    const supplierAppsTbody = document.querySelector('[data-supplier-apps-tbody]');
    const supplierAppsSearch = document.querySelector('[data-supplier-apps-search]');
    const supplierAppsStatusFilter = document.querySelector('[data-supplier-apps-status-filter]');

    function renderSupplierAppsTable(list){
      if(!supplierAppsTbody){
        return;
      }
      supplierAppsTbody.innerHTML = '';
      if(!list.length){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="9" style="text-align:center;color:var(--muted);padding:24px">Brak zgłoszeń dostawców. <a href="zostan-dostawca.html" style="color:var(--accent-cyan,#35d9ff)">Strona formularzowa</a></td>';
        supplierAppsTbody.appendChild(tr);
        return;
      }
      list.forEach((app, idx) => {
        const dropshipLabel = [
          app.dropshipping ? 'Dropshipping' : '',
          app.wholesale ? 'Hurt' : '',
          app.whitelabel ? 'White-label' : '',
          app.api ? 'API' : ''
        ].filter(Boolean).join(', ') || '—';
        const pillMap = {pending: 'pill-pending', accepted: 'pill-accepted', rejected: 'pill-rejected'};
        const pill = `<span class="${pillMap[app.status] || 'pill-pending'}">${app.status === 'accepted' ? 'Zaakceptowane' : app.status === 'rejected' ? 'Odrzucone' : 'Oczekujące'}</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-muted">${formatDate(app.submittedAt)}</td>
          <td><strong>${escapeHtml(app.companyName)}</strong></td>
          <td>${escapeHtml(app.email)}</td>
          <td>${escapeHtml(app.phone)}</td>
          <td>${escapeHtml(app.country)}</td>
          <td>${escapeHtml(app.productTypes)}</td>
          <td>${escapeHtml(dropshipLabel)}</td>
          <td>${pill}</td>
          <td class="cell-mono">
            ${app.status === 'pending' ? `<button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" data-accept-app="${idx}">Akceptuj</button> <button class="btn" style="font-size:12px;padding:4px 10px;background:rgba(255,79,79,.15);border-color:rgba(255,79,79,.4);color:#ffd5d5" data-reject-app="${idx}">Odrzuć</button>` : '—'}
          </td>
        `;
        supplierAppsTbody.appendChild(tr);
      });
    }
    renderSupplierAppsTable(supplierApps);

    function filterSupplierApps(){
      const searchQuery = supplierAppsSearch ? supplierAppsSearch.value.trim().toLowerCase() : '';
      const statusFilter = supplierAppsStatusFilter ? supplierAppsStatusFilter.value : '';
      let list = supplierApps;
      if(searchQuery){
        list = list.filter(supplierApp => (supplierApp.companyName + supplierApp.email).toLowerCase().includes(searchQuery));
      }
      if(statusFilter){
        list = list.filter(supplierApp => supplierApp.status === statusFilter);
      }
      renderSupplierAppsTable(list);
    }
    if(supplierAppsSearch){
      supplierAppsSearch.addEventListener('input', filterSupplierApps);
    }
    if(supplierAppsStatusFilter){
      supplierAppsStatusFilter.addEventListener('change', filterSupplierApps);
    }
    if(supplierAppsTbody){
      supplierAppsTbody.addEventListener('click', event => {
        const acceptBtn = event.target.closest('[data-accept-app]');
        const rejectBtn = event.target.closest('[data-reject-app]');
        if(acceptBtn){
          const idx = Number(acceptBtn.dataset.acceptApp);
          if(!Number.isNaN(idx) && supplierApps[idx]){
            supplierApps[idx].status = 'accepted';
            saveStoredList(OWNER_STORAGE_KEYS.supplierApps, supplierApps);
            filterSupplierApps();
            setText('[data-supplier-apps-pending]', supplierApps.filter(a => a.status === 'pending').length);
            setText('[data-supplier-apps-accepted]', supplierApps.filter(a => a.status === 'accepted').length);
          }
        }
        if(rejectBtn){
          const idx = Number(rejectBtn.dataset.rejectApp);
          if(!Number.isNaN(idx) && supplierApps[idx]){
            supplierApps[idx].status = 'rejected';
            saveStoredList(OWNER_STORAGE_KEYS.supplierApps, supplierApps);
            filterSupplierApps();
            setText('[data-supplier-apps-pending]', supplierApps.filter(a => a.status === 'pending').length);
          }
        }
      });
    }

    // ── RANKING TAB ──
    const rankingTbody = document.querySelector('[data-ranking-tbody]');
    if(rankingTbody){
      const rankData = users
        .filter(u => (u.role || '') === 'partner' || (u.sales || 0) > 0)
        .map(u => {
          const userStores = stores.filter(s => s.userId === u.id);
          const totalOrders = userStores.reduce((s, st) => s + (st.orders || 0), 0);
          const totalSales = userStores.reduce((s, st) => s + (st.sales || 0), 0);
          const commission = Math.round(totalSales * PLATFORM_MARGIN_PCT / 100);
          return {...u, totalOrders, totalSales, commission, storeNames: userStores.map(s => s.name).join(', ')};
        })
        .sort((a, b) => b.totalSales - a.totalSales);

      if(!rankData.length){
        rankingTbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Brak danych rankingowych.</td></tr>';
      } else {
        rankData.forEach((u, i) => {
          const pos = i + 1;
          const medalClass = pos <= 3 ? `rank-medal rank-${pos}` : '';
          const medal = medalClass ? `<span class="${medalClass}">${pos}</span>` : pos;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td style="text-align:center">${medal}</td>
            <td><strong>${escapeHtml(u.name)}</strong><br><small class="cell-muted">${escapeHtml(u.email)}</small></td>
            <td>${escapeHtml(u.storeNames || '—')}</td>
            <td>${statusPill(normalizePlan(u.plan) || 'basic')}</td>
            <td>${u.totalOrders}</td>
            <td>${formatCurrency(u.totalSales)}</td>
            <td>${formatCurrency(u.commission)}</td>
            <td>${statusPill(u.status || 'active')}</td>
          `;
          rankingTbody.appendChild(tr);
        });
      }
    }

    // ── REPORTS TAB ──
    const reportTotalRevenue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const reportPlatformMargin = Math.round(reportTotalRevenue * PLATFORM_MARGIN_PCT / 100);
    const reportActivePartners = users.filter(u => (u.role || '') === 'partner' && u.status === 'active').length;
    setText('[data-report-total-revenue]', formatCurrency(reportTotalRevenue));
    setText('[data-report-platform-margin]', formatCurrency(reportPlatformMargin));
    setText('[data-report-total-orders]', orders.length);
    setText('[data-report-active-partners]', reportActivePartners);

    // Subscription revenue by plan
    const reportSubRevenue = {basic: 0, pro: 0, elite: 0};
    const reportSubCounts = {basic: 0, pro: 0, elite: 0};
    subscriptions.forEach(sub => {
      const plan = normalizePlan(sub.plan);
      if(plan && reportSubRevenue[plan] !== undefined){
        reportSubRevenue[plan] += (sub.amount || 0);
        reportSubCounts[plan] += 1;
      }
    });
    const reportSubTotal = Object.values(reportSubRevenue).reduce((s, v) => s + v, 0) || 1;
    ['basic', 'pro', 'elite'].forEach(p => {
      setText(`[data-report-sub-${p}]`, `${formatCurrency(reportSubRevenue[p])} (${reportSubCounts[p]} sub.)`);
      const bar = document.querySelector(`[data-report-sub-${p}-bar]`);
      if(bar){
        bar.style.width = `${Math.round(reportSubRevenue[p] / reportSubTotal * 100)}%`;
        bar.style.background = p === 'elite' ? '#9e77ff' : p === 'pro' ? '#35d9ff' : '#54ffb0';
        bar.style.display = 'block';
        bar.style.height = '8px';
        bar.style.borderRadius = '4px';
      }
    });

    // Export buttons
    document.querySelectorAll('[data-export-report]').forEach(btn => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.exportReport;
        let rows, headers;
        if(type === 'orders'){
          headers = ['ID', 'Użytkownik', 'Sklep', 'Produkt', 'Kwota', 'Data', 'Status'];
          rows = orders.map(o => [o.id, o.userName || '', o.storeName || '', o.product || '', o.total || 0, o.date || '', o.status || '']);
        } else if(type === 'users'){
          headers = ['ID', 'Imię', 'Email', 'Rola', 'Plan', 'Status', 'Kraj', 'Data'];
          rows = users.map(u => [u.id, u.name, u.email, u.role || '', u.plan || '', u.status || '', u.country || '', u.createdAt || '']);
        } else {
          headers = ['Typ', 'Kwota', 'Basic', 'Pro', 'Elite'];
          rows = [['Subskrypcje', reportSubTotal, reportSubRevenue.basic, reportSubRevenue.pro, reportSubRevenue.elite],
                  ['Przychód platformy', reportTotalRevenue, reportPlatformMargin, '', '']];
        }
        const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csv], {type: 'text/csv;charset=utf-8;'});
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = `${type}_raport_${new Date().toISOString().slice(0, 10)}.csv`;
        downloadLink.click();
        URL.revokeObjectURL(url);
      });
    });

    // ── PAYMENTS TAB ──
    const paymentRows = subscriptions.map(sub => ({
      date: sub.createdAt || sub.date || '',
      user: sub.userName || sub.user || '',
      plan: normalizePlan(sub.plan) || 'basic',
      amount: sub.amount || 0,
      type: 'Subskrypcja',
      status: sub.status || 'paid'
    }));
    const totalPayments = paymentRows.reduce((sum, payment) => sum + payment.amount, 0);
    const pendingPayments = paymentRows.filter(payment => payment.status === 'pending').reduce((sum, payment) => sum + payment.amount, 0);
    const overduePayments = paymentRows.filter(payment => payment.status === 'overdue').reduce((sum, payment) => sum + payment.amount, 0);
    setText('[data-payments-total]', formatCurrency(totalPayments));
    setText('[data-payments-pending]', formatCurrency(pendingPayments));
    setText('[data-payments-overdue]', formatCurrency(overduePayments));

    const paymentsTbody = document.querySelector('[data-payments-tbody]');
    const paymentsSearch = document.querySelector('[data-payments-search]');
    const paymentsStatusFilter = document.querySelector('[data-payments-status-filter]');

    function renderPaymentsTable(list){
      if(!paymentsTbody){
        return;
      }
      paymentsTbody.innerHTML = '';
      if(!list.length){
        const tr = document.createElement('tr');
        tr.innerHTML = '<td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Brak płatności.</td>';
        paymentsTbody.appendChild(tr);
        return;
      }
      list.forEach(payment => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="cell-muted">${formatDate(payment.date)}</td>
          <td>${escapeHtml(payment.user)}</td>
          <td>${statusPill(payment.plan)}</td>
          <td><strong>${formatCurrency(payment.amount)}</strong></td>
          <td>${escapeHtml(payment.type)}</td>
          <td>${statusPill(payment.status)}</td>
        `;
        paymentsTbody.appendChild(tr);
      });
    }
    renderPaymentsTable(paymentRows);

    function filterPayments(){
      const searchQuery = paymentsSearch ? paymentsSearch.value.trim().toLowerCase() : '';
      const statusFilter = paymentsStatusFilter ? paymentsStatusFilter.value : '';
      let list = paymentRows;
      if(searchQuery){
        list = list.filter(payment => payment.user.toLowerCase().includes(searchQuery));
      }
      if(statusFilter){
        list = list.filter(payment => payment.status === statusFilter);
      }
      renderPaymentsTable(list);
    }
    if(paymentsSearch){
      paymentsSearch.addEventListener('input', filterPayments);
    }
    if(paymentsStatusFilter){
      paymentsStatusFilter.addEventListener('change', filterPayments);
    }

    // ── SETTINGS TAB ──
    const settingsForm = document.querySelector('[data-platform-settings-form]');
    const settingsSaved = document.querySelector('[data-settings-saved]');
    const PLATFORM_SETTINGS_KEY = 'qm_platform_settings';
    if(settingsForm){
      // Load saved settings
      try {
        const saved = JSON.parse(localStorage.getItem(PLATFORM_SETTINGS_KEY) || '{}');
        Object.entries(saved).forEach(([k, v]) => {
          const el = settingsForm.elements[k];
          if(el){
            el.value = v;
          }
        });
      } catch(_e){/* ignore */}
      settingsForm.addEventListener('submit', event => {
        event.preventDefault();
        const formData = new FormData(settingsForm);
        const settings = {};
        formData.forEach((v, k) => { settings[k] = v; });
        localStorage.setItem(PLATFORM_SETTINGS_KEY, JSON.stringify(settings));
        if(settingsSaved){
          settingsSaved.hidden = false;
          window.setTimeout(() => { settingsSaved.hidden = true; }, 2500);
        }
        // Log the change
        const logsForSave = getStoredList(OWNER_STORAGE_KEYS.adminLogs);
        logsForSave.unshift({
          id: `log_settings_${Date.now()}`,
          time: new Date().toISOString(),
          user: 'Superadmin',
          role: 'superadmin',
          action: 'Zmiana ustawień platformy',
          object: 'settings',
          details: `Zaktualizowano ${Object.keys(settings).length} parametrów`
        });
        saveStoredList(OWNER_STORAGE_KEYS.adminLogs, logsForSave);
      });
    }

    // ── PLATFORM MARGIN TIERS ──
    const MARGIN_TIERS_KEY = 'qm_platform_margin_tiers';
    const DEFAULT_TIERS = [
      { threshold_max: 20,   margin_percent: 60 },
      { threshold_max: 100,  margin_percent: 40 },
      { threshold_max: 300,  margin_percent: 25 },
      { threshold_max: null, margin_percent: 15 },
    ];
    const tiersTbody  = document.querySelector('[data-margin-tiers-tbody]');
    const tiersAddBtn = document.querySelector('[data-margin-tier-add]');
    const tiersSaveBtn = document.querySelector('[data-margin-tiers-save]');
    const tiersSavedMsg = document.querySelector('[data-margin-tiers-saved]');

    function buildTierRow(tier) {
      const tr = document.createElement('tr');
      const maxNum = tier.threshold_max != null ? parseFloat(tier.threshold_max) : null;
      const marginNum = parseFloat(tier.margin_percent) || 0;

      const maxInput = document.createElement('input');
      maxInput.className = 'owner-input';
      maxInput.type = 'number';
      maxInput.min = '0';
      maxInput.step = '0.01';
      maxInput.placeholder = '(brak limitu)';
      maxInput.style.width = '100%';
      maxInput.setAttribute('data-tier-max', '');
      if (maxNum !== null) maxInput.value = maxNum;

      const marginInput = document.createElement('input');
      marginInput.className = 'owner-input';
      marginInput.type = 'number';
      marginInput.min = '0';
      marginInput.max = '999';
      marginInput.step = '0.1';
      marginInput.style.width = '100%';
      marginInput.setAttribute('data-tier-margin', '');
      marginInput.value = marginNum;

      const removeBtn = document.createElement('button');
      removeBtn.className = 'btn btn-secondary';
      removeBtn.type = 'button';
      removeBtn.setAttribute('data-tier-remove', '');
      removeBtn.style.padding = '4px 10px';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', () => tr.remove());

      const tdMax = document.createElement('td');
      tdMax.appendChild(maxInput);
      const tdMargin = document.createElement('td');
      tdMargin.appendChild(marginInput);
      const tdAction = document.createElement('td');
      tdAction.appendChild(removeBtn);

      tr.append(tdMax, tdMargin, tdAction);
      return tr;
    }

    function readTiersFromTable() {
      if (!tiersTbody) return [];
      return Array.from(tiersTbody.querySelectorAll('tr')).map(tr => {
        const maxRaw = tr.querySelector('[data-tier-max]').value.trim();
        const marginRaw = tr.querySelector('[data-tier-margin]').value.trim();
        const marginVal = parseFloat(marginRaw);
        return {
          threshold_max:   maxRaw === '' ? null : parseFloat(maxRaw),
          margin_percent:  isNaN(marginVal) ? 0 : marginVal,
        };
      });
    }

    function renderTiersTable(tiers) {
      if (!tiersTbody) return;
      tiersTbody.innerHTML = '';
      tiers.forEach(tier => tiersTbody.appendChild(buildTierRow(tier)));
    }

    if (tiersTbody) {
      // Try loading from backend; fall back to localStorage, then defaults
      const api = window.QMApi;
      if (api && api.Admin && api.Admin.platformMargins && typeof api.Admin.platformMargins === 'function') {
        api.Admin.platformMargins()
          .then(data => {
            const tiers = (data && data.tiers && data.tiers.length)
              ? data.tiers
              : JSON.parse(localStorage.getItem(MARGIN_TIERS_KEY) || 'null') || DEFAULT_TIERS;
            renderTiersTable(tiers);
          })
          .catch(() => {
            const tiers = JSON.parse(localStorage.getItem(MARGIN_TIERS_KEY) || 'null') || DEFAULT_TIERS;
            renderTiersTable(tiers);
          });
      } else {
        const tiers = JSON.parse(localStorage.getItem(MARGIN_TIERS_KEY) || 'null') || DEFAULT_TIERS;
        renderTiersTable(tiers);
      }
    }

    if (tiersAddBtn) {
      tiersAddBtn.addEventListener('click', () => {
        if (tiersTbody) {
          tiersTbody.appendChild(buildTierRow({ threshold_max: null, margin_percent: 0 }));
        }
      });
    }

    if (tiersSaveBtn) {
      tiersSaveBtn.addEventListener('click', () => {
        const tiers = readTiersFromTable();
        localStorage.setItem(MARGIN_TIERS_KEY, JSON.stringify(tiers));
        const api = window.QMApi;
        const saveFinish = (ok) => {
          if (tiersSavedMsg) {
            tiersSavedMsg.textContent = ok ? '✅ Zapisano!' : '⚠️ Zapisano lokalnie (brak połączenia z API).';
            tiersSavedMsg.hidden = false;
            window.setTimeout(() => { tiersSavedMsg.hidden = true; }, 2500);
          }
        };
        if (api && api.Admin && api.Admin.updatePlatformMargins && typeof api.Admin.updatePlatformMargins === 'function') {
          api.Admin.updatePlatformMargins({ tiers })
            .then(() => saveFinish(true))
            .catch(() => saveFinish(false));
        } else {
          saveFinish(false);
        }
      });
    }

    // ── SCRIPTS TAB ──
    const scriptRunBtns = document.querySelectorAll('[data-script-run]');
    const scriptResultEl = document.querySelector('[data-script-result]');
    const SCRIPT_LOG_KEY = 'qm_scripts_log';

    function getScriptLog(){ try { return JSON.parse(localStorage.getItem(SCRIPT_LOG_KEY) || '[]'); } catch(_e){ return []; } }
    function saveScriptLog(log){ localStorage.setItem(SCRIPT_LOG_KEY, JSON.stringify(log.slice(0, 50))); }

    function renderScriptsLog(){
      const list = document.querySelector('[data-scripts-log-list]');
      if(!list) return;
      const log = getScriptLog();
      if(!log.length){ list.innerHTML = '<p class="hint">Brak historii uruchomień.</p>'; return; }
      list.innerHTML = '';
      log.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'list-card';
        const isOk = entry.ok === true;
        card.innerHTML = `<strong>${escapeHtml(entry.name)}</strong> <span class="hint">${escapeHtml(entry.time)}</span> <span class="status-pill ${isOk ? 'is-ready' : 'is-error'}">${isOk ? 'OK' : 'Błąd'}</span>`;
        list.appendChild(card);
      });
    }

    if(scriptRunBtns.length){
      renderScriptsLog();
      scriptRunBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const scriptId = btn.dataset.scriptRun;
          const scriptNames = {
            'warehouse-sync': 'Synchronizacja hurtowni',
            'recalculate-prices': 'Przeliczenie cen',
            'csv-import': 'Import produktów CSV',
            'cleanup-accounts': 'Czyszczenie nieaktywnych kont',
            'export-report': 'Eksport raportów finansowych'
          };
          const name = scriptNames[scriptId] || scriptId;
          btn.disabled = true;
          btn.textContent = '⏳ Uruchamianie…';
          window.setTimeout(() => {
            const log = getScriptLog();
            log.unshift({ name, time: new Date().toLocaleString('pl-PL'), ok: true });
            saveScriptLog(log);
            btn.disabled = false;
            btn.textContent = '▶ Uruchom';
            if(scriptResultEl){ scriptResultEl.textContent = `✅ Skrypt "${name}" wykonany.`; }
            renderScriptsLog();
          }, 1200);
        });
      });
    }
  }

  function initOperatorPanel(){
    if(document.body.dataset.page !== 'operator-panel'){
      return;
    }
    const logged = isAppLoggedIn();
    if(!logged){
      window.location.replace('login.html');
      return;
    }
    const role = getStoredUserRole();
    const hasAccess = role === 'owner' || role === 'superadmin' || role === 'operator';
    const lockedPanel = document.querySelector('[data-operator-locked]');
    const content = document.querySelector('[data-operator-content]');
    if(!hasAccess){
      if(lockedPanel) lockedPanel.hidden = false;
      if(content) content.hidden = true;
      return;
    }
    if(lockedPanel) lockedPanel.hidden = true;
    if(content) content.hidden = false;

    const tabNav = document.querySelector('[data-operator-tab-nav]');
    const tabPanels = document.querySelectorAll('[data-operator-tab-panel]');
    function showTab(tabId){
      tabPanels.forEach(panel => {
        panel.hidden = panel.dataset.operatorTabPanel !== tabId;
      });
      if(tabNav){
        tabNav.querySelectorAll('[data-operator-tab]').forEach(link => {
          link.classList.toggle('active', link.dataset.operatorTab === tabId);
        });
      }
    }
    if(tabNav){
      tabNav.addEventListener('click', event => {
        const link = event.target.closest('[data-operator-tab]');
        if(!link) return;
        event.preventDefault();
        showTab(link.dataset.operatorTab);
      });
    }
    document.querySelectorAll('[data-operator-tab-trigger]').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.dataset.operatorTabTrigger;
        if(tabId) showTab(tabId);
      });
    });
    showTab('overview');

    const data = ensureFinalStorage();
    const users = data.users || [];
    const stores = data.stores || [];
    const products = data.products || [];
    const orders = data.orders || [];
    const suppliers = data.suppliers || [];

    const setTxt = (sel, val) => { const el = document.querySelector(sel); if(el) el.textContent = val; };
    setTxt('[data-op-users]', users.length);
    setTxt('[data-op-stores]', stores.length);
    setTxt('[data-op-products]', products.length);
    setTxt('[data-op-orders]', orders.length);
    setTxt('[data-operator-partners-count]', users.filter(u => u.role === 'partner').length);
    setTxt('[data-operator-tasks-count]', 0);
    setTxt('[data-operator-role]', role === 'superadmin' ? 'Superadmin' : 'Operator');

    function renderEmptyRow(colspan, msg){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="${colspan}" style="text-align:center;color:var(--muted);padding:24px">${escapeHtml(msg)}</td>`;
      return tr;
    }

    const opUsersTbody = document.querySelector('[data-op-users-tbody]');
    if(opUsersTbody){
      opUsersTbody.innerHTML = '';
      if(!users.length){
        opUsersTbody.appendChild(renderEmptyRow(7, 'Brak użytkowników.'));
      } else {
        users.forEach(u => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td class="cell-mono">${escapeHtml(u.id)}</td><td><strong>${escapeHtml(u.name)}</strong></td><td>${escapeHtml(u.email)}</td><td>${statusPill(u.role || 'client')}</td><td>${statusPill(normalizePlan(u.plan) || 'trial')}</td><td>${statusPill(u.status || 'active')}</td><td class="cell-muted">${escapeHtml(u.createdAt || '—')}</td>`;
          opUsersTbody.appendChild(tr);
        });
      }
    }

    const opStoresTbody = document.querySelector('[data-op-stores-tbody]');
    if(opStoresTbody){
      opStoresTbody.innerHTML = '';
      if(!stores.length){
        opStoresTbody.appendChild(renderEmptyRow(8, 'Brak sklepów.'));
      } else {
        stores.forEach(s => {
          const owner = users.find(u => u.id === s.userId);
          const tr = document.createElement('tr');
          tr.innerHTML = `<td class="cell-mono">${escapeHtml(s.id)}</td><td><strong>${escapeHtml(s.name)}</strong></td><td>${escapeHtml(owner ? owner.name : '—')}</td><td>${statusPill(normalizePlan(s.plan) || 'trial')}</td><td>${s.products || 0}</td><td>${s.orders || 0}</td><td>${statusPill(s.status || 'active')}</td><td><button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" type="button">Szczegóły</button></td>`;
          opStoresTbody.appendChild(tr);
        });
      }
    }

    const opProductsTbody = document.querySelector('[data-op-products-tbody]');
    if(opProductsTbody){
      opProductsTbody.innerHTML = '';
      if(!products.length){
        opProductsTbody.appendChild(renderEmptyRow(7, 'Brak produktów.'));
      } else {
        products.slice(0, 50).forEach(p => {
          const tr = document.createElement('tr');
          const price = typeof p.price === 'number' ? p.price.toFixed(2) + ' zł' : (p.price || '—');
          tr.innerHTML = `<td class="cell-mono">${escapeHtml(p.id || '—')}</td><td><strong>${escapeHtml(p.name || '—')}</strong></td><td class="cell-mono">${escapeHtml(p.sku || '—')}</td><td>${escapeHtml(price)}</td><td>${escapeHtml(p.supplier || '—')}</td><td>${statusPill(p.status || 'active')}</td><td><button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" type="button">Podgląd</button></td>`;
          opProductsTbody.appendChild(tr);
        });
      }
      // Async: replace with live API data when available
      (function(){
        const api = window.QMApi;
        if(!api || !api.Admin || !api.Auth || !api.Auth.isLoggedIn || !api.Auth.isLoggedIn()) return;
        api.Admin.products({ limit: 50, page: 1 }).then(function(resp){
          const rows = (resp && resp.products) ? resp.products : [];
          if(!rows.length) return;
          opProductsTbody.innerHTML = '';
          rows.forEach(function(p){
            const tr = document.createElement('tr');
            const price = p.platform_price ? parseFloat(p.platform_price).toFixed(2) + ' zł' : (p.price_gross ? parseFloat(p.price_gross).toFixed(2) + ' zł' : '—');
            tr.innerHTML = `<td class="cell-mono">${escapeHtml(p.id || '—')}</td><td><strong>${escapeHtml(p.name || '—')}</strong></td><td class="cell-mono">${escapeHtml(p.sku || '—')}</td><td>${escapeHtml(price)}</td><td>${escapeHtml(p.supplier_name || '—')}</td><td>${statusPill(p.status || 'active')}</td><td><button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" type="button">Podgląd</button></td>`;
            opProductsTbody.appendChild(tr);
          });
          setTxt('[data-op-products]', (resp.total || rows.length).toString());
        }).catch(function(){});
      })();
    }

    const opOrdersTbody = document.querySelector('[data-op-orders-tbody]');
    if(opOrdersTbody){
      opOrdersTbody.innerHTML = '';
      if(!orders.length){
        opOrdersTbody.appendChild(renderEmptyRow(7, 'Brak zamówień.'));
      } else {
        orders.slice(0, 50).forEach(o => {
          const store = stores.find(s => s.id === o.storeId);
          const tr = document.createElement('tr');
          const amount = typeof o.total === 'number' ? o.total.toFixed(2) + ' zł' : (o.total || '—');
          tr.innerHTML = `<td class="cell-mono">${escapeHtml(o.id || '—')}</td><td>${escapeHtml(o.customerName || '—')}</td><td>${escapeHtml(store ? store.name : '—')}</td><td>${escapeHtml(amount)}</td><td>${statusPill(o.status || 'pending')}</td><td class="cell-muted">${escapeHtml(o.createdAt || '—')}</td><td><button class="btn btn-secondary" style="font-size:12px;padding:4px 10px" type="button">Szczegóły</button></td>`;
          opOrdersTbody.appendChild(tr);
        });
      }
    }

    const opWarehousesTbody = document.querySelector('[data-op-warehouses-tbody]');
    if(opWarehousesTbody){
      opWarehousesTbody.innerHTML = '';
      if(!suppliers.length){
        opWarehousesTbody.appendChild(renderEmptyRow(7, 'Brak hurtowni.'));
      } else {
        suppliers.forEach(s => {
          const tr = document.createElement('tr');
          tr.innerHTML = `<td class="cell-mono">${escapeHtml(s.id || '—')}</td><td><strong>${escapeHtml(s.name || '—')}</strong></td><td>${escapeHtml(s.country || '—')}</td><td>${s.products || 0}</td><td>${escapeHtml(s.type || 'API')}</td><td>${statusPill(s.status || 'active')}</td><td><a class="btn btn-secondary" style="font-size:12px;padding:4px 10px" href="hurtownie.html">Szczegóły</a></td>`;
          opWarehousesTbody.appendChild(tr);
        });
      }
      // Async: replace with live API data when available
      (function(){
        const api = window.QMApi;
        if(!api || !api.Admin || !api.Auth || !api.Auth.isLoggedIn || !api.Auth.isLoggedIn()) return;
        api.Admin.suppliers({ limit: 50 }).then(function(resp){
          const rows = (resp && resp.suppliers) ? resp.suppliers : (Array.isArray(resp) ? resp : []);
          if(!rows.length) return;
          opWarehousesTbody.innerHTML = '';
          rows.forEach(function(s){
            const tr = document.createElement('tr');
            const productCount = s.product_count || 0;
            tr.innerHTML = `<td class="cell-mono">${escapeHtml(s.id || '—')}</td><td><strong>${escapeHtml(s.name || '—')}</strong></td><td>—</td><td>${escapeHtml(String(productCount))}</td><td>${escapeHtml(s.integration_type || 'API')}</td><td>${statusPill(s.status || 'active')}</td><td><a class="btn btn-secondary" style="font-size:12px;padding:4px 10px" href="hurtownie.html">Szczegóły</a></td>`;
            opWarehousesTbody.appendChild(tr);
          });
        }).catch(function(){});
      })();
    }
  }

  function initScriptsTab(){
    if(document.body.dataset.page !== 'owner-panel'){
      return;
    }
    document.querySelectorAll('[data-run-script]').forEach(btn => {
      btn.addEventListener('click', () => {
        const scriptId = btn.dataset.runScript;
        const now = new Date().toLocaleString('pl-PL');
        const timeEl = document.querySelector(`[data-script-run-time="${scriptId}"]`);
        const statusEl = document.querySelector(`[data-script-status="${scriptId}"]`);
        if(timeEl) timeEl.textContent = now;
        if(statusEl){
          statusEl.className = 'pill-trial';
          statusEl.textContent = 'Uruchamianie…';
        }
        btn.disabled = true;
        btn.textContent = '⏳ Działanie…';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = '▶ Uruchom';
          if(statusEl){
            statusEl.className = 'pill-active';
            statusEl.textContent = 'Aktywny';
          }
          const logTbody = document.querySelector('[data-scripts-log-tbody]');
          if(logTbody){
            const scriptNames = {
              'sync-warehouses': 'Synchronizacja hurtowni',
              'import-products': 'Import produktów CSV/XML',
              'recalc-prices': 'Przeliczenie cen i marż',
              'cleanup-subscriptions': 'Czyszczenie wygasłych subskrypcji',
              'gen-reports': 'Generowanie raportów miesięcznych',
              'send-notifications': 'Wysyłka powiadomień e-mail',
              'db-backup': 'Backup bazy danych'
            };
            const tr = document.createElement('tr');
            tr.innerHTML = `<td class="cell-muted">${escapeHtml(now)}</td><td><strong>${escapeHtml(scriptNames[scriptId] || scriptId)}</strong></td><td class="cell-muted">~2s</td><td><span class="pill-active">Sukces</span></td><td class="cell-muted">Zakończono pomyślnie.</td>`;
            const emptyRow = logTbody.querySelector('td[colspan]');
            if(emptyRow) emptyRow.closest('tr').remove();
            logTbody.insertBefore(tr, logTbody.firstChild);
          }
        }, 1800);
      });
    });

    const systemModeSave = document.querySelector('[data-system-mode-save]');
    if(systemModeSave){
      systemModeSave.addEventListener('click', () => {
        const modeSelect = document.querySelector('[data-system-mode-select]');
        const savedMsg = document.querySelector('[data-system-mode-saved]');
        if(modeSelect){
          localStorage.setItem('qm_system_mode', modeSelect.value);
        }
        if(savedMsg){
          savedMsg.hidden = false;
          setTimeout(() => { savedMsg.hidden = true; }, 3000);
        }
      });
    }
    const savedMode = localStorage.getItem('qm_system_mode');
    if(savedMode){
      const modeSelect = document.querySelector('[data-system-mode-select]');
      if(modeSelect) modeSelect.value = savedMode;
    }
    const scriptCount = document.querySelectorAll('[data-run-script]').length;
    const totalEl = document.querySelector('[data-scripts-total]');
    if(totalEl) totalEl.textContent = scriptCount;
  }

  function initSuppliersModule(){
    if(document.body.dataset.page !== 'hurtownie'){
      return;
    }
    const data = ensureOwnerDemoData();
    const suppliers = data.suppliers;
    const suppliersGrid = document.querySelector('[data-suppliers-grid]');
    const suppliersEmpty = document.querySelector('[data-suppliers-empty]');
    const productsGrid = document.querySelector('[data-products-grid]');
    const productsEmpty = document.querySelector('[data-products-empty]');
    if(!suppliersGrid || !productsGrid){
      return;
    }

    const supplierName = document.querySelector('[data-selected-supplier-name]');
    const supplierDesc = document.querySelector('[data-selected-supplier-desc]');
    const searchInput = document.querySelector('[data-product-search]');
    const categorySelect = document.querySelector('[data-product-category]');
    const bulkMarginInput = document.querySelector('[data-bulk-margin]');
    const importButton = document.querySelector('[data-import-store]');
    const importStatus = document.querySelector('[data-import-status]');
    const calculator = document.querySelector('[data-calculator]');
    const calculatorCost = calculator ? calculator.querySelector('[data-calculator-cost]') : null;
    const calculatorMargin = calculator ? calculator.querySelector('[data-calculator-margin]') : null;
    const calculatorFinal = calculator ? calculator.querySelector('[data-calculator-final]') : null;
    const calculatorProfit = calculator ? calculator.querySelector('[data-calculator-profit]') : null;
    const calculatorDesc = calculator ? calculator.querySelector('[data-calculator-desc]') : null;
    const calculatorAdd = calculator ? calculator.querySelector('[data-calculator-add]') : null;
    const suppliersCount = document.querySelector('[data-suppliers-count]');
    const productsCount = document.querySelector('[data-products-count]');
    const averageCost = document.querySelector('[data-average-cost]');
    const importsToday = document.querySelector('[data-imports-today]');

    const allProducts = suppliers.flatMap(supplier => supplier.products || []);
    const totalCost = allProducts.reduce((sum, product) => sum + resolveCostAndPrice(product).cost, 0);
    const avgCost = allProducts.length ? Math.round(totalCost / allProducts.length) : 0;
    const activeStore = getActiveStore(ensureStoresList());
    const storeSettings = loadStoreSettings();
    let storeMargin = resolveStoreMargin({store: activeStore, settings: storeSettings, plan: activeStore && activeStore.plan});
    const storeImportCount = activeStore && Array.isArray(activeStore.products) ? activeStore.products.length : 0;
    const currentPlan = normalizePlan(
      (activeStore && activeStore.plan)
      || (storeSettings && (storeSettings.plan || storeSettings.suggestedPlan))
      || getCurrentPlan()
    );
    const currentPlanLevel = getPlanLevel(currentPlan);

    if(suppliersCount){
      suppliersCount.dataset.counter = `${suppliers.length}`;
    }
    if(productsCount){
      productsCount.dataset.counter = `${allProducts.length}`;
    }
    if(averageCost){
      averageCost.dataset.counter = `${avgCost}`;
      averageCost.dataset.counterFormat = 'currency';
    }
    if(importsToday){
      importsToday.dataset.counter = `${storeImportCount}`;
    }

    if(bulkMarginInput){
      bulkMarginInput.value = `${storeMargin}`;
    }
    if(calculatorMargin){
      calculatorMargin.value = `${storeMargin}`;
    }

    const resolveSupplierPlan = supplier => normalizePlan(supplier && supplier.plan) || 'basic';
    // Subscription plan gates removed — all suppliers are available to all users.
    const isSupplierLocked = () => false;
    const getSupplierPlanTagClass = plan => {
      const planMap = {elite: 'tag-elite', pro: 'tag-premium', basic: 'tag-basic'};
      return planMap[plan] || 'tag-basic';
    };
    const getSupplierLogoFallback = name => `https://placehold.co/48x48/0f1837/FFFFFF?text=${encodeURIComponent((name || 'H').slice(0, 2).toUpperCase())}`;
    const firstAvailableSupplier = suppliers.find(supplier => !isSupplierLocked(supplier)) || null;
    let selectedSupplier = firstAvailableSupplier;
    let currentProducts = [];
    let selectedProduct = null;

    const updateCalculator = (product, marginValue) => {
      if(!calculator){
        return;
      }
      if(!product){
        if(calculatorDesc){
          calculatorDesc.textContent = 'Wybierz produkt z listy, aby policzyć zysk.';
        }
        if(calculatorCost){
          calculatorCost.textContent = formatCurrency(0);
        }
        if(calculatorFinal){
          calculatorFinal.textContent = formatCurrency(0);
        }
        if(calculatorProfit){
          calculatorProfit.textContent = formatCurrency(0);
        }
        return;
      }
      const {cost} = resolveCostAndPrice(product);
      const pricing = calculateTieredPricing(cost, {
        userMargin: marginValue,
        store: activeStore,
        settings: storeSettings,
        product
      });
      if(calculatorDesc){
        calculatorDesc.textContent = `${product.name} • ${product.supplier}`;
      }
      if(calculatorMargin){
        calculatorMargin.value = `${pricing.userMarginPct}`;
      }
      if(calculatorCost){
        calculatorCost.textContent = formatCurrency(pricing.cost);
      }
      if(calculatorFinal){
        calculatorFinal.textContent = formatCurrency(pricing.finalPrice);
      }
      if(calculatorProfit){
        calculatorProfit.textContent = formatCurrency(pricing.userMarginValue);
      }
    };

    const updateImportsCounter = () => {
      if(!importsToday){
        return;
      }
      const refreshedStores = ensureStoresList();
      const refreshedStore = getActiveStore(refreshedStores);
      const count = refreshedStore && Array.isArray(refreshedStore.products) ? refreshedStore.products.length : 0;
      importsToday.dataset.counter = `${count}`;
      setCounterValue(importsToday, count);
    };

    const updateStatus = message => {
      if(importStatus){
        importStatus.textContent = message;
      }
    };

    const importSupplierProducts = supplier => {
      if(!supplier || !Array.isArray(supplier.products) || !supplier.products.length){
        updateStatus('Brak produktów do importu.');
        return;
      }
      const marginValue = bulkMarginInput ? bulkMarginInput.value : storeMargin;
      const realIds = supplier.products.filter(p => p.id && isUUID(p.id)).map(p => p.id);
      const api = window.QMApi;
      if(api && api.MyStore && api.Auth && api.Auth.isLoggedIn && api.Auth.isLoggedIn() && realIds.length){
        api.MyStore.get().then(store => {
          if(!store || !store.id) throw new Error('no store');
          return api.MyStore.bulkAddProducts({ store_id: store.id, product_ids: realIds });
        }).then(resp => {
          const count = (resp && typeof resp.added === 'number') ? resp.added : realIds.length;
          updateStatus(`✅ Zaimportowano ${count} produktów z ${supplier.name} do sklepu.`);
          updateImportsCounter();
        }).catch(() => {
          supplier.products.forEach(product => addProductToStore(product, marginValue));
          updateStatus(`Zaimportowano ${supplier.products.length} produktów z ${supplier.name}.`);
          updateImportsCounter();
        });
      } else {
        supplier.products.forEach(product => addProductToStore(product, marginValue));
        updateStatus(`Zaimportowano ${supplier.products.length} produktów z ${supplier.name}.`);
        updateImportsCounter();
      }
    };

    const renderProducts = products => {
      productsGrid.innerHTML = '';
      if(!products.length){
        if(productsEmpty){
          productsEmpty.hidden = false;
        }
        return;
      }
      if(productsEmpty){
        productsEmpty.hidden = true;
      }
      products.forEach(product => {
        const {cost: resolvedCost} = resolveCostAndPrice(product);
        const resolvedImage = resolveProductImage(product);
        const card = document.createElement('article');
        card.className = 'product-card';
        const defaultMargin = bulkMarginInput ? normalizeMarginValue(bulkMarginInput.value, storeMargin) : storeMargin;
        card.innerHTML = `
          <img src="${resolvedImage}" alt="${product.name}">
          <div class="product-meta">
            <div>
              <span class="tag">${product.category}</span>
              <h3>${product.name}</h3>
              <p class="hint">${product.description || 'Opis produktu w przygotowaniu.'}</p>
            </div>
            <div class="price-stack">
              <span>Koszt zakupu</span>
              <strong data-product-cost>${formatCurrency(resolvedCost)}</strong>
            </div>
            <label class="product-input">
              Marża (%)
              <input type="number" min="0" max="300" step="1" value="${defaultMargin}" data-product-margin>
            </label>
            <div class="price-stack">
              <span>Cena końcowa</span>
              <strong data-product-final>0 zł</strong>
            </div>
            <div class="price-stack">
              <span>Zysk</span>
              <strong data-product-profit>0 zł</strong>
            </div>
            <div class="product-actions">
              <button class="btn btn-primary" type="button" data-add-product>Dodaj do mojego sklepu</button>
              <button class="btn btn-secondary" type="button" data-select-product>Ustaw w kalkulatorze</button>
              <button class="btn btn-link-gen" type="button" data-gen-link>Generuj link sprzedażowy</button>
            </div>
          </div>
        `;
        const marginInput = card.querySelector('[data-product-margin]');
        const finalTarget = card.querySelector('[data-product-final]');
        const profitTarget = card.querySelector('[data-product-profit]');
        const updateCardPricing = () => {
          const pricing = calculateTieredPricing(resolvedCost, {
            userMargin: marginInput ? marginInput.value : storeMargin,
            store: activeStore,
            settings: storeSettings,
            product
          });
          if(finalTarget){
            finalTarget.textContent = formatCurrency(pricing.finalPrice);
          }
          if(profitTarget){
            profitTarget.textContent = formatCurrency(pricing.userMarginValue);
          }
        };
        updateCardPricing();
        if(marginInput){
          marginInput.addEventListener('input', () => {
            updateCardPricing();
            if(selectedProduct && selectedProduct.id === product.id){
              updateCalculator(product, marginInput.value);
            }
          });
        }
        const addButton = card.querySelector('[data-add-product]');
        if(addButton){
          addButton.addEventListener('click', () => {
            const marginValue = marginInput ? marginInput.value : storeMargin;
            const api = window.QMApi;
            if(api && api.MyStore && api.Auth && api.Auth.isLoggedIn && api.Auth.isLoggedIn() && product.id && isUUID(product.id)){
              api.MyStore.get().then(store => {
                if(!store || !store.id) throw new Error('no store');
                return api.MyStore.addProduct({ store_id: store.id, product_id: product.id });
              }).then(() => {
                updateStatus(`✅ Dodano "${product.name}" do sklepu.`);
                updateImportsCounter();
              }).catch(() => {
                const result = addProductToStore(product, marginValue);
                if(result) updateStatus(`Dodano "${product.name}" do ${result.store.name}.`);
                updateImportsCounter();
              });
            } else {
              const result = addProductToStore(product, marginValue);
              if(result){
                updateStatus(`Dodano "${product.name}" do ${result.store.name}.`);
                updateImportsCounter();
              }
            }
          });
        }
        const selectButton = card.querySelector('[data-select-product]');
        if(selectButton){
          selectButton.addEventListener('click', () => {
            selectedProduct = product;
            updateCalculator(product, marginInput ? marginInput.value : storeMargin);
          });
        }
        const genLinkButton = card.querySelector('[data-gen-link]');
        if(genLinkButton){
          genLinkButton.addEventListener('click', () => {
            const result = generateSalesLink(product, marginInput ? marginInput.value : storeMargin);
            if(!result){
              return;
            }
            if(navigator.clipboard){
              navigator.clipboard.writeText(result.url).then(() => {
                const original = genLinkButton.textContent;
                genLinkButton.textContent = result.isNew ? 'Link wygenerowany i skopiowany ✓' : 'Link skopiowany ✓';
                updateStatus(`Link sprzedażowy dla "${product.name}" skopiowany do schowka.`);
                setTimeout(() => {
                  genLinkButton.textContent = original;
                }, 2500);
              }).catch(() => {
                updateStatus(`Link sprzedażowy: ${result.url}`);
              });
            } else {
              updateStatus(`Link sprzedażowy: ${result.url}`);
            }
          });
        }
        productsGrid.appendChild(card);
      });
    };

    const applyFilters = () => {
      if(!selectedSupplier){
        currentProducts = [];
        renderProducts([]);
        return;
      }
      const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const category = categorySelect ? categorySelect.value : 'all';
      currentProducts = (selectedSupplier.products || []).filter(product => {
        const matchesCategory = category === 'all' || product.category === category;
        const description = (product.description || '').toLowerCase();
        const matchesSearch = !searchTerm || product.name.toLowerCase().includes(searchTerm)
          || description.includes(searchTerm);
        return matchesCategory && matchesSearch;
      });
      renderProducts(currentProducts);
    };

    const populateCategories = supplier => {
      if(!categorySelect){
        return;
      }
      categorySelect.innerHTML = '<option value="all">Wszystkie</option>';
      const categories = Array.from(new Set((supplier.products || []).map(product => product.category))).sort();
      categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
      });
    };

    const selectSupplier = supplier => {
      if(!supplier){
        return;
      }
      const requiredPlan = resolveSupplierPlan(supplier);
      if(isSupplierLocked(supplier)){
        showUpgradeModal(requiredPlan);
        return;
      }
      selectedSupplier = supplier;
      if(supplierName){
        supplierName.textContent = supplier ? supplier.name : 'Wybierz hurtownię';
      }
      if(supplierDesc){
        supplierDesc.textContent = supplier ? supplier.description : '';
      }
      populateCategories(supplier);
      applyFilters();
      const firstProduct = supplier && supplier.products ? supplier.products[0] : null;
      selectedProduct = firstProduct;
      updateCalculator(firstProduct, calculatorMargin ? calculatorMargin.value : storeMargin);
      Array.from(suppliersGrid.children).forEach(child => {
        const isActive = supplier && child.dataset.supplierId === supplier.slug;
        child.classList.toggle('is-active', isActive);
      });
    };

    const renderSuppliers = () => {
      suppliersGrid.innerHTML = '';
      if(!suppliers.length){
        if(suppliersEmpty){
          suppliersEmpty.hidden = false;
        }
        return;
      }
      if(suppliersEmpty){
        suppliersEmpty.hidden = true;
      }
      suppliers.forEach(supplier => {
        const requiredPlan = resolveSupplierPlan(supplier);
        const locked = isSupplierLocked(supplier);
        const card = document.createElement('article');
        card.className = 'supplier-card';
        card.dataset.locked = locked ? 'true' : 'false';
        card.dataset.supplierId = supplier.slug;
        card.dataset.supplierPlan = requiredPlan;
        const planTagClass = getSupplierPlanTagClass(requiredPlan);
        const planTagText = `Plan: ${formatPlanLabel(requiredPlan)}`;
        const lockTag = locked
          ? `<span class="tag tag-lock ${planTagClass}" aria-label="Wymaga planu ${formatPlanLabel(requiredPlan)}" role="status">🔒 ${planTagText}</span>`
          : `<span class="tag ${planTagClass}" aria-label="Dostępny w planie ${formatPlanLabel(requiredPlan)}">${planTagText}</span>`;
        const importLabel = locked ? 'Odblokuj' : 'Importuj';
        const logoFallback = getSupplierLogoFallback(supplier.name);
        card.innerHTML = `
          <div class="supplier-meta">
            <img src="${supplier.logo}" alt="${supplier.name}" onerror="this.src='${logoFallback}'">
            <div>
              <strong>${supplier.name}</strong>
              <span class="hint">${supplier.category}</span>
            </div>
          </div>
          <p class="hint">${supplier.description}</p>
          <div class="cta-row">
            <button class="btn btn-primary" type="button" data-supplier-import aria-label="Importuj produkty z ${supplier.name}">${importLabel}</button>
            <button class="btn btn-secondary" type="button" data-supplier-view>Zobacz produkty</button>
            ${lockTag}
            <span class="tag">${(supplier.products || []).length} produktów</span>
          </div>
        `;
        card.addEventListener('click', event => {
          if(event.target.closest('button')){
            return;
          }
          selectSupplier(supplier);
        });
        const viewButton = card.querySelector('[data-supplier-view]');
        if(viewButton){
          viewButton.addEventListener('click', event => {
            event.stopPropagation();
            selectSupplier(supplier);
          });
        }
        const importAction = card.querySelector('[data-supplier-import]');
        if(importAction){
          importAction.addEventListener('click', event => {
            event.stopPropagation();
            if(locked){
              showUpgradeModal(requiredPlan);
              return;
            }
            selectSupplier(supplier);
            importSupplierProducts(supplier);
          });
        }
        suppliersGrid.appendChild(card);
      });
    };

    renderSuppliers();
    if(selectedSupplier){
      selectSupplier(selectedSupplier);
    } else if(suppliers.length){
      if(supplierName){
        supplierName.textContent = 'Ulepsz plan';
      }
      if(supplierDesc){
        supplierDesc.textContent = 'Twoja wersja planu nie obejmuje aktywnych hurtowni.';
      }
      updateStatus('Ulepsz plan, aby odblokować hurtownie.');
    }

    // ── Async API enhancement: replace demo data with live API data when logged in ──
    (function(){
      const api = window.QMApi;
      if(!api || !api.Auth || !api.Auth.isLoggedIn || !api.Auth.isLoggedIn()) return;
      api.Suppliers.list().then(function(apiSuppliers){
        if(!Array.isArray(apiSuppliers) || !apiSuppliers.length) return;
        return api.Products.list({ is_central: true, status: 'active', limit: 500 }).then(function(resp){
          const apiProducts = (resp && resp.products) ? resp.products : [];
          // Build supplier → products map
          const supplierProdMap = Object.create(null);
          const noSupplierProds = [];
          apiProducts.forEach(function(p){
            const normProd = {
              id: p.id,
              name: p.name,
              cost: parseFloat(p.supplier_price || p.price_gross || 0),
              price: parseFloat(p.platform_price || p.selling_price || 0),
              img: p.image_url || '',
              image: p.image_url || '',
              description: p.description || '',
              category: p.category || '',
              sku: p.sku || ''
            };
            if(p.supplier_id){
              if(!supplierProdMap[p.supplier_id]) supplierProdMap[p.supplier_id] = [];
              supplierProdMap[p.supplier_id].push(normProd);
            } else {
              noSupplierProds.push(normProd);
            }
          });
          const mapped = apiSuppliers.map(function(s){
            const prods = supplierProdMap[s.id] || [];
            prods.forEach(function(p){ p.supplier = s.name; });
            return {
              id: s.id,
              name: s.name,
              slug: s.id,
              plan: 'basic',
              category: s.integration_type || 'API',
              description: s.notes || s.name,
              logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=' + encodeURIComponent((s.name || 'H').slice(0, 2).toUpperCase()),
              products: prods
            };
          });
          if(noSupplierProds.length){
            noSupplierProds.forEach(function(p){ p.supplier = 'Katalog centralny'; });
            mapped.push({
              id: 'central',
              name: 'Katalog centralny',
              slug: 'central',
              plan: 'basic',
              category: 'Katalog platformy',
              description: 'Produkty z katalogu centralnego platformy.',
              logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=KC',
              products: noSupplierProds
            });
          }
          if(!mapped.length) return;
          // Replace demo suppliers array in-place so closures stay valid
          suppliers.length = 0;
          mapped.forEach(function(s){ suppliers.push(s); });
          const allProds = suppliers.reduce(function(acc, s){ return acc.concat(s.products || []); }, []);
          if(suppliersCount){ suppliersCount.dataset.counter = String(suppliers.length); setCounterValue(suppliersCount, suppliers.length); }
          if(productsCount){ productsCount.dataset.counter = String(allProds.length); setCounterValue(productsCount, allProds.length); }
          selectedSupplier = null;
          renderSuppliers();
          const firstAvailable = suppliers.find(function(s){ return !isSupplierLocked(s); });
          if(firstAvailable) selectSupplier(firstAvailable);
        });
      }).catch(function(){}); // keep demo data on API error
    })();

    if(searchInput){
      searchInput.addEventListener('input', applyFilters);
    }
    if(categorySelect){
      categorySelect.addEventListener('change', applyFilters);
    }
    if(bulkMarginInput){
      bulkMarginInput.addEventListener('input', () => {
        storeMargin = setStoreMargin(bulkMarginInput.value);
        if(calculatorMargin){
          calculatorMargin.value = `${storeMargin}`;
          if(selectedProduct){
            updateCalculator(selectedProduct, calculatorMargin.value);
          }
        }
        applyFilters();
      });
    }
    if(importButton){
      importButton.addEventListener('click', () => {
        if(!currentProducts.length){
          updateStatus('Brak produktów do importu.');
          return;
        }
        const marginValue = bulkMarginInput ? bulkMarginInput.value : storeMargin;
        const realIds = currentProducts.filter(p => p.id && isUUID(p.id)).map(p => p.id);
        const api = window.QMApi;
        if(api && api.MyStore && api.Auth && api.Auth.isLoggedIn && api.Auth.isLoggedIn() && realIds.length){
          api.MyStore.get().then(store => {
            if(!store || !store.id) throw new Error('no store');
            return api.MyStore.bulkAddProducts({ store_id: store.id, product_ids: realIds });
          }).then(resp => {
            const count = (resp && typeof resp.added === 'number') ? resp.added : realIds.length;
            updateStatus(`✅ Zaimportowano ${count} produktów do sklepu.`);
            updateImportsCounter();
          }).catch(() => {
            currentProducts.forEach(product => addProductToStore(product, marginValue));
            updateStatus(`Zaimportowano ${currentProducts.length} produktów do sklepu.`);
            updateImportsCounter();
          });
        } else {
          currentProducts.forEach(product => addProductToStore(product, marginValue));
          updateStatus(`Zaimportowano ${currentProducts.length} produktów do sklepu.`);
          updateImportsCounter();
        }
      });
    }
    if(calculatorMargin){
      calculatorMargin.addEventListener('input', () => {
        if(selectedProduct){
          updateCalculator(selectedProduct, calculatorMargin.value);
        }
      });
    }
    if(calculatorAdd){
      calculatorAdd.addEventListener('click', () => {
        if(!selectedProduct){
          updateStatus('Najpierw wybierz produkt z listy.');
          return;
        }
        const marginValue = calculatorMargin ? calculatorMargin.value : storeMargin;
        const api = window.QMApi;
        if(api && api.MyStore && api.Auth && api.Auth.isLoggedIn && api.Auth.isLoggedIn() && selectedProduct.id && isUUID(selectedProduct.id)){
          api.MyStore.get().then(store => {
            if(!store || !store.id) throw new Error('no store');
            return api.MyStore.addProduct({ store_id: store.id, product_id: selectedProduct.id });
          }).then(() => {
            updateStatus(`✅ Dodano "${selectedProduct.name}" do sklepu.`);
            updateImportsCounter();
          }).catch(() => {
            const result = addProductToStore(selectedProduct, marginValue);
            if(result) updateStatus(`Dodano "${selectedProduct.name}" do ${result.store.name}.`);
            updateImportsCounter();
          });
        } else {
          const result = addProductToStore(selectedProduct, marginValue);
          if(result){
            updateStatus(`Dodano "${selectedProduct.name}" do ${result.store.name}.`);
            updateImportsCounter();
          }
        }
      });
    }
  }

  function initStorefrontProducts(){
    if(document.body.dataset.page !== 'sklep'){
      return;
    }
    const productsGrid = document.querySelector('[data-store-products-grid]');
    if(!productsGrid){
      return;
    }
    const emptyState = document.querySelector('[data-store-products-empty]');
    const stores = ensureStoresList();
    const activeStore = getActiveStore(stores);
    const storeSettings = loadStoreSettings();
    const storeMargin = resolveStoreMargin({store: activeStore, settings: storeSettings, plan: activeStore && activeStore.plan});

    // Try loading products from the backend API first; fall back to localStorage/demo data.
    function renderProducts(storeProducts){
      productsGrid.innerHTML = '';
      if(!storeProducts.length){
        if(emptyState){
          emptyState.hidden = false;
        }
        return;
      }
      if(emptyState){
        emptyState.hidden = true;
      }
      storeProducts.forEach(product => {
        const {cost: resolvedCost} = resolveCostAndPrice(product);
        const pricing = calculateTieredPricing(resolvedCost, {
          userMargin: product.margin ?? storeMargin,
          store: activeStore,
          settings: storeSettings,
          product
        });
        const card = document.createElement('article');
        card.className = 'product-card product-tile';

        const media = document.createElement('div');
        media.className = 'product-media';
        const image = document.createElement('img');
        image.src = resolveProductImage(product);
        image.alt = product.name || 'Produkt';
        media.appendChild(image);

        const details = document.createElement('div');
        details.className = 'product-details';
        const category = document.createElement('span');
        category.className = 'tag';
        category.textContent = product.category || 'Kategoria';
        const title = document.createElement('h3');
        title.textContent = product.name || 'Produkt';
        const hint = document.createElement('p');
        hint.className = 'hint';
        hint.textContent = product.description || 'Opis produktu w przygotowaniu.';
        const meta = document.createElement('div');
        meta.className = 'product-meta';
        const price = document.createElement('span');
        price.className = 'price';
        price.textContent = formatCurrency(pricing.finalPrice);
        meta.appendChild(price);

        const supplier = document.createElement('div');
        supplier.className = 'product-supplier';
        const supplierText = document.createElement('span');
        supplierText.textContent = product.supplier ? `Hurtownia: ${product.supplier}` : 'Hurtownia: —';
        supplier.appendChild(supplierText);

        const actions = document.createElement('div');
        actions.className = 'cta-row product-actions';
        const addButton = document.createElement('button');
        addButton.className = 'btn btn-primary';
        addButton.type = 'button';
        // product.shop_product_id is used for API-based cart (logged in flow).
        // product.id is the central catalog product ID.
        addButton.dataset.addToCart = '';
        addButton.dataset.productId = product.id || '';
        addButton.dataset.productName = product.name || '';
        addButton.dataset.productPrice = String(pricing.finalPrice);
        addButton.dataset.productImg = resolveProductImage(product);
        if(product.shop_product_id){
          // When a shop_product_id is available, the cart.js global click handler
          // will use addByShopProduct (API-backed cart when logged in).
          addButton.dataset.shopProductId = product.shop_product_id;
        }
        addButton.textContent = 'Dodaj do koszyka';
        addButton.addEventListener('click', () => {
          const order = createOrder(product, activeStore, {amount: pricing.finalPrice});
          if(order){
            const original = addButton.textContent;
            addButton.textContent = 'Dodano ✓';
            addButton.disabled = true;
            setTimeout(() => {
              addButton.textContent = original;
              addButton.disabled = false;
            }, 2000);
          }
        });
        const detailsLink = document.createElement('a');
        detailsLink.className = 'btn btn-secondary';
        detailsLink.href = 'listing.html';
        detailsLink.textContent = 'Szczegóły';
        actions.appendChild(addButton);
        actions.appendChild(detailsLink);

        details.appendChild(category);
        details.appendChild(title);
        details.appendChild(hint);
        details.appendChild(meta);
        details.appendChild(supplier);
        details.appendChild(actions);

        card.appendChild(media);
        card.appendChild(details);
        productsGrid.appendChild(card);
      });
    }

    function loadLocalProducts(){
      let storeProducts = loadProductsBySupplier();
      if(activeStore && activeStore.id){
        storeProducts = storeProducts.filter(product => product.storeId === activeStore.id);
      }
      if(!storeProducts.length && activeStore && Array.isArray(activeStore.products)){
        storeProducts = activeStore.products.map(product => ({...product, storeId: activeStore.id}));
      }
      const storeCategoryCount = new Set(storeProducts.map(p => p.category)).size;
      if(!storeProducts.length || storeCategoryCount < 5){
        if(!storefrontFallbackProducts){
          const fallbackSuppliers = ensureOwnerDemoData().suppliers;
          storefrontFallbackProducts = buildProductsFromSuppliers(fallbackSuppliers);
        }
        storeProducts = storefrontFallbackProducts.map(product => ({
          ...product,
          storeId: (activeStore && activeStore.id) || product.storeId
        }));
      }
      return storeProducts;
    }

    // Try API if available
    if(window.QMApi && window.QMApi.Products){
      const apiParams = { is_central: true, status: 'active', limit: 40 };
      window.QMApi.Products.list(apiParams).then(function(resp){
        const rows = (resp && resp.products) ? resp.products : (Array.isArray(resp) ? resp : []);
        if(rows.length){
          // Normalize API product shape to match local product shape
          const normalized = rows.map(p => ({
            id: p.id,
            // shop_product_id is present when fetched via /api/shop-products;
            // absent for central catalog (/api/products). Cart will use id as fallback.
            shop_product_id: p.shop_product_id || null,
            name: p.name,
            description: p.description || '',
            category: p.category || '',
            price: parseFloat(p.selling_price || p.price_gross || 0),
            cost: parseFloat(p.price_gross || 0),
            img: p.image_url || '',
            supplier: p.supplier_name || '',
            margin: parseFloat(p.margin || 0)
          }));
          renderProducts(normalized);
          return;
        }
        renderProducts(loadLocalProducts());
      }).catch(function(){
        renderProducts(loadLocalProducts());
      });
    } else {
      renderProducts(loadLocalProducts());
    }
  }

  function initStoreGenerator(){
    const form = document.querySelector('[data-store-form]');
    if(!form){
      return;
    }
    const nameInput = form.querySelector('input[name="storeName"]');
    const descriptionInput = form.querySelector('textarea[name="storeDescription"]');
    const primaryColorInput = form.querySelector('input[name="primaryColor"]');
    const accentColorInput = form.querySelector('input[name="accentColor"]');
    const styleInputs = form.querySelectorAll('input[name="storeStyle"]');
    const logoInput = form.querySelector('input[name="storeLogo"]');
    const logoPreview = form.querySelector('[data-logo-preview]');
    const logoImage = form.querySelector('[data-logo-image]');
    const logoPlaceholder = form.querySelector('[data-logo-placeholder]');
    const primaryChip = form.querySelector('[data-primary-chip]');
    const accentChip = form.querySelector('[data-accent-chip]');
    let logoDataUrl = '';

    const storedSettings = loadStoreSettings();
    if(storedSettings){
      if(nameInput && (storedSettings.storeName || storedSettings.niche)){
        nameInput.value = storedSettings.storeName || storedSettings.niche;
      }
      if(descriptionInput && storedSettings.storeDescription){
        descriptionInput.value = storedSettings.storeDescription;
      }
      if(primaryColorInput && storedSettings.primaryColor){
        primaryColorInput.value = storedSettings.primaryColor;
      }
      if(accentColorInput && storedSettings.accentColor){
        accentColorInput.value = storedSettings.accentColor;
      }
      if(storedSettings.storeStyle){
        const matched = Array.from(styleInputs).find(input => input.value === storedSettings.storeStyle);
        if(matched){
          matched.checked = true;
        }
      }
      if(storedSettings.logoDataUrl){
        logoDataUrl = storedSettings.logoDataUrl;
      }
    }

    updateLogoPreview(
      logoPreview,
      logoImage,
      logoPlaceholder,
      nameInput ? nameInput.value : '',
      logoDataUrl
    );
    updateColorChips(primaryColorInput, accentColorInput, primaryChip, accentChip);

    if(nameInput){
      nameInput.addEventListener('input', () => {
        updateLogoPreview(logoPreview, logoImage, logoPlaceholder, nameInput.value, logoDataUrl);
      });
    }
    if(primaryColorInput){
      primaryColorInput.addEventListener('input', () => {
        updateColorChips(primaryColorInput, accentColorInput, primaryChip, accentChip);
      });
    }
    if(accentColorInput){
      accentColorInput.addEventListener('input', () => {
        updateColorChips(primaryColorInput, accentColorInput, primaryChip, accentChip);
      });
    }
    if(logoInput){
      logoInput.addEventListener('change', event => {
        const file = event.target.files && event.target.files[0];
        if(!file){
          logoDataUrl = '';
          updateLogoPreview(logoPreview, logoImage, logoPlaceholder, nameInput ? nameInput.value : '', logoDataUrl);
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          logoDataUrl = typeof reader.result === 'string' ? reader.result : '';
          updateLogoPreview(logoPreview, logoImage, logoPlaceholder, nameInput ? nameInput.value : '', logoDataUrl);
        };
        reader.readAsDataURL(file);
      });
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const selectedStyle = form.querySelector('input[name="storeStyle"]:checked');
      const settings = {
        storeName: nameInput ? nameInput.value.trim() : '',
        storeDescription: descriptionInput ? descriptionInput.value.trim() : '',
        primaryColor: primaryColorInput ? primaryColorInput.value : '',
        accentColor: accentColorInput ? accentColorInput.value : '',
        storeStyle: selectedStyle ? selectedStyle.value : '',
        logoDataUrl: logoDataUrl,
        updatedAt: new Date().toISOString()
      };
      saveStoreSettings(settings);
      window.location.href = 'dashboard.html';
    });
  }

  // ── syncAuthToLegacyStorage: keeps old localStorage flags in sync after API login ──
  function syncAuthToLegacyStorage(user, email){
    if(email){
      localStorage.setItem(STORAGE_KEYS.email, email);
    }
    if(user){
      const role = user.role || '';
      if(role === 'superadmin' || role === 'owner'){
        localStorage.setItem(STORAGE_KEYS.role, 'superadmin');
      } else if(role){
        localStorage.removeItem(STORAGE_KEYS.role);
      }
      if(user.plan){
        localStorage.setItem(STORAGE_KEYS.plan, user.plan);
      }
      try{
        localStorage.setItem(STORAGE_KEYS.userProfile, JSON.stringify(user));
      } catch(_){}
    }
    localStorage.setItem(STORAGE_KEYS.logged, 'true');
  }

  function initLoginForm(){
    const form = document.querySelector('[data-login-form]');
    if(!form){
      return;
    }

    // "Create account" button (secondary button in the login form)
    const createBtn = form.querySelector('.btn-secondary[type="button"]');
    if(createBtn){
      createBtn.addEventListener('click', async function(){
        const emailInput = form.querySelector('input[name="email"]');
        const passwordInput = form.querySelector('input[name="password"]');
        const email = emailInput ? emailInput.value.trim() : '';
        const password = passwordInput ? passwordInput.value : '';
        if(!email || !password){
          alert('Podaj adres e-mail i hasło, aby utworzyć konto.');
          return;
        }
        const name = email.split('@')[0] || 'Użytkownik';
        if(window.QMApi && window.QMApi.Auth){
          try{
            const data = await window.QMApi.Auth.register(email, password, name, 'seller');
            syncAuthToLegacyStorage(data.user, email);
            startTrialIfNeeded(email);
            window.location.href = 'dashboard.html';
            return;
          } catch(err){
            const msg = (err && err.body && err.body.error) || (err && err.message) || '';
            if(msg){
              alert('Błąd rejestracji: ' + msg);
              return;
            }
          }
        }
        // Legacy fallback – no backend available
        if(email){
          localStorage.setItem(STORAGE_KEYS.email, email);
          if(normalizeQueryParam(email) === OWNER_EMAIL_NORMALIZED){
            localStorage.setItem(STORAGE_KEYS.role, 'superadmin');
          } else {
            localStorage.removeItem(STORAGE_KEYS.role);
          }
        }
        localStorage.setItem(STORAGE_KEYS.logged, 'true');
        startTrialIfNeeded(email);
        window.location.href = 'dashboard.html';
      });
    }

    form.addEventListener('submit', async function(event){
      event.preventDefault();
      const emailInput = form.querySelector('input[name="email"]');
      const passwordInput = form.querySelector('input[name="password"]');
      const email = emailInput ? emailInput.value.trim() : '';
      const password = passwordInput ? passwordInput.value : '';

      if(window.QMApi && window.QMApi.Auth && email && password){
        try{
          const data = await window.QMApi.Auth.login(email, password);
          syncAuthToLegacyStorage(data.user, email);
          startTrialIfNeeded(email);
          window.location.href = 'dashboard.html';
          return;
        } catch(err){
          const msg = (err && err.body && err.body.error) || (err && err.message) || '';
          // Only block on explicit auth errors (401/403); network errors fall through to legacy
          if(err && (err.status === 401 || err.status === 403)){
            alert('Błąd logowania: ' + (msg || 'Nieprawidłowy e-mail lub hasło'));
            return;
          }
        }
      }

      // Legacy fallback – backend not available
      if(email){
        localStorage.setItem(STORAGE_KEYS.email, email);
        if(normalizeQueryParam(email) === OWNER_EMAIL_NORMALIZED){
          localStorage.setItem(STORAGE_KEYS.role, 'superadmin');
        } else {
          localStorage.removeItem(STORAGE_KEYS.role);
        }
      }
      localStorage.setItem(STORAGE_KEYS.logged, 'true');
      startTrialIfNeeded(email);
      window.location.href = 'dashboard.html';
    });
  }

  function initMotionPolish(){
    if(!('IntersectionObserver' in window)) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if(prefersReducedMotion) return;

    const revealSelectors = [
      '.hero-side',
      '.app-cta-section',
      '.promo-motion-section .promo-motion-copy',
      '.promo-motion-section .promo-motion-gallery',
      '.promo-section .section-head',
      '.promo-grid .promo-card',
      '.activity-section .section-head',
      '.activity-grid .activity-card',
      '.activity-banner',
      '.results-section .section-head',
      '.results-grid .result-card',
      '.calculator-section .section-head',
      '.calculator-section .panel-card',
      '.calculator-recommendation',
      '.survey-section .section-head',
      '.survey-section .survey-card',
      '.footer',
      '.pricing-grid .price-card',
      '.supplier-grid .supplier-card',
      '.products-grid .product-card',
      '.page-hero',
      '.section-head'
    ];

    const seen = new WeakSet();
    const elements = [];

    revealSelectors.forEach(selector => {
      document.querySelectorAll(selector).forEach((el, i) => {
        if(seen.has(el)) return;
        seen.add(el);
        el.classList.add('js-reveal');
        el.style.transitionDelay = `${Math.min(i, 4) * 70}ms`;
        elements.push(el);
      });
    });

    if(!elements.length) return;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: 0.1, rootMargin: '0px 0px -30px 0px'});

    elements.forEach(el => observer.observe(el));
  }

  function initSuperadminLink(){
    const links = document.querySelectorAll('[data-superadmin-link]');
    if(!links.length){
      return;
    }
    if(isAppLoggedIn() && hasOwnerAccess()){
      links.forEach(link => {
        link.hidden = false;
      });
    }
  }

  // ── SMS Login for owner ──
  function initSmsOwnerLogin(){
    if(document.body.dataset.page !== 'login'){
      return;
    }

    // Auth tab switching
    const authTabBtns = document.querySelectorAll('[data-auth-tab]');
    const authTabPanels = document.querySelectorAll('.auth-tab-panel');
    authTabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.authTab;
        authTabBtns.forEach(b => {
          b.classList.toggle('active', b.dataset.authTab === target);
          b.setAttribute('aria-selected', b.dataset.authTab === target ? 'true' : 'false');
        });
        authTabPanels.forEach(panel => {
          panel.hidden = panel.id !== `auth-panel-${target}`;
        });
      });
    });

    const phoneForm = document.querySelector('[data-sms-phone-form]');
    const codeForm = document.querySelector('[data-sms-code-form]');
    const stepPhone = document.querySelector('[data-sms-step="phone"]');
    const stepCode = document.querySelector('[data-sms-step="code"]');
    const backBtn = document.querySelector('[data-sms-back]');
    const phoneError = document.querySelector('[data-sms-phone-error]');
    const codeError = document.querySelector('[data-sms-code-error]');
    const codeHint = document.querySelector('[data-sms-code-hint]');

    if(!phoneForm || !codeForm){
      return;
    }

    let pendingCode = '';

    function normalizePhone(p){
      return (p || '').replace(/\s+/g, '').replace(/[^\d+]/g, '');
    }

    phoneForm.addEventListener('submit', event => {
      event.preventDefault();
      const phoneInput = phoneForm.querySelector('input[name="phone"]');
      const phone = normalizePhone(phoneInput ? phoneInput.value : '');
      const ownerNorm = normalizePhone(OWNER_PHONE_NORMALIZED);
      if(phone !== ownerNorm){
        if(phoneError){
          phoneError.textContent = 'Numer telefonu nie jest powiązany z kontem właściciela.';
          phoneError.hidden = false;
        }
        return;
      }
      if(phoneError){
        phoneError.hidden = true;
      }
      // Generate a secure 6-digit demo code
      const randomArray = new Uint32Array(1);
      crypto.getRandomValues(randomArray);
      pendingCode = String(100000 + (randomArray[0] % 900000));
      if(stepPhone){
        stepPhone.hidden = true;
      }
      if(stepCode){
        stepCode.hidden = false;
      }
      if(codeHint){
        codeHint.textContent = `Twój kod SMS: ${pendingCode}`;
      }
    });

    if(backBtn){
      backBtn.addEventListener('click', () => {
        if(stepCode){
          stepCode.hidden = true;
        }
        if(stepPhone){
          stepPhone.hidden = false;
        }
        if(codeError){
          codeError.hidden = true;
        }
        pendingCode = '';
      });
    }

    codeForm.addEventListener('submit', event => {
      event.preventDefault();
      const codeInput = codeForm.querySelector('input[name="code"]');
      const code = codeInput ? codeInput.value.trim() : '';
      if(code !== pendingCode){
        if(codeError){
          codeError.textContent = 'Nieprawidłowy kod SMS. Sprawdź i spróbuj ponownie.';
          codeError.hidden = false;
        }
        return;
      }
      if(codeError){
        codeError.hidden = true;
      }
      // Grant superadmin access
      localStorage.setItem(STORAGE_KEYS.email, OWNER_EMAIL);
      localStorage.setItem(STORAGE_KEYS.role, 'superadmin');
      localStorage.setItem(STORAGE_KEYS.logged, 'true');
      // Log the login
      const logs = getStoredList(OWNER_STORAGE_KEYS.adminLogs);
      logs.unshift({
        id: `log_sms_${Date.now()}`,
        time: new Date().toISOString(),
        user: 'Superadmin',
        role: 'superadmin',
        action: 'Logowanie SMS',
        object: 'owner-panel',
        details: 'Pomyślne logowanie przez numer telefonu i kod SMS'
      });
      saveStoredList(OWNER_STORAGE_KEYS.adminLogs, logs);
      window.location.href = 'owner-panel.html';
    });
  }

  // ── Supplier application form (zostan-dostawca.html) ──
  function initSupplierApplicationForm(){
    if(document.body.dataset.page !== 'zostan-dostawca'){
      return;
    }
    const form = document.querySelector('[data-supplier-app-form]');
    const formWrap = document.querySelector('[data-supplier-app-form-wrap]');
    const success = document.querySelector('[data-supplier-app-success]');
    const errorEl = document.querySelector('[data-supplier-app-error]');
    if(!form){
      return;
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      const data = new FormData(form);
      const app = {
        id: `sapp_${Date.now()}`,
        submittedAt: new Date().toISOString(),
        status: 'pending',
        companyName: (data.get('companyName') || '').trim(),
        email: (data.get('email') || '').trim(),
        phone: (data.get('phone') || '').trim(),
        country: data.get('country') || '',
        productTypes: (data.get('productTypes') || '').trim(),
        websiteUrl: (data.get('websiteUrl') || '').trim(),
        dropshipping: data.get('dropshipping') === '1',
        wholesale: data.get('wholesale') === '1',
        whitelabel: data.get('whitelabel') === '1',
        api: data.get('api') === '1',
        notes: (data.get('notes') || '').trim()
      };
      if(!app.companyName || !app.email || !app.phone || !app.country || !app.productTypes){
        if(errorEl){
          errorEl.textContent = 'Proszę wypełnić wszystkie wymagane pola.';
          errorEl.hidden = false;
        }
        return;
      }
      if(errorEl){
        errorEl.hidden = true;
      }
      const apps = getStoredList(OWNER_STORAGE_KEYS.supplierApps);
      apps.unshift(app);
      saveStoredList(OWNER_STORAGE_KEYS.supplierApps, apps);
      if(formWrap){
        formWrap.hidden = true;
      }
      if(success){
        success.hidden = false;
      }
    });
  }

  function initTasksModule(){
    if(document.body.dataset.page !== 'tasks'){
      return;
    }

    const seedTasks = [
      {id:'task_001',title:'Zaktualizować opisy produktów w kategorii Elektronika',description:'Przejrzeć i zaktualizować opisy wszystkich produktów w kategorii Elektronika — poprawić tytuły SEO, dodać bullet-pointy z cechami, uzupełnić parametry techniczne.',priority:'high',assignee:'Anna K.',dueLabel:'jutro',status:'open',createdAt:'2026-03-10T10:00:00Z',closedAt:null},
      {id:'task_002',title:'Przesłać zdjęcia nowej kolekcji zimowej',description:'Zrobić i wgrać zdjęcia produktowe nowej kolekcji zimowej: kurtki, swetry, akcesoria. Format: JPEG 1200×1200, białe tło.',priority:'med',assignee:'Marek N.',dueLabel:'3 dni',status:'open',createdAt:'2026-03-10T10:30:00Z',closedAt:null},
      {id:'task_003',title:'Skonfigurować kampanię Black Friday',description:'Przygotować banner główny, listę produktów promocyjnych i kody rabatowe na Black Friday. Sprawdzić zgodność ze Stripe.',priority:'high',assignee:'Tomasz Z.',dueLabel:'5 dni',status:'open',createdAt:'2026-03-10T11:00:00Z',closedAt:null},
      {id:'task_004',title:'Integracja nowej hurtowni FashionLane',description:'Podpiąć API hurtowni FashionLane: import produktów, synchronizacja stanów magazynowych, mapowanie kategorii.',priority:'high',assignee:'Katarzyna W.',dueLabel:'dziś',status:'in_progress',createdAt:'2026-03-09T09:00:00Z',closedAt:null},
      {id:'task_005',title:'Aktualizacja cennika sezonowego Q4',description:'Zaktualizować marże i ceny detaliczne dla Q4 zgodnie z nową polityką cenową. Uwzględnić koszty logistyki.',priority:'med',assignee:'Piotr L.',dueLabel:'2 dni',status:'in_progress',createdAt:'2026-03-09T10:00:00Z',closedAt:null},
      {id:'task_006',title:'Przegląd i optymalizacja marż w sklepie',description:'Przeanalizować marże na wszystkich kategoriach, zidentyfikować produkty poniżej progu opłacalności i zaproponować korektę.',priority:'low',assignee:'Anna K.',dueLabel:'tydzień',status:'in_progress',createdAt:'2026-03-09T11:00:00Z',closedAt:null},
      {id:'task_007',title:'Wdrożenie modułu CRM dla partnerów',description:'',priority:'high',assignee:'Agata K.',dueLabel:null,status:'done',createdAt:'2026-03-05T09:00:00Z',closedAt:null},
      {id:'task_008',title:'Konfiguracja automatu powiadomień',description:'',priority:'med',assignee:'Marek N.',dueLabel:null,status:'done',createdAt:'2026-03-05T10:00:00Z',closedAt:null},
      {id:'task_009',title:'Analiza sprzedaży Q3 — raport miesięczny',description:'',priority:'med',assignee:'Tomasz Z.',dueLabel:null,status:'done',createdAt:'2026-03-06T09:00:00Z',closedAt:null}
    ];

    let tasks = getStoredList(OWNER_STORAGE_KEYS.tasks);
    if(!tasks || !tasks.length){
      tasks = seedTasks.map(t => Object.assign({}, t));
      saveStoredList(OWNER_STORAGE_KEYS.tasks, tasks);
    }

    const board = document.querySelector('[data-tasks-board]');
    if(!board){
      return;
    }

    function getPriorityClass(priority){
      if(priority === 'high') return 'task-priority-high';
      if(priority === 'med') return 'task-priority-med';
      return 'task-priority-low';
    }

    function getPriorityLabel(priority){
      if(priority === 'high') return '↑ Wysoki';
      if(priority === 'med') return '→ Średni';
      return '↓ Niski';
    }

    function getStatusBadge(status){
      if(status === 'open') return '<span class="status-open">OPEN</span>';
      if(status === 'in_progress') return '<span class="status-in-progress">IN PROGRESS</span>';
      if(status === 'done') return '<span class="status-done">✓ DONE</span>';
      if(status === 'closed') return '<span class="status-draft">✕ Zamknięte</span>';
      return '';
    }

    function getActionButton(task){
      if(task.status === 'open'){
        return `<button class="btn-task btn-task-start" data-task-action="start" data-task-id="${escapeHtml(task.id)}">Rozpocznij</button>`;
      }
      if(task.status === 'in_progress'){
        return `<button class="btn-task btn-task-complete" data-task-action="complete" data-task-id="${escapeHtml(task.id)}">Ukończ</button>`;
      }
      if(task.status === 'done'){
        return `<button class="btn-task btn-task-close" data-task-action="close" data-task-id="${escapeHtml(task.id)}">Zamknij zadanie</button>`;
      }
      return '';
    }

    function buildTaskPermalink(task){
      const origin = (typeof window !== 'undefined' && window.location && window.location.origin !== undefined && window.location.origin !== null) ? window.location.origin : '';
      const author = task.author ? '?author=' + encodeURIComponent(task.author) : '';
      return origin + '/tasks/' + encodeURIComponent(task.id) + author;
    }

    function truncateUrl(url){
      return url.length > 60 ? url.slice(0, 60) + '…' : url;
    }

    function renderTaskCard(task){
      const priorityCls = getPriorityClass(task.priority);
      const priorityLabel = getPriorityLabel(task.priority);
      const statusBadge = getStatusBadge(task.status);
      const actionBtn = getActionButton(task);
      const dueHtml = task.dueLabel ? `<span>${escapeHtml(task.dueLabel)}</span>` : '';
      const closedClass = task.status === 'closed' ? ' is-closed' : '';
      const descHtml = task.description ? `<p class="task-desc">${escapeHtml(task.description)}</p>` : '';
      const attachHtml = (task.attachment && /^data:image\//.test(task.attachment)) ? `<img class="task-attachment-thumb" src="${task.attachment}" alt="Załącznik" loading="lazy">` : '';
      const shareBtn = `<button class="btn-task btn-task-share" data-task-action="copy-link" data-task-id="${escapeHtml(task.id)}" title="Skopiuj link do zadania" aria-label="Skopiuj link">🔗 Skopiuj link</button>`;
      return `
        <div class="task-item${closedClass}" data-task-id="${escapeHtml(task.id)}">
          <div class="task-header">
            ${statusBadge}
            <span class="${priorityCls}">${priorityLabel}</span>
          </div>
          <p class="task-title">${escapeHtml(task.title)}</p>
          ${descHtml}
          ${attachHtml}
          <div class="task-meta">
            <span>${escapeHtml(task.assignee)}</span>
            ${dueHtml}
          </div>
          <div class="task-action-row">${actionBtn ? actionBtn + ' ' : ''}${shareBtn}</div>
        </div>`;
    }

    function updateTaskStats(){
      const nonClosed = tasks.filter(t => t.status !== 'closed');
      const doneTasks = tasks.filter(t => t.status === 'done');
      const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
      const today = new Date().toISOString().slice(0, 10);
      const closedToday = tasks.filter(t => t.status === 'closed' && t.closedAt && t.closedAt.startsWith(today)).length;
      const totalEl = document.querySelector('[data-tasks-total]');
      const doneEl = document.querySelector('[data-tasks-done-today]');
      const inProgressEl = document.querySelector('[data-tasks-in-progress]');
      if(totalEl) totalEl.textContent = nonClosed.length;
      if(doneEl) doneEl.textContent = doneTasks.length + closedToday;
      if(inProgressEl) inProgressEl.textContent = inProgressTasks.length;
    }

    function renderBoard(){
      const open = tasks.filter(t => t.status === 'open');
      const inProgress = tasks.filter(t => t.status === 'in_progress');
      const done = tasks.filter(t => t.status === 'done');
      const openCol = `
        <div class="task-column" data-column="open">
          <div class="task-column-head">
            <h3>Do zrobienia</h3>
            <span class="status-open status-col-badge">OPEN</span>
            <span class="task-count">${open.length}</span>
            <button class="task-add-btn" data-task-add="open" aria-label="Dodaj zadanie" title="Dodaj zadanie">+</button>
          </div>
          ${open.map(renderTaskCard).join('')}
        </div>`;
      const inProgressCol = `
        <div class="task-column" data-column="in_progress">
          <div class="task-column-head">
            <h3>W realizacji</h3>
            <span class="status-in-progress status-col-badge">IN PROGRESS</span>
            <span class="task-count">${inProgress.length}</span>
            <button class="task-add-btn" data-task-add="in_progress" aria-label="Dodaj zadanie" title="Dodaj zadanie">+</button>
          </div>
          ${inProgress.map(renderTaskCard).join('')}
        </div>`;
      const doneCol = `
        <div class="task-column" data-column="done">
          <div class="task-column-head">
            <h3>Ukończone</h3>
            <span class="status-done status-col-badge">DONE</span>
            <span class="task-count">${done.length}</span>
          </div>
          ${done.map(renderTaskCard).join('')}
        </div>`;
      board.innerHTML = openCol + inProgressCol + doneCol;
      updateTaskStats();
    }

    function showTaskFeedback(title, detail){
      let el = document.querySelector('[data-task-feedback]');
      if(!el){
        el = document.createElement('div');
        el.className = 'task-feedback';
        el.setAttribute('data-task-feedback', '');
        const strong = document.createElement('strong');
        const span = document.createElement('span');
        el.append(strong, span);
        document.body.appendChild(el);
      }
      const strong = el.querySelector('strong');
      const span = el.querySelector('span');
      if(strong) strong.textContent = title;
      if(span) span.textContent = detail || '';
      el.classList.remove('is-visible');
      requestAnimationFrame(() => {
        requestAnimationFrame(() => el.classList.add('is-visible'));
      });
      clearTimeout(el._hideTimer);
      el._hideTimer = setTimeout(() => {
        el.classList.remove('is-visible');
      }, 2800);
    }

    function handleTaskAction(action, taskId){
      if(action === 'copy-link'){
        const task = tasks.find(t => t.id === taskId);
        if(!task) return;
        const url = buildTaskPermalink(task);
        if(navigator.clipboard && navigator.clipboard.writeText){
          navigator.clipboard.writeText(url).then(function(){
            showTaskFeedback('🔗 Link skopiowany', truncateUrl(url));
          }).catch(function(){
            showTaskFeedback('Link do zadania', truncateUrl(url));
          });
        } else {
          showTaskFeedback('Link do zadania', truncateUrl(url));
        }
        return;
      }
      const idx = tasks.findIndex(t => t.id === taskId);
      if(idx === -1) return;
      if(action === 'start'){
        tasks[idx].status = 'in_progress';
        showTaskFeedback('Zadanie uruchomione', 'Status: IN PROGRESS');
      } else if(action === 'complete'){
        tasks[idx].status = 'done';
        showTaskFeedback('Zadanie ukończone', 'Status: DONE');
      } else if(action === 'close'){
        tasks[idx].status = 'closed';
        tasks[idx].closedAt = new Date().toISOString();
        showTaskFeedback('✓ Zadanie zamknięte', 'Issue closed');
      }
      saveStoredList(OWNER_STORAGE_KEYS.tasks, tasks);
      renderBoard();
    }

    function openNewTaskModal(defaultStatus){
      const modal = document.querySelector('[data-task-modal]');
      if(!modal) return;
      const statusInput = modal.querySelector('[name="status"]');
      if(statusInput) statusInput.value = defaultStatus || 'open';
      modal.hidden = false;
      document.body.classList.add('modal-open');
      const titleInput = modal.querySelector('[name="title"]');
      if(titleInput) titleInput.focus();
    }

    function closeTaskModal(){
      const modal = document.querySelector('[data-task-modal]');
      if(modal) modal.hidden = true;
      document.body.classList.remove('modal-open');
    }

    function initTaskModal(){
      const modal = document.querySelector('[data-task-modal]');
      if(!modal) return;
      const form = modal.querySelector('[data-task-form]');
      const closeBtns = modal.querySelectorAll('[data-task-modal-close]');

      let pendingAttachment = null;

      const MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024;

      function clearAttachmentPreview(){
        pendingAttachment = null;
        const previewWrap = modal.querySelector('[id="task-attachment-preview-wrap"]');
        const hint = modal.querySelector('[data-task-upload-hint]');
        const fileInput = modal.querySelector('[data-task-attachment-input]');
        if(previewWrap) previewWrap.hidden = true;
        if(hint) hint.textContent = '';
        if(fileInput) fileInput.value = '';
      }

      const fileInput = form && form.querySelector('[data-task-attachment-input]');
      if(fileInput){
        fileInput.addEventListener('change', () => {
          const file = fileInput.files && fileInput.files[0];
          const hint = modal.querySelector('[data-task-upload-hint]');
          const previewWrap = modal.querySelector('[id="task-attachment-preview-wrap"]');
          const previewImg = modal.querySelector('[id="task-attachment-preview"]');
          if(!file){
            pendingAttachment = null;
            if(previewWrap) previewWrap.hidden = true;
            if(hint) hint.textContent = '';
            return;
          }
          const MAX_BYTES = MAX_ATTACHMENT_BYTES;
          if(file.size > MAX_BYTES){
            if(hint){
              hint.textContent = 'Plik jest za duży (maks. 1 MB). Wybierz mniejsze zdjęcie.';
              hint.style.color = '#f87171';
            }
            fileInput.value = '';
            pendingAttachment = null;
            if(previewWrap) previewWrap.hidden = true;
            return;
          }
          if(hint){ hint.textContent = ''; hint.style.color = ''; }
          const reader = new FileReader();
          reader.onload = function(ev){
            pendingAttachment = ev.target.result;
            if(previewImg && /^data:image\//.test(pendingAttachment)) previewImg.src = pendingAttachment;
            if(previewWrap) previewWrap.hidden = false;
          };
          reader.readAsDataURL(file);
        });
      }

      const removeBtn = form && form.querySelector('[data-task-attachment-remove]');
      if(removeBtn){
        removeBtn.addEventListener('click', clearAttachmentPreview);
      }

      closeBtns.forEach(btn => btn.addEventListener('click', () => { clearAttachmentPreview(); closeTaskModal(); }));
      modal.addEventListener('click', e => {
        if(e.target === modal){ clearAttachmentPreview(); closeTaskModal(); }
      });
      document.addEventListener('keydown', e => {
        if(e.key === 'Escape' && !modal.hidden){ clearAttachmentPreview(); closeTaskModal(); }
      });
      if(form){
        form.addEventListener('submit', e => {
          e.preventDefault();
          const data = new FormData(form);
          const title = (data.get('title') || '').trim();
          if(!title) return;
          const newId = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `task_${Date.now()}`;
          let taskAuthor = '';
          try {
            const profileRaw = localStorage.getItem(STORAGE_KEYS.userProfile);
            const profile = profileRaw ? JSON.parse(profileRaw) : null;
            taskAuthor = (profile && (profile.name || profile.login || profile.email)) || '';
          } catch(e) {}
          const newTask = {
            id: newId,
            title,
            description: (data.get('description') || '').trim(),
            priority: data.get('priority') || 'med',
            assignee: (data.get('assignee') || '').trim() || 'Nieprzypisane',
            dueLabel: (data.get('dueLabel') || '').trim() || null,
            status: data.get('status') || 'open',
            createdAt: new Date().toISOString(),
            closedAt: null,
            author: taskAuthor,
            attachment: pendingAttachment || null
          };
          tasks.unshift(newTask);
          saveStoredList(OWNER_STORAGE_KEYS.tasks, tasks);
          form.reset();
          clearAttachmentPreview();
          closeTaskModal();
          renderBoard();
          showTaskFeedback('Nowe zadanie dodane', 'Status: OPEN');
        });
      }
    }

    board.addEventListener('click', e => {
      const actionBtn = e.target.closest('[data-task-action]');
      if(actionBtn){
        const action = actionBtn.dataset.taskAction;
        const taskId = actionBtn.dataset.taskId;
        if(action && taskId) handleTaskAction(action, taskId);
        return;
      }
      const addBtn = e.target.closest('[data-task-add]');
      if(addBtn) openNewTaskModal(addBtn.dataset.taskAdd);
    });

    const newTaskBtn = document.querySelector('[data-task-new-btn]');
    if(newTaskBtn){
      newTaskBtn.addEventListener('click', () => openNewTaskModal('open'));
    }

    initTaskModal();
    renderBoard();

    const deepLinkId = new URLSearchParams(window.location.search).get('id');
    if(deepLinkId){
      const targetEl = board.querySelector(`[data-task-id="${CSS.escape(deepLinkId)}"]`);
      if(targetEl){
        targetEl.classList.add('task-item--focused');
        requestAnimationFrame(() => targetEl.scrollIntoView({behavior:'smooth', block:'center'}));
      } else {
        showTaskFeedback('Zadanie nie znalezione', 'ID: ' + deepLinkId.slice(0, 20));
      }
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    initServiceWorker();
    initInstallBanner();
    initAppInstallExperience();
    initAppSplash();
    bindMenu();
    initBottomNav();
    ensureFinalStorage();
    trackSalesLinkClick();
    initOwnerPanel();
    initOperatorPanel();
    initScriptsTab();
    initSuppliersModule();
    initStorefrontProducts();
    initSalesLinksPage();
    initCounters();
    initHelperBoxes();
    initPromoMotion();
    initActivityToasts();
    initSalesCalculator();
    initStoreCalculator();
    initTrafficCalculator();
    initSlotsBanner();
    initLandingModal();
    initSurveyModal();
    initPlanCheckoutReturn();
    initPricingSelector();
    initBillingToggle();
    applyPlanRecommendation();
    initPlanGates();
    initStoreGenerator();
    initLoginForm();
    guardDashboard();
    initSuperadminLink();
    initSmsOwnerLogin();
    initSupplierApplicationForm();
    initMotionPolish();
    initTasksModule();
  });

  window.addEventListener('pagehide', () => {
    liveCounterIntervals.forEach(intervalId => clearInterval(intervalId));
    liveCounterIntervals.clear();
    if(activityToastIntervalId){
      clearInterval(activityToastIntervalId);
      activityToastIntervalId = null;
    }
  });
})();
