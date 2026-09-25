/* ============================================================
   PaceUp — Service Worker v3
   NETWORK-FIRST for app files (always gets latest)
   Cache-only as offline fallback
   ============================================================ */

var CACHE_NAME = 'paceup-v3';

// Install — just activate immediately, don't pre-cache
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Activate — delete ALL old caches, claim clients
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.map(function(name) {
          if (name !== CACHE_NAME) return caches.delete(name);
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch — NETWORK FIRST for everything
// Try network → cache response for offline → serve
// If network fails → serve from cache (offline mode)
self.addEventListener('fetch', function(event) {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Got fresh response from network — cache it
      if (response.ok) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Network failed — try cache (offline mode)
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // Nothing in cache either — return offline page for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
