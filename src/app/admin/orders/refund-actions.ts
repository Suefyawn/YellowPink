'use server';

// Refunding an order — Shopify's refund flow, sized for this store.
//
// A refund is a LEDGER row (order_refunds), not a status change: a partial
// refund (one damaged item out of three) keeps the order in its current
// status while the row records the amount, the lines involved, whether stock
// came back, the reason, and who did it. Only when cumulative refunds reach
// the order's total does the order flip to `refunded` — and that flip runs
// through the existing updateOrderStatus path so everything downstream
// (revenue rules, settlements, analytics) behaves exactly as a manual
// status change does today. Vendor settlement maths is otherwise untouched.
//
// Discipline mirrors cancelOrder:
//   • the amount and item quantities are validated server-side against the
//     order (client prices are never trusted — the charged price comes from
//     the order's own items snapshot);
//   • restocking is optional and goes through record_stock_change with
//     reason 'return' (the RPC's untracked-product guard applies), the same
//     ledger path as a received customer return;
//   • the refund lands on the order timeline and in the audit log;
//   • the customer email is optional and best-effort (a provider hiccup
//     must not fail the refund record).

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { logActionError } from '@/lib/action-log';
import { updateOrderStatus } from '@/app/admin/actions';
import { brandPlusName } from '@/lib/product-display';

// Statuses money can be given back on: the order was (or is being) fulfilled.
// cancelled / payment_pending / payment_failed never collected anything;
// refunded is already fully closed out.
const REFUNDABLE_STATUSES = ['processing', 'shipped', 'delivered', 'returned'];

interface OrderLineSnapshot {
  id: string;
  name?: string;
  brand?: string | null;
  price: number;
  qty: number;
  variant_id?: string | null;
  variant_label?: string | null;
  variant?: string | null;
}

/** Refund an order via the Shopify-style dialog (lines + amount + restock +
 *  notify + reason). `selected` in the form data is a JSON array of
 *  { index, qty } referring to the order's items by position; everything
 *  money-related is re-derived server-side from the order snapshot. */
