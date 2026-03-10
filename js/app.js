
(function(){
  const KEYS = {
    products:'qm_products_by_supplier_v1',
    intel:'qm_intel_prefill_v1',
    listing:'qm_listing_prefill_v1',
    crm:'qm_crm_v1',
    stores:'qm_stores_v1',
    activeStore:'qm_active_store_v1',
    margin:'qm_store_margin_pct',
    cart:'qm_cart_v1',
    orders:'qm_orders_v1',
    plan:'qm_plan_v1'
  };

  const safeParse = (value, fallback) => {
    try { return value ? JSON.parse(value) : fallback; } catch (e) { return fallback; }
  };

  const read = (key, fallback) => safeParse(localStorage.getItem(key), fallback);
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const money = (value) => new Intl.NumberFormat('pl-PL', {style:'currency', currency:'PLN', maximumFractionDigits:0}).format(Number(value || 0));
  const stores = () => read(KEYS.stores, []);
  const productsBySupplier = () => read(KEYS.products, {});
  const cart = () => read(KEYS.cart, []);
  const orders = () => read(KEYS.orders, []);

  function getActiveStore(){
    const list = stores();
    const id = localStorage.getItem(KEYS.activeStore);
    return list.find(s => s.id === id) || list[0] || {
      id:'demo',
      name:'Demo Store',
      niche:'Sprzedaż wielobranżowa',
      plan: (localStorage.getItem(KEYS.plan) || 'basic'),
      theme:'clean',
      logo:'assets/logo-uszefa.svg',
      margin: Number(localStorage.getItem(KEYS.margin) || 20)
    };
  }

  function setActivePlan(plan){
    localStorage.setItem(KEYS.plan, plan);
    const active = getActiveStore();
    active.plan = plan;
    const list = stores().map(s => s.id === active.id ? active : s);
    if(list.length) write(KEYS.stores, list);
  }

  function getMargin(){
    return Number(localStorage.getItem(KEYS.margin) || getActiveStore().margin || 20);
  }

  function injectPromo(){
    const left = Math.max(0, 3 - stores().length);
    document.querySelectorAll('[data-promo-left]').forEach(el => {
      el.textContent = left > 0
        ? `Promocja aktywna: jeszcze ${left} miejsca dla pierwszych 3 sprzedawców.`
        : 'Promocja dla pierwszych 3 została wykorzystana. Działa już standardowe wdrożenie.';
    });
  }

  function fillDashboardStats(){
    const list = stores();
    const supplierMap = productsBySupplier();
    const productsCount = Object.values(supplierMap).flat().length;
    const ordersCount = orders().length;
    const avgMargin = getMargin();
    const salesBase = Math.max(1, list.length) * 7800;
    const estProfit = salesBase * (avgMargin / 100);

    document.querySelectorAll('[data-stores-count]').forEach(el => el.textContent = list.length);
    document.querySelectorAll('[data-products-count]').forEach(el => el.textContent = productsCount);
    document.querySelectorAll('[data-orders-count]').forEach(el => el.textContent = ordersCount);
    document.querySelectorAll('[data-margin-default]').forEach(el => el.textContent = `${avgMargin}%`);
    document.querySelectorAll('[data-est-sales]').forEach(el => el.textContent = money(salesBase));
    document.querySelectorAll('[data-est-profit]').forEach(el => el.textContent = money(estProfit));
    document.querySelectorAll('[data-active-store-name]').forEach(el => el.textContent = getActiveStore().name);
    document.querySelectorAll('[data-active-plan]').forEach(el => el.textContent = (getActiveStore().plan || localStorage.getItem(KEYS.plan) || 'basic').toUpperCase());
  }

  function renderStoreList(selector){
    const root = document.getElementById(selector);
    if(!root) return;
    const list = stores();
    if(!list.length){
      root.innerHTML = `<h3>Sklepy</h3><p class="empty">Nie ma jeszcze zapisanych sklepów. Wejdź do generatora i zapisz pierwszy sklep.</p>`;
      return;
    }
    root.innerHTML = `<h3>Twoje sklepy</h3><div class="list-cards">${
      list.map((s, i) => `
        <article class="store-card">
          <strong>${s.name}</strong>
          <div>${s.niche || 'Sprzedaż wielobranżowa'} • plan ${String(s.plan).toUpperCase()}</div>
          <div>Motyw: ${s.theme} • marża ${s.margin}% ${i < 3 ? '• promocja startowa' : ''}</div>
        </article>`).join('')
    }</div>`;
  }

  function bindMenu(){
    const button = document.querySelector('[data-menu-toggle]');
    const nav = document.querySelector('.nav');
    if(button && nav){
      button.addEventListener('click', () => nav.classList.toggle('open'));
    }
    const page = document.body.dataset.page;
    document.querySelectorAll('.nav a').forEach(a => {
      if(a.getAttribute('href') === `${page}.html` || (page==='index' && a.getAttribute('href')==='index.html')) a.classList.add('active');
    });
  }

  function bindQualitetPrefill(){
    const intelBtn = document.querySelector('[data-fill-intel]');
    const crmBtn = document.querySelector('[data-fill-crm]');
    const intelStatus = document.querySelector('[data-intel-status]');
    const crmStatus = document.querySelector('[data-crm-status]');
    if(intelStatus){
      const intel = read(KEYS.intel, null);
      intelStatus.textContent = intel ? 'Gotowy' : 'Brak';
    }
    if(crmStatus){
      const crm = read(KEYS.crm, null);
      crmStatus.textContent = crm ? 'Gotowy' : 'Puste';
    }
    if(intelBtn){
      intelBtn.addEventListener('click', () => {
        write(KEYS.intel, {headline:'Start od zera', audience:'Nowi sprzedawcy', updatedAt: new Date().toISOString()});
        write(KEYS.listing, {title:'Gotowy listing produktu', bullets:['szybki start','duża marża','prosta sprzedaż']});
        if(intelStatus) intelStatus.textContent = 'Gotowy';
      });
    }
    if(crmBtn){
      crmBtn.addEventListener('click', () => {
        write(KEYS.crm, [{lead:'Sklep startowy', status:'nowy'}]);
        if(crmStatus) crmStatus.textContent = 'Gotowy';
      });
    }
  }

  window.QM = { KEYS, read, write, money, stores, getActiveStore, setActivePlan, getMargin, renderStoreList, cart, orders };
  document.addEventListener('DOMContentLoaded', () => {
    bindMenu();
    injectPromo();
    fillDashboardStats();
    renderStoreList('lista-magazynow-danych');
    bindQualitetPrefill();
  });
})();
