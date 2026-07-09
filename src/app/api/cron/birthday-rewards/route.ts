// ============================================================================
// Birthday loyalty points, dispatched from /api/cron/daily. Awards
// site_settings.loyalty_birthday_points to every customer whose profile DOB
// falls today (Pakistan time). All the rules — the PKT day match, the Feb-29
// handling, and the once-per-~11-months guard — live in the
// award_birthday_points() SQL function (migration 20260709_640), so a re-run
// or a manual invocation can never double-award.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { log } from '@/lib/logger';

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

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb.rpc('award_birthday_points' as never);
  if (error) {
    log.error('cron.birthday_rewards_failed', { err: error });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, awarded: (data as unknown as number) ?? 0 });
}
