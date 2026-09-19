// Every 10 minutes (scheduler Worker): ring the admin bell for carts that
// crossed the abandonment grace period. This was a pg_cron job inside
// Supabase (migration 20260803_910); it now runs from the same scheduler as
// every other job so Phase B (D1) has nothing left in the database to port.

import { NextRequest, NextResponse } from 'next/server';
import { cronAuthorized } from '@/lib/cron-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { error } = await supabaseAdmin().rpc('process_abandoned_cart_bells');
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
