'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// ─── Vendor CRUD ────────────────────────────────────────────────────────────

export async function createVendor(formData: FormData) {
  const session = await assertPermission('orders');
  const name  = (formData.get('name') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();
  const notes = (formData.get('notes') as string)?.trim() || null;
  if (!name || !phone) return;

  const { data: created } = await supabaseAdmin()
    .from('vendors')
    .insert({ name, phone, notes })
    .select('id')
    .single();
  void logAudit(session, {
    action: 'vendor.create', entity: 'vendors', entity_id: created?.id ?? null,
    diff: { name, phone },
  });
  revalidatePath('/admin/vendors');
}

export async function deleteVendor(formData: FormData) {
  const session = await assertPermission('orders');
  const id = formData.get('id') as string;
  const { data: target } = await supabaseAdmin().from('vendors').select('name').eq('id', id).single();
  await supabaseAdmin().from('vendors').delete().eq('id', id);
  void logAudit(session, {
    action: 'vendor.delete', entity: 'vendors', entity_id: id,
    diff: { name: target?.name },
  });
  revalidatePath('/admin/vendors');
}

// ─── Order confirmation + vendor dispatch ───────────────────────────────────

/** Toggle whether the customer has confirmed the order (typically over
 *  WhatsApp). Bound with the order id + target state by the order page. */
export async function setOrderConfirmed(orderId: string, confirmed: boolean) {
  const session = await assertPermission('orders');
  await supabaseAdmin()
    .from('orders')
    .update({ confirmed_at: confirmed ? new Date().toISOString() : null })
    .eq('id', orderId);
  void logAudit(session, {
    action: confirmed ? 'order.customer_confirmed' : 'order.confirmation_cleared',
    entity: 'orders', entity_id: orderId,
  });
  revalidatePath(`/admin/orders/${orderId}`);
}

/** Record that the order was forwarded to a vendor. The WhatsApp message
 *  itself is opened client-side; this just persists the assignment + a
 *  "sent" timestamp so the order page shows it was dispatched. */
export async function dispatchOrderToVendor(orderId: string, vendorId: string) {
  const session = await assertPermission('orders');
  if (!vendorId) return;
  await supabaseAdmin()
    .from('orders')
    .update({ vendor_id: vendorId, vendor_sent_at: new Date().toISOString() })
    .eq('id', orderId);
  void logAudit(session, {
    action: 'order.dispatched_to_vendor', entity: 'orders', entity_id: orderId,
    diff: { vendor_id: vendorId },
  });
  revalidatePath(`/admin/orders/${orderId}`);
}
