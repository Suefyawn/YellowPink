// One rule for "can a shopper buy this right now", stated once.
//
// The storefront asks this in six places — product tile, PDP, mini-cart, cart
// quantity cap, schema.org availability and the merchant feeds — and place_order
// enforces the same thing server-side. When the rule lived inline in each of
// them they drifted: some checked `track_inventory !== false`, some
// `track_inventory === false`, and none of them knew about backorders.
//
// The rule:
//   • stock_mode other than 'own'  → always sellable (somebody else holds it)
//   • continue_selling_when_out    → always sellable (owner: "we'll get it")
//   • otherwise                    → sellable while the count is above zero
//
// A product with shades is judged on the SHADES, because the parent counter is
// an aggregate nothing maintains.

export interface SellableProduct {
  stock?: number | null;
  track_inventory?: boolean | null;
  continue_selling_when_out?: boolean | null;
}

/** Does this product's count gate the sale at all? */
export function stockIsEnforced(p: SellableProduct): boolean {
  // track_inventory is the derived mirror of stock_mode === 'own', and is what
  // every existing caller already has to hand.
  if (p.track_inventory === false) return false;
  // Default true matches the column default: absent means keep selling.
  return p.continue_selling_when_out === false;
}

/** Can a shopper add this to the cart? `available` overrides the product's own
 *  count when the caller has a better figure (a chosen shade, or the sum of
 *  shades on a variable product). */
export function isSellable(p: SellableProduct, available?: number | null): boolean {
  if (!stockIsEnforced(p)) return true;
  return (available ?? p.stock ?? 0) > 0;
}

/**
 * What to publish in structured data and the merchant feeds.
 *
 * Stock WE hold that has run to zero but keeps selling is NOT "in stock" — we
 * do not have it, we intend to source it. Google has a value for exactly that
 * (BackOrder), and using it keeps the listing purchasable in Shopping without
 * claiming stock we cannot show. Saying "in stock" for a shelf we know is
 * empty is what gets a Merchant Center account flagged for availability
 * mismatch.
 *
 * Stock somebody ELSE holds (stock_mode 'external' — the vendor ships it on
 * the normal timeline — or 'untracked') is a different case: the item is
 * available and dispatches like any other order, so it is InStock. Our own
 * counter for those rows is always 0 because nothing maintains it, and
 * publishing that 0 as BackOrder made Google show 222 of 244 live products
 * without the "In stock" label — the branded queries where those PDPs sit at
 * position 3–5 were drawing zero clicks (Search Console, Aug–Sep 2026).
 */
export type Availability = 'in_stock' | 'backorder' | 'out_of_stock';

export function availabilityState(p: SellableProduct, available?: number | null): Availability {
  const n = available ?? p.stock ?? 0;
  if (n > 0) return 'in_stock';
  // Not our shelf (vendor-held / untracked): the count means nothing, the
  // item ships normally.
  if (p.track_inventory === false) return 'in_stock';
  return stockIsEnforced(p) ? 'out_of_stock' : 'backorder';
}

export const SCHEMA_AVAILABILITY: Record<Availability, string> = {
  in_stock:     'https://schema.org/InStock',
  backorder:    'https://schema.org/BackOrder',
  out_of_stock: 'https://schema.org/OutOfStock',
};

/** g:availability in the Google Merchant feed. */
export const FEED_AVAILABILITY: Record<Availability, string> = {
  in_stock:     'in_stock',
  backorder:    'backorder',
  out_of_stock: 'out_of_stock',
};

/** Meta's catalogue spells these differently — spaces, and "available for
 *  order" in place of backorder. Feeding it Google's tokens silently
 *  invalidates the row. */
export const META_AVAILABILITY: Record<Availability, string> = {
  in_stock:     'in stock',
  backorder:    'available for order',
  out_of_stock: 'out of stock',
};

/** The most a shopper may put in the cart. Infinity when the count is not
 *  enforced, so a backorder is not silently capped at the last known figure. */
export function purchasableCap(p: SellableProduct, available?: number | null): number {
  if (!stockIsEnforced(p)) return Infinity;
  return Math.max(0, available ?? p.stock ?? 0);
}
