/* ============================================================
   PaceUp — Service Worker (FIXED)
   Resilient caching — individual file failures don't block install
   ============================================================ */

const CACHE_NAME = 'paceup-v2';

const APP_FILES = [
  './index.html',
  './css/style.css',
  './js/gps.js',
  './js/voice.js',
  './js/pacer.js',
  './js/map.js',
  './js/ui.js',
  './js/history.js',
  './js/app.js',
  './manifest.json',
  './privacy.html',
];

const CDN_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

// Install — cache files individually (don't fail on a single 404)
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      // Cache each file individually — failures don't block install
      var promises = APP_FILES.concat(CDN_FILES).map(function(url) {
        return cache.add(url).catch(function(err) {
          console.warn('SW: failed to cache', url, err.message);
        });
      });
      return Promise.all(promises);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names
          .filter(function(name) { return name !== CACHE_NAME && !name.startsWith(CACHE_NAME); })
          .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — network first for navigation, cache first for assets
self.addEventListener('fetch', function(event) {
  var url = new URL(event.request.url);

  // Map tiles — network first, cache fallback (don't block on tile errors)
  if (url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        var clone = response.clone();
        caches.open(CACHE_NAME + '-tiles').then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        return caches.match(event.request);
      })
    );
    return;
  }

  // Everything else — cache first, network fallback
  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        // Cache new successful responses
        if (response.ok) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function() {
        // Offline and not cached — return offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
