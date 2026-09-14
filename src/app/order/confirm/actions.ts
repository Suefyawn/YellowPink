'use server';

import { createClient } from '@supabase/supabase-js';
import { revalidatePath } from 'next/cache';
import { isDemo } from '@/lib/supabase';
import { verifyOrderConfirmToken } from '@/lib/order-confirm-token';
import { log } from '@/lib/logger';

// Customer-side order confirmation.
//
// The token in the link is the whole authorisation: it is an HMAC over the
// order number with the service-role secret, so possessing a valid one proves
// the holder received our email for that order. No account, no login, no
// personal data echoed back.
//
// Only ever moves an order from "not yet confirmed" to "confirmed". It cannot
// cancel, cannot change status, and cannot touch a confirmed order, so a leaked
// or replayed link has no destructive use.

export type ConfirmResult =
  | { ok: true; already: boolean }
  | { ok: false; reason: 'invalid' | 'not_found' | 'error' };

export async function confirmOrderAction(
  orderNumber: string,
  token: string,
): Promise<ConfirmResult> {
  const o = orderNumber?.trim().toUpperCase() ?? '';
  if (!o || !token || !verifyOrderConfirmToken(o, token)) return { ok: false, reason: 'invalid' };
  if (isDemo) return { ok: true, already: false };

  try {
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );

    const { data: order, error: readErr } = await admin
      .from('orders')
      .select('id, order_number, status, confirmed_at')
      .eq('order_number', o)
      .maybeSingle();

    if (readErr) {
      log.error('order.confirm_read_failed', { order: o, error: readErr.message });
      return { ok: false, reason: 'error' };
    }
    if (!order) return { ok: false, reason: 'not_found' };
    if (order.confirmed_at) return { ok: true, already: true };

    // A cancelled or delivered order has nothing to confirm; report it as
    // already handled rather than as an error, because from the customer's
    // side the job is done either way and an error screen would just prompt
    // a support message.
    if (['cancelled', 'refunded', 'delivered', 'returned'].includes(order.status)) {
      return { ok: true, already: true };
    }

    const now = new Date().toISOString();
    const { error: updErr } = await admin
      .from('orders')
      .update({ confirmed_at: now })
      .eq('id', order.id)
      .is('confirmed_at', null);

    if (updErr) {
      log.error('order.confirm_update_failed', { order: o, error: updErr.message });
      return { ok: false, reason: 'error' };
    }

    // Timeline entry so the order page shows WHO confirmed and when. Same
    // status on both sides: this records a confirmation, not a transition,
    // and staff still decide when the order moves to processing.
    await admin.from('order_events').insert({
      order_id: order.id,
      from_status: order.status,
      to_status: order.status,
      actor_kind: 'customer',
      actor_id: 'customer-link',
      note: 'Customer confirmed the order from the email link.',
    });

    log.info('order.confirmed_by_customer', { order: o });
    revalidatePath(`/admin/orders/${order.id}`);
    return { ok: true, already: false };
  } catch (err) {
    log.error('order.confirm_unexpected', { order: o, error: (err as Error).message });
    return { ok: false, reason: 'error' };
  }
}
