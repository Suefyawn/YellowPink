'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

// Win-back outreach actions. Sending itself happens in the owner's own
// WhatsApp (a wa.me deep link with the personalised message pre-filled) —
// these actions only keep the shared "who has been messaged" ledger and the
// editable template/coupon settings.

const CAMPAIGN = 'winback-2026-07';

async function assertWinback() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

/** Record that a customer was messaged (idempotent — the unique constraint
 *  makes a double-click harmless). */
export async function markSent(custKey: string): Promise<{ ok: boolean }> {
  const session = await assertWinback();
  const { error } = await supabaseAdmin().from('campaign_outreach').upsert(
    { campaign: CAMPAIGN, cust_key: custKey, sent_by: session.email ?? 'staff' },
    { onConflict: 'campaign,cust_key', ignoreDuplicates: true },
  );
  if (error) return { ok: false };
  void logAudit(session, { action: 'winback.sent', entity: 'campaign_outreach', entity_id: custKey });
  revalidatePath('/admin/winback');
  return { ok: true };
}

/** Undo a mistaken mark (e.g. the WhatsApp tab was closed without sending). */
export async function unmarkSent(custKey: string): Promise<{ ok: boolean }> {
  const session = await assertWinback();
  const { error } = await supabaseAdmin()
    .from('campaign_outreach')
    .delete()
    .eq('campaign', CAMPAIGN)
    .eq('cust_key', custKey);
  if (error) return { ok: false };
  void logAudit(session, { action: 'winback.unsent', entity: 'campaign_outreach', entity_id: custKey });
  revalidatePath('/admin/winback');
  return { ok: true };
}

/** Persist the editable message template + campaign coupon code. */
export async function saveWinbackSettings(formData: FormData): Promise<void> {
  const session = await assertWinback();
  // Writing templates/coupons is a SETTINGS write, not a customer read —
  // customers.view alone must not be able to change store-wide messaging
  // (2026-08-01 audit). Owner or the settings permission required.
  if (!session.isOwner && !session.permissions.includes('settings')) {
    throw new Error('Unauthorized: settings permission required');
  }
  const template = ((formData.get('template') as string) ?? '').slice(0, 2000);
  const coupon = ((formData.get('coupon') as string) ?? '').trim().toUpperCase().slice(0, 40);
  const pairs = [
    { key: 'winback_wa_template', value: template },
    { key: 'winback_coupon', value: coupon },
  ];
  await supabaseAdmin().from('site_settings').upsert(pairs, { onConflict: 'key' });
  revalidatePath('/admin/winback');
}
