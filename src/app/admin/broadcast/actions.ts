'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

// WhatsApp broadcast actions. Sending happens in the owner's own WhatsApp
// (a wa.me deep link per customer with the personalised message pre-filled);
// these only keep the shared "who has been messaged" ledger and the editable
// template settings. Unlike Win-back, the campaign key is a setting: change
// it (azadi-2026-08 → eleven-eleven-2026) and the checklist starts fresh for
// the new blast while the old campaign's ledger stays intact.

async function assertBroadcast() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function markBroadcastSent(campaign: string, custKey: string): Promise<{ ok: boolean }> {
  const session = await assertBroadcast();
  if (!campaign || !custKey) return { ok: false };
  const { error } = await supabaseAdmin().from('campaign_outreach').upsert(
    { campaign, cust_key: custKey, sent_by: session.email ?? 'staff' },
    { onConflict: 'campaign,cust_key', ignoreDuplicates: true },
  );
  if (error) return { ok: false };
  void logAudit(session, { action: 'broadcast.sent', entity: 'campaign_outreach', entity_id: custKey, diff: { campaign } });
  revalidatePath('/admin/broadcast');
  return { ok: true };
}

export async function unmarkBroadcastSent(campaign: string, custKey: string): Promise<{ ok: boolean }> {
  const session = await assertBroadcast();
  if (!campaign || !custKey) return { ok: false };
  const { error } = await supabaseAdmin()
    .from('campaign_outreach')
    .delete()
    .eq('campaign', campaign)
    .eq('cust_key', custKey);
  if (error) return { ok: false };
  void logAudit(session, { action: 'broadcast.unsent', entity: 'campaign_outreach', entity_id: custKey, diff: { campaign } });
  revalidatePath('/admin/broadcast');
  return { ok: true };
}

export async function saveBroadcastSettings(formData: FormData): Promise<void> {
  const session = await assertBroadcast();
  const template = String(formData.get('template') ?? '').trim().slice(0, 1000);
  const campaign = String(formData.get('campaign') ?? '').trim().toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  if (!template || !campaign) return;
  await supabaseAdmin().from('site_settings').upsert(
    [
      { key: 'broadcast_template', value: template },
      { key: 'broadcast_campaign', value: campaign },
    ],
    { onConflict: 'key' },
  );
  void logAudit(session, { action: 'broadcast.settings', entity: 'site_settings', entity_id: 'broadcast_template', diff: { campaign } });
  revalidatePath('/admin/broadcast');
}
