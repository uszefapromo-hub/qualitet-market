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
    storeReady: 'app_store_ready'
  };
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const TRIAL_RULES = [
    {limit: 3, days: 60},
    {limit: 5, days: 30}
  ];
  const DEFAULT_TRIAL_DAYS = 7;
  const CURRENCY_FORMATTER = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0
  });

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

  function getCounterTarget(el){
    const rawValue = el.dataset.counter;
    if(!rawValue) return null;
    const target = Number.parseInt(rawValue, 10);
    return Number.isNaN(target) ? null : target;
  }

  function setCounterValue(el, value){
    el.textContent = `${value}`;
    if(el.dataset.counterLabel){
      el.setAttribute('aria-label', `${el.dataset.counterLabel}: ${value}`);
    }
  }

  function animateCounter(el){
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
      });
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if(entry.isIntersecting){
          animateCounter(entry.target);
          observer.unobserve(entry.target);
        }
      });
    }, {threshold: 0.4});

    counters.forEach(counter => {
      const target = getCounterTarget(counter);
      setCounterValue(counter, 0);
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

  function formatCurrency(value){
    return CURRENCY_FORMATTER.format(value);
  }

  function getNumericInputValue(input, fallback = 0){
    if(!input){
      return fallback;
    }
    const raw = input.value.replace(',', '.');
    const parsed = parseFloat(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function bindCalculator(card, update){
    if(!card) return;
    const inputs = card.querySelectorAll('input');
    inputs.forEach(input => input.addEventListener('input', update));
    update();
  }

  function initCalculators(){
    const calculatorCards = document.querySelectorAll('[data-calc]');
    if(!calculatorCards.length) return;

    calculatorCards.forEach(card => {
      const type = card.dataset.calc;
      if(type === 'margin'){
        bindCalculator(card, () => {
          const price = getNumericInputValue(card.querySelector('[data-calc-input="price"]'));
          const cost = getNumericInputValue(card.querySelector('[data-calc-input="cost"]'));
          const profit = price - cost;
          const margin = price > 0 ? (profit / price) * 100 : 0;
          const marginTarget = card.querySelector('[data-calc-output="margin"]');
          const profitTarget = card.querySelector('[data-calc-output="profit"]');
          if(marginTarget){
            marginTarget.textContent = `${Math.round(margin)}%`;
          }
          if(profitTarget){
            profitTarget.textContent = `Zysk: ${formatCurrency(profit)} / szt.`;
          }
        });
      }
      if(type === 'profit'){
        bindCalculator(card, () => {
          const price = getNumericInputValue(card.querySelector('[data-calc-input="price"]'));
          const cost = getNumericInputValue(card.querySelector('[data-calc-input="cost"]'));
          const quantity = getNumericInputValue(card.querySelector('[data-calc-input="quantity"]'));
          const totalProfit = (price - cost) * quantity;
          const totalTarget = card.querySelector('[data-calc-output="total-profit"]');
          if(totalTarget){
            totalTarget.textContent = formatCurrency(totalProfit);
          }
        });
      }
      if(type === 'units'){
        bindCalculator(card, () => {
          const target = getNumericInputValue(card.querySelector('[data-calc-input="target"]'));
          const profit = getNumericInputValue(card.querySelector('[data-calc-input="profit"]'));
          const units = profit > 0 ? Math.ceil(target / profit) : 0;
          const unitsTarget = card.querySelector('[data-calc-output="units"]');
          if(unitsTarget){
            unitsTarget.textContent = `${units} szt.`;
          }
        });
      }
      if(type === 'monthly'){
        bindCalculator(card, () => {
          const dailyOrders = getNumericInputValue(card.querySelector('[data-calc-input="daily-orders"]'));
          const profitPerOrder = getNumericInputValue(card.querySelector('[data-calc-input="profit-per-order"]'));
          const monthlyProfit = dailyOrders * profitPerOrder * 30;
          const monthlyTarget = card.querySelector('[data-calc-output="monthly-profit"]');
          if(monthlyTarget){
            monthlyTarget.textContent = formatCurrency(monthlyProfit);
          }
        });
      }
      if(type === 'plan'){
        bindCalculator(card, () => {
          const products = getNumericInputValue(card.querySelector('[data-calc-input="products"]'));
          const orders = getNumericInputValue(card.querySelector('[data-calc-input="orders"]'));
          let plan = 'Basic';
          let note = 'Skala startowa';
          if(products >= 280 || orders >= 320){
            plan = 'Elite';
            note = 'Skala premium i wzrost';
          } else if(products >= 120 || orders >= 160){
            plan = 'Pro';
            note = 'Rozwój sprzedaży';
          }
          const planTarget = card.querySelector('[data-calc-output="plan"]');
          const noteTarget = card.querySelector('[data-calc-output="plan-note"]');
          if(planTarget){
            planTarget.textContent = plan;
          }
          if(noteTarget){
            noteTarget.textContent = note;
          }
        });
      }
    });
  }

  function initPopups(){
    const popup = document.querySelector('[data-popup]');
    if(!popup) return;
    const titleTarget = popup.querySelector('[data-popup-title]');
    const messageTarget = popup.querySelector('[data-popup-message]');
    const ctaTarget = popup.querySelector('[data-popup-cta]');
    const closeButtons = popup.querySelectorAll('[data-popup-close]');
    let timeTriggered = false;
    let scrollTriggered = false;

    function openPopup({title, message, ctaLabel, ctaLink}){
      if(titleTarget){
        titleTarget.textContent = title;
      }
      if(messageTarget){
        messageTarget.textContent = message;
      }
      if(ctaTarget){
        ctaTarget.textContent = ctaLabel || 'Otwórz sklep';
        ctaTarget.href = ctaLink || 'generator-sklepu.html';
      }
      popup.hidden = false;
      popup.classList.add('is-visible');
      popup.setAttribute('aria-hidden', 'false');
    }

    function closePopup(){
      popup.classList.remove('is-visible');
      popup.hidden = true;
      popup.setAttribute('aria-hidden', 'true');
    }

    closeButtons.forEach(button => {
      button.addEventListener('click', closePopup);
    });

    popup.addEventListener('click', event => {
      if(event.target === popup){
        closePopup();
      }
    });

    document.querySelectorAll('[data-popup-trigger]').forEach(trigger => {
      trigger.addEventListener('click', event => {
        event.preventDefault();
        const title = trigger.dataset.popupTitle || 'Chcesz własny sklep online?';
        const message = trigger.dataset.popupMessage || 'Uruchom sklep bez programowania.';
        const link = trigger.dataset.popupLink || trigger.getAttribute('href') || 'generator-sklepu.html';
        openPopup({title, message, ctaLink: link});
      });
    });

    setTimeout(() => {
      if(timeTriggered || popup.classList.contains('is-visible')){
        return;
      }
      timeTriggered = true;
      openPopup({
        title: 'Chcesz własny sklep online?',
        message: 'Uruchom sklep bez programowania.'
      });
    }, 9000);

    window.addEventListener('scroll', () => {
      if(scrollTriggered || popup.classList.contains('is-visible')){
        return;
      }
      const scrollRatio = (window.scrollY + window.innerHeight) / document.documentElement.scrollHeight;
      if(scrollRatio > 0.45){
        scrollTriggered = true;
        openPopup({
          title: 'Zostało tylko kilka miejsc testowych',
          message: 'Dobierz plan dla swojego sklepu.'
        });
      }
    }, {passive: true});
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

  function updateDashboardStatus(){
    const trialTargets = document.querySelectorAll('[data-trial-remaining]');
    const remaining = getTrialRemainingDays();
    if(trialTargets.length){
      trialTargets.forEach(target => {
        target.textContent = `${remaining}`;
      });
    }
    const trialLabel = document.querySelector('[data-trial-label]');
    if(trialLabel){
      trialLabel.textContent = getTrialLabel(remaining);
    }
    const planTarget = document.querySelector('[data-user-plan]');
    if(planTarget){
      const storedPlan = localStorage.getItem(STORAGE_KEYS.plan);
      const plan = storedPlan || (remaining > 0 ? 'trial' : 'basic');
      planTarget.textContent = plan === 'trial' ? 'Trial' : 'Basic';
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
    initCalculators();
    initPopups();
    initStoreGenerator();
    initLoginForm();
    guardDashboard();
  });
})();
