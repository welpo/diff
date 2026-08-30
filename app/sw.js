// GENERATED BLOCK: written by .githooks/pre-commit, do not edit by hand.
const CACHE_NAME = 'kawari-887bb28e';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './diff.js?h=52ba9aad',
  './grid.js?h=611eb787',
  './styles.css?h=a999d490',
  './manifest.json?h=2c311878',
  './diff.worker.js?h=e7b50a1c',
  './sw-registration.js?h=bfa8fde5',
  './app.js?h=a4c3f98c',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png',
  './favicon.ico'
];
// END GENERATED BLOCK

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
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => cache.put(event.request, copy));
          }
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
