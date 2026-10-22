const CACHE_NAME = 'mofie-v6';
const STATIC_PATTERN = /\.(css|js|woff2?|png|jpg|jpeg|svg|ico|gif|webp)(\?|$)/i;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') ||
      url.hostname.includes('cloudinary') || url.hostname.includes('identitytoolkit')) return;

  if (STATIC_PATTERN.test(url.pathname)) {
    // Cache-first
    e.respondWith(
      caches.match(req).then(cached => {
        const fetchP = fetch(req).then(res => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(c => c.put(req, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchP;
      })
    );
    return;
  }

  // Network-first for HTML
  e.respondWith(
    fetch(req).then(res => {
      if (res && res.status === 200) {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, clone));
      }
      return res;
    }).catch(() => caches.match(req))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) if (c.url.includes(self.location.origin)) return c.focus();
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});
