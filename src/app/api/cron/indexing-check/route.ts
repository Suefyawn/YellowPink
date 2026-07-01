// ============================================================================
// Vercel Cron entry point (fanned out from /api/cron/daily), refreshes Search
// Console indexing status for a capped batch of tracked new pages so the
// admin Indexing page (/admin/indexing) shows current data without staff
// having to trigger it by hand. See src/lib/indexing-status.ts for why this
// checks status rather than "submitting" pages, no Google API can force-index
// arbitrary content.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { refreshIndexingStatus } from '@/lib/indexing-status';

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
  const result = await refreshIndexingStatus();
  return NextResponse.json(result, { status: 200 });
}
