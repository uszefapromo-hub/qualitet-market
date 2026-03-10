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
    activeStore: 'activeStore',
    stores: 'stores'
  };
  const MS_PER_DAY = 1000 * 60 * 60 * 24;
  const TRIAL_RULES = [
    {limit: 3, days: 60},
    {limit: 5, days: 30}
  ];
  const DEFAULT_TRIAL_DAYS = 7;

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

  function getStoredObject(key){
    const raw = localStorage.getItem(key);
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

  function loadStoreSettings(){
    return getStoredObject(STORAGE_KEYS.storeSettings);
  }

  function saveStoreSettings(settings){
    if(!settings){
      return;
    }
    localStorage.setItem(STORAGE_KEYS.storeSettings, JSON.stringify(settings));
    localStorage.setItem(STORAGE_KEYS.storeReady, 'true');
    syncActiveStore(settings);
  }

  function loadActiveStore(){
    const stored = getStoredObject(STORAGE_KEYS.activeStore);
    if(stored){
      return stored;
    }
    const settings = loadStoreSettings();
    if(!settings){
      return null;
    }
    const store = buildActiveStore(settings, null);
    if(store){
      saveActiveStore(store);
      updateStoresWithActive(store);
    }
    return store;
  }

  function loadStoresList(){
    return getStoredList(STORAGE_KEYS.stores) || [];
  }

  function saveStoresList(stores){
    localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(stores || []));
  }

  function saveActiveStore(store){
    if(!store){
      return;
    }
    localStorage.setItem(STORAGE_KEYS.activeStore, JSON.stringify(store));
  }

  function buildActiveStore(settings, existingStore){
    if(!settings){
      return null;
    }
    const storeId = existingStore && existingStore.id ? existingStore.id : `store-${Date.now()}`;
    const createdAt = existingStore && existingStore.createdAt ? existingStore.createdAt : new Date().toISOString();
    const products = existingStore && Array.isArray(existingStore.products) ? existingStore.products : [];
    return {
      id: storeId,
      name: settings.storeName || '',
      description: settings.storeDescription || '',
      primaryColor: settings.primaryColor || '',
      accentColor: settings.accentColor || '',
      style: settings.storeStyle || '',
      logo: settings.logoDataUrl || '',
      createdAt: createdAt,
      updatedAt: new Date().toISOString(),
      products: products
    };
  }

  function syncActiveStore(settings){
    const existingStore = loadActiveStore();
    const activeStore = buildActiveStore(settings, existingStore);
    if(!activeStore){
      return;
    }
    saveActiveStore(activeStore);
    const stores = loadStoresList();
    const index = stores.findIndex(store => store && store.id === activeStore.id);
    if(index >= 0){
      stores[index] = activeStore;
    } else {
      stores.push(activeStore);
    }
    saveStoresList(stores);
  }

  function getStoreInitial(storeName){
    const trimmed = (storeName || '').trim();
    if(!trimmed){
      return 'S';
    }
    return trimmed.charAt(0).toUpperCase();
  }

  function parseNumber(value){
    const normalized = `${value}`.replace(',', '.');
    const parsed = Number.parseFloat(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function calculateFinalPrice(cost, margin){
    const safeCost = Number.isFinite(cost) ? cost : 0;
    const safeMargin = Number.isFinite(margin) ? margin : 0;
    return safeCost + (safeCost * safeMargin / 100);
  }

  function formatPrice(value){
    if(!Number.isFinite(value)){
      return '';
    }
    try{
      return new Intl.NumberFormat('pl-PL', {style: 'currency', currency: 'PLN'}).format(value);
    } catch (_error){
      return `${value.toFixed(2)} zł`;
    }
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

  function renderStorefront(){
    const container = document.querySelector('[data-storefront]');
    if(!container){
      return;
    }
    const emptyState = container.querySelector('[data-store-empty]');
    const storeView = container.querySelector('[data-store-view]');
    const stores = loadStoresList();
    const activeStore = loadActiveStore() || (stores.length ? stores[0] : null);

    if(!activeStore){
      if(emptyState){
        emptyState.hidden = false;
      }
      if(storeView){
        storeView.hidden = true;
      }
      return;
    }

    if(emptyState){
      emptyState.hidden = true;
    }
    if(storeView){
      storeView.hidden = false;
    }

    const storeName = activeStore.name || 'Sklep klienta';
    const storeDescription = activeStore.description || 'Brak opisu sklepu.';
    const primaryColor = activeStore.primaryColor || '#35d9ff';
    const accentColor = activeStore.accentColor || '#54ffb0';
    const storeStyle = activeStore.style || 'Jasny modern';

    const nameTarget = container.querySelector('[data-store-name]');
    const descriptionTarget = container.querySelector('[data-store-description]');
    const styleTarget = container.querySelector('[data-store-style]');
    const primaryChip = container.querySelector('[data-store-primary-chip]');
    const accentChip = container.querySelector('[data-store-accent-chip]');
    const primaryLabel = container.querySelector('[data-store-primary-label]');
    const accentLabel = container.querySelector('[data-store-accent-label]');
    const logoWrapper = container.querySelector('[data-store-logo-wrap]');
    const logoImage = container.querySelector('[data-store-logo]');
    const logoInitial = container.querySelector('[data-store-initial]');

    if(nameTarget){
      nameTarget.textContent = storeName;
    }
    if(descriptionTarget){
      descriptionTarget.textContent = storeDescription;
    }
    if(styleTarget){
      styleTarget.textContent = storeStyle;
    }
    if(primaryChip){
      primaryChip.style.background = primaryColor;
    }
    if(accentChip){
      accentChip.style.background = accentColor;
    }
    if(primaryLabel){
      primaryLabel.textContent = primaryColor;
    }
    if(accentLabel){
      accentLabel.textContent = accentColor;
    }
    if(logoInitial){
      logoInitial.textContent = getStoreInitial(storeName);
    }
    if(logoImage){
      if(activeStore.logo){
        logoImage.src = activeStore.logo;
        logoImage.alt = `Logo ${storeName}`;
        logoImage.hidden = false;
        if(logoWrapper){
          logoWrapper.classList.add('has-image');
        }
      } else {
        logoImage.removeAttribute('src');
        logoImage.hidden = true;
        if(logoWrapper){
          logoWrapper.classList.remove('has-image');
        }
      }
    }

    const products = Array.isArray(activeStore.products) ? activeStore.products : [];
    const productsGrid = container.querySelector('[data-products-grid]');
    const productsEmpty = container.querySelector('[data-products-empty]');
    if(productsGrid){
      productsGrid.innerHTML = '';
      if(!products.length){
        if(productsEmpty){
          productsEmpty.hidden = false;
        }
      } else {
        if(productsEmpty){
          productsEmpty.hidden = true;
        }
        products.forEach(product => {
          const card = document.createElement('article');
          card.className = 'storefront-product';

          const media = document.createElement('div');
          media.className = 'storefront-product-media';
          if(product.image){
            const img = document.createElement('img');
            img.src = product.image;
            img.alt = product.name ? `Produkt ${product.name}` : 'Produkt';
            media.appendChild(img);
          } else {
            const placeholder = document.createElement('span');
            placeholder.textContent = 'Brak zdjęcia';
            media.appendChild(placeholder);
          }

          const body = document.createElement('div');
          body.className = 'storefront-product-body';

          const title = document.createElement('h3');
          title.textContent = product.name || 'Produkt bez nazwy';

          const description = document.createElement('p');
          description.textContent = product.description || 'Opis produktu niedostępny.';

          const priceBox = document.createElement('div');
          priceBox.className = 'storefront-product-price';

          const cost = parseNumber(product.cost);
          const margin = parseNumber(product.margin);
          const storedFinal = parseNumber(product.finalPrice);
          const finalPrice = storedFinal || calculateFinalPrice(cost, margin);
          const price = document.createElement('strong');
          price.textContent = formatPrice(finalPrice);

          const marginInfo = document.createElement('span');
          marginInfo.textContent = `Marża ${margin}%`;

          priceBox.appendChild(price);
          priceBox.appendChild(marginInfo);

          body.appendChild(title);
          body.appendChild(description);
          body.appendChild(priceBox);

          card.appendChild(media);
          card.appendChild(body);
          productsGrid.appendChild(card);
        });
      }
    }
  }

  function updateStoresWithActive(activeStore){
    if(!activeStore){
      return;
    }
    const stores = loadStoresList();
    const index = stores.findIndex(store => store && store.id === activeStore.id);
    if(index >= 0){
      stores[index] = activeStore;
    } else {
      stores.push(activeStore);
    }
    saveStoresList(stores);
  }

  function initAddProductForm(){
    const form = document.querySelector('[data-product-form]');
    if(!form){
      return;
    }
    const emptyState = document.querySelector('[data-product-empty]');
    const activeStore = loadActiveStore();
    if(!activeStore){
      if(emptyState){
        emptyState.hidden = false;
      }
      form.hidden = true;
      return;
    }
    if(emptyState){
      emptyState.hidden = true;
    }
    form.hidden = false;

    form.addEventListener('submit', event => {
      event.preventDefault();
      const nameInput = form.querySelector('input[name="productName"]');
      const costInput = form.querySelector('input[name="productCost"]');
      const marginInput = form.querySelector('input[name="productMargin"]');
      const imageInput = form.querySelector('input[name="productImage"]');
      const descriptionInput = form.querySelector('textarea[name="productDescription"]');

      const name = nameInput ? nameInput.value.trim() : '';
      const cost = parseNumber(costInput ? costInput.value : 0);
      const margin = parseNumber(marginInput ? marginInput.value : 0);
      const finalPrice = calculateFinalPrice(cost, margin);
      const image = imageInput ? imageInput.value.trim() : '';
      const description = descriptionInput ? descriptionInput.value.trim() : '';

      const product = {
        id: `product-${Date.now()}`,
        name: name,
        price: finalPrice,
        cost: cost,
        margin: margin,
        finalPrice: finalPrice,
        image: image,
        description: description
      };

      const store = loadActiveStore();
      if(!store){
        return;
      }
      store.products = Array.isArray(store.products) ? store.products : [];
      store.products.push(product);
      store.updatedAt = new Date().toISOString();

      saveActiveStore(store);
      updateStoresWithActive(store);
      window.location.href = 'panel.html';
    });
  }

  function renderPanel(){
    const panel = document.querySelector('[data-panel]');
    if(!panel){
      return;
    }
    const emptyState = panel.querySelector('[data-panel-empty]');
    const storeNameTarget = panel.querySelector('[data-panel-store-name]');
    const storeStatusTarget = panel.querySelector('[data-panel-store-status]');
    const productCountTarget = panel.querySelector('[data-panel-product-count]');
    const descriptionTarget = panel.querySelector('[data-panel-store-description]');
    const store = loadActiveStore();

    if(!store){
      if(emptyState){
        emptyState.hidden = false;
      }
      if(storeNameTarget){
        storeNameTarget.textContent = 'Brak aktywnego sklepu';
      }
      if(storeStatusTarget){
        storeStatusTarget.textContent = 'Nieaktywny';
      }
      if(productCountTarget){
        productCountTarget.textContent = '0';
      }
      if(descriptionTarget){
        descriptionTarget.textContent = 'Najpierw uzupełnij dane w generatorze sklepu.';
      }
      return;
    }

    if(emptyState){
      emptyState.hidden = true;
    }
    if(storeNameTarget){
      storeNameTarget.textContent = store.name || 'Sklep klienta';
    }
    if(storeStatusTarget){
      storeStatusTarget.textContent = 'Aktywny';
    }
    if(descriptionTarget){
      descriptionTarget.textContent = store.description || 'Brak opisu sklepu.';
    }
    if(productCountTarget){
      const count = Array.isArray(store.products) ? store.products.length : 0;
      productCountTarget.textContent = `${count}`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindMenu();
    initCounters();
    initHelperBoxes();
    initStoreGenerator();
    initLoginForm();
    guardDashboard();
    renderStorefront();
    initAddProductForm();
    renderPanel();
  });
})();
