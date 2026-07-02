// ============================================================================
// YellowPink service worker — minimal, hand-written.
//
// Strategy:
//   • Storefront pages (HTML)           → network-first with cached fallback.
//   • Static assets (_next/static, css) → cache-first.
//   • Images (Supabase Storage, public) → stale-while-revalidate.
//
// No background sync / push for now — opt in via a follow-up commit.
// ============================================================================

const VERSION = 'yp-v2';
const HTML_CACHE   = `${VERSION}-html`;
const ASSET_CACHE  = `${VERSION}-assets`;
const IMAGE_CACHE  = `${VERSION}-images`;

self.addEventListener('install', (event) => {
  // Skip waiting so we activate the new SW immediately on next nav.
  self.skipWaiting();
  event.waitUntil(
    caches.open(HTML_CACHE).then(c => c.add('/').catch(() => null))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  // Our public product images live on Supabase Storage (a different origin);
  // that's the one cross-origin host we deliberately cache.
  const isStorageImage = url.pathname.includes('/storage/v1/object/public/images/');

  // Never intercept OTHER cross-origin requests. Matching third-party assets
  // by path/extension made the SW re-issue them via fetch() from its own
  // context — which (a) tripped connect-src CSP for things like a browser
  // extension's Google Font (fonts.gstatic.com Figtree woff2) and (b) cached
  // junk we don't own. Let the browser handle cross-origin normally.
  if (!sameOrigin && !isStorageImage) return;

  // Never cache auth-sensitive / mutating endpoints.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/admin')) return;

  // Static assets (same-origin only) — cache-first (long-lived hashes).
  if (sameOrigin && (url.pathname.startsWith('/_next/static') || /\.(css|js|woff2?)$/.test(url.pathname))) {
    event.respondWith(cacheFirst(req, ASSET_CACHE));
    return;
  }

  // Product images — stale-while-revalidate (Supabase Storage or same-origin).
  if (isStorageImage || (sameOrigin && /\.(png|jpg|jpeg|webp|avif|svg)$/.test(url.pathname))) {
    event.respondWith(staleWhileRevalidate(req, IMAGE_CACHE));
    return;
  }

  // HTML — network-first, fall back to cached or the offline shell.
  if (sameOrigin && req.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(req, HTML_CACHE));
    return;
  }
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone()).catch(() => {});
  return res;
}

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  } catch {
    const hit = await cache.match(req);
    if (hit) return hit;
    // Last resort: the home page (cached at install).
    return (await cache.match('/')) ?? Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  const fetchPromise = fetch(req).then(res => {
    if (res.ok) cache.put(req, res.clone()).catch(() => {});
    return res;
  }).catch(() => hit ?? Response.error());
  return hit ?? fetchPromise;
}
