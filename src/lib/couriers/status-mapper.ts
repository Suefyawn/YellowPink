// ============================================================================
// Courier-status string → our internal enum mapper. Each PK courier reports
// status in slightly different language ("Delivered" vs "OK" vs "POD"), so
// this normaliser absorbs the variation so shipment_events rows always
// carry one of: created, picked_up, in_transit, out_for_delivery,
// delivered, returned, failed, cancelled.
//
// ORDER MATTERS. Several courier phrases contain the substring "deliver" while
// describing the OPPOSITE of a successful delivery — "Out For Delivery" (still
// in transit), "Delivery Attempted" / "Recipient Refused To Accept" / "Unable
// To Deliver" (a failed attempt). These must be matched BEFORE the plain
// "deliver" → delivered rule, or a parcel that was refused reads as delivered.
// (This is exactly what happened with TCS "Out For Delivery" scans.)
// ============================================================================

export function normaliseCourierStatus(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  // 1. Out for delivery — contains "deliver", so it must win before "delivered".
  if (s.includes('out for delivery') || s === 'ofd')        return 'out_for_delivery';
  // 2. Failed/refused attempts — many contain "deliver" ("delivery attempted",
  //    "unable to deliver", "not delivered", "recipient refused"). Catch these
  //    before the success rule so an unsuccessful attempt is never read as
  //    delivered.
  if (s.includes('refus') || s.includes('attempt') || s.includes('unable')
      || s.includes('undeliver') || s.includes('not deliver') || s.includes('fail')
      || s.includes('unclaim') || s.includes('reject'))     return 'failed';
  // 3. Returned to origin (terminal). Before "deliver" for safety.
  if (s.includes('return') || s === 'ro')                    return 'returned';
  if (s.includes('cancel'))                                  return 'cancelled';
  // 4. Genuine delivery.
  if (s.includes('deliver') || s === 'ok' || s === 'pod')    return 'delivered';
  if (s.includes('transit') || s.includes('shipped') || s.includes('arrived')
      || s.includes('depart') || s.includes('forward') || s.includes('receiv')) return 'in_transit';
  if (s.includes('pick'))                                    return 'picked_up';
  // "BOOKED" (e.g. TCS shipmentsummary "Current Status: BOOKED") = consignment
  // exists but nothing has been scanned — that's our 'created', not in transit.
  if (s.includes('book'))                                    return 'created';
  return 'in_transit';
}
