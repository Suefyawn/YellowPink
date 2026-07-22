'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

// Review-asks queue actions: record (or undo) the manual WhatsApp review
// nudge on the order row. Sending happens in the owner's own WhatsApp via a
// wa.me deep link; these only keep the shared "asked already" marker.

async function assertAccess() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function markReviewAskSent(orderId: string): Promise<{ ok: boolean }> {
  const session = await assertAccess();
  const { error } = await supabaseAdmin()
    .from('orders')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ review_wa_sent_at: new Date().toISOString(), review_wa_sent_by: session.email ?? 'staff' } as any)
    .eq('id', orderId);
  if (error) return { ok: false };
  void logAudit(session, { action: 'review_ask.sent', entity: 'orders', entity_id: orderId });
  revalidatePath('/admin/review-asks');
  return { ok: true };
}

export async function unmarkReviewAskSent(orderId: string): Promise<{ ok: boolean }> {
  const session = await assertAccess();
  const { error } = await supabaseAdmin()
    .from('orders')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ review_wa_sent_at: null, review_wa_sent_by: null } as any)
    .eq('id', orderId);
  if (error) return { ok: false };
  void logAudit(session, { action: 'review_ask.unsent', entity: 'orders', entity_id: orderId });
  revalidatePath('/admin/review-asks');
  return { ok: true };
}
