const CACHE_NAME = 'lector-resultados-v44';
const APP_SHELL = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Intercepta el envío de "Compartir con..." desde WhatsApp, Gmail, etc.
  if (event.request.method === 'POST' && url.pathname.endsWith('/index.html')) {
    event.respondWith(handleShareTarget(event));
    return;
  }

  // Never cache API calls — always go to the network for live analysis.
  if (url.hostname === 'generativelanguage.googleapis.com') {
    return;
  }

  // App shell: cache-first so the interface loads offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200 && event.request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);
    })
  );
});

async function handleShareTarget(event) {
  try {
    const formData = await event.request.formData();
    const file = formData.get('sharedFile');
    if (file) {
      const cache = await caches.open('share-target-cache');
      const safeName = encodeURIComponent(file.name || 'documento-compartido');
      await cache.put('shared-file', new Response(file, {
        headers: { 'X-Shared-File-Name': safeName, 'Content-Type': file.type || 'application/octet-stream' }
      }));
    }
  } catch (e) {
    // Si algo falla, igual redirigimos a la app normal.
  }
  return Response.redirect('./index.html?shared=1', 303);
}
