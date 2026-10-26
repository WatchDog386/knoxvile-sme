// Knoxville service worker — makes the app installable and lets the shell
// open on a weak connection. API data is never cached (always live).
const CACHE = 'knoxville-shell-v1';
const REQUIRED_SHELL = ['/', '/index.html'];
const OPTIONAL_SHELL = ['/manifest.json', '/icons/splash-logo.png', '/icons/launch-192.png', '/icons/launch-512.png', '/icons/maskable-192.png', '/icons/maskable-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(REQUIRED_SHELL);
    await Promise.all(OPTIONAL_SHELL.map((path) => cache.add(path).catch(() => undefined)));
  })());
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) {
    return;
  }

  // Pages: network first, fall back to the cached app shell when offline
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) return response;
        return (await caches.match('/index.html')) || response;
      } catch {
        return (await caches.match('/index.html')) || new Response(
          'Knoxville is offline. Reconnect and try again.',
          { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
        );
      }
    })());
    return;
  }

  // Built assets are content-hashed: serve from cache, fill it on first use
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok && url.pathname.startsWith('/assets/')) {
        await caches.open(CACHE).then((cache) => cache.put(request, response.clone())).catch(() => undefined);
      }
      return response;
    } catch {
      if (request.destination === 'image') {
        const imageFallback = await caches.match('/icons/launch-192.png');
        if (imageFallback) return imageFallback;
      }
      return new Response(null, { status: 503, statusText: 'Service Unavailable' });
    }
  })());
});
