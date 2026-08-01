// ============================================================================
// Vercel Cron: alert the owner about orders stuck in `payment_pending`.
//
// An online-payment order (JazzCash / Easypaisa / card) that the customer
// never finishes sits in `payment_pending` forever, invisible unless someone
// scans the orders list. If unnoticed the customer often re-pays and gets
// double-charged. This finds orders pending for >2h (and <14 days, so we don't
// re-alert ancient ones indefinitely) and emails the owner a digest.
// sendStuckPaymentsAlertEmail is a no-op when the list is empty, so a clean
// day is silent. Invoked by the consolidated daily cron.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendStuckPaymentsAlertEmail } from '@/lib/email';

const MIN_AGE_HOURS = 2;
const MAX_AGE_DAYS = 14;

async function authorize(req: NextRequest): Promise<boolean> {
  // Fail closed if CRON_SECRET isn't set.
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const now = Date.now();
  const olderThan = new Date(now - MIN_AGE_HOURS * 60 * 60 * 1000).toISOString();
  const newerThan = new Date(now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await sb
    .from('orders')
    .select('order_number, total, pay_method, first_name, last_name, created_at')
    .eq('status', 'payment_pending')
    .is('archived_at', null)
    .lte('created_at', olderThan)
    .gte('created_at', newerThan)
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const orders = ((data ?? []) as Array<{ order_number: string; total: number | null; pay_method: string | null; first_name: string | null; last_name: string | null; created_at: string }>)
    .map(o => ({
      order_number: o.order_number,
      total: Number(o.total ?? 0),
      pay_method: o.pay_method ?? '—',
      customer: [o.first_name, o.last_name].filter(Boolean).join(' ') || '—',
      hoursOld: Math.floor((now - Date.parse(o.created_at)) / (60 * 60 * 1000)),
    }));

  await sendStuckPaymentsAlertEmail({ orders });

  return NextResponse.json({ ok: true, stuck: orders.length });
}
