'use server';

// Order timeline comments — Shopify's order timeline interleaves the status
// events with staff notes ("rang twice, trying this evening"), and ours now
// does the same. Append-only, authored, internal-only: the customer never
// sees these. Distinct from orders.notes (one overwritable textarea) and
// from order_events (status transitions).

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

export async function addOrderComment(orderId: string, formData: FormData): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }
  const body = String(formData.get('body') ?? '').trim().slice(0, 2000);
  if (!body) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Write the note first.'));
  }

  const { data, error } = await supabaseAdmin()
    .from('order_comments')
    .insert({ order_id: orderId, author: session.email || 'staff', body })
    .select('id')
    .single();
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(error.message));
  }

  void logAudit(session, {
    action: 'order.comment', entity: 'order_comments', entity_id: (data as { id: string }).id,
    diff: { order_id: orderId, body },
  });
  revalidatePath(`/admin/orders/${orderId}`);
}

export async function deleteOrderComment(id: string, orderId: string): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }

  // Scoped to the order so a forged id can't delete another order's note,
  // and captured first so the audit log keeps what was removed.
  const { data: existing } = await supabaseAdmin()
    .from('order_comments')
    .select('id, author, body, created_at')
    .eq('id', id)
    .eq('order_id', orderId)
    .maybeSingle();
  if (!existing) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Note not found.'));
  }

  const { error } = await supabaseAdmin().from('order_comments').delete().eq('id', id);
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(error.message));
  }

  void logAudit(session, {
    action: 'order.comment_deleted', entity: 'order_comments', entity_id: id,
    diff: { order_id: orderId, ...(existing as Record<string, unknown>) },
  });
  revalidatePath(`/admin/orders/${orderId}`);
}
