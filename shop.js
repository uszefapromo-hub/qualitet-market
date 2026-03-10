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
  const DEFAULT_INITIAL = 'S';
  const HASH_MULTIPLIER = 31;
  const HASH_MODULO = 10000;
  const HASH_SEED = 7;
  const MOCK_PRODUCTS_BASE = 12;
  const MOCK_PRODUCTS_RANGE = 24;
  const MOCK_REVENUE_BASE = 12000;
  const MOCK_REVENUE_RANGE = 9000;
  const PLAN_STORAGE_KEY = 'app_user_plan';
  const CURRENCY_FORMATTER = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    maximumFractionDigits: 0
  });

  function getStoredPlan(){
    const storedPlan = localStorage.getItem(PLAN_STORAGE_KEY);
    return storedPlan ? storedPlan.toLowerCase() : '';
  }

  function resolvePlan(storePlan){
    const storedPlan = getStoredPlan();
    return storedPlan || storePlan;
  }

  function formatPlan(plan){
    const value = (plan || '').toLowerCase();
    if(value === 'trial'){
      return 'Trial';
    }
    if(value === 'pro'){
      return 'PRO';
    }
    if(value === 'elite'){
      return 'ELITE';
    }
    return 'Basic';
  }

  function formatCurrencyPLN(value){
    return CURRENCY_FORMATTER.format(value);
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
    if(activeStore){
      hydrateGenerator(form, activeStore);
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

    if(activeStore){
      renderLogo(logoPreview, activeStore);
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
    const content = panel.querySelector('[data-store-content]');
    const emptyState = panel.querySelector('[data-store-empty]');

    if(!store){
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

    const metrics = getMockMetrics(store);
    const plan = resolvePlan(store.plan);
    const map = {
      'store-name': store.name,
      'store-plan': formatPlan(plan),
      'store-margin': `${store.margin}%`,
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

  function initStoreShop(){
    const shop = document.querySelector('[data-store-shop]');
    if(!shop){
      return;
    }
    const store = manager.getActiveStore();
    const content = shop.querySelector('[data-store-content]');
    const emptyState = shop.querySelector('[data-store-empty]');

    if(!store){
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

    document.documentElement.style.setProperty('--store-primary', store.primaryColor || DEFAULTS.primaryColor);
    document.documentElement.style.setProperty('--store-accent', store.accentColor || DEFAULTS.accentColor);
    document.documentElement.style.setProperty('--store-background', store.backgroundColor || DEFAULTS.backgroundColor);

    const plan = resolvePlan(store.plan);
    const map = {
      'store-name': store.name,
      'store-description': store.description || DEFAULTS.description,
      'store-plan': `Plan: ${formatPlan(plan)}`,
      'store-margin': `Marża: ${store.margin}%`,
      'store-theme': `Styl: ${store.theme}`,
      'store-slug': `@${store.slug}`
    };

    Object.entries(map).forEach(([key, value]) => {
      const target = shop.querySelector(`[data-${key}]`);
      if(target){
        target.textContent = value;
      }
    });

    const contactMap = {
      'store-email': store.email,
      'store-phone': store.phone,
      'store-delivery': store.delivery || DEFAULTS.delivery
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
    renderLogo(logoContainer, store);
  }

  document.addEventListener('DOMContentLoaded', () => {
    initStoreGenerator();
    initStorePanel();
    initStoreShop();
  });
})();
