(function(){
  const KEYMAP = {
    products:'qm_products_by_supplier_v1',
    intelPrefill:'qm_intel_prefill_v1',
    listingPrefill:'qm_listing_prefill_v1',
    crm:'qm_crm_v1',
    orders:'qm_orders_v1',
    stores:'qm_stores_v1',
    activeStore:'qm_active_store_v1',
    marginPct:'qm_store_margin_pct',
    plan:'qm_plan_v1',
    cart:'qm_cart_v1'
  };

  const defaultProducts = [
    {id:'p1', supplier:'AliExpress', name:'Lampa LED RGB Smart', price:79.99, img:'💡', category:'Dom'},
    {id:'p2', supplier:'CJ Dropshipping', name:'Mini projektor WiFi', price:249.00, img:'📽️', category:'Elektronika'},
    {id:'p3', supplier:'VidaXL', name:'Krzesło biurowe ergonomiczne', price:399.00, img:'🪑', category:'Dom'},
    {id:'p4', supplier:'Banggood', name:'Słuchawki ANC', price:189.00, img:'🎧', category:'Elektronika'},
    {id:'p5', supplier:'EPROLO', name:'Plecak miejski', price:129.00, img:'🎒', category:'Moda'},
    {id:'p6', supplier:'AliExpress', name:'Powerbank 20000 mAh', price:149.00, img:'🔋', category:'Elektronika'},
    {id:'p7', supplier:'BigBuy', name:'Komplet organizerów premium', price:119.00, img:'🧰', category:'Dom'},
    {id:'p8', supplier:'Hertwill', name:'Kubek termiczny steel', price:89.00, img:'☕', category:'Lifestyle'}
  ];

  const defaultStores = [
    {id:'store-main', name:'Qualitet Demo', slug:'demo', description:'Domyślny sklep demo', marginPct:20}
  ];

  function safeRead(key, fallback){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    }catch(e){ return fallback; }
  }
  function safeWrite(key, value){
    localStorage.setItem(key, JSON.stringify(value));
    return value;
  }

  function ensureDefaults(){
    if(!localStorage.getItem(KEYMAP.products)) safeWrite(KEYMAP.products, defaultProducts);
    if(!localStorage.getItem(KEYMAP.orders)) safeWrite(KEYMAP.orders, []);
    if(!localStorage.getItem(KEYMAP.stores)) safeWrite(KEYMAP.stores, defaultStores);
    if(!localStorage.getItem(KEYMAP.activeStore)) localStorage.setItem(KEYMAP.activeStore, 'demo');
    if(!localStorage.getItem(KEYMAP.marginPct)) localStorage.setItem(KEYMAP.marginPct, '20');
    if(!localStorage.getItem(KEYMAP.plan)) localStorage.setItem(KEYMAP.plan, 'basic');
    if(!localStorage.getItem(KEYMAP.cart)) safeWrite(KEYMAP.cart, []);
  }

  function getPlan(){ return localStorage.getItem(KEYMAP.plan) || 'basic'; }
  function setPlan(plan){ localStorage.setItem(KEYMAP.plan, plan); }
  function getProducts(){ return safeRead(KEYMAP.products, defaultProducts); }
  function setProducts(items){ return safeWrite(KEYMAP.products, items); }
  function getOrders(){ return safeRead(KEYMAP.orders, []); }
  function setOrders(items){ return safeWrite(KEYMAP.orders, items); }
  function getStores(){ return safeRead(KEYMAP.stores, defaultStores); }
  function setStores(items){ return safeWrite(KEYMAP.stores, items); }
  function getActiveStoreSlug(){
    const urlStore = new URLSearchParams(location.search).get('store');
    return urlStore || localStorage.getItem(KEYMAP.activeStore) || 'demo';
  }
  function setActiveStoreSlug(slug){ localStorage.setItem(KEYMAP.activeStore, slug); }
  function getStoreMargin(){ return Number(localStorage.getItem(KEYMAP.marginPct) || '20'); }
  function setStoreMargin(v){ localStorage.setItem(KEYMAP.marginPct, String(Number(v)||0)); }
  function money(v){ return new Intl.NumberFormat('pl-PL',{style:'currency',currency:'PLN'}).format(Number(v)||0); }
  function slugify(v){
    return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
  }
  function marginPrice(base, pct){
    const price = Number(base)||0;
    return +(price * (1 + (Number(pct)||0)/100)).toFixed(2);
  }
  function getCart(){ return safeRead(KEYMAP.cart, []); }
  function setCart(items){ return safeWrite(KEYMAP.cart, items); }

  ensureDefaults();

  window.QM = {
    KEYMAP, getPlan, setPlan, getProducts, setProducts, getOrders, setOrders,
    getStores, setStores, getActiveStoreSlug, setActiveStoreSlug, getStoreMargin,
    setStoreMargin, money, slugify, marginPrice, getCart, setCart, ensureDefaults
  };
})();
