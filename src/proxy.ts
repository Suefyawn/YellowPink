import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ============================================================================
// Middleware. Lives at src/proxy.ts (this Next.js build's renamed middleware
// convention). Handles:
//   1. Admin / account / sensitive-path auth gates
//   2. 301 redirects from the `redirects` table (WP URL preservation)
//
// Redirect lookup runs only on paths that we don't already know are handled
// (i.e. when the matcher would let the request fall through to a 404). To
// avoid hammering Supabase on every request, we keep a 60-second in-memory
// LRU of resolved (or known-missing) lookups per edge instance.
// ============================================================================

// ─── tiny LRU cache (Map preserves insertion order) ─────────────────────────
const REDIRECT_CACHE_MAX = 500;
const REDIRECT_TTL_MS = 60_000;

interface CacheEntry { to: string | null; expiresAt: number }
const redirectCache = new Map<string, CacheEntry>();

function cacheGet(key: string): string | null | undefined {
  const entry = redirectCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    redirectCache.delete(key);
    return undefined;
  }
  // Touch for LRU (delete + re-insert).
  redirectCache.delete(key);
  redirectCache.set(key, entry);
  return entry.to;
}

function cacheSet(key: string, to: string | null): void {
  if (redirectCache.size >= REDIRECT_CACHE_MAX) {
    const first = redirectCache.keys().next().value;
    if (first !== undefined) redirectCache.delete(first);
  }
  redirectCache.set(key, { to, expiresAt: Date.now() + REDIRECT_TTL_MS });
}

// Paths Next.js definitely owns (avoid useless lookups + redirect-loops).
function isOwnedPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/account') ||
    pathname === '/checkout' ||
    pathname === '/thank-you' ||
    pathname === '/cart' ||
    pathname === '/wishlist' ||
    pathname === '/login' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/track' ||
    pathname === '/shop' ||
    pathname === '/blog' ||
    pathname.startsWith('/product/') ||
    pathname.startsWith('/blog/') ||
    pathname.startsWith('/page/') ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/favicon.ico' ||
    pathname === '/icon.svg'
  );
}

