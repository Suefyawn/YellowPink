// Same-origin image resizer: /img?src=<path-or-url>&w=<width>&q=<quality>.
//
// Every <Image> on the site resolves here (src/lib/image-loader.ts). The
// route fetches the resized WebP from images.weserv.nl server-to-server —
// robots.txt only binds crawlers, not our server — and streams it back from
// our own domain with immutable cache headers, so the Vercel edge cache
// serves repeat hits without re-invoking the function. Google therefore
// crawls and indexes images at www.yellowpink.pk/img?…, which is what makes
// product-result thumbnails possible (weserv URLs are robots-blocked and
// were invisible to Google Images).
//
// Not an open proxy: src must be site-relative or on a whitelisted host,
// and width/quality are clamped, so the route can't be abused to resize
// arbitrary third-party content on our bill.

import { NextRequest, NextResponse } from 'next/server';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yellowpink.pk').replace(/\/$/, '');

const hostOf = (u: string | undefined): string | null => {
  try { return u ? new URL(u).hostname : null; } catch { return null; }
};

// Every host that appears in catalogue/blog image URLs (verified against
// production data): our own domain and Supabase storage. All catalogue
// images were re-hosted into our own storage (July 2026), so third-party
// brand CDNs are no longer whitelisted — new products must upload their
// shots rather than hotlink. The site + Supabase hosts derive from env so
// local/preview stacks (different Supabase URL) work without edits.
const ALLOWED_HOSTS = new Set(
  [
    'www.yellowpink.pk',
    'yellowpink.pk',
    hostOf(SITE),
    hostOf(process.env.NEXT_PUBLIC_SUPABASE_URL),
  ].filter((h): h is string => Boolean(h)),
);

// Mirror next.config deviceSizes/imageSizes bounds.
const MIN_W = 16;
const MAX_W = 1920;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const src = sp.get('src') ?? '';
  if (!src) return new NextResponse('missing src', { status: 400 });

  // Resolve the target: site-relative paths belong to us; absolute URLs must
  // be on the whitelist.
  let target: URL;
  try {
    target = src.startsWith('/') ? new URL(`${SITE}${src}`) : new URL(src);
  } catch {
    return new NextResponse('bad src', { status: 400 });
  }
  if (target.protocol !== 'https:' && target.protocol !== 'http:') {
    return new NextResponse('bad src', { status: 400 });
  }
  if (!ALLOWED_HOSTS.has(target.hostname)) {
    return new NextResponse('host not allowed', { status: 403 });
  }

  const w = Math.min(MAX_W, Math.max(MIN_W, Number(sp.get('w')) || 640));
  const q = Math.min(90, Math.max(30, Number(sp.get('q')) || 75));

  // Same weserv parameters the old client-side loader used: resize to the
  // requested width, WebP output, `we` = never upscale past the original.
  const upstream = `https://images.weserv.nl/?url=${encodeURIComponent(target.href)}&w=${w}&q=${q}&output=webp&we`;

  try {
    const res = await fetch(upstream, {
      // The bytes for a given (src, w, q) never change — cache the upstream
      // fetch too, so ISR-style re-renders don't re-download.
      cache: 'force-cache',
      headers: { Accept: 'image/webp,image/*' },
    });
    if (!res.ok || !res.body) throw new Error(`upstream ${res.status}`);
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        'Content-Type': res.headers.get('content-type') ?? 'image/webp',
        // Browser + Vercel edge: cache for a year. Image content at a given
        // URL is immutable (catalogue images get new filenames on change).
        'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
      },
    });
  } catch {
    // weserv down or refusing: serve the original directly rather than a
    // broken image. Short-lived cache so recovery is quick.
    return NextResponse.redirect(target.href, {
      status: 302,
      headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
    });
  }
}
