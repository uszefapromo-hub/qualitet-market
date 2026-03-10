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
    calculatorResults: 'calculatorResults'
  };
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const SURVEY_AUTO_OPEN_DELAY = 4500;
  const LANDING_AUTO_OPEN_DELAY = 2400;
  const SURVEY_SUCCESS_TIMEOUT = 1500;
  const DEFAULT_LOCALE = 'pl-PL';
  const DEFAULT_TEST_SLOTS = 20;
  const DEFAULT_LIVE_STEP_MIN = 1;
  const DEFAULT_LIVE_STEP_MAX = 3;
  const DEFAULT_LIVE_INTERVAL_MS = 6500;
  const TOAST_INTERVAL_MS = 5200;
  const TOAST_INTERVAL_REDUCED_MS = 9000;
  const TOAST_DISPLAY_MS = 4200;
  const TOAST_DISPLAY_REDUCED_MS = 3600;
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
  const DEFAULT_TRIAL_DAYS = 7;
  const PLAN_LEVELS = {
    trial: 0,
    basic: 0,
    pro: 1,
    elite: 2
  };
  const PLAN_LABELS = {
    trial: 'Trial',
    basic: 'Basic',
    pro: 'PRO',
    elite: 'ELITE'
  };
  const OWNER_EMAIL = 'uszefaqualitetpromo@gmail.com';
  const PRICE_LINKS = {
    basic: '',
    pro: '',
    elite: ''
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
    activeStore: 'activeStore'
  };

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

  function ensureSeedList(key, seedList){
    const existing = getStoredList(key);
    if(Array.isArray(existing) && existing.length){
      return existing;
    }
    saveStoredList(key, seedList);
    return seedList;
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
        const finalPrice = product.cost * (1 + margin / 100);
        const createdAt = new Date(now - (index + 1) * MS_PER_DAY).toISOString();
        const mapped = {
          id: `catalog_${product.id}`,
          name: product.name,
          cost: product.cost,
          finalPrice: Math.round(finalPrice),
          margin,
          supplier: supplier.name,
          category: product.category,
          storeId: index % 2 === 0 ? 'store_elektronika' : 'store_moda',
          createdAt
        };
        index += 1;
        return mapped;
      });
    });
  }

  function ensureOwnerDemoData(){
    const seedSuppliers = [
      {
        id: 'supplier_elektronika',
        name: 'Elektronika',
        slug: 'elektronika',
        category: 'Elektronika',
        description: 'Premium elektronika użytkowa i akcesoria smart.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=E',
        products: [
          {
            id: 'elektro_watch',
            name: 'Smartwatch Pulsar',
            cost: 420,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Smartwatch',
            description: 'Wyświetlacz AMOLED, tryby sportowe, szybkie ładowanie.',
            supplier: 'Elektronika',
            category: 'Wearables'
          },
          {
            id: 'elektro_audio',
            name: 'Słuchawki Quantum',
            cost: 260,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Audio',
            description: 'Redukcja szumów, etui premium, 40h pracy.',
            supplier: 'Elektronika',
            category: 'Audio'
          },
          {
            id: 'elektro_cam',
            name: 'Kamera Auri',
            cost: 610,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Kamera',
            description: 'Kamera 4K do monitoringu i vlogowania.',
            supplier: 'Elektronika',
            category: 'Foto'
          }
        ]
      },
      {
        id: 'supplier_dom',
        name: 'Dom i ogród',
        slug: 'dom-i-ogrod',
        category: 'Dom i ogród',
        description: 'Nowoczesne wyposażenie domu i strefy outdoor.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=D',
        products: [
          {
            id: 'home_lamp',
            name: 'Lampa Halo',
            cost: 190,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Lampa',
            description: 'Regulowane światło, sterowanie aplikacją.',
            supplier: 'Dom i ogród',
            category: 'Oświetlenie'
          },
          {
            id: 'home_garden',
            name: 'Zestaw ogrodowy Leaf',
            cost: 520,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Ogród',
            description: 'Aluminiowe meble, odporność na warunki.',
            supplier: 'Dom i ogród',
            category: 'Ogród'
          },
          {
            id: 'home_robot',
            name: 'Robot sprzątający Orbit',
            cost: 840,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Robot',
            description: 'Mapowanie 3D, automatyczne mopowanie.',
            supplier: 'Dom i ogród',
            category: 'AGD'
          }
        ]
      },
      {
        id: 'supplier_moda',
        name: 'Moda',
        slug: 'moda',
        category: 'Moda',
        description: 'Nowe kolekcje street i premium fashion.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=M',
        products: [
          {
            id: 'fashion_jacket',
            name: 'Kurtka Nova',
            cost: 210,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Kurtka',
            description: 'Wodoodporna, lekka, w zestawie torba.',
            supplier: 'Moda',
            category: 'Odzież'
          },
          {
            id: 'fashion_sneakers',
            name: 'Sneakers Lumen',
            cost: 240,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Sneakers',
            description: 'Limitowana edycja, wkładka gel.',
            supplier: 'Moda',
            category: 'Obuwie'
          },
          {
            id: 'fashion_bag',
            name: 'Torba City',
            cost: 120,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Torba',
            description: 'Skóra ekologiczna, trzy komory.',
            supplier: 'Moda',
            category: 'Akcesoria'
          }
        ]
      },
      {
        id: 'supplier_kids',
        name: 'Dziecko',
        slug: 'dziecko',
        category: 'Dziecko',
        description: 'Produkty wspierające rozwój i bezpieczeństwo dzieci.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=K',
        products: [
          {
            id: 'kids_stroller',
            name: 'Wózek Comet',
            cost: 980,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Wózek',
            description: 'Ultralekki stelaż, amortyzacja premium.',
            supplier: 'Dziecko',
            category: 'Wózki'
          },
          {
            id: 'kids_blocks',
            name: 'Klocki Cosmo',
            cost: 140,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Klocki',
            description: 'Zestaw kreatywny, 250 elementów.',
            supplier: 'Dziecko',
            category: 'Zabawki'
          },
          {
            id: 'kids_monitor',
            name: 'Niania Halo',
            cost: 360,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Niania',
            description: 'Kamera nocna, czujnik temperatury.',
            supplier: 'Dziecko',
            category: 'Elektronika'
          }
        ]
      },
      {
        id: 'supplier_auto',
        name: 'Auto',
        slug: 'auto',
        category: 'Auto',
        description: 'Akcesoria samochodowe i wyposażenie premium.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=A',
        products: [
          {
            id: 'auto_cam',
            name: 'Wideorejestrator Drive',
            cost: 320,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Auto+Cam',
            description: 'Nagrywanie 4K, tryb parkingowy.',
            supplier: 'Auto',
            category: 'Elektronika'
          },
          {
            id: 'auto_detail',
            name: 'Zestaw detailingowy',
            cost: 180,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Detailing',
            description: 'Kosmetyki premium, mikrofibry.',
            supplier: 'Auto',
            category: 'Kosmetyki'
          },
          {
            id: 'auto_holder',
            name: 'Uchwyt Gravity',
            cost: 90,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Uchwyt',
            description: 'Automatyczny zacisk, ładowanie Qi.',
            supplier: 'Auto',
            category: 'Akcesoria'
          }
        ]
      },
      {
        id: 'supplier_beauty',
        name: 'Beauty',
        slug: 'beauty',
        category: 'Beauty',
        description: 'Kosmetyki i urządzenia beauty w segmencie premium.',
        logo: 'https://placehold.co/96x96/0f1837/FFFFFF?text=B',
        products: [
          {
            id: 'beauty_serum',
            name: 'Serum Glow',
            cost: 150,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Serum',
            description: 'Witamina C, efekt rozświetlenia.',
            supplier: 'Beauty',
            category: 'Pielęgnacja'
          },
          {
            id: 'beauty_dryer',
            name: 'Suszarka Aura',
            cost: 310,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=Suszarka',
            description: 'Jonizacja, tryb pielęgnacyjny.',
            supplier: 'Beauty',
            category: 'Sprzęt'
          },
          {
            id: 'beauty_spa',
            name: 'Zestaw SPA',
            cost: 120,
            image: 'https://placehold.co/400x280/0f1837/FFFFFF?text=SPA',
            description: 'Świece, olejki, maski regenerujące.',
            supplier: 'Beauty',
            category: 'Relaks'
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
            id: 'elektro_watch',
            name: 'Smartwatch Pulsar',
            cost: 420,
            margin: 28,
            finalPrice: 538,
            supplier: 'Elektronika'
          },
          {
            id: 'elektro_audio',
            name: 'Słuchawki Quantum',
            cost: 260,
            margin: 32,
            finalPrice: 343,
            supplier: 'Elektronika'
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
            id: 'fashion_jacket',
            name: 'Kurtka Nova',
            cost: 210,
            margin: 40,
            finalPrice: 294,
            supplier: 'Moda'
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
        products: [],
        createdAt: '2026-02-24T08:22:00Z'
      }
    ];

    const seedUsers = [
      {
        id: 'user_anna',
        name: 'Anna Nowak',
        email: 'anna@uszefaqualitet.pl',
        plan: 'pro',
        createdAt: '2026-02-08T07:40:00Z'
      },
      {
        id: 'user_marek',
        name: 'Marek Kowalski',
        email: 'marek@uszefaqualitet.pl',
        plan: 'basic',
        createdAt: '2026-02-11T11:20:00Z'
      },
      {
        id: 'user_ola',
        name: 'Ola Zielińska',
        email: 'ola@uszefaqualitet.pl',
        plan: 'elite',
        createdAt: '2026-02-15T14:10:00Z'
      },
      {
        id: 'user_tomasz',
        name: 'Tomasz Kaczmarek',
        email: 'tomasz@uszefaqualitet.pl',
        plan: 'pro',
        createdAt: '2026-02-21T09:55:00Z'
      },
      {
        id: 'user_klaudia',
        name: 'Klaudia Nowicka',
        email: 'klaudia@uszefaqualitet.pl',
        plan: 'basic',
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

    const suppliers = ensureSeedList(OWNER_STORAGE_KEYS.suppliers, seedSuppliers);
    const stores = ensureSeedList(OWNER_STORAGE_KEYS.stores, seedStores);
    if(!localStorage.getItem(OWNER_STORAGE_KEYS.activeStore) && stores.length){
      localStorage.setItem(OWNER_STORAGE_KEYS.activeStore, stores[0].id);
    }
    const products = ensureSeedList(OWNER_STORAGE_KEYS.products, buildProductsFromSuppliers(suppliers));
    const users = ensureSeedList(OWNER_STORAGE_KEYS.users, seedUsers);
    const leads = ensureSeedList(OWNER_STORAGE_KEYS.leads, seedLeads);
    const subscriptions = ensureSeedList(OWNER_STORAGE_KEYS.subscriptions, seedSubscriptions);

    return {
      users,
      stores,
      leads,
      products,
      subscriptions,
      suppliers
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
      margin: 25,
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
    if(trafficCalc){
      const trafficSignal = normalizeNumberValue(
        trafficCalc.monthlyVisits ?? trafficCalc.visits ?? trafficCalc.traffic,
        0
      );
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

  function applyPlanRecommendation(results){
    const resolved = results || loadCalculatorResults() || {};
    const decision = normalizeDecision(resolved.decision);
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
      profitCalc: existing.profitCalc || null,
      storeCalc: existing.storeCalc || null,
      trafficCalc: existing.trafficCalc || null,
      ...existing,
      ...partial
    };
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

    const update = () => {
      const niche = nicheInput ? nicheInput.value.trim() : '';
      const budgetValue = Math.max(0, normalizeNumberValue(budgetInput ? budgetInput.value : 0, 0));
      const marginValue = normalizeMarginValue(marginInput ? marginInput.value : 0, 0);
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
    const pricing = calculatePricing(product.cost, margin);
    const entry = {
      id: product.id,
      name: product.name,
      cost: pricing.cost,
      margin: pricing.margin,
      finalPrice: pricing.finalPrice,
      profit: pricing.profit,
      supplier: product.supplier,
      category: product.category,
      image: product.image,
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

    return {
      store: updatedStore,
      product: entry
    };
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
    const seed = {
      niche: activeStore.name,
      budget: 12000,
      margin: activeStore.margin,
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
    if(normalized !== 'trial'){
      localStorage.removeItem(STORAGE_KEYS.trialStart);
      localStorage.removeItem(STORAGE_KEYS.trialDays);
    }
  }

  function getCurrentPlan(){
    const logged = localStorage.getItem(STORAGE_KEYS.logged) === 'true';
    if(logged){
      startTrialIfNeeded(localStorage.getItem(STORAGE_KEYS.email));
    }
    const storedPlan = normalizePlan(localStorage.getItem(STORAGE_KEYS.plan));
    if(storedPlan){
      return storedPlan;
    }
    if(logged){
      const remaining = getTrialRemainingDays();
      return remaining > 0 ? 'trial' : 'basic';
    }
    return null;
  }

  function getPlanStatusLabel(plan, remaining){
    const normalized = normalizePlan(plan);
    if(!normalized){
      return 'Brak aktywnego planu';
    }
    if(normalized === 'trial'){
      return `Trial • ${remaining} ${getTrialLabel(remaining)}`;
    }
    return 'Aktywny';
  }

  function getPlanHint(plan, remaining){
    const normalized = normalizePlan(plan);
    if(normalized === 'trial'){
      return `Trial Basic jest aktywny jeszcze przez ${remaining} ${getTrialLabel(remaining)}.`;
    }
    if(normalized === 'pro'){
      return 'Masz pełny dostęp do modułów PRO oraz hurtowni.';
    }
    if(normalized === 'elite'){
      return 'Pełen pakiet ELITE odblokowuje wszystkie moduły i analitykę AI.';
    }
    return 'Plan Basic daje dostęp do podstawowych modułów sprzedaży.';
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
    const storeName = settings && (settings.storeName || settings.niche) ? (settings.storeName || settings.niche) : 'Brak danych';
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
    const highlightPlan = currentPlan === 'trial' ? 'basic' : currentPlan;
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
    const logged = localStorage.getItem(STORAGE_KEYS.logged) === 'true';
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
    const currentPlan = getCurrentPlan();
    const currentLevel = getPlanLevel(currentPlan);
    const elements = Array.from(document.querySelectorAll('[data-require]:not(body)'));
    if(elements.length){
      elements.forEach(element => {
        const requiredPlan = normalizePlan(element.dataset.require);
        if(!requiredPlan){
          return;
        }
        const requiredLevel = getPlanLevel(requiredPlan);
        if(requiredLevel < 0){
          return;
        }
        const allowed = currentLevel >= requiredLevel;
        element.classList.toggle('is-locked', !allowed);
        if(!allowed){
          element.setAttribute('aria-disabled', 'true');
        }
        element.addEventListener('click', event => {
          const latestLevel = getPlanLevel(getCurrentPlan());
          if(latestLevel < requiredLevel){
            event.preventDefault();
            event.stopPropagation();
            showUpgradeModal(requiredPlan);
          }
        });
      });
    }
    const pageRequirement = normalizePlan(document.body.dataset.require);
    const pageRequirementLevel = getPlanLevel(pageRequirement);
    if(pageRequirement && pageRequirementLevel >= 0 && currentLevel < pageRequirementLevel){
      document.body.classList.add('page-locked');
      showUpgradeModal(pageRequirement, {lockPage: true});
    }
  }

  function guardDashboard(){
    if(document.body.dataset.page !== 'dashboard'){
      return;
    }
    const logged = localStorage.getItem(STORAGE_KEYS.logged) === 'true';
    if(!logged){
      window.location.href = 'login.html';
      return;
    }
    startTrialIfNeeded(localStorage.getItem(STORAGE_KEYS.email));
    updateDashboardStatus();
    renderDashboardStoreSummary();
  }

  function getStoredUserRole(){
    const storedRole = normalizeQueryParam(localStorage.getItem(STORAGE_KEYS.role));
    if(storedRole){
      return storedRole;
    }
    const rawProfile = localStorage.getItem('app_user_profile');
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
    if(role === 'owner'){
      return true;
    }
    const email = normalizeQueryParam(localStorage.getItem(STORAGE_KEYS.email));
    return email && email === normalizeQueryParam(OWNER_EMAIL);
  }

  function applyOwnerAccessState(){
    if(document.body.dataset.page !== 'owner-panel'){
      return false;
    }
    const accessGranted = hasOwnerAccess();
    const lockedPanel = document.querySelector('[data-owner-locked]');
    const content = document.querySelector('[data-owner-content]');
    if(lockedPanel){
      lockedPanel.hidden = accessGranted;
    }
    if(content){
      content.hidden = !accessGranted;
    }
    return accessGranted;
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

    const activeSubscriptions = subscriptions.filter(subscription => subscription.status === 'active');
    const planCounts = {basic: 0, pro: 0, elite: 0};
    activeSubscriptions.forEach(subscription => {
      const normalizedPlan = normalizePlan(subscription.plan);
      if(normalizedPlan && planCounts[normalizedPlan] !== undefined){
        planCounts[normalizedPlan] += 1;
      }
    });
    const revenue = activeSubscriptions.reduce((sum, subscription) => {
      const amount = Number.parseFloat(subscription.amount);
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);
    const sales = products.length;

    const counters = [
      ['[data-owner-users]', users.length],
      ['[data-owner-stores]', stores.length],
      ['[data-owner-products]', products.length],
      ['[data-owner-leads]', leads.length],
      ['[data-owner-revenue]', Math.round(revenue)],
      ['[data-owner-sales]', sales],
      ['[data-owner-plan-basic]', planCounts.basic],
      ['[data-owner-plan-pro]', planCounts.pro],
      ['[data-owner-plan-elite]', planCounts.elite]
    ];
    counters.forEach(([selector, value]) => {
      const target = document.querySelector(selector);
      if(target){
        target.dataset.counter = `${Math.max(0, Math.round(value))}`;
      }
    });

    const planTargets = [
      {selector: '[data-owner-plan-basic]', value: planCounts.basic},
      {selector: '[data-owner-plan-pro]', value: planCounts.pro},
      {selector: '[data-owner-plan-elite]', value: planCounts.elite}
    ];
    window.setTimeout(() => {
      planTargets.forEach(({selector, value}) => {
        const target = document.querySelector(selector);
        if(target){
          setCounterValue(target, value);
        }
      });
    }, 1300);

    const storeList = document.querySelector('[data-owner-stores-list]');
    const leadList = document.querySelector('[data-owner-leads-list]');
    const productList = document.querySelector('[data-owner-products-list]');
    const supplierList = document.querySelector('[data-owner-suppliers-list]');

    const renderList = (container, items, builder, emptyMessage) => {
      if(!container){
        return;
      }
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

    const sortedStores = [...stores].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    renderList(storeList, sortedStores, store => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const productCount = Array.isArray(store.products) ? store.products.length : 0;
      card.innerHTML = `
        <strong>${store.name}</strong>
        <span class="hint">Plan ${formatPlanLabel(store.plan)} • ${productCount} produktów</span>
        <small>Dodano: ${formatDate(store.createdAt)}</small>
      `;
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
      card.innerHTML = `
        <strong>${lead.name}</strong>
        <span class="status-pill ${meta.className}">${meta.label}</span>
        <small>${lead.email} • ${lead.source}</small>
      `;
      return card;
    }, 'Brak nowych leadów.');

    const sortedProducts = [...products].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 3);
    renderList(productList, sortedProducts, product => {
      const card = document.createElement('div');
      card.className = 'list-card';
      card.innerHTML = `
        <strong>${product.name}</strong>
        <span class="hint">${product.category || 'Kategoria'} • ${product.supplier || 'Katalog'}</span>
        <small>Cena: ${formatCurrency(product.finalPrice || product.cost || 0)}</small>
      `;
      return card;
    }, 'Brak nowych produktów.');

    const topSuppliers = [...suppliers].slice(0, 4);
    renderList(supplierList, topSuppliers, supplier => {
      const card = document.createElement('div');
      card.className = 'list-card';
      const productCount = Array.isArray(supplier.products) ? supplier.products.length : 0;
      card.innerHTML = `
        <div class="supplier-meta">
          <img src="${supplier.logo}" alt="${supplier.name}">
          <div>
            <strong>${supplier.name}</strong>
            <small>${supplier.category}</small>
          </div>
        </div>
        <small>${productCount} produktów w katalogu</small>
      `;
      return card;
    }, 'Brak aktywnych hurtowni.');

    const updateChart = (prefix, values) => {
      const total = Object.values(values).reduce((sum, value) => sum + value, 0) || 1;
      Object.entries(values).forEach(([key, value]) => {
        const percent = Math.round((value / total) * 100);
        const bar = document.querySelector(`[data-${prefix}-chart-bar="${key}"]`);
        const label = document.querySelector(`[data-${prefix}-chart-value="${key}"]`);
        if(bar){
          bar.style.setProperty('--value', `${percent}%`);
        }
        if(label){
          label.textContent = `${value} (${percent}%)`;
        }
      });
    };

    updateChart('plan', planCounts);

    const leadCounts = leads.reduce((acc, lead) => {
      const status = lead.status || 'cold';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {hot: 0, warm: 0, cold: 0});
    updateChart('lead', leadCounts);
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
    const totalCost = allProducts.reduce((sum, product) => sum + (Number.parseFloat(product.cost) || 0), 0);
    const avgCost = allProducts.length ? Math.round(totalCost / allProducts.length) : 0;
    const activeStore = getActiveStore(ensureStoresList());
    const storeMargin = activeStore ? normalizeMarginValue(activeStore.margin, 25) : 25;
    const storeImportCount = activeStore && Array.isArray(activeStore.products) ? activeStore.products.length : 0;

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

    let selectedSupplier = suppliers[0] || null;
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
      const pricing = calculatePricing(product.cost, marginValue);
      if(calculatorDesc){
        calculatorDesc.textContent = `${product.name} • ${product.supplier}`;
      }
      if(calculatorMargin){
        calculatorMargin.value = `${pricing.margin}`;
      }
      if(calculatorCost){
        calculatorCost.textContent = formatCurrency(pricing.cost);
      }
      if(calculatorFinal){
        calculatorFinal.textContent = formatCurrency(pricing.finalPrice);
      }
      if(calculatorProfit){
        calculatorProfit.textContent = formatCurrency(pricing.profit);
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
        const card = document.createElement('article');
        card.className = 'product-card';
        const defaultMargin = bulkMarginInput ? normalizeMarginValue(bulkMarginInput.value, storeMargin) : storeMargin;
        card.innerHTML = `
          <img src="${product.image}" alt="${product.name}">
          <div class="product-meta">
            <div>
              <span class="tag">${product.category}</span>
              <h3>${product.name}</h3>
              <p class="hint">${product.description || 'Opis produktu w przygotowaniu.'}</p>
            </div>
            <div class="price-stack">
              <span>Koszt zakupu</span>
              <strong data-product-cost>${formatCurrency(product.cost)}</strong>
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
            </div>
          </div>
        `;
        const marginInput = card.querySelector('[data-product-margin]');
        const finalTarget = card.querySelector('[data-product-final]');
        const profitTarget = card.querySelector('[data-product-profit]');
        const updateCardPricing = () => {
          const pricing = calculatePricing(product.cost, marginInput ? marginInput.value : storeMargin);
          if(finalTarget){
            finalTarget.textContent = formatCurrency(pricing.finalPrice);
          }
          if(profitTarget){
            profitTarget.textContent = formatCurrency(pricing.profit);
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
            const result = addProductToStore(product, marginInput ? marginInput.value : storeMargin);
            if(result){
              updateStatus(`Dodano "${product.name}" do ${result.store.name}.`);
              updateImportsCounter();
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
        const card = document.createElement('article');
        card.className = 'supplier-card';
        card.dataset.supplierId = supplier.slug;
        card.innerHTML = `
          <div class="supplier-meta">
            <img src="${supplier.logo}" alt="${supplier.name}">
            <div>
              <strong>${supplier.name}</strong>
              <span class="hint">${supplier.category}</span>
            </div>
          </div>
          <p class="hint">${supplier.description}</p>
          <div class="cta-row">
            <button class="btn btn-secondary" type="button">Zobacz produkty</button>
            <span class="tag">${(supplier.products || []).length} produktów</span>
          </div>
        `;
        card.addEventListener('click', () => {
          selectSupplier(supplier);
        });
        suppliersGrid.appendChild(card);
      });
    };

    renderSuppliers();
    if(selectedSupplier){
      selectSupplier(selectedSupplier);
    }

    if(searchInput){
      searchInput.addEventListener('input', applyFilters);
    }
    if(categorySelect){
      categorySelect.addEventListener('change', applyFilters);
    }
    if(bulkMarginInput){
      bulkMarginInput.addEventListener('input', () => {
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
        currentProducts.forEach(product => addProductToStore(product, marginValue));
        updateStatus(`Zaimportowano ${currentProducts.length} produktów do sklepu.`);
        updateImportsCounter();
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
        const result = addProductToStore(selectedProduct, marginValue);
        if(result){
          updateStatus(`Dodano "${selectedProduct.name}" do ${result.store.name}.`);
          updateImportsCounter();
        }
      });
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

  function initLoginForm(){
    const form = document.querySelector('[data-login-form]');
    if(!form){
      return;
    }
    form.addEventListener('submit', event => {
      event.preventDefault();
      const emailInput = form.querySelector('input[name="email"]');
      const email = emailInput ? emailInput.value.trim() : '';
      if(email){
        localStorage.setItem(STORAGE_KEYS.email, email);
        if(normalizeQueryParam(email) === normalizeQueryParam(OWNER_EMAIL)){
          localStorage.setItem(STORAGE_KEYS.role, 'owner');
        } else {
          localStorage.removeItem(STORAGE_KEYS.role);
        }
      }
      localStorage.setItem(STORAGE_KEYS.logged, 'true');
      startTrialIfNeeded(email);
      window.location.href = 'dashboard.html';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindMenu();
    ensureFinalStorage();
    initOwnerPanel();
    initSuppliersModule();
    initCounters();
    initHelperBoxes();
    initActivityToasts();
    initSalesCalculator();
    initStoreCalculator();
    initTrafficCalculator();
    initSlotsBanner();
    initLandingModal();
    initSurveyModal();
    initPlanCheckoutReturn();
    initPricingSelector();
    applyPlanRecommendation();
    initPlanGates();
    initStoreGenerator();
    initLoginForm();
    guardDashboard();
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
