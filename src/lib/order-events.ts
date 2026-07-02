// Operator attribution for order_events rows. Extracted from
// app/admin/actions.ts so the shipment-booking action (which also moves an
// order to 'shipped') can attribute the transition the same way.

import type { supabaseAdmin } from '@/lib/supabase';
import type { StaffSession } from '@/lib/permissions';
import type { OrderStatus } from '@/types';

/** The order_events trigger stamps every admin status change `staff` with a
 *  null actor_id, the database can't see the app session. After a status
 *  update, patch the event row the trigger just wrote with the signed-in
 *  operator so the order timeline shows WHO made the change, not just "STAFF".
 *  Only rows with a null actor_id are touched, so past events keep their
 *  original attribution. */
export async function attributeOrderEvents(
  admin: ReturnType<typeof supabaseAdmin>,
  orderIds: string[],
  status: OrderStatus,
  session: StaffSession,
): Promise<void> {
  const actor = session.isOwner ? 'owner' : (session.email ?? 'staff');
  for (const orderId of orderIds) {
    const { data: evt } = await admin
      .from('order_events')
      .select('id')
      .eq('order_id', orderId)
      .eq('to_status', status)
      .is('actor_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evt?.id) {
      await admin.from('order_events').update({ actor_id: actor }).eq('id', evt.id);
    }
  }
}
