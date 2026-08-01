'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

// Abandoned-checkout WhatsApp follow-up actions. Sending happens in the
// owner's own WhatsApp (wa.me deep link with the message pre-filled); these
// actions keep the per-cart "nudged already" marker and the editable
// template/coupon settings. The marker lives ON the abandoned_carts row (not
// a campaign ledger): if the same shopper abandons again months later the
// capture RPC resets the row, so the queue naturally re-surfaces them.

async function assertAccess() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

/** Record that this abandoned cart got a WhatsApp nudge (idempotent). */
export async function markWaSent(cartId: string): Promise<{ ok: boolean }> {
  const session = await assertAccess();
  const { error } = await supabaseAdmin()
    .from('abandoned_carts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ last_wa_sent_at: new Date().toISOString(), wa_sent_by: session.email ?? 'staff' } as any)
    .eq('id', cartId);
  if (error) return { ok: false };
  void logAudit(session, { action: 'abandoned.wa_sent', entity: 'abandoned_carts', entity_id: cartId });
  revalidatePath('/admin/abandoned');
  return { ok: true };
}

/** Undo a mistaken mark (e.g. the WhatsApp tab was closed without sending). */
export async function unmarkWaSent(cartId: string): Promise<{ ok: boolean }> {
  const session = await assertAccess();
  const { error } = await supabaseAdmin()
    .from('abandoned_carts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ last_wa_sent_at: null, wa_sent_by: null } as any)
    .eq('id', cartId);
  if (error) return { ok: false };
  void logAudit(session, { action: 'abandoned.wa_unsent', entity: 'abandoned_carts', entity_id: cartId });
  revalidatePath('/admin/abandoned');
  return { ok: true };
}

/** Dismiss a cart from the queue without an order (wrong number, test row,
 *  shopper said no). Reuses the recovered flag — the cron and queue both
 *  filter on it, and a genuine new abandonment resets it via the capture RPC. */
export async function dismissCart(cartId: string): Promise<{ ok: boolean }> {
  const session = await assertAccess();
  const { error } = await supabaseAdmin()
    .from('abandoned_carts')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ recovered: true } as any)
    .eq('id', cartId);
  if (error) return { ok: false };
  void logAudit(session, { action: 'abandoned.dismissed', entity: 'abandoned_carts', entity_id: cartId });
  revalidatePath('/admin/abandoned');
  return { ok: true };
}

/** Persist the editable message template + coupon code. */
export async function saveAbandonedSettings(formData: FormData): Promise<void> {
  const session = await assertAccess();
  // Writing templates/coupons is a SETTINGS write, not a customer read —
  // customers.view alone must not be able to change store-wide messaging
  // (2026-08-01 audit). Owner or the settings permission required.
  if (!session.isOwner && !session.permissions.includes('settings')) {
    throw new Error('Unauthorized: settings permission required');
  }
  const template = ((formData.get('template') as string) ?? '').slice(0, 2000);
  const coupon = ((formData.get('coupon') as string) ?? '').trim().toUpperCase().slice(0, 40);
  const pairs = [
    { key: 'abandoned_wa_template', value: template },
    { key: 'abandoned_wa_coupon', value: coupon },
  ];
  await supabaseAdmin().from('site_settings').upsert(pairs, { onConflict: 'key' });
  revalidatePath('/admin/abandoned');
}
