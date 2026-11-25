const cacheName = 'kamby-shell-' + BUILD_VERSION;
const shell = new URL('./index.html', self.registration.scope).href;
const assets = new Set(BUILD_ASSETS.map(path => new URL(path, self.registration.scope).href));

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache =>
    cache.addAll([...assets].map(url => new Request(url, {cache: 'reload'})))
  ).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('kamby-shell-') && key !== cacheName)
      .map(key => caches.delete(key))
  )));
});

async function serveShell(request, fallback) {
  let response;
  try {
    response = await fetch(request, { cache: 'no-cache' });
    if (response.status < 500) return response;
  } catch {
    // Offline users can still open the last fully prepared shell.
  }
  const cache = await caches.open(cacheName);
  return await cache.match(fallback) || response || Response.error();
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const base = new URL('./', self.registration.scope);
  const appNavigation = request.mode === 'navigate' && url.origin === base.origin &&
    (url.pathname === base.pathname || url.pathname === new URL(shell).pathname);
  if (!appNavigation && !assets.has(url.href)) return;

  if (appNavigation || /\.(?:js|css|webmanifest)$/.test(url.pathname)) {
    event.respondWith(serveShell(request, appNavigation ? shell : request));
  } else {
    event.respondWith(caches.open(cacheName).then(async cache =>
      await cache.match(request) || fetch(request)
    ));
  }
});
