const CACHE_NAME = 'diff-cache-v1.0.1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './styles.css?h=85bf58d9',
  './app.js?h=24423efd',
  './diff.js?h=52ba9aad',
  './diff.worker.js?h=eeed30b0',
  './grid.js?h=a91e6c44',
  './manifest.json?h=2c311878',
  './sw-registration.js?h=bfa8fde5',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png',
  './favicon.ico'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      );
    })
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request)
          .then(response => response || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});
