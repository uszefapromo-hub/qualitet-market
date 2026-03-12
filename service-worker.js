const CACHE_VERSION = 'app-shell-v2';
const PRECACHE_ASSETS = [
  './',
  'index.html',
  'cennik.html',
  'crm.html',
  'dashboard.html',
  'generator-sklepu.html',
  'hurtownie.html',
  'intelligence.html',
  'listing.html',
  'login.html',
  'owner-panel.html',
  'panel-sklepu.html',
  'qualitetmarket.html',
  'sklep.html',
  'koszyk.html',
  'css/style.css',
  'styles.css',
  'panel.css',
  'shop.css',
  'landing.css',
  'js/app.js',
  'js/api.js',
  'js/api-client.js',
  'js/flow.js',
  'js/cart.js',
  'js/pwa-connect.js',
  'shop.js',
  'stores.js',
  'assets/images/logo-uszefa.svg',
  'assets/images/logo-wspolne.svg',
  'assets/icons/icon-192.svg',
  'assets/icons/icon-512.svg',
  'assets/icons/apple-touch-icon.svg',
  'assets/icons/favicon.svg',
  'manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_VERSION).map(key => caches.delete(key))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if(event.request.method !== 'GET'){
    return;
  }
  const requestUrl = new URL(event.request.url);
  if(requestUrl.origin !== self.location.origin){
    return;
  }
  if(event.request.mode === 'navigate'){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match('index.html'))
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached){
        return cached;
      }
      return fetch(event.request).then(response => {
        if(response && response.status === 200){
          const copy = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
