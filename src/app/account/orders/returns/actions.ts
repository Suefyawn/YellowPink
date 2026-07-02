'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { createServerSupabase as authedClient } from '@/lib/supabase-server';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { supabaseAdmin } from '@/lib/supabase';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { brandPlusName } from '@/lib/product-display';

// A stored return line, reconstructed server-side from the order snapshot.
interface ReturnItem { product_id: string; qty: number; name: string; price: number; variant_id: string | null }

// authedClient() is the @supabase/ssr server client, reads the customer's
// session from cookies so RLS on order returns applies.

export async function requestReturn(args: {
  order_id: string;
  reason: string;
  /** Indexes into the order's items array + the qty being returned for each.
   *  We deliberately DON'T take price/name from the client, those are read
   *  back from the order so a tampered payload can't inflate a refund. */
  items: { index: number; qty: number }[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const h = await headers();
  const { success } = await reviewLimiter.limit(`return:${ipFromHeaders(h)}`);
  if (!success) return { ok: false, error: 'Too many requests. Wait a minute.' };

  if (!args.order_id) return { ok: false, error: 'order_id required' };
  if (!args.reason || args.reason.trim().length < 5) return { ok: false, error: 'Please tell us why you\'re returning' };
  if (!Array.isArray(args.items) || args.items.length === 0) return { ok: false, error: 'Select at least one item' };

  const sb = await authedClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in' };

  // ── Server-side eligibility: never trust the client. The /new form gates on
  // these too, but a direct action call bypasses the UI. The RLS insert policy
  // only checks user_id, NOT that the order belongs to the user, so without
  // this block a customer could file a return against someone else's order. ──
  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, status, items, created_at')
    .eq('id', args.order_id)
    .maybeSingle();
  // Same "Order not found" message whether the order is missing or owned by
  // someone else, so we don't confirm the existence of other people's orders.
  if (!order || order.user_id !== user.id) return { ok: false, error: 'Order not found' };
  if (order.status !== 'delivered') {
    return { ok: false, error: 'This order isn’t delivered yet, so it isn’t eligible for a return.' };
  }

  // Returns window is measured from the delivery date (the order_events row for
  // the delivered transition); fall back to the order date if that event is
  // missing. Only reject when we can positively place it past the window, a
  // missing timestamp shouldn't block a legitimate return.
  const { data: deliveredEvt } = await admin
    .from('order_events')
    .select('created_at')
    .eq('order_id', order.id)
    .eq('to_status', 'delivered')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const deliveredAt = (deliveredEvt?.created_at as string | undefined) ?? order.created_at;
  if (deliveredAt && Date.now() - new Date(deliveredAt).getTime() > RETURNS_WINDOW_DAYS * 86_400_000) {
    return { ok: false, error: `The ${RETURNS_WINDOW_DAYS}-day return window for this order has closed.` };
  }

  // Reconstruct each line from the order snapshot: price, name and variant come
  // from our record (not the client), and qty is clamped to what was ordered.
  // This is what makes the downstream refund amount and the restock-on-receive
  // (which needs variant_id) trustworthy.
  type OrderLine = { id?: string; name?: string; brand?: string | null; price?: number; qty?: number; variant_id?: string | null };
  const orderItems = (order.items ?? []) as OrderLine[];
  const lines: ReturnItem[] = [];
  for (const sel of args.items) {
    const src = orderItems[sel.index];
    if (!src || !src.id) continue;
    const qty = Math.min(Math.floor(Number(sel.qty)), Number(src.qty ?? 0));
    if (!Number.isFinite(qty) || qty <= 0) continue;
    lines.push({
      product_id: src.id,
      qty,
      name: brandPlusName(src.brand, src.name ?? ''),
      price: Number(src.price ?? 0),
      variant_id: src.variant_id ?? null,
    });
  }
  if (lines.length === 0) return { ok: false, error: 'Select at least one item to return.' };

  const { data, error } = await sb.from('return_requests').insert({
    order_id:    order.id,
    user_id:     user.id,
    email:       user.email ?? null,
    reason:      args.reason.trim(),
    items:       lines,
    status:      'pending',
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/account/orders/${args.order_id}`);
  revalidatePath('/account/orders');
  return { ok: true, id: data?.id as string };
}

// Admin-side decision actions live under /admin and use the service-role
// client; declaring them here keeps the customer/admin paths colocated.

import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

async function assertOrders() {
  // The Returns section is governed by the 'returns' permission; 'orders.edit'
  // also satisfies it for existing staff who only hold order permissions.
  // Previously this demanded 'orders.edit' alone, which made the 'returns'
  // permission non-functional (a returns agent could open the queue but every
  // decision threw a 500).
  const session = await getStaffSession();
  if (!session || (!session.isOwner
      && !session.permissions.includes('returns')
      && !session.permissions.includes('orders.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function approveReturn(args: {
  id: string;
  refund_amount: number;
  refund_method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct';
  admin_note?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  if (args.refund_amount < 0) return { error: 'refund_amount must be >= 0' };

  // return_requests + loyalty_ledger are RLS-locked, staff-cookie auth
  // doesn't go through Supabase Auth, so we need the service-role client.
  const admin = supabaseAdmin();
  const { data: row } = await admin
    .from('return_requests')
    .select('id, user_id, items, order_id, status')
    .eq('id', args.id)
    .single();
  if (!row) return { error: 'return request not found' };
  if (row.status !== 'pending') return { error: `cannot approve a ${row.status} request` };

  // Cap the refund at the value of the returned items so an admin typo
  // (50000 for a 5000 return) can't silently overpay / over-credit. The items
  // + prices were reconstructed server-side at request time, so this bound is
  // trustworthy. A small epsilon tolerates rounding.
  const itemsValue = ((row.items ?? []) as Array<{ price?: number; qty?: number }>)
    .reduce((s, i) => s + Number(i.price ?? 0) * Number(i.qty ?? 0), 0);
  if (args.refund_amount > itemsValue + 0.5) {
    return { error: `Refund (PKR ${Math.round(args.refund_amount)}) exceeds the returned items' value (PKR ${Math.round(itemsValue)}).` };
  }

  const { error } = await admin
    .from('return_requests')
    .update({
      status: 'approved',
      refund_amount: args.refund_amount,
      refund_method: args.refund_method,
      admin_note: args.admin_note ?? null,
    })
    .eq('id', args.id);
  if (error) return { error: error.message };

  // Store-credit path: top up loyalty (1 PKR = 1 point per defaults).
  if (args.refund_method === 'store_credit' && row.user_id) {
    await admin.rpc('grant_loyalty_points' as never, {
      p_user_id:  row.user_id,
      p_delta:    Math.round(args.refund_amount),
      p_reason:   'refund_reversal',
      p_order_id: row.order_id,
      p_note:     `return ${args.id.slice(0,8)} approved as store credit`,
    } as never);
  }

  await logAudit(session, {
    action: 'return.approve',
    entity: 'return_request',
    entity_id: args.id,
    diff: { refund_amount: args.refund_amount, refund_method: args.refund_method },
  });
  revalidatePath('/admin/returns');
  return { success: true };
}

export async function rejectReturn(id: string, admin_note: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  const { error } = await supabaseAdmin()
    .from('return_requests')
    .update({ status: 'rejected', admin_note: admin_note || null })
    .eq('id', id);
  if (error) return { error: error.message };
  await logAudit(session, { action: 'return.reject', entity: 'return_request', entity_id: id, diff: { admin_note } });
  revalidatePath('/admin/returns');
  return { success: true };
}

// Mark an approved return as received and restock the items via the
// inventory ledger. Closes the loop: the units leave stock when the
// order is placed (place_order → record_stock_change reason='order')
// and re-enter stock here with reason='return' tying the ledger row
// back to the original return_request.
export async function markReturnReceived(id: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  const admin = supabaseAdmin();

  const { data: row } = await admin
    .from('return_requests')
    .select('id, status, items, order_id, user_id')
    .eq('id', id)
    .single();
  if (!row) return { error: 'return request not found' };
  if (row.status !== 'approved') {
    return { error: `cannot mark a ${row.status} return as received, approve it first` };
  }

  const items = (row.items ?? []) as Array<{ product_id: string; qty: number; variant_id?: string | null }>;

  // Restock each line via the ledger RPC. We do this BEFORE the status
  // update so a downstream failure doesn't leave the return marked
  // received with no stock movement.
  for (const it of items) {
    if (!it.product_id || !it.qty || it.qty <= 0) continue;
    const { error: rpcErr } = await admin.rpc('record_stock_change' as never, {
      p_product_id:  it.product_id,
      p_variant_id:  it.variant_id ?? null,
      p_qty_delta:   it.qty,
      p_reason:      'return',
      p_order_id:    row.order_id,
      p_return_id:   id,
      p_actor_kind:  session.isOwner ? 'owner' : 'staff',
      p_actor_email: session.email,
      p_note:        `Restock from return ${id.slice(0, 8)}`,
    } as never) as unknown as { error: { message: string } | null };
    if (rpcErr) return { error: `restock failed for product ${it.product_id}: ${rpcErr.message}` };
  }

  const { error } = await admin
    .from('return_requests')
    .update({ status: 'received' })
    .eq('id', id);
  if (error) return { error: error.message };

  // Reflect the return on the linked order: a delivered order whose goods
  // came back is `returned` (migration 001's state machine). Guarded so we
  // never clobber an unrelated state (e.g. an order cancelled in the
  // meantime); the status trigger logs the transition to order_events.
  await admin
    .from('orders')
    .update({ status: 'returned' })
    .eq('id', row.order_id)
    .eq('status', 'delivered');

  await logAudit(session, {
    action: 'return.received',
    entity: 'return_request',
    entity_id: id,
    diff: { items_restocked: items.length },
  });
  revalidatePath('/admin/returns');
  revalidatePath('/admin/inventory');
  revalidatePath(`/admin/orders/${row.order_id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}

// Final step of the return lifecycle: the refund (store credit, coupon,
// original method or COD deduction — executed per refund_method outside this
// action where applicable) has actually been given. Marks the request
// `refunded` and moves the linked order to `refunded` so Finance/Analytics
// stop counting its revenue.
export async function markReturnRefunded(id: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  const admin = supabaseAdmin();

  const { data: row } = await admin
    .from('return_requests')
    .select('id, status, order_id, refund_amount, refund_method')
    .eq('id', id)
    .single();
  if (!row) return { error: 'return request not found' };
  if (row.status !== 'received') {
    return { error: `cannot mark a ${row.status} return as refunded, mark it received first` };
  }

  const { error } = await admin
    .from('return_requests')
    .update({ status: 'refunded' })
    .eq('id', id);
  if (error) return { error: error.message };

  // The linked order was moved to `returned` when the parcel came back;
  // `refunded` is the terminal state once the money/credit has gone out.
  // Guarded to the two expected prior states so an unrelated transition
  // isn't overwritten.
  await admin
    .from('orders')
    .update({ status: 'refunded' })
    .eq('id', row.order_id)
    .in('status', ['returned', 'delivered']);

  await logAudit(session, {
    action: 'return.refunded',
    entity: 'return_request',
    entity_id: id,
    diff: { refund_amount: row.refund_amount, refund_method: row.refund_method },
  });
  revalidatePath('/admin/returns');
  revalidatePath(`/admin/orders/${row.order_id}`);
  revalidatePath('/admin/orders');
  revalidatePath('/admin/finance');
  return { success: true };
}
