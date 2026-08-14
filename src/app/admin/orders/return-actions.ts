'use server';

// Staff-created returns. The customer self-service path (account → returns)
// requires a signed-in account that owns the order — which most buyers here
// don't have, so a phoned-in "I want to send this back" from a guest could
// not be entered at all. This action lets staff file the request on the
// customer's behalf; it lands in the same Returns queue and lifecycle
// (approve → received & restock → refunded) as a self-service one.
//
// Item names and prices are read back from the order row, never from the
// client, mirroring requestReturn's anti-tamper shape.

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

const RETURNABLE_STATUSES = ['shipped', 'delivered'];

export async function createReturnForOrder(orderId: string, formData: FormData): Promise<void> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('returns'))) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Not authorized'));
  }

  const reason = String(formData.get('reason') ?? '').trim().slice(0, 1000);
  if (reason.length < 5) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Give a short reason (at least 5 characters).'));
  }

  const admin = supabaseAdmin();
  const { data: order } = await admin
    .from('orders')
    .select('id, user_id, email, status, items')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Order not found.'));
  }
  const o = order as { id: string; user_id: string | null; email: string | null; status: string; items: Array<{ id: string; name: string; price: number; qty: number; variant_id?: string | null }> };
  if (!RETURNABLE_STATUSES.includes(o.status)) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Returns can only be filed for shipped or delivered orders.'));
  }

  // Selected line items arrive as ret__<index>__qty; names and prices come
  // from the order row by index.
  const items: Array<{ product_id: string; qty: number; name: string; price: number; variant_id: string | null }> = [];
  (o.items ?? []).forEach((line, index) => {
    const raw = formData.get(`ret__${index}__qty`);
    if (raw == null || raw === '') return;
    const qty = Number(raw);
    if (!Number.isInteger(qty) || qty < 1) return;
    items.push({
      product_id: line.id,
      qty: Math.min(qty, line.qty),
      name: line.name,
      price: line.price,
      // Restock-on-received credits the exact shade, so the variant rides along.
      variant_id: line.variant_id ?? null,
    });
  });
  if (items.length === 0) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent('Pick at least one item to return.'));
  }

  const { data, error } = await admin
    .from('return_requests')
    .insert({
      order_id: o.id,
      user_id: o.user_id,          // null for guests — the whole point
      email: o.email,
      reason,
      items,
      status: 'pending',
      admin_note: `Filed by staff (${session.email ?? 'staff'})`,
    })
    .select('id')
    .single();
  if (error) {
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(`Could not create the return: ${error.message}`));
  }

  await logAudit(session, {
    action: 'return.staff_create',
    entity: 'return_requests',
    entity_id: (data as { id: string }).id,
    diff: { order_id: o.id, reason, items },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/returns');
  redirect(`/admin/orders/${orderId}?ret=filed`);
}
