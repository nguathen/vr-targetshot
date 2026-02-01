const CACHE_VERSION = 'vr-quest-v15';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const CDN_CACHE = `${CACHE_VERSION}-cdn`;

const STATIC_ASSETS = [
  './',
  './index.html',
  './game.html',
  './settings.html',
  './stats.html',
  './tutorial.html',
  './friends.html',
  './shop.html',
  './privacy.html',
  './css/style.css',
  './manifest.json',
];

const CDN_ASSETS = [
  'https://aframe.io/releases/1.6.0/aframe.min.js',
];

// Install: cache static assets + CDN
self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
      caches.open(CDN_CACHE).then((cache) => cache.addAll(CDN_ASSETS)),
    ]).then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== CDN_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static/CDN, network-first for API/Firebase
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Firebase / API calls: network-first
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // CDN assets: cache-first
  if (url.hostname !== location.hostname) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
        const clone = response.clone();
        caches.open(CDN_CACHE).then((cache) => cache.put(event.request, clone));
        return response;
      }))
    );
    return;
  }

  // Static assets (including hashed JS/CSS): cache-first, update in background
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || fetchPromise;
    })
  );
});
