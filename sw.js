// Nomi Service Worker — offline cache
const CACHE_NAME = 'nomi-v1';
const OFFLINE_URL = '/nomi/';

const CACHE_URLS = [
  '/nomi/',
  '/nomi/index.html',
  '/nomi/manifest.json',
  '/nomi/icon-192.png',
  '/nomi/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache the shell — ignore failures for missing icons
      return cache.addAll(CACHE_URLS).catch(() => cache.add(OFFLINE_URL));
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  // Only handle GET requests for same-origin or CDN fonts
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Network-first for API calls (Anthropic, Firebase, OpenAI)
  if (url.hostname.includes('anthropic') ||
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis') ||
      url.hostname.includes('openai') ||
      url.hostname.includes('google')) {
    return; // Let these go straight to network
  }

  // Cache-first for app shell and static assets
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200) return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
      });
    })
  );
});

// Handle shortcuts from manifest
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/lifeos/';
  event.waitUntil(clients.openWindow(url));
});
