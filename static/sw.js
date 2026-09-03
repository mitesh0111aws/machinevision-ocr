const CACHE_NAME = 'mv-scanner-v1';
const ASSETS = [
  '/',
  '/static/app.js',
  '/api/templates',
  '/api/samples'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
