(function(){
  const APP_STORAGE_KEYS = {
    plan: 'app_user_plan'
  };
  window.APP_STORAGE_KEYS = {
    ...(window.APP_STORAGE_KEYS || {}),
    ...APP_STORAGE_KEYS
  };
  const STORAGE_KEYS = {
    stores: 'stores',
    activeStore: 'activeStore'
  };

  function safeParse(raw){
    if(!raw){
      return null;
    }
    try{
      return JSON.parse(raw);
    } catch (_error){
      return null;
    }
  }

  function loadStores(){
    const parsed = safeParse(localStorage.getItem(STORAGE_KEYS.stores));
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveStores(stores){
    localStorage.setItem(STORAGE_KEYS.stores, JSON.stringify(stores));
  }

  function normalizeSlug(value){
    return (value || '')
      .toString()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');
  }

  function generateId(){
    if(typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'){
      return crypto.randomUUID();
    }
    return `store_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  }

  function upsertStore(store){
    const stores = loadStores();
    const normalizedSlug = normalizeSlug(store.slug || store.name || '');
    const candidate = {
      ...store,
      slug: normalizedSlug
    };
    let index = -1;
    if(candidate.id){
      index = stores.findIndex(item => item.id === candidate.id);
    }
    if(index === -1 && normalizedSlug){
      index = stores.findIndex(item => item.slug === normalizedSlug);
    }

    if(index >= 0){
      const existing = stores[index];
      const updated = {
        ...existing,
        ...candidate,
        id: existing.id,
        createdAt: existing.createdAt || candidate.createdAt
      };
      stores[index] = updated;
      saveStores(stores);
      return updated;
    }

    const created = {
      ...candidate,
      id: candidate.id || generateId(),
      createdAt: candidate.createdAt || new Date().toISOString()
    };
    stores.push(created);
    saveStores(stores);
    return created;
  }

  function setActiveStore(storeId){
    if(!storeId){
      localStorage.removeItem(STORAGE_KEYS.activeStore);
      return;
    }
    localStorage.setItem(STORAGE_KEYS.activeStore, storeId);
  }

  function getActiveStore(){
    const stores = loadStores();
    const activeId = localStorage.getItem(STORAGE_KEYS.activeStore);
    let active = stores.find(item => item.id === activeId);
    if(!active && stores.length){
      active = stores[stores.length - 1];
    }
    return active || null;
  }

  window.StoreManager = {
    STORAGE_KEYS,
    loadStores,
    saveStores,
    normalizeSlug,
    upsertStore,
    setActiveStore,
    getActiveStore
  };
})();
