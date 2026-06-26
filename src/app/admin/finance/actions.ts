'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

// Finance is gated on the same permission as Analytics (owner always allowed;
// a null session is the owner-password mode used elsewhere in admin).
const EXPENSE_CATEGORIES = ['Ads', 'Salaries', 'Packaging', 'Marketing', 'Rent & Utilities', 'Other'];

export async function addExpense(formData: FormData): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('analytics'))) {
    redirect('/admin/finance?err=' + encodeURIComponent('Not authorized'));
  }

  const incurred_on = String(formData.get('incurred_on') || '').trim() || new Date().toISOString().slice(0, 10);
  const category = String(formData.get('category') || '').trim();
  const channelRaw = String(formData.get('channel') || '').trim();
  const amount = Number(formData.get('amount'));
  const note = String(formData.get('note') || '').trim() || null;

  if (!EXPENSE_CATEGORIES.includes(category)) {
    redirect('/admin/finance?err=' + encodeURIComponent('Pick a valid category'));
  }
  if (!isFinite(amount) || amount < 0) {
    redirect('/admin/finance?err=' + encodeURIComponent('Enter a valid amount'));
  }
  // Channel only meaningful for ad spend.
  const channel = category === 'Ads' ? (channelRaw || 'Other') : null;

  const { error } = await supabaseAdmin().from('expenses').insert({
    incurred_on, category, channel, amount, note,
  });
  if (error) {
    redirect('/admin/finance?err=' + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'expense.create', entity: 'expense', diff: { category, channel, amount } });
  revalidatePath('/admin/finance');
  redirect('/admin/finance?ok=1');
}

export async function deleteExpense(id: string): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('analytics'))) {
    redirect('/admin/finance?err=' + encodeURIComponent('Not authorized'));
  }
  const { error } = await supabaseAdmin().from('expenses').delete().eq('id', id);
  if (error) {
    redirect('/admin/finance?err=' + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'expense.delete', entity: 'expense', entity_id:id });
  revalidatePath('/admin/finance');
  redirect('/admin/finance?ok=1');
}

// Per-order cost capture (delivery paid to courier + payment-gateway fee),
// saved from the order detail page. Gated on orders.edit.
export async function setOrderCosts(orderId: string, formData: FormData): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }
  const parseNum = (v: FormDataEntryValue | null): number | null => {
    const s = String(v ?? '').trim();
    if (s === '') return null;
    const n = Number(s);
    return isFinite(n) && n >= 0 ? n : null;
  };
  const delivery_cost = parseNum(formData.get('delivery_cost'));
  const payment_fee = parseNum(formData.get('payment_fee'));
  const acquisition_cost = parseNum(formData.get('acquisition_cost'));

  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ delivery_cost, payment_fee, acquisition_cost })
    .eq('id', orderId);
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'order.set_costs', entity: 'order', entity_id:orderId, diff: { delivery_cost, payment_fee, acquisition_cost } });
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}?costs=saved`);
}

// Record that a payment was received against an order, which configured
// account the money landed in, and when. Lets Finance reconcile bank/wallet
// transfers and break revenue down by account. Gated on orders.edit.
export async function recordPayment(orderId: string, formData: FormData): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }
  const account = String(formData.get('payment_account') || '').trim();
  if (!account) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Pick the account the payment landed in'));
  }
  // Optional date (defaults to now). A bare yyyy-mm-dd is fine, Postgres
  // widens it to midnight of that day in the column's timezone.
  const dateRaw = String(formData.get('received_on') || '').trim();
  const received_at = dateRaw ? new Date(dateRaw).toISOString() : new Date().toISOString();
  const by = session?.email ?? 'Owner';

  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ payment_account: account, payment_received_at: received_at, payment_received_by: by })
    .eq('id', orderId);
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'order.record_payment', entity: 'order', entity_id: orderId, diff: { payment_account: account, received_at } });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/finance');
  redirect(`/admin/orders/${orderId}?pay=recorded`);
}

// Save a freeform internal staff note on an order (admin-only; never shown to
// the customer). Gated on orders.edit, same as the other order-page widgets.
export async function updateOrderNotes(orderId: string, formData: FormData): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }
  const raw = String(formData.get('notes') ?? '').trim();
  const notes = raw === '' ? null : raw.slice(0, 4000);

  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ notes })
    .eq('id', orderId);
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'order.update_notes', entity: 'order', entity_id: orderId });
  revalidatePath(`/admin/orders/${orderId}`);
  redirect(`/admin/orders/${orderId}?notes=saved`);
}

// Undo a recorded payment (e.g. logged against the wrong account).
export async function clearPayment(orderId: string): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }
  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ payment_account: null, payment_received_at: null, payment_received_by: null })
    .eq('id', orderId);
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(error.message));
  }
  await logAudit(session, { action: 'order.clear_payment', entity: 'order', entity_id: orderId });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/finance');
  redirect(`/admin/orders/${orderId}?pay=cleared`);
}
