// 404 capture endpoint. The not-found page used to read headers() server-side
// to log the missed path, but reading a dynamic API in the *root not-found
// boundary* forced every route into dynamic rendering (killed the static/ISR
// cache sitewide → ~1.5s TTFB). The not-found page is now static and beacons
// the missed path here instead. Modern crawlers (incl. Googlebot) render JS, so
// crawler 404s still reach this; this route keeps the server-side bot detection
// + genuine-404 guard (logNotFound) intact, and runs the service-role write off
// the static render path.

import { NextRequest, NextResponse } from 'next/server';
import { logNotFound } from '@/lib/not-found-log';
import { notFoundLimiter, ipFromHeaders } from '@/lib/ratelimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  // Unauthenticated write surface (service-role RPC behind logNotFound) →
  // per-IP rate limit so a scripted client can't spam the broken-links table.
  const rl = await notFoundLimiter.limit(ipFromHeaders(req.headers));
  if (!rl.success) {
    return new NextResponse(null, { status: 429 });
  }

  let body: { path?: unknown; referer?: unknown };
  try {
    body = (await req.json()) as { path?: unknown; referer?: unknown };
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  // logNotFound does all the heavy lifting: strips query/hash, the
  // speculative-render / owned-path guard (isGenuine404), bot detection from
  // the UA, asset/junk filtering, then the aggregated log_not_found RPC. The
  // beacon only fires on a real page render (never on router prefetch), so
  // isPrefetch is always false here.
  await logNotFound({
    path: typeof body.path === 'string' ? body.path : null,
    referer: typeof body.referer === 'string' && body.referer ? body.referer : req.headers.get('referer'),
    userAgent: req.headers.get('user-agent'),
    isPrefetch: false,
  });

  return new NextResponse(null, { status: 204 });
}
