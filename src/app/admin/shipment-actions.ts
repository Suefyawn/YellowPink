'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

async function assertOrders() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function createShipment(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();

  const order_id = formData.get('order_id');
  const courier  = formData.get('courier');
  const tracking_number = formData.get('tracking_number');
  if (typeof order_id !== 'string' || !order_id) return { error: 'order_id required' };
  if (typeof courier !== 'string' || !courier) return { error: 'courier required' };
  if (typeof tracking_number !== 'string' || !tracking_number) return { error: 'tracking_number required' };

  const weightRaw = formData.get('weight_grams');
  const weight_grams = typeof weightRaw === 'string' && weightRaw ? Number(weightRaw) : null;

  const { data, error } = await supabase.from('shipments').insert({
    order_id,
    courier,
    tracking_number: tracking_number.trim(),
    weight_grams,
    status: 'picked_up',
  }).select('id').single();

  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'shipment.create',
    entity: 'shipment',
    entity_id: data?.id as string | undefined,
    diff: { order_id, courier, tracking_number },
  });

  revalidatePath(`/admin/orders/${order_id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}
