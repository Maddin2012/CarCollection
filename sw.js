/* Service Worker von CarCollection.
   Seitenaufrufe: erst Netz, dann Cache  -> Updates kommen sofort an, offline geht es trotzdem.
   Übrige Dateien: erst Cache, Netz aktualisiert im Hintergrund.
   WICHTIG: bei jeder Änderung an index.html o. ä. die Fassung hochzählen - hier
   CACHE, dazu APP_VERSION in index.html und version.json. Alle drei müssen
   dieselbe Zahl tragen, die CI vergleicht sie. */
const CACHE = 'carcollection-v10';
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

  // version.json ist das Signal für ein Update und darf deshalb nie aus dem
  // Cache kommen - sonst meldete die App auf ewig die Fassung von vorgestern.
  // Sie wird auch nicht abgelegt; offline schlägt die Anfrage fehl, das fängt
  // die App ab.
  if (new URL(req.url).pathname.endsWith('/version.json')) {
    e.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // Vor dem Zurückgeben klonen, nicht danach: Die Seite liest den Körper sofort,
  // und ein gelesener Körper lässt sich nicht mehr klonen. Vorher stand das
  // clone() erst im then() von caches.open() - also einen Mikrotask zu spät.
  // Dadurch warf jeder Abruf im Service Worker einen TypeError und es wurde nie
  // etwas nachträglich abgelegt.
  const ablegen = (schluessel, res) => {
    if (!res || !res.ok) return res;
    const kopie = res.clone();
    caches.open(CACHE).then(c => c.put(schluessel, kopie)).catch(() => {});
    return res;
  };

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => ablegen('./', res))
        .catch(() => caches.match(req).then(hit => hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(hit => {
      const net = fetch(req).then(res => ablegen(req, res)).catch(() => hit);
      return hit || net;
    })
  );
});
