const CACHE_NAME = 'ehdra-v1';
const ASSETS = [
  '/Mhail-frontend/',
  '/Mhail-frontend/index.html',
  '/Mhail-frontend/style.css',
  '/Mhail-frontend/app.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => response || fetch(e.request))
  );
});
