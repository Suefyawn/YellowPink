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

  // ─── Admin auth gate (unchanged) ──────────────────────────────────────────
  if (pathname === '/admin') return NextResponse.next();
  if (pathname.startsWith('/admin/')) {
    const session = request.cookies.get('admin_session')?.value;
    const staff   = request.cookies.get('staff_session')?.value;
    const pass    = process.env.ADMIN_PASSWORD;
    if (!pass && !staff) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (pass) {
      const expected = Buffer.from(pass).toString('base64');
      // Either the legacy owner cookie or a staff session is accepted.
      if (session !== expected && !staff) {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
    } else if (!staff) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
  }

  // ─── Customer-account auth gate (unchanged) ───────────────────────────────
  if (pathname.startsWith('/account')) {
    const hasSession = [...request.cookies.getAll()].some(c =>
      (c.name.includes('auth-token') || c.name.includes('sb-')) && c.name.endsWith('-auth-token')
    );
    if (!hasSession) {
      return NextResponse.redirect(new URL('/login', request.url));
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