export async function refundOrder(
  id: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertPermission('orders.edit');
  const admin = supabaseAdmin();

  const { data: orderRow } = await admin
    .from('orders')
    .select('id, order_number, status, email, first_name, total, items')
    .eq('id', id)
    .maybeSingle();
  if (!orderRow) return { error: 'Order no longer exists.' };
  const o = orderRow as {
    id: string; order_number: string | null; status: string | null;
    email: string | null; first_name: string | null; total: number | null;
    items: OrderLineSnapshot[] | null;
  };
  if (!REFUNDABLE_STATUSES.includes(o.status ?? '')) {
    return { error: 'This order is not in a refundable state.' };
  }

  // Already-refunded total caps this refund: cumulative refunds can never
  // exceed what the customer paid.
  const { data: priorRows, error: priorErr } = await admin
    .from('order_refunds')
    .select('amount')
    .eq('order_id', id);
  if (priorErr) return { error: priorErr.message };
  const alreadyRefunded = ((priorRows ?? []) as Array<{ amount: number | string }>)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const orderTotal = Number(o.total ?? 0);
  const maxRefundable = Math.max(0, orderTotal - alreadyRefunded);
  if (maxRefundable <= 0) return { error: 'This order is already fully refunded.' };

  const amount = Number(formData.get('amount'));
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'The refund amount has to be a positive number.' };
  }
  if (amount > maxRefundable + 0.005) {
    return { error: `At most PKR ${Math.round(maxRefundable).toLocaleString()} can still be refunded on this order.` };
  }

  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500);
  const restockAsked = formData.get('restock') === 'on';
  const notify = formData.get('notify') === 'on';

  // Selected lines: [{ index, qty }] against the order's items snapshot. The
  // stored jsonb keeps the documented shape [{ id, variant_id, qty, price }]
  // with the CHARGED price from the order, never the client's number.
  let selected: Array<{ index: number; qty: number }>;
  try {
    selected = JSON.parse((formData.get('selected') as string) || '[]') as Array<{ index: number; qty: number }>;
  } catch {
    return { error: 'The selected items could not be read. Please reselect them.' };
  }
  if (!Array.isArray(selected)) selected = [];
  const orderItems = (o.items ?? []) as OrderLineSnapshot[];
  const refundLines: Array<{ line: OrderLineSnapshot; qty: number }> = [];
  for (const s of selected) {
    const line = Number.isInteger(s?.index) ? orderItems[s.index] : undefined;
    if (!line) return { error: 'A selected item no longer exists on this order.' };
    if (!Number.isInteger(s.qty) || s.qty < 1 || s.qty > line.qty) {
      return { error: 'Each refunded quantity must be between 1 and the ordered quantity.' };
    }
    refundLines.push({ line, qty: s.qty });
  }
  const restock = restockAsked && refundLines.length > 0;

  const itemsJson = refundLines.map(({ line, qty }) => ({
    id: line.id,
    variant_id: line.variant_id ?? null,
    qty,
    price: Number(line.price) || 0,
  }));

  const { data: inserted, error: insErr } = await admin
    .from('order_refunds')
    .insert({
      order_id: id,
      amount,
      items: itemsJson,
      restocked: restock,
      reason: reason || null,
      created_by: session.email || (session.isOwner ? 'owner' : 'staff'),
    })
    .select('id')
    .single();
  if (insErr) return { error: insErr.message };

  // Restock only when asked and lines were selected: same ledger path
  // (record_stock_change, reason 'return') as a received customer return —
  // the RPC skips untracked products and clamps at zero. Legacy non-UUID
  // item ids have no ledger to move.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (restock) {
    for (const { line, qty } of refundLines) {
      if (typeof line.id !== 'string' || !UUID_RE.test(line.id)) continue;
      await admin.rpc('record_stock_change' as never, {
        p_product_id:  line.id,
        p_variant_id:  line.variant_id ?? null,
        p_qty_delta:   qty,
        p_reason:      'return',
        p_order_id:    id,
        p_return_id:   null,
        p_actor_kind:  session.isOwner ? 'owner' : 'staff',
        p_actor_email: session.email ?? null,
        p_note:        `Restock from refund on ${o.order_number ?? id.slice(0, 8)}`,
      } as never);
    }
    revalidatePath('/admin/inventory');
  }

  const willNotify = notify && Boolean(o.email);
  const lineSummary = refundLines
    .map(({ line, qty }) => `${qty}× ${brandPlusName(line.brand ?? null, line.name ?? 'item')}${line.variant_label ?? line.variant ? ` (${line.variant_label ?? line.variant})` : ''}`)
    .join(', ');

  // The refund lands on the order timeline, interleaved with the status
  // events, so "why did this customer get money back?" has an answer later.
  await admin.from('order_comments').insert({
    order_id: id,
    author: session.email || 'staff',
    body: (`Refunded PKR ${Math.round(amount).toLocaleString()}${reason ? ` - ${reason}` : ''}.`
      + (refundLines.length > 0 ? ` Items: ${lineSummary}. ${restock ? 'Restocked.' : 'Not restocked.'}` : ' Flat amount, no items.')
      + (willNotify ? ' Customer notified by email.' : '')).slice(0, 2000),
  });

  await logAudit(session, {
    action: 'order.refund', entity: 'order', entity_id: id,
    diff: {
      refund_id: (inserted as { id: string } | null)?.id ?? null,
      order_number: o.order_number,
      amount, reason: reason || null, restocked: restock,
      items: itemsJson, notified: willNotify,
      total_refunded: alreadyRefunded + amount,
    },
  });

  // Full refund: flip the order to Refunded through the existing
  // status-change path so revenue rules, event attribution and every other
  // downstream surface behave exactly as a manual status change.
  const fullyRefunded = alreadyRefunded + amount >= orderTotal - 0.005;
  if (fullyRefunded && o.status !== 'refunded') {
    const fd = new FormData();
    fd.set('status', 'refunded');
    const res = await updateOrderStatus(id, null, fd);
    if (res?.error) {
      // The refund row is saved; only the status flip failed. Surface it so
      // staff flip the status by hand rather than believing it happened.
      return { error: `Refund recorded, but the order could not be marked Refunded: ${res.error}` };
    }
  }

  // Customer notification through the branded shell. Best-effort: a
  // provider hiccup must not fail the refund itself.
  if (willNotify) {
    try {
      const { sendRefundEmail } = await import('@/lib/email');
      await sendRefundEmail({
        email: o.email as string,
        first_name: o.first_name ?? 'there',
        order_number: o.order_number ?? '',
        amount,
        items: refundLines.map(({ line, qty }) => ({
          name: line.name ?? 'Item',
          brand: line.brand ?? undefined,
          variant: line.variant_label ?? line.variant ?? undefined,
          qty,
          price: Number(line.price) || 0,
        })),
      });
    } catch (e) {
      logActionError('admin.orders.refund_email', e, { order_id: id });
    }
  }

  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}
