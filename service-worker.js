const CACHE_NAME = 'uszefaqualitet-app-v1';
const CORE_ASSETS = [
  '/',
  'index.html',
  'css/style.css',
  'styles.css',
  'js/app.js',
  'shop.js',
  'stores.js',
  'assets/icons/icon-192.png',
  'assets/icons/icon-512.png',
  'assets/icons/apple-touch-icon.png',
  'assets/icons/favicon-32x32.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
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
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(error => {
          console.warn('Offline fallback served for navigation.', error);
          return caches.match('index.html');
        })
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
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
