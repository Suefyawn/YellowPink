'use server';

// Draft orders for the manual-order form (Shopify's Drafts, simplified).
// A draft is the ENTIRE form state frozen as jsonb: staff take half an order
// over WhatsApp, save it, and pick it back up later from the Drafts card on
// /admin/orders/new. Completing the order goes through createManualOrder as
// usual; that action deletes the draft row on success.
//
// Same staff gate as creating the manual order itself (orders.edit), and the
// same audit pattern (logAudit) since the manual-order action audit-logs.

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

export interface DraftLine {
  id: string;
  variantId: string | null;
  label: string;
  qty: number;
  price: number;
}

/** Everything the form needs to rebuild itself exactly as it was saved. */
export interface DraftPayload {
  lines: DraftLine[];
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  province: string;
  payMethod: string;
  status: string;
  sendConfirmation: boolean;
  shipOverridden: boolean;
  shipValue: number;
  discount: number;
  vendorId: string;
}

export interface SaveDraftResult {
  /** The draft row's id (existing on update, fresh on insert). */
  id: string | null;
  error: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function saveOrderDraft(input: {
  draftId: string | null;
  payload: DraftPayload;
  note: string;
}): Promise<SaveDraftResult> {
  const session = await assertPermission('orders.edit');

  const payload = input?.payload;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.lines)) {
    return { id: null, error: 'The draft could not be read. Please try again.' };
  }
  const first = typeof payload.firstName === 'string' ? payload.firstName.trim() : '';
  const last = typeof payload.lastName === 'string' ? payload.lastName.trim() : '';
  const customerName = [first, last].filter(Boolean).join(' ') || null;
  if (payload.lines.length === 0 && !customerName) {
    return { id: null, error: 'Add at least one item or a customer name before saving a draft.' };
  }
  // jsonb sanity cap: the whole form state is a few KB; anything huge is a bug.
  try {
    if (JSON.stringify(payload).length > 100_000) {
      return { id: null, error: 'This draft is too large to save.' };
    }
  } catch {
    return { id: null, error: 'The draft could not be read. Please try again.' };
  }

  const note = (typeof input.note === 'string' ? input.note.trim() : '').slice(0, 500) || null;
  const admin = supabaseAdmin();
  const now = new Date().toISOString();

  // Opened from a draft → update that row. Falls through to insert if the
  // row was deleted from another tab in the meantime.
  if (input.draftId && UUID_RE.test(input.draftId)) {
    const { data, error } = await admin
      .from('draft_orders')
      .update({ payload, customer_name: customerName, note, updated_at: now })
      .eq('id', input.draftId)
      .select('id')
      .maybeSingle();
    if (error) return { id: null, error: `Could not save the draft: ${error.message}` };
    if (data) {
      await logAudit(session, {
        action: 'order.draft_save',
        entity: 'draft_orders',
        entity_id: data.id as string,
        diff: { customer: customerName, items: payload.lines.length, mode: 'update' },
      });
      revalidatePath('/admin/orders/new');
      return { id: data.id as string, error: null };
    }
  }

  const { data, error } = await admin
    .from('draft_orders')
    .insert({
      payload,
      customer_name: customerName,
      note,
      created_by: session.name || session.email,
    })
    .select('id')
    .single();
  if (error || !data) {
    return { id: null, error: `Could not save the draft: ${error?.message ?? 'unknown error'}` };
  }
  await logAudit(session, {
    action: 'order.draft_save',
    entity: 'draft_orders',
    entity_id: data.id as string,
    diff: { customer: customerName, items: payload.lines.length, mode: 'insert' },
  });
  revalidatePath('/admin/orders/new');
  return { id: data.id as string, error: null };
}

/** Bound into each Drafts-card row's delete form: action={deleteOrderDraft.bind(null, id)}. */
export async function deleteOrderDraft(draftId: string): Promise<void> {
  const session = await assertPermission('orders.edit');
  if (!UUID_RE.test(draftId)) return;
  const { error } = await supabaseAdmin().from('draft_orders').delete().eq('id', draftId);
  if (!error) {
    await logAudit(session, {
      action: 'order.draft_delete',
      entity: 'draft_orders',
      entity_id: draftId,
      diff: {},
    });
  }
  revalidatePath('/admin/orders/new');
}
