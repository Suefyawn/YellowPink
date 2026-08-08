// ============================================================================
// Vercel Cron entry point (own schedule in vercel.json, 09:30 UTC), refreshes
// Search Console indexing status for a capped batch of tracked new pages so
// the admin Indexing page (/admin/indexing) shows current data without staff
// having to trigger it by hand. See src/lib/indexing-status.ts for why this
// checks status rather than "submitting" pages, no Google API can force-index
// arbitrary content.
//
// This used to run last in /api/cron/daily's fan-out, where the shared 60 s
// budget squeezed it to ~6 inspections/day — the Jul 31–Aug 7 content push
// (27 posts) sat uninspected behind a 161-row backlog. A dedicated cron with
// its own maxDuration clears ~50 URLs/day within Google's ~2000/day quota.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { refreshIndexingStatus } from '@/lib/indexing-status';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  // 50 URLs / 240 s: fits comfortably inside maxDuration with headroom for
  // the seed + quota bookkeeping, and clears a 160-row backlog in ~3 days.
  const result = await refreshIndexingStatus(50, 240_000);
  return NextResponse.json(result, { status: 200 });
}
