// ============================================================================
// Weekly cron (scheduler Worker, Mondays 10:00 UTC = 3 pm PKT): NB Sons
// price-parity first (it scrapes the vendor store), then the owner's weekly
// health report. In-process, see src/lib/cron-fanout.ts.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron-auth';
import { runJobs } from '@/lib/cron-fanout';
import { GET as priceParity } from '../price-parity/route';
import { GET as weeklyReport } from '../weekly-report/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // Sequential so one job's failure never aborts the others; order is the
  // revenue-relevant work first, the analytics tail last.
  const results = await runJobs(req, [
    ['price-parity', priceParity],
    ['weekly-report', weeklyReport],
  ], 180_000);
  const allOk = results.every(r => r.ok);
  console.log('[cron/cron]', JSON.stringify(results.map(r => ({ job: r.job, ok: r.ok, ms: r.ms, error: r.error }))));
  return NextResponse.json({ ok: allOk, ran: results.length, results }, { status: allOk ? 200 : 207 });
}
