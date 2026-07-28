// ============================================================================
// Weekly store health report — Mondays only, fanned out from /api/cron/weekly
// (its own cron entry, 10:00 UTC Mondays; it lived at the tail of the daily
// fanout first and got budget-starved every week). Assembles the week's
// numbers via lib/weekly-report.ts and emails the owner one glanceable
// digest: sales vs last week, the shopper funnel, section clicks, abandoned
// checkouts, review supply, and Google indexing state.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { buildWeeklyReport } from '@/lib/weekly-report';
import { sendWeeklyReportEmail } from '@/lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const force = new URL(req.url).searchParams.get('force') === '1';
  // The weekly cron fires Mondays 10:00 UTC (3 pm PKT); the self-gate stays
  // as defense against off-schedule manual hits.
  if (!force && new Date().getUTCDay() !== 1) {
    return NextResponse.json({ ok: true, skipped: 'runs Mondays (pass ?force=1 to override)' });
  }
  const report = await buildWeeklyReport();
  await sendWeeklyReportEmail(report);
  return NextResponse.json({
    ok: true,
    period: report.periodLabel,
    sections: {
      orders: report.orders != null,
      funnel: report.funnel != null,
      abandoned: report.abandoned != null,
      reviews: report.reviews != null,
      indexing: report.indexing != null,
    },
  });
}
