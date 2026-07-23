// ============================================================================
// Consolidated daily cron. Runs these jobs sequentially:
//   1. abandoned-cart      , drip emails to carts left for 24 h / 72 h
//   2. courier-sync        , poll courier APIs for in-transit shipments
//   3. review-requests     , ask for reviews on orders delivered 3-30 days ago
//   4. stuck-payments      , flag orders stuck mid-payment for follow-up
//   5. not-found-digest    , email the owner newly-broken (404) URLs
//   6. analytics-refresh   , refresh PostHog + Sentry dashboard widgets
//   7. popularity-refresh  , recompute products.popularity_score (views+carts+sales)
//   8. indexing-check      , refresh GSC indexing status for new pages
//   9. price-parity        , (Mondays only) NB Sons singles never below their store price
//
// Removed: low-stock + back-in-stock. The store runs a dropship model, so
// shelf stock isn't tracked and there's nothing to restock-alert or notify
// watchers about, those jobs (and their email senders + routes) were deleted.
//
// Vercel Hobby allows only 2 cron entries per project and only at
// daily-or-less-frequent schedules. The previous setup (three crons,
// one hourly) tripped both limits, so the deploy was rejected before a
// build event ever fired. This route consolidates everything into one
// vercel.json cron entry and delegates to the three existing route
// handlers via in-process fetch, keeps the per-job logic untouched.
//
// Upgrade path: when the project moves to Vercel Pro, split this back
// into separate crons (e.g. `abandoned-cart` daily, `courier-sync`
// every 30 min) for fresher tracking updates.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Bump the function timeout, courier-sync alone can touch up to 200
// shipments × 1 API round-trip each; combined with the two email jobs
// the default 10 s budget is too tight.
export const maxDuration = 60;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

interface SubJobResult {
  job: string;
  ok: boolean;
  status: number;
  ms: number;
  body?: unknown;
  error?: string;
}

async function runJob(req: NextRequest, path: string): Promise<SubJobResult> {
  const t0 = Date.now();
  try {
    const url = new URL(path, req.url);
    const res = await fetch(url, {
      method: 'GET',
      headers: { authorization: req.headers.get('authorization') ?? '' },
      // No caching, these are mutating jobs.
      cache: 'no-store',
    });
    let body: unknown = null;
    try { body = await res.json(); } catch { /* non-JSON response */ }
    return { job: path, ok: res.ok, status: res.status, ms: Date.now() - t0, body };
  } catch (err) {
    return {
      job: path, ok: false, status: 0, ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Run sequentially so we don't blow the 60 s budget with parallel
  // long-runs, and so a failure in one job doesn't abort the others.
  //
  // Time-budget guard: if the earlier jobs eat most of the 60 s maxDuration
  // (courier-sync alone can touch 200 shipments), Vercel kills the function
  // mid-job — the remaining jobs silently never run and the invocation logs
  // nothing. Stop launching new jobs once <12 s remain and report the rest
  // as skipped instead, so a squeezed day shows up as an explicit 207 with
  // named skips rather than a silent half-run. Revenue-relevant jobs run
  // first; the analytics/index refreshes at the tail are the safest to skip
  // (they re-run tomorrow, and staff can refresh dashboards manually).
  const JOBS = [
    '/api/cron/abandoned-cart',
    '/api/cron/courier-sync',
    '/api/cron/review-requests',
    '/api/cron/stuck-payments',
    '/api/cron/not-found-digest',
    '/api/cron/analytics-refresh',
    '/api/cron/popularity-refresh',
    '/api/cron/indexing-check',
    '/api/cron/price-parity',
  ];
  const BUDGET_MS = (maxDuration - 12) * 1000;
  const started = Date.now();
  const results: SubJobResult[] = [];
  for (const path of JOBS) {
    if (Date.now() - started > BUDGET_MS) {
      results.push({ job: path, ok: false, status: 0, ms: 0, error: 'skipped: cron time budget exhausted' });
      continue;
    }
    results.push(await runJob(req, path));
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json(
    { ok: allOk, ran: results.filter(r => r.error !== 'skipped: cron time budget exhausted').length, results },
    { status: allOk ? 200 : 207 },
  );
}
