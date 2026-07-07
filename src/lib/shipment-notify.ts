// ============================================================================
// Customer notification on AUTOMATED shipment-status transitions.
//
// The DB trigger `sync_order_tracking_from_shipment` (migration
// 20260521_040_shipments.sql) cascades a shipment status change onto
// orders.status. But the customer shipped/delivered email is only sent from
// the server *actions* (updateOrderStatus / bulk / shipment booking) — a status
// advance driven purely by the DB trigger (i.e. from the courier-sync cron or
// the courier webhook) updates the order silently, with no email.
//
// This helper closes that gap: the cron and webhook call it after they change a
// shipment's status, and it emails the customer exactly once — on the *edge*
// where the parent order actually advances (…→shipped, shipped→delivered).
// Keyed on the shipment-status edge (old vs new), so a repeat "delivered"
// webhook or a same-order-status shipment tick (picked_up→in_transit, both map
// to "shipped") never re-sends.
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendStatusTransitionEmail } from '@/lib/order-status-emails';

// Mirror of the trigger's mapping (migration 20260708_610): which order status a
// given (normalised) shipment status resolves to, or null for statuses that
// don't move the order. A `returned` scan (parcel refused / returned to origin)
// advances the order to `returned` so a refused COD delivery stops showing as
// "shipped" — it does NOT restock (that's the returns flow, on physical
// receipt). `failed` (a single unsuccessful attempt, may be re-attempted) and
// `created` / `cancelled` don't move the order here.
export function orderStatusForShipment(shipmentStatus: string): 'shipped' | 'delivered' | 'returned' | null {
  if (shipmentStatus === 'delivered') return 'delivered';
  if (shipmentStatus === 'returned') return 'returned';
  if (shipmentStatus === 'picked_up' || shipmentStatus === 'in_transit' || shipmentStatus === 'out_for_delivery') {
    return 'shipped';
  }
  return null;
}

/**
 * Email the customer if an automated shipment-status change advanced the order.
 * Fires only on the transition edge (old→new maps to a *different* order
 * status), so it's safe to call on every cron tick / webhook hit. Never throws
 * — notifications are best-effort and must not fail the status write.
 *
 * @param oldShipmentStatus the shipment's status BEFORE this change
 * @param newShipmentStatus the shipment's status AFTER this change
 */
export async function notifyOrderShipmentTransition(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sb: SupabaseClient<any, any, any>,
  orderId: string,
  oldShipmentStatus: string,
  newShipmentStatus: string,
): Promise<void> {
  const target = orderStatusForShipment(newShipmentStatus);
  const prev = orderStatusForShipment(oldShipmentStatus);
  // No order-level advance (e.g. picked_up→in_transit both == "shipped", or a
  // duplicate delivered event) → nothing to send.
  if (!target || target === prev) return;
  // Never "downgrade"-notify (a stray shipped event after delivered).
  if (target === 'shipped' && prev === 'delivered') return;

  try {
    const { data } = await sb
      .from('orders')
      .select('email, first_name, order_number, tracking_number, courier')
      .eq('id', orderId)
      .maybeSingle();
    if (!data) return;
    await sendStatusTransitionEmail(data, target);
  } catch {
    // best-effort; sendStatusTransitionEmail already swallows its own errors
  }
}
