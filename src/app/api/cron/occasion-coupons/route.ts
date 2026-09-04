// Daily: make sure the occasion the calendar is running (or is about to
// open, the autopilot arms 24 h ahead) has its advertised coupon code live
// and bounded to the window. Cheap, DB-only; part of /api/cron/daily.
import { NextRequest, NextResponse } from 'next/server';
import { syncAutopilotCoupons } from '@/lib/sale-event-coupons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const results = await syncAutopilotCoupons();
    const failed = results.some(r => r.action === 'error');
    return NextResponse.json({ ok: !failed, results }, { status: failed ? 207 : 200 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
