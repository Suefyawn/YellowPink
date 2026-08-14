'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { CASH_CATEGORY_VALUES, categoryMeta } from '@/lib/cash';

const PAGE = '/admin/cash';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireFinance() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !can(session, 'finance'))) {
    redirect(PAGE);
  }
  return session!;
}

function back(param: 'ok' | 'error', msg: string): never {
  redirect(`${PAGE}?${param}=${encodeURIComponent(msg)}`);
}

export async function addCashEntry(formData: FormData): Promise<void> {
  const session = await requireFinance();
  const category = String(formData.get('category') ?? '');
  const amount = Number(formData.get('amount'));
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const entryDate = String(formData.get('entry_date') ?? '').trim();
  const orderNo = String(formData.get('order_no') ?? '').trim().slice(0, 40);
  const vendorIdRaw = String(formData.get('vendor_id') ?? '').trim();
  const vendorId = UUID_RE.test(vendorIdRaw) ? vendorIdRaw : null;

  if (!CASH_CATEGORY_VALUES.includes(category)) back('error', 'Pick a category.');
  if (!Number.isFinite(amount) || amount <= 0) back('error', 'The amount has to be a positive number.');
  if (entryDate && !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) back('error', 'That date does not look right.');

  // Optional order link: an order NUMBER (YP-XXXX, what humans know) resolved
  // to the order id server-side. A number that matches nothing is an error,
  // not a silently unlinked entry.
  let orderId: string | null = null;
  if (orderNo) {
    const { data: orderRow } = await supabaseAdmin()
      .from('orders')
      .select('id')
      .ilike('order_number', orderNo)
      .maybeSingle();
    if (!orderRow) back('error', `No order ${orderNo} found — check the order number.`);
    orderId = (orderRow as { id: string }).id;
  }

  // Direction comes from the category, never from the client separately —
  // a "stock purchase" can only ever be money out.
  const direction = categoryMeta(category).direction;

  const { data, error } = await supabaseAdmin()
    .from('cash_entries')
    .insert({
      direction,
      amount,
      category,
      note: note || null,
      order_id: orderId,
      vendor_id: vendorId,
      ...(entryDate ? { entry_date: entryDate } : {}),
      created_by: session.email,
    })
    .select('id')
    .single();
  if (error) back('error', 'Could not save the entry.');

  void logAudit(session, {
    action: 'cash.add', entity: 'cash_entries', entity_id: (data as { id: string }).id,
    diff: { direction, amount, category, note, entry_date: entryDate || 'today', order_id: orderId, vendor_id: vendorId },
  });
  revalidatePath(PAGE);
  back('ok', `Recorded: ${direction === 'in' ? '+' : '−'}Rs ${amount.toLocaleString()} (${categoryMeta(category).label}).`);
}

/** Confirm a suggested entry (from settlements / reconciled payments): the
 *  same insert as addCashEntry plus the source_key, whose unique index makes
 *  a double-confirm a no-op complaint instead of a duplicate row. */
export async function confirmCashSuggestion(formData: FormData): Promise<void> {
  const session = await requireFinance();
  const sourceKey = String(formData.get('source_key') ?? '').slice(0, 200);
  const category = String(formData.get('category') ?? '');
  const amount = Number(formData.get('amount'));
  const note = String(formData.get('note') ?? '').trim().slice(0, 500);
  const entryDate = String(formData.get('entry_date') ?? '').trim();
  // Link hints the suggestion carries (a settled balance knows its vendor, a
  // reconciled payment knows its order). Anything that isn't a UUID is
  // ignored rather than failing the confirm.
  const orderIdRaw = String(formData.get('order_id') ?? '').trim();
  const vendorIdRaw = String(formData.get('vendor_id') ?? '').trim();
  const orderId = UUID_RE.test(orderIdRaw) ? orderIdRaw : null;
  const vendorId = UUID_RE.test(vendorIdRaw) ? vendorIdRaw : null;

  if (!sourceKey.startsWith('settle:') && !sourceKey.startsWith('payment:')) back('error', 'Bad suggestion.');
  if (!CASH_CATEGORY_VALUES.includes(category)) back('error', 'Pick a category.');
  if (!Number.isFinite(amount) || amount <= 0) back('error', 'The amount has to be a positive number.');
  if (entryDate && !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) back('error', 'That date does not look right.');

  const direction = categoryMeta(category).direction;
  const { data, error } = await supabaseAdmin()
    .from('cash_entries')
    .insert({
      direction, amount, category,
      note: note || null,
      source_key: sourceKey,
      order_id: orderId,
      vendor_id: vendorId,
      ...(entryDate ? { entry_date: entryDate } : {}),
      created_by: session.email,
    })
    .select('id')
    .single();
  if (error) back('error', 'Could not save the entry (was it already confirmed?).');

  void logAudit(session, {
    action: 'cash.confirm_suggestion', entity: 'cash_entries', entity_id: (data as { id: string }).id,
    diff: { direction, amount, category, source_key: sourceKey, order_id: orderId, vendor_id: vendorId },
  });
  revalidatePath(PAGE);
  back('ok', `Recorded: ${direction === 'in' ? '+' : '−'}Rs ${amount.toLocaleString()} (${categoryMeta(category).label}).`);
}

/** Dismiss a suggestion without recording it — e.g. a settlement that was
 *  netted off against stock instead of paid in cash. */
export async function skipCashSuggestion(formData: FormData): Promise<void> {
  const session = await requireFinance();
  const sourceKey = String(formData.get('source_key') ?? '').slice(0, 200);
  if (!sourceKey.startsWith('settle:') && !sourceKey.startsWith('payment:')) back('error', 'Bad suggestion.');
  const { error } = await supabaseAdmin()
    .from('cash_suggestion_skips')
    .upsert({ source_key: sourceKey }, { onConflict: 'source_key', ignoreDuplicates: true });
  if (error) back('error', 'Could not skip the suggestion.');
  void logAudit(session, { action: 'cash.skip_suggestion', entity: 'cash_suggestion_skips', entity_id: sourceKey });
  revalidatePath(PAGE);
  back('ok', 'Suggestion skipped.');
}

/** Remove a wrongly entered row. The audit log keeps what was deleted, so a
 *  mistake is correctable without the cashbook accumulating "correction"
 *  noise entries. */
export async function deleteCashEntry(formData: FormData): Promise<void> {
  const session = await requireFinance();
  const id = String(formData.get('id') ?? '');
  if (!id) back('error', 'Missing entry.');

  const { data: existing } = await supabaseAdmin()
    .from('cash_entries')
    .select('id, direction, amount, category, note, entry_date, order_id, vendor_id')
    .eq('id', id)
    .maybeSingle();
  if (!existing) back('error', 'Entry not found.');

  const { error } = await supabaseAdmin().from('cash_entries').delete().eq('id', id);
  if (error) back('error', 'Could not delete the entry.');

  void logAudit(session, {
    action: 'cash.delete', entity: 'cash_entries', entity_id: id,
    diff: existing as Record<string, unknown>,
  });
  revalidatePath(PAGE);
  back('ok', 'Entry deleted.');
}
