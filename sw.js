const CACHE = 'kiem-ke-ca-v70';

const PRECACHE = [
  '/quanlycuahang/',
  '/quanlycuahang/index.html',
  '/quanlycuahang/manifest.json',
  '/quanlycuahang/icon-192.png',
  '/quanlycuahang/icon-512.png',
  '/quanlycuahang/banh_bao.png',
  '/quanlycuahang/chita-logo.jpg',
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
];

self.addEventListener('install', e => {
  // Do NOT call skipWaiting here — wait for user to confirm reload
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// User taps "Tải lại" → app sends this message → SW skips waiting → page reloads
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', e => {
  // Never intercept GAS or Sheets API calls — must hit the network
  if (e.request.url.includes('script.google.com') || e.request.url.includes('docs.google.com')) return;

  // Cache-first for everything else (app shell + CDN bundles)
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        if (res && res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
    })
  );
});
