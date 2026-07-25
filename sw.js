/* Offline cache for the instalment calculator.
   Bump CACHE when index.html changes so phones pick up the new version. */
var CACHE = 'atin-v1';
var ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) {
        // prices.json is added separately: if it is missing or the network
        // hiccups, installation must still succeed.
        return c.addAll(ASSETS).then(function () {
          return c.add('./prices.json').catch(function () {});
        });
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* Network-first for the page (so updates land), cache-first for assets. */
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  /* prices.json is shared data, not a static asset: always try the network
     first so an edited file shows up, and keep a copy for offline use. */
  if (req.url.indexOf('prices.json') > -1) {
    e.respondWith(
      fetch(req).then(function (res) {
        if (res && res.status === 200) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put('./prices.json', copy); });
        }
        return res;
      }).catch(function () {
        return caches.match('./prices.json');
      })
    );
    return;
  }

  var isPage = req.mode === 'navigate' ||
               (req.headers.get('accept') || '').indexOf('text/html') > -1;

  if (isPage) {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) {
          return r || caches.match('./');
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      });
    })
  );
});
