const cacheName = 'kamby-shell-' + BUILD_VERSION;
const base = new URL('./', self.registration.scope);
const shell = new URL('index.html', base);
const privatePath = /^(?:admin(?:[./-]|$)|(?:api|auth|rest|storage|functions|graphql|realtime)(?:\/|$))/i;
const staticPath = /^(?:[a-z0-9_.-]+\/)*[a-z0-9_.-]+\.(?:js|css|png|jpg|webp|svg|webmanifest)$/i;
const authParameters = ['code', 'access_token', 'refresh_token', 'token', 'token_hash', 'error', 'error_description'];

function isInScope(url) {
  return url.origin === base.origin && url.pathname.startsWith(base.pathname);
}

function isPublicAsset(url) {
  if (!isInScope(url) || url.search || url.hash) return false;
  const path = url.pathname.slice(base.pathname.length);
  return !privatePath.test(path) && (url.href === shell.href || staticPath.test(path));
}

const assets = new Set(BUILD_ASSETS.map(path => new URL(path, base)).filter(isPublicAsset).map(url => url.href));

async function prepareShell() {
  const downloads = await Promise.all([...assets].map(async url => {
    const request = new Request(url, { cache: 'reload', credentials: 'omit', redirect: 'error' });
    const response = await fetch(request);
    const cacheControl = response.headers.get('Cache-Control') || '';
    if (!response.ok || /(?:^|,)\s*(?:private|no-store)\b/i.test(cacheControl)) {
      throw new Error('O ficheiro não pode integrar o acesso offline: ' + new URL(url).pathname);
    }
    return [request, response];
  }));
  const cache = await caches.open(cacheName);
  await Promise.all(downloads.map(([request, response]) => cache.put(request, response)));
}

self.addEventListener('install', event => {
  event.waitUntil(prepareShell().then(() => self.skipWaiting()));
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
  if (request.method !== 'GET' || request.cache === 'no-store' || request.headers.has('Authorization')) return;
  const url = new URL(request.url);
  if (!isInScope(url) || privatePath.test(url.pathname.slice(base.pathname.length))) return;
  const appNavigation = request.mode === 'navigate' &&
    (url.pathname === base.pathname || url.pathname === shell.pathname) &&
    !authParameters.some(parameter => url.searchParams.has(parameter));
  if (!appNavigation && !assets.has(url.href)) return;

  if (appNavigation || /\.(?:js|css|webmanifest)$/.test(url.pathname)) {
    event.respondWith(serveShell(request, appNavigation ? shell.href : request));
  } else {
    event.respondWith(caches.open(cacheName).then(async cache =>
      await cache.match(request) || fetch(request)
    ));
  }
});
