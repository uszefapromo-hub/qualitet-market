(function(){
  const manager = window.StoreManager;
  if(!manager){
    return;
  }

  const DEFAULTS = {
    primaryColor: '#35d9ff',
    accentColor: '#54ffb0',
    backgroundColor: '#f5f7fb',
    theme: 'modern',
    margin: 15,
    plan: 'basic',
    trial: true,
    description: 'Nowoczesny sklep online na platformie U SZEFA.',
    delivery: 'Wysyłka w 24h'
  };
  const STORE_SETTINGS_KEY = 'app_store_settings';
  const STORE_MARGIN_KEY = 'qm_store_margin_pct';
  const PLAN_DEFAULT_MARGINS = {
    basic: 15,
    pro: 25,
    elite: 35
  };
  const DEFAULT_INITIAL = 'S';
  const HASH_MULTIPLIER = 31;
  const HASH_MODULO = 10000;
  const HASH_SEED = 7;
  const MOCK_PRODUCTS_BASE = 12;
  const MOCK_PRODUCTS_RANGE = 24;
  const MOCK_REVENUE_BASE = 12000;
  const MOCK_REVENUE_RANGE = 9000;
  const CURRENCY_FORMATTER = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0
  });

  function formatPlan(plan){
    const value = (plan || '').toLowerCase();
    if(value === 'pro'){
      return 'Pro';
    }
    if(value === 'elite'){
      return 'Elite';
    }
    return 'Basic';
  }

  function formatCurrencyPLN(value){
    return CURRENCY_FORMATTER.format(value);
  }

  function parseMarginValue(value){
    const parsed = parseFloat(value);
    if(!Number.isFinite(parsed) || parsed < 0){
      return null;
    }
    return parsed;
  }

  function getPlanDefaultMargin(plan){
    const value = (plan || '').toLowerCase();
    if(value === 'pro'){
      return PLAN_DEFAULT_MARGINS.pro;
    }
    if(value === 'elite'){
      return PLAN_DEFAULT_MARGINS.elite;
    }
    return PLAN_DEFAULT_MARGINS.basic;
  }

  function getInitial(name){
    const trimmed = (name || '').trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : DEFAULT_INITIAL;
  }

  function renderLogo(container, store){
    if(!container){
      return;
    }
    const image = container.querySelector('img');
    const placeholder = container.querySelector('span');
    if(store.logo){
      if(image){
        image.src = store.logo;
        image.alt = store.name || 'Logo sklepu';
      }
      container.classList.add('has-image');
    } else {
      if(image){
        image.removeAttribute('src');
      }
      container.classList.remove('has-image');
    }
    if(placeholder){
      placeholder.textContent = getInitial(store.name);
    }
  }

  function applyText(target, value, fallback){
    if(!target){
      return;
    }
    target.textContent = value ? value : fallback;
  }

  function updateColorChip(input, chip){
    if(input && chip){
      chip.style.background = input.value;
    }
  }

  function updateSlugPreview(preview, slug){
    if(!preview){
      return;
    }
    preview.textContent = slug ? `Adres: uszefaqualitet.pl/${slug}` : 'Adres: —';
  }

  function normalizeMargin(rawValue){
    const isBlank = rawValue === '' || rawValue == null;
    const parsedValue = isBlank ? NaN : parseFloat(rawValue);
    if(!Number.isFinite(parsedValue)){
      return DEFAULTS.margin;
    }
    return Math.min(100, Math.max(0, parsedValue));
  }

  function resolveStoreMargin(store, settings){
    const stored = parseMarginValue(localStorage.getItem(STORE_MARGIN_KEY));
    if(stored !== null){
      return stored;
    }
    const storeMargin = parseMarginValue(store && store.margin);
    const settingsMargin = parseMarginValue(settings && settings.margin);
    const plan = (store && store.plan) || resolvePlanFromSettings(settings);
    const fallback = getPlanDefaultMargin(plan);
    const resolved = storeMargin !== null ? storeMargin : (settingsMargin !== null ? settingsMargin : fallback);
    localStorage.setItem(STORE_MARGIN_KEY, `${resolved}`);
    return resolved;
  }

  function loadStoreSettings(){
    const raw = localStorage.getItem(STORE_SETTINGS_KEY);
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

  function ensureStoreSettings(){
    const existing = loadStoreSettings();
    if(existing){
      return existing;
    }
    const seed = {
      niche: 'Sklep startowy',
      budget: 12000,
      margin: DEFAULTS.margin,
      goal: 25000,
      suggestedPlan: DEFAULTS.plan,
      storeName: 'Sklep startowy',
      storeStyle: DEFAULTS.theme
    };
    localStorage.setItem(STORE_SETTINGS_KEY, JSON.stringify(seed));
    return seed;
  }

  function resolvePlanFromSettings(settings){
    const rawPlan = settings ? (settings.suggestedPlan || settings.plan) : '';
    const value = rawPlan ? rawPlan.toString().toLowerCase() : '';
    if(value === 'pro' || value === 'elite'){
      return value;
    }
    return 'basic';
  }

  function buildStoreFromSettings(settings){
    if(!settings){
      return null;
    }
    const resolvedName = (settings.storeName || settings.niche || '').trim();
    const name = resolvedName || 'Mój sklep';
    const parsedGoal = parseFloat(settings.goal);
    const goalValue = Number.isFinite(parsedGoal) ? parsedGoal : null;
    let description = settings.storeDescription || '';
    if(!description && settings.niche){
      description = `Sklep w branży ${settings.niche}.`;
    }
    if(!description && goalValue !== null){
      description = `Cel sprzedaży: ${formatCurrencyPLN(goalValue)}`;
    }
    if(!description){
      description = DEFAULTS.description;
    }
    const resolvedMargin = resolveStoreMargin(null, settings);
    return {
      name,
      slug: manager.normalizeSlug(settings.storeSlug || name),
      description,
      logo: settings.logo || settings.storeLogo || '',
      email: settings.email || settings.storeEmail || '',
      phone: settings.phone || settings.storePhone || '',
      delivery: settings.delivery || settings.storeDelivery || DEFAULTS.delivery,
      primaryColor: settings.primaryColor || DEFAULTS.primaryColor,
      accentColor: settings.accentColor || DEFAULTS.accentColor,
      backgroundColor: settings.backgroundColor || DEFAULTS.backgroundColor,
      theme: settings.theme || settings.storeStyle || DEFAULTS.theme,
      margin: resolvedMargin,
      plan: resolvePlanFromSettings(settings),
      trial: false
    };
  }

  function buildStoreFromForm(form){
    const nameInput = form.querySelector('input[name="storeName"]');
    const slugInput = form.querySelector('input[name="storeSlug"]');
    const descriptionInput = form.querySelector('textarea[name="storeDescription"]');
    const logoInput = form.querySelector('input[name="storeLogo"]');
    const emailInput = form.querySelector('input[name="storeEmail"]');
    const phoneInput = form.querySelector('input[name="storePhone"]');
    const deliveryInput = form.querySelector('input[name="storeDelivery"]');
    const primaryInput = form.querySelector('input[name="primaryColor"]');
    const accentInput = form.querySelector('input[name="accentColor"]');
    const backgroundInput = form.querySelector('input[name="backgroundColor"]');
    const themeSelect = form.querySelector('select[name="storeTheme"]');
    const marginInput = form.querySelector('input[name="storeMargin"]');
    const planSelect = form.querySelector('select[name="storePlan"]');
    const trialSelect = form.querySelector('select[name="storeTrial"]');

    const name = nameInput ? nameInput.value.trim() : '';
    const slug = manager.normalizeSlug(slugInput && slugInput.value ? slugInput.value : name);
    const marginRaw = marginInput ? marginInput.value : '';
    const normalizedMargin = normalizeMargin(marginRaw);

    return {
      name,
      slug,
      description: descriptionInput ? descriptionInput.value.trim() : '',
      logo: logoInput ? logoInput.value.trim() : '',
      email: emailInput ? emailInput.value.trim() : '',
      phone: phoneInput ? phoneInput.value.trim() : '',
      delivery: deliveryInput ? deliveryInput.value.trim() : '',
      primaryColor: primaryInput ? primaryInput.value : DEFAULTS.primaryColor,
      accentColor: accentInput ? accentInput.value : DEFAULTS.accentColor,
      backgroundColor: backgroundInput ? backgroundInput.value : DEFAULTS.backgroundColor,
      theme: themeSelect ? themeSelect.value : DEFAULTS.theme,
      margin: normalizedMargin,
      plan: planSelect ? planSelect.value : DEFAULTS.plan,
      trial: trialSelect ? trialSelect.value === 'true' : DEFAULTS.trial
    };
  }

  function hydrateGenerator(form, store){
    if(!store){
      return;
    }
    const fields = {
      storeName: store.name,
      storeSlug: store.slug,
      storeDescription: store.description,
      storeLogo: store.logo,
      storeEmail: store.email,
      storePhone: store.phone,
      storeDelivery: store.delivery,
      primaryColor: store.primaryColor,
      accentColor: store.accentColor,
      backgroundColor: store.backgroundColor,
      storeTheme: store.theme,
      storeMargin: store.margin,
      storePlan: store.plan,
      storeTrial: store.trial ? 'true' : 'false'
    };
    Object.entries(fields).forEach(([name, value]) => {
      if(value === undefined || value === null){
        return;
      }
      const field = form.querySelector(`[name="${name}"]`);
      if(field){
        field.value = value;
      }
    });
  }

  function initStoreGenerator(){
    const form = document.querySelector('[data-store-generator]');
    if(!form){
      return;
    }

    const nameInput = form.querySelector('input[name="storeName"]');
    const slugInput = form.querySelector('input[name="storeSlug"]');
    const logoInput = form.querySelector('input[name="storeLogo"]');
    const primaryInput = form.querySelector('input[name="primaryColor"]');
    const accentInput = form.querySelector('input[name="accentColor"]');
    const backgroundInput = form.querySelector('input[name="backgroundColor"]');
    const slugPreview = form.querySelector('[data-slug-preview]');
    const logoPreview = form.querySelector('[data-logo-preview]');
    const primaryChip = form.querySelector('[data-primary-chip]');
    const accentChip = form.querySelector('[data-accent-chip]');
    const backgroundChip = form.querySelector('[data-background-chip]');
    const previewButton = form.querySelector('[data-store-preview]');
    const panelButton = form.querySelector('[data-store-panel]');

    let activeStore = manager.getActiveStore();
    const storeSettings = ensureStoreSettings();
    const settingsStore = !activeStore && storeSettings ? buildStoreFromSettings(storeSettings) : null;
    if(activeStore){
      hydrateGenerator(form, activeStore);
    } else if(settingsStore){
      hydrateGenerator(form, settingsStore);
    }

    let slugTouched = false;
    if(slugInput){
      slugTouched = Boolean(slugInput.value.trim());
      updateSlugPreview(slugPreview, slugInput.value.trim());
      slugInput.addEventListener('input', () => {
        slugTouched = Boolean(slugInput.value.trim());
        updateSlugPreview(slugPreview, slugInput.value.trim());
      });
    }

    if(nameInput){
      nameInput.addEventListener('input', () => {
        if(slugInput && !slugTouched){
          slugInput.value = manager.normalizeSlug(nameInput.value);
          updateSlugPreview(slugPreview, slugInput.value.trim());
        }
        renderLogo(logoPreview, {
          name: nameInput.value,
          logo: logoInput ? logoInput.value.trim() : ''
        });
      });
    }

    if(logoInput){
      logoInput.addEventListener('input', () => {
        renderLogo(logoPreview, {
          name: nameInput ? nameInput.value : '',
          logo: logoInput.value.trim()
        });
      });
    }

    if(primaryInput){
      updateColorChip(primaryInput, primaryChip);
      primaryInput.addEventListener('input', () => updateColorChip(primaryInput, primaryChip));
    }

    if(accentInput){
      updateColorChip(accentInput, accentChip);
      accentInput.addEventListener('input', () => updateColorChip(accentInput, accentChip));
    }

    if(backgroundInput){
      updateColorChip(backgroundInput, backgroundChip);
      backgroundInput.addEventListener('input', () => updateColorChip(backgroundInput, backgroundChip));
    }

    const previewStore = activeStore || settingsStore;
    if(previewStore){
      renderLogo(logoPreview, previewStore);
    }

    function handleGeneratorSave(redirectUrl){
      const storeData = buildStoreFromForm(form);
      if(!storeData.name){
        if(typeof form.reportValidity === 'function'){
          form.reportValidity();
        }
        return;
      }
      const saved = manager.upsertStore({
        ...storeData,
        id: activeStore ? activeStore.id : undefined,
        createdAt: activeStore ? activeStore.createdAt : undefined
      });
      manager.setActiveStore(saved.id);
      activeStore = saved;
      if(redirectUrl){
        window.location.href = redirectUrl;
      }
    }

    form.addEventListener('submit', event => {
      event.preventDefault();
      handleGeneratorSave('panel-sklepu.html');
    });

    if(previewButton){
      previewButton.addEventListener('click', () => {
        handleGeneratorSave('sklep.html');
      });
    }

    if(panelButton){
      panelButton.addEventListener('click', () => {
        handleGeneratorSave('panel-sklepu.html');
      });
    }
  }

  function hashString(value){
    return Array.from(value || '').reduce((acc, char) => {
      return (acc * HASH_MULTIPLIER + char.charCodeAt(0)) % HASH_MODULO;
    }, HASH_SEED);
  }

  function getMockMetrics(store){
    const seed = hashString(store.id || store.slug || store.name);
    const products = MOCK_PRODUCTS_BASE + (seed % MOCK_PRODUCTS_RANGE);
    const revenue = MOCK_REVENUE_BASE + (seed % MOCK_REVENUE_RANGE);
    return {products, revenue};
  }

  function initStorePanel(){
    const panel = document.querySelector('[data-store-panel]');
    if(!panel){
      return;
    }
    const store = manager.getActiveStore();
    const storeSettings = ensureStoreSettings();
    const fallbackStore = !store && storeSettings ? buildStoreFromSettings(storeSettings) : null;
    const resolvedStore = store || fallbackStore;
    const content = panel.querySelector('[data-store-content]');
    const emptyState = panel.querySelector('[data-store-empty]');

    if(!resolvedStore){
      if(content){
        content.hidden = true;
      }
      if(emptyState){
        emptyState.hidden = false;
      }
      return;
    }

    if(content){
      content.hidden = false;
    }
    if(emptyState){
      emptyState.hidden = true;
    }

    const displayMargin = resolveStoreMargin(resolvedStore, storeSettings);
    const metrics = getMockMetrics(resolvedStore);
    const map = {
      'store-name': resolvedStore.name,
      'store-plan': formatPlan(resolvedStore.plan),
      'store-margin': `${displayMargin}%`,
      'store-products': `${metrics.products}`,
      'store-revenue': formatCurrencyPLN(metrics.revenue)
    };

    Object.entries(map).forEach(([key, value]) => {
      const target = panel.querySelector(`[data-${key}]`);
      if(target){
        target.textContent = value;
      }
    });
  }

  function loadShopFromApi(slug, shop){
    const apiBase = window.QM_API_BASE || 'https://api.uszefaqualitet.pl/api';
    const content = shop.querySelector('[data-store-content]');
    const emptyState = shop.querySelector('[data-store-empty]');

    Promise.all([
      fetch(`${apiBase}/shops/${encodeURIComponent(slug)}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${apiBase}/shops/${encodeURIComponent(slug)}/products`).then(r => r.ok ? r.json() : null).catch(() => null)
    ]).then(([shopData, productsData]) => {
      if(!shopData || !shopData.shop){
        // API returned no shop – show the empty state so user knows
        if(content){ content.hidden = true; }
        if(emptyState){ emptyState.hidden = false; }
        return;
      }
      const s = shopData.shop;
      if(content){ content.hidden = false; }
      if(emptyState){ emptyState.hidden = true; }

      const nameEl = shop.querySelector('[data-store-name]');
      if(nameEl){ nameEl.textContent = s.name || 'Sklep'; }

      const descEl = shop.querySelector('[data-store-description]');
      if(descEl){ descEl.textContent = s.description || ''; }

      const slugEl = shop.querySelector('[data-store-slug]');
      if(slugEl){ slugEl.textContent = s.slug ? `@${s.slug}` : ''; }

      const planEl = shop.querySelector('[data-store-plan]');
      if(planEl){ planEl.textContent = s.plan ? `Plan: ${formatPlan(s.plan)}` : ''; }

      const emailEl = shop.querySelector('[data-store-email]');
      if(emailEl){ emailEl.textContent = s.email || 'Brak danych'; }

      const phoneEl = shop.querySelector('[data-store-phone]');
      if(phoneEl){ phoneEl.textContent = s.phone || 'Brak danych'; }

      const deliveryEl = shop.querySelector('[data-store-delivery]');
      if(deliveryEl){ deliveryEl.textContent = s.delivery || DEFAULTS.delivery; }

      const themeEl = shop.querySelector('[data-store-theme]');
      if(themeEl){ themeEl.textContent = ''; }

      document.title = `${s.name || 'Sklep'} | QualitetMarket`;

      const logoContainer = shop.querySelector('[data-logo-preview]');
      renderLogo(logoContainer, s);

      if(productsData && productsData.products && productsData.products.length){
        renderApiProducts(shop, productsData.products);
      }
    });
  }

  function renderApiProducts(shop, products){
    const grid = shop.querySelector('[data-store-products-grid]');
    const emptyMsg = shop.querySelector('[data-store-products-empty]');
    if(!grid){ return; }
    grid.innerHTML = '';
    if(!products.length){
      if(emptyMsg){ emptyMsg.hidden = false; }
      return;
    }
    if(emptyMsg){ emptyMsg.hidden = true; }
    products.forEach(p => {
      const card = document.createElement('div');
      card.className = 'product-card';
      const price = p.selling_price || p.platform_price || p.supplier_price || 0;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'product-img';
      if(p.image_url){
        const img = document.createElement('img');
        img.src = p.image_url;
        img.alt = p.name || '';
        img.loading = 'lazy';
        imgWrap.appendChild(img);
      } else {
        imgWrap.textContent = '📦';
      }

      const info = document.createElement('div');
      info.className = 'product-info';

      const nameEl = document.createElement('h3');
      nameEl.className = 'product-name';
      nameEl.textContent = p.name || 'Produkt';

      const priceEl = document.createElement('div');
      priceEl.className = 'product-price';
      priceEl.textContent = `${Number(price).toFixed(2)} zł`;

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary btn-sm';
      btn.textContent = 'Dodaj do koszyka';
      btn.addEventListener('click', () => {
        if(window.QMCart){ window.QMCart.addItem(p.id, p.name || 'Produkt', price); }
      });

      info.appendChild(nameEl);
      info.appendChild(priceEl);
      info.appendChild(btn);
      card.appendChild(imgWrap);
      card.appendChild(info);
      grid.appendChild(card);
    });
  }

  function initStoreShop(){
    const shop = document.querySelector('[data-store-shop]');
    if(!shop){
      return;
    }

    // Try to load from API if a slug is provided in the URL (?slug=...)
    const urlParams = new URLSearchParams(window.location.search);
    const urlSlug = urlParams.get('slug') || urlParams.get('shop');
    if(urlSlug){
      loadShopFromApi(urlSlug, shop);
    }

    const store = manager.getActiveStore();
    const storeSettings = ensureStoreSettings();
    const fallbackStore = !store && storeSettings ? buildStoreFromSettings(storeSettings) : null;
    const resolvedStore = store || fallbackStore;
    const content = shop.querySelector('[data-store-content]');
    const emptyState = shop.querySelector('[data-store-empty]');

    if(!resolvedStore){
      if(content){
        content.hidden = true;
      }
      if(emptyState){
        emptyState.hidden = false;
      }
      return;
    }

    if(content){
      content.hidden = false;
    }
    if(emptyState){
      emptyState.hidden = true;
    }

    document.documentElement.style.setProperty('--store-primary', resolvedStore.primaryColor || DEFAULTS.primaryColor);
    document.documentElement.style.setProperty('--store-accent', resolvedStore.accentColor || DEFAULTS.accentColor);
    document.documentElement.style.setProperty('--store-background', resolvedStore.backgroundColor || DEFAULTS.backgroundColor);

    const displayMargin = resolveStoreMargin(resolvedStore, storeSettings);
    const map = {
      'store-name': resolvedStore.name,
      'store-description': resolvedStore.description || DEFAULTS.description,
      'store-plan': `Plan: ${formatPlan(resolvedStore.plan)}`,
      'store-margin': `Marża: ${displayMargin}%`,
      'store-theme': '',
      'store-slug': `@${resolvedStore.slug}`
    };

    Object.entries(map).forEach(([key, value]) => {
      const target = shop.querySelector(`[data-${key}]`);
      if(target){
        target.textContent = value;
      }
    });

    const contactMap = {
      'store-email': resolvedStore.email,
      'store-phone': resolvedStore.phone,
      'store-delivery': resolvedStore.delivery || DEFAULTS.delivery
    };

    Object.entries(contactMap).forEach(([key, value]) => {
      const target = shop.querySelector(`[data-${key}]`);
      if(!target){
        return;
      }
      const fallback = key === 'store-delivery' ? DEFAULTS.delivery : 'Brak danych';
      applyText(target, value, fallback);
    });

    const logoContainer = shop.querySelector('[data-logo-preview]');
    renderLogo(logoContainer, resolvedStore);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initStoreGenerator();
    initStorePanel();
    initStoreShop();
  });
})();
