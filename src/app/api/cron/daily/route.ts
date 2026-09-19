// ============================================================================
// Consolidated daily cron (scheduler Worker, 09:00 UTC). Runs, in order:
//   abandoned-cart, courier-sync, order-actions, occasion-coupons,
//   popularity-refresh, review-requests, stuck-payments, not-found-digest,
//   analytics-refresh.
// indexing-check has its own trigger (09:30 UTC); price-parity and
// weekly-report run from /api/cron/weekly on Mondays.
//
// The sub-jobs are called in-process (src/lib/cron-fanout.ts). Removed: the
// 60 s wall budget and the self-fetch per job, both Vercel-isms.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron-auth';
import { runJobs } from '@/lib/cron-fanout';
import { GET as abandonedCart } from '../abandoned-cart/route';
import { GET as courierSync } from '../courier-sync/route';
import { GET as orderActions } from '../order-actions/route';
import { GET as occasionCoupons } from '../occasion-coupons/route';
import { GET as popularityRefresh } from '../popularity-refresh/route';
import { GET as reviewRequests } from '../review-requests/route';
import { GET as stuckPayments } from '../stuck-payments/route';
import { GET as notFoundDigest } from '../not-found-digest/route';
import { GET as analyticsRefresh } from '../analytics-refresh/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Sequential so one job's failure never aborts the others; order is the
  // revenue-relevant work first, the analytics tail last.
  const results = await runJobs(req, [
    ['abandoned-cart', abandonedCart],
    ['courier-sync', courierSync],
    ['order-actions', orderActions],
    ['occasion-coupons', occasionCoupons],
    ['popularity-refresh', popularityRefresh],
    ['review-requests', reviewRequests],
    ['stuck-payments', stuckPayments],
    ['not-found-digest', notFoundDigest],
    ['analytics-refresh', analyticsRefresh],
  ], 120_000);
  const allOk = results.every(r => r.ok);
  console.log('[cron/cron]', JSON.stringify(results.map(r => ({ job: r.job, ok: r.ok, ms: r.ms, error: r.error }))));
  return NextResponse.json({ ok: allOk, ran: results.length, results }, { status: allOk ? 200 : 207 });
}
