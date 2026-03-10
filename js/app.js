(function(){
  const STORAGE_KEYS = {
    email: 'app_user_email',
    logged: 'app_user_logged',
    usersCount: 'app_users_count',
    usersList: 'app_users_list',
    trialDays: 'app_user_trial_days',
    trialStart: 'app_user_trial_start',
    plan: 'app_user_plan',
    storeSettings: 'app_store_settings',
    storeReady: 'app_store_ready',
    surveyResponses: 'app_survey_responses',
    surveySeen: 'app_survey_seen'
  };
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const SURVEY_AUTO_OPEN_DELAY = 4500;
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
  const TRIAL_RULES = [
    {limit: 3, days: 60},
    {limit: 5, days: 30}
  ];
  const DEFAULT_TRIAL_DAYS = 7;
  const PLAN_LABELS = {
    trial: 'Trial',
    basic: 'Basic',
    pro: 'PRO',
    elite: 'ELITE'
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
        if(modal.hidden){
          openModal(true);
        }
      }, SURVEY_AUTO_OPEN_DELAY);
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

  function getStoredPlan(){
    const storedPlan = localStorage.getItem(STORAGE_KEYS.plan);
    return storedPlan ? storedPlan.toLowerCase() : '';
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
    localStorage.setItem(STORAGE_KEYS.storeSettings, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEYS.storeReady, 'true');
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

  function formatPlanLabel(plan){
    const normalized = (plan || '').toLowerCase();
    return PLAN_LABELS[normalized] || PLAN_LABELS.basic;
  }

  function resolvePlan(remaining){
    const storedPlan = getStoredPlan();
    if(storedPlan){
      return storedPlan;
    }
    return remaining > 0 ? 'trial' : 'basic';
  }

  function startTrialIfNeeded(email){
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

    let trialDays = DEFAULT_TRIAL_DAYS;
    const rule = TRIAL_RULES.find(entry => currentCount <= entry.limit);
    if(rule){
      trialDays = rule.days;
    }
    localStorage.setItem(STORAGE_KEYS.trialDays, `${trialDays}`);
    localStorage.setItem(STORAGE_KEYS.trialStart, new Date().toISOString());
    const existingPlan = getStoredPlan();
    if(!existingPlan || existingPlan === 'trial'){
      localStorage.setItem(STORAGE_KEYS.plan, 'trial');
    }
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
      const storedPlan = getStoredPlan();
      if(!storedPlan || storedPlan === 'trial'){
        localStorage.setItem(STORAGE_KEYS.plan, 'basic');
      }
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

  function updateDashboardStatus(){
    const trialTargets = document.querySelectorAll('[data-trial-remaining]');
    const remaining = getTrialRemainingDays();
    const plan = resolvePlan(remaining);
    if(trialTargets.length){
      trialTargets.forEach(target => {
        target.textContent = plan === 'trial' ? `${remaining}` : 'Aktywny';
      });
    }
    const trialLabel = document.querySelector('[data-trial-label]');
    if(trialLabel){
      trialLabel.textContent = plan === 'trial' ? getTrialLabel(remaining) : 'plan';
    }
    const planTarget = document.querySelector('[data-user-plan]');
    if(planTarget){
      planTarget.textContent = formatPlanLabel(plan);
    }
    updatePlanStatusLabels(plan);
    updatePlanPurchaseButtons(plan);
  }

  function updatePlanStatusLabels(plan){
    const statusTargets = document.querySelectorAll('[data-plan-status]');
    if(!statusTargets.length){
      return;
    }
    const label = formatPlanLabel(plan);
    statusTargets.forEach(target => {
      target.textContent = `Aktywny plan: ${label}`;
    });
  }

  function updatePlanPurchaseButtons(plan){
    const buttons = document.querySelectorAll('[data-plan-buy]');
    if(!buttons.length){
      return;
    }
    buttons.forEach(button => {
      const buttonPlan = (button.dataset.planBuy || '').toLowerCase();
      if(!button.dataset.planDefault){
        button.dataset.planDefault = button.textContent.trim();
      }
      const isActive = buttonPlan && buttonPlan === plan;
      if(isActive){
        button.textContent = 'Aktualny plan';
        button.disabled = true;
        button.setAttribute('aria-disabled', 'true');
      } else {
        button.textContent = button.dataset.planDefault;
        button.disabled = false;
        button.removeAttribute('aria-disabled');
      }
    });
  }

  function handlePlanPurchase(plan){
    const normalizedPlan = (plan || '').toLowerCase();
    if(!normalizedPlan){
      return;
    }
    localStorage.setItem(STORAGE_KEYS.plan, normalizedPlan);
    if(normalizedPlan !== 'trial'){
      localStorage.setItem(STORAGE_KEYS.trialDays, '0');
    }
    updateDashboardStatus();
  }

  function initPlanPurchaseButtons(){
    const buttons = document.querySelectorAll('[data-plan-buy]');
    if(!buttons.length){
      updatePlanStatusLabels(resolvePlan(getTrialRemainingDays()));
      return;
    }
    const plan = resolvePlan(getTrialRemainingDays());
    updatePlanPurchaseButtons(plan);
    updatePlanStatusLabels(plan);
    buttons.forEach(button => {
      button.addEventListener('click', () => {
        handlePlanPurchase(button.dataset.planBuy);
      });
    });
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
    const storeName = settings && settings.storeName ? settings.storeName : 'Brak danych';
    const storeStyle = settings && settings.storeStyle ? settings.storeStyle : '---';

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
      if(nameInput && storedSettings.storeName){
        nameInput.value = storedSettings.storeName;
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
      }
      localStorage.setItem(STORAGE_KEYS.logged, 'true');
      startTrialIfNeeded(email);
      window.location.href = 'dashboard.html';
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindMenu();
    initCounters();
    initHelperBoxes();
    initActivityToasts();
    initSlotsBanner();
    initSurveyModal();
    initStoreGenerator();
    initLoginForm();
    guardDashboard();
    initPlanPurchaseButtons();
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
