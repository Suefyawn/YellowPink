// Core Web Vitals beacon sink. The storefront's WebVitalsReporter posts each
// metric here (consent-gated, via navigator.sendBeacon) and we persist it to
// the `web_vitals` table so the admin Analytics page can show real p75 field
// performance in-app — Vercel Speed Insights has no public query API to pull
// those numbers from.
//
// The table is RLS-locked with no anon policies, so the insert runs through
// the service role here. We validate hard and store only non-PII fields
// (metric, value, rating, pathname, coarse device, connection type). noindex
// via the /api/ robots disallow.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Only the standard Core Web Vitals set is persisted. Next.js also emits
// Next-hydration/render custom metrics via useReportWebVitals; we drop those
// to keep the table focused on the field metrics Google ranks on.
const ALLOWED_METRICS = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);
const ALLOWED_RATINGS = new Set(['good', 'needs-improvement', 'poor']);

// Sane upper bounds so a malformed/abusive beacon can't poison the p75.
// LCP/INP/FCP/TTFB are ms; CLS is a small unitless ratio.
function valueInRange(metric: string, value: number): boolean {
  if (!Number.isFinite(value) || value < 0) return false;
  if (metric === 'CLS') return value <= 10;          // CLS rarely exceeds ~1
  return value <= 600_000;                           // 10 min ceiling for timings
}

function deviceFromUA(ua: string | null): 'mobile' | 'desktop' {
  if (ua && /Mobi|Android|iPhone|iPad|iPod/i.test(ua)) return 'mobile';
  return 'desktop';
}

interface VitalBody {
  name?: unknown;
  value?: unknown;
  rating?: unknown;
  route?: unknown;
  connection?: unknown;
}

export async function POST(req: NextRequest) {
  // sendBeacon posts as text/plain or application/json; tolerate both.
  let body: VitalBody;
  try {
    body = (await req.json()) as VitalBody;
  } catch {
    return NextResponse.json({ ok: false, error: 'bad json' }, { status: 400 });
  }

  const metric = typeof body.name === 'string' ? body.name : '';
  const value = typeof body.value === 'number' ? body.value : Number(body.value);
  if (!ALLOWED_METRICS.has(metric) || !valueInRange(metric, value)) {
    // 204 (not an error to the client): we just silently drop anything we
    // don't store, so a noisy beacon never shows up as a console error.
    return new NextResponse(null, { status: 204 });
  }

  const rating = typeof body.rating === 'string' && ALLOWED_RATINGS.has(body.rating)
    ? body.rating
    : null;

  // Pathname only — strip any query string/hash defensively even though the
  // client already does. Cap length so a crafted path can't bloat the row.
  let route: string | null = null;
  if (typeof body.route === 'string' && body.route.startsWith('/')) {
    route = body.route.split(/[?#]/)[0].slice(0, 512);
  }

  // Staff-only surfaces are not customer field data — /admin and /reviewer
  // rows were polluting the p75s the WebVitalsWidget reports (audit C8).
  if (route && (route.startsWith('/admin') || route.startsWith('/reviewer'))) {
    return new NextResponse(null, { status: 204 });
  }
  // A single desktop client hammering one blog post drove TTFB p75 to a
  // fake-poor 4.9s (30s+ samples, 61 of 100 desktop rows). A real user's
  // timing beyond 30s is a dead connection or a scraper, not page
  // performance — drop it instead of letting one client define the p75.
  if (metric !== 'CLS' && value > 30_000) {
    return new NextResponse(null, { status: 204 });
  }

  const connection = typeof body.connection === 'string'
    ? body.connection.slice(0, 16)
    : null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    // Misconfigured env — don't 500 a fire-and-forget beacon.
    return new NextResponse(null, { status: 204 });
  }

  try {
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });
    await admin.from('web_vitals').insert({
      metric,
      value,
      rating,
      route,
      device: deviceFromUA(req.headers.get('user-agent')),
      connection,
    });
  } catch {
    // Swallow — a dropped vitals sample is never worth surfacing to the user.
  }

  // sendBeacon ignores the body; 204 keeps it cheap.
  return new NextResponse(null, { status: 204 });
}
