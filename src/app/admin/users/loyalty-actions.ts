'use server';

// Manual loyalty-points adjustment from the admin customer page. The main
// use-case: awarding the Google-review bonus — Google reviews can't be
// verified by code, so the operator sees the review, opens the customer,
// and grants the points with a note. Also covers goodwill credits and
// corrections. Goes through grant_loyalty_points so the balance and the
// append-only ledger move together (reason 'manual', which the customer's
// rewards page renders as "Manual adjustment").

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

export async function adjustLoyaltyPoints(formData: FormData): Promise<void> {
  const session = await assertPermission('customers.edit');

  const userId = String(formData.get('user_id') ?? '').trim();
  const delta = Math.trunc(Number(formData.get('delta')));
  const note = String(formData.get('note') ?? '').trim().slice(0, 200);

  if (!userId || userId.startsWith('guest-')) throw new Error('Points need a registered account');
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Enter a non-zero points amount');
  if (Math.abs(delta) > 100_000) throw new Error('Amount out of range');

  const sb = supabaseAdmin();
  const { error } = await sb.rpc('grant_loyalty_points' as never, {
    p_user_id: userId,
    p_delta: delta,
    p_reason: 'manual',
    p_order_id: null,
    p_note: note || 'Manual adjustment',
  } as never);
  if (error) throw new Error(error.message);

  void logAudit(session, {
    action: 'customer.points_adjusted',
    entity: 'customer',
    entity_id: userId,
    diff: { delta, note },
  });

  revalidatePath(`/admin/users/${userId}`);
}
