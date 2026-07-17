const CACHE_NAME = 'seventh-reaction-build-68';
const APP_SHELL = [
  './',
  'styles.css?v=68',
  'map-data.js?v=68',
  'content.js?v=68',
  'state.js?v=68',
  'sprites.js?v=68',
  'game.js?v=68',
  'runtime.js?v=68',
  'interiors.js?v=68',
  'minigames.js?v=68',
  'audio.js?v=68',
  'assistant.js?v=68',
  'app.js?v=68',
  'manifest.webmanifest?v=68',
  'assets/seventh-reaction-icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.includes('/api/') || url.pathname.includes('/admin/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./', copy));
          return response;
        })
        .catch(() => caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => cached || fetch(request).then(response => {
      if (response.ok) caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    }))
  );
});