async function resolveRedirect(pathname: string): Promise<string | null> {
  const cached = cacheGet(pathname);
  if (cached !== undefined) return cached;

  const sbUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const sbKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!sbUrl || !sbKey) {
    cacheSet(pathname, null);
    return null;
  }

  try {
    // PostgREST direct call — avoids pulling the full SDK into edge middleware.
    const url = `${sbUrl}/rest/v1/redirects?from_path=eq.${encodeURIComponent(pathname)}&select=to_path&limit=1`;
    const res = await fetch(url, {
      headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` },
      // Vercel-edge friendly: no body, GET, short.
    });
    if (!res.ok) {
      cacheSet(pathname, null);
      return null;
    }
    const rows = (await res.json()) as { to_path: string }[];
    const to = rows[0]?.to_path ?? null;
    cacheSet(pathname, to);
    return to;
  } catch {
    cacheSet(pathname, null);
    return null;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // ─── Admin auth gate ──────────────────────────────────────────────────────
  // The legacy admin_session cookie is HMAC-signed (see lib/signed-cookie.ts);
  // we verify the signature + age here in Edge. A staff_session cookie is
  // also accepted; its body verification happens at the page layer because
  // it needs the DB-backed staff_members lookup that Edge can't do cheaply.
  if (pathname === '/admin') return NextResponse.next();
  if (pathname.startsWith('/admin/')) {
    const session = request.cookies.get('admin_session')?.value;
    const staff   = request.cookies.get('staff_session')?.value;
    const pass    = process.env.ADMIN_PASSWORD;
    let ownerOk = false;
    if (pass && session) {
      const { verify, OWNER_COOKIE_TTL_SEC } = await import('@/lib/signed-cookie');
      const { STAFF_SESSION_SECRET } = await import('@/lib/session-secret');
      const payload = await verify(session, STAFF_SESSION_SECRET(), OWNER_COOKIE_TTL_SEC);
      ownerOk = payload?.sub === 'owner';
    }
    if (!ownerOk && !staff) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ─── Customer-account auth gate ───────────────────────────────────────────
  // Previously this only checked cookie presence — an attacker on a sibling
  // subdomain could plant any cookie of that shape and bypass the gate. RLS
  // would still protect the data at the page layer, but the metadata leak
  // ("you have an account") and the rendered shell were undesirable.
  //
  // Now we decode the Supabase access-token JWT body and check the `exp`
  // claim. We don't verify the signature in Edge (that would require the
  // project's JWT secret or a round-trip to Supabase); the page-layer
  // `supabase.auth.getUser()` does the cryptographic verification on every
  // request. This middleware is a fast pre-filter for UX.
  if (pathname.startsWith('/account')) {
    const sbCookie = [...request.cookies.getAll()].find(c =>
      (c.name.includes('auth-token') || c.name.includes('sb-')) && c.name.endsWith('-auth-token')
    );
    if (!sbCookie) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    // Supabase stores the cookie as either a JSON-serialized session or a
    // base64 envelope. Try both shapes; if we can't extract an unexpired JWT,
    // fall back to redirect.
    let ok = false;
    try {
      const raw = decodeURIComponent(sbCookie.value);
      // Strip a leading "base64-" tag if Supabase v2 added it.
      const stripped = raw.startsWith('base64-') ? atob(raw.slice('base64-'.length)) : raw;
      // Either a JSON {access_token, expires_at} or just the JWT.
      let accessToken: string | null = null;
      let expiresAt: number | null = null;
      try {
        const parsed = JSON.parse(stripped);
        if (Array.isArray(parsed)) {
          // legacy [access_token, refresh_token, _provider_token, _provider_refresh_token, _user]
          accessToken = parsed[0];
        } else if (parsed && typeof parsed === 'object') {
          accessToken = parsed.access_token ?? null;
          expiresAt = typeof parsed.expires_at === 'number' ? parsed.expires_at : null;
        }
      } catch {
        // Not JSON — assume the cookie value IS the JWT.
        accessToken = stripped;
      }
      // Decode JWT payload (no signature check — page layer enforces).
      if (accessToken && accessToken.split('.').length === 3) {
        const payloadB64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const pad = '='.repeat((4 - (payloadB64.length % 4)) % 4);
        const payload = JSON.parse(atob(payloadB64 + pad));
        const exp = expiresAt ?? payload.exp;
        if (typeof exp === 'number' && exp * 1000 > Date.now()) ok = true;
      }
    } catch {
      ok = false;
    }
    if (!ok) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // ─── WP pattern 301s (URL preservation for legacy slugs) ──────────────────
  // The Semrush audit of the live WP site flagged a thousand+ broken internal
  // links pointing at WP-style URLs (/about-us/, /shop/page/2/, /category/x/,
  // /?page_id=3). These rules cover the common shapes; per-slug redirects are
  // still served from the `redirects` table below (built by the WP importer
  // from old product / blog ids).
  //
  // Runs on ALL paths (incl. `/`) because `/?s=foo` is itself a WP redirect
  // target — `isOwnedPath` would otherwise filter it out before we got here.
  {
    const patternTo = wpPatternRedirect(pathname, request.nextUrl.searchParams);
    if (patternTo && patternTo !== pathname + (search ?? '')) {
      return NextResponse.redirect(new URL(patternTo, request.url), 301);
    }
  }

  // ─── 301 redirect lookup (WordPress URL preservation) ─────────────────────
  // Only run on paths we don't already own to avoid useless work and any
  // potential loops with route-handler-owned URLs.
  if (!isOwnedPath(pathname)) {
    const to = await resolveRedirect(pathname);
    if (to && to !== pathname) {
      const target = new URL(to + (search ?? ''), request.url);
      return NextResponse.redirect(target, 301);
    }
  }

  return NextResponse.next();
}

// Map a known WP-style URL to the Next route, or null if no rule matches and
// we should fall through to the per-slug `redirects` lookup. Pure function —
// no DB hits, no async — runs at edge speed.
function wpPatternRedirect(pathname: string, params: URLSearchParams): string | null {
  // /shop/page/2/ → /shop?page=2
  const shopPage = pathname.match(/^\/shop\/page\/(\d+)\/?$/);
  if (shopPage) return `/shop?page=${shopPage[1]}`;

  // /blog/page/2/ → /blog?page=2
  const blogPage = pathname.match(/^\/blog\/page\/(\d+)\/?$/);
  if (blogPage) return `/blog?page=${blogPage[1]}`;

  // /category/<slug>/ + /product-category/<slug>/ + /brand/<slug>/
  //   → /shop?category=<slug>
  const cat = pathname.match(/^\/(?:product-category|category|brand)\/([^/]+)\/?$/);
  if (cat) return `/shop?category=${encodeURIComponent(cat[1])}`;

  // /author/<name>/<page?>/ → /blog (we don't have author archives)
  if (/^\/author\/[^/]+(?:\/page\/\d+)?\/?$/.test(pathname)) return '/blog';

  // WP standard slugs that map to our CMS page route.
  const PAGE_SLUG_MAP: Record<string, string> = {
    '/about-us':         '/page/about',
    '/about':            '/page/about',
    '/contact-us':       '/page/contact',
    '/contact':          '/page/contact',
    '/shipping-policy':  '/page/shipping',
    '/shipping':         '/page/shipping',
    '/return-policy':    '/page/returns',
    '/returns-policy':   '/page/returns',
    '/returns-refunds':  '/page/returns',
    '/refund-policy':    '/page/returns',
    '/faqs':             '/page/faq',
    '/faq':              '/page/faq',
    '/privacy-policy':   '/privacy',
    '/terms':            '/page/terms',
    '/terms-conditions': '/page/terms',
  };
  const trimmed = pathname.replace(/\/$/, '') || '/';
  if (PAGE_SLUG_MAP[trimmed]) return PAGE_SLUG_MAP[trimmed];

  // /?s=foo&post_type=product (or any /?s=) → /shop with q param
  if (pathname === '' || pathname === '/') {
    const s = params.get('s');
    if (s) return `/shop?q=${encodeURIComponent(s)}`;
    // /?page_id=N is a WP fallback; route to home (page_ids aren't preserved
    // post-migration but the redirects table handles per-id mappings).
    if (params.get('page_id')) return '/';
  }

  return null;
}

// Run on everything except Next.js internals and static assets.
export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static, _next/image, _next/data
     * - any file with an extension (.svg, .png, .jpg, .css, .js, .woff…)
     */
    '/((?!_next/static|_next/image|_next/data|.*\\..*).*)',
  ],
};
