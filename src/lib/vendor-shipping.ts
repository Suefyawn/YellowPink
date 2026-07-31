// ============================================================================
// Vendor-scoped free shipping — pure, client-safe part.
//
// Lives in its own module (no supabase imports) so client components (cart
// progress bar, mini-cart, checkout's optimistic estimate) can share the exact
// eligibility rule the server enforces, instead of re-deriving it and
// drifting. The server quote (lib/shipping.ts) and the SQL floor in
// place_order (migrations 770/780) are the enforcement points.
// ============================================================================

/** Minimal slice of a cart line the vendor free-shipping rule needs. */
export interface ShippingItem {
  vendor_id?: string | null;
  price: number;
  qty: number;
}

/**
 * True when the sum of line amounts for any single vendor reaches that
 * vendor's threshold. Matches the SQL enforcement in place_order. The
 * motivating case: NB Sons free-ships above Rs 1,999 on their own store, so
 * any NB Sons basket of ours between Rs 2,000 and the zone threshold was
 * cheaper at the source.
 *
 * Thresholds are a plain Record (not a Map) so the same value can cross the
 * RSC boundary into client components via CommerceSettings.
 */
export function vendorFreeShippingEligible(
  items: ShippingItem[],
  thresholds: Record<string, number>,
): boolean {
  const vendorIds = Object.keys(thresholds);
  if (vendorIds.length === 0) return false;
  const sums = new Map<string, number>();
  for (const it of items) {
    if (!it.vendor_id || !(it.vendor_id in thresholds)) continue;
    sums.set(it.vendor_id, (sums.get(it.vendor_id) ?? 0) + it.price * it.qty);
  }
  for (const [vendorId, sum] of sums) {
    const threshold = thresholds[vendorId];
    if (threshold != null && sum >= threshold) return true;
  }
  return false;
}
