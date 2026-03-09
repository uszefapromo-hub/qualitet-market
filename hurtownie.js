document.addEventListener('DOMContentLoaded', () => {
  if(!window.QM) return;

  const settingsForm = document.getElementById('store-settings-form');
  const storePreview = document.getElementById('store-preview');
  const generatorForm = document.getElementById('generator-form');
  const storesList = document.getElementById('stores-list');

  function renderPreview(){
    if(!storePreview) return;
    const stores = QM.getStores();
    const slug = QM.getActiveStoreSlug();
    const store = stores.find(s=>s.slug===slug) || stores[0];
    storePreview.innerHTML = `
      <div class="list-item"><span>Nazwa</span><strong>${store?.name || 'Brak'}</strong></div>
      <div class="list-item"><span>Slug</span><strong>${store?.slug || 'Brak'}</strong></div>
      <div class="list-item"><span>Marża</span><strong>${QM.getStoreMargin()}%</strong></div>
    `;
    if(settingsForm && store){
      settingsForm.name.value = store.name || '';
      settingsForm.slug.value = store.slug || '';
      settingsForm.description.value = store.description || '';
      settingsForm.margin.value = QM.getStoreMargin();
    }
  }

  function renderStores(){
    if(!storesList) return;
    const stores = QM.getStores();
    storesList.innerHTML = stores.map(store => `
      <div class="list-item">
        <div>
          <strong>${store.name}</strong>
          <div class="small">${store.slug} • marża ${store.marginPct || QM.getStoreMargin()}%</div>
        </div>
        <button class="btn" data-open="${store.slug}">Aktywuj</button>
      </div>
    `).join('');
    storesList.querySelectorAll('[data-open]').forEach(btn=>{
      btn.addEventListener('click',()=>{
        QM.setActiveStoreSlug(btn.getAttribute('data-open'));
        alert('Ustawiono aktywny sklep');
        renderStores();
        renderPreview();
      });
    });
  }

  if(settingsForm){
    settingsForm.addEventListener('submit',(e)=>{
      e.preventDefault();
      const fd = new FormData(settingsForm);
      const name = fd.get('name') || 'Mój sklep';
      const slug = QM.slugify(fd.get('slug') || name);
      const stores = QM.getStores();
      const idx = stores.findIndex(s=>s.slug===QM.getActiveStoreSlug());
      const next = {id:'store-'+Date.now(), name, slug, description:fd.get('description')||'', marginPct:Number(fd.get('margin')||20)};
      if(idx >= 0) stores[idx] = next; else stores.push(next);
      QM.setStores(stores);
      QM.setActiveStoreSlug(slug);
      QM.setStoreMargin(next.marginPct);
      renderPreview();
      renderStores();
      alert('Zapisano ustawienia sklepu');
    });
  }

  if(generatorForm){
    generatorForm.addEventListener('submit',(e)=>{
      e.preventDefault();
      const fd = new FormData(generatorForm);
      const name = fd.get('name');
      const slug = QM.slugify(name);
      const stores = QM.getStores();
      if(stores.some(s=>s.slug===slug)){
        alert('Taki sklep już istnieje');
        return;
      }
      stores.push({id:'store-'+Date.now(), name, slug, description:fd.get('description')||'', marginPct:Number(fd.get('margin')||20)});
      QM.setStores(stores);
      QM.setActiveStoreSlug(slug);
      QM.setStoreMargin(Number(fd.get('margin')||20));
      generatorForm.reset();
      renderStores();
      renderPreview();
      alert('Sklep utworzony');
    });
  }

  renderPreview();
  renderStores();
});
