/* Service Worker der Fahrzeugakte.
   Seitenaufrufe: erst Netz, dann Cache  -> Updates kommen sofort an, offline geht es trotzdem.
   Übrige Dateien: erst Cache, Netz aktualisiert im Hintergrund.
   WICHTIG: bei jeder Änderung an index.html o. ä. CACHE hochzählen. */
const CACHE = 'fahrzeugakte-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => { caches.open(CACHE).then(c => c.put('./', res.clone())); return res; })
        .catch(() => caches.match(req).then(hit => hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req)
        .then(res => { if (res && res.ok) caches.open(CACHE).then(c => c.put(req, res.clone())); return res; })
        .catch(() => hit);
      return hit || net;
    })
  );
});
