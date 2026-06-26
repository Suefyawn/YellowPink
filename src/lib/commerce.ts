// Single source of truth for storefront commerce defaults that are shown to
// the shopper BEFORE the per-zone shipping rate is resolved server-side (see
// lib/shipping.ts, which seeds its own defaults from here). The cart,
// mini-cart and checkout all read these so the free-shipping promise can never
// drift between surfaces, previously each hard-coded `2500`/`200`, so an
// admin change to the threshold silently left the cart copy out of date.
//
// The real, province-aware rate still comes from shipping_rates in the DB;
// these are only the optimistic pre-address defaults.
export const FREE_SHIPPING_THRESHOLD = 5000;
export const DEFAULT_SHIPPING_RATE = 200;

/** Resolved free-shipping / shipping configuration, derived from the
 *  owner-editable site settings (admin → Settings → Shipping). This is the
 *  single source of truth the whole system reads, storefront copy, the cart
 *  progress bar, checkout's optimistic estimate, and the server-side rate
 *  resolver, so changing the threshold (or switching free shipping off)
 *  reflects everywhere at once. */
export interface CommerceConfig {
  /** Master switch. When false, free shipping is never offered anywhere and
   *  the storefront stops showing the progress bar / "free over X" copy. */
  freeShippingEnabled: boolean;
  /** Order subtotal (PKR) at which shipping becomes free. Only meaningful when
   *  freeShippingEnabled is true. */
  freeShippingThreshold: number;
  /** Flat shipping rate (PKR) charged when the order doesn't qualify for free
   *  shipping and no shipping zone overrides it. */
  defaultShippingRate: number;
}

/** Parse the raw site_settings key/value map into a typed CommerceConfig,
 *  falling back to the historical constants when a value is missing or invalid.
 *  Free shipping defaults to ON when the toggle has never been set, preserving
 *  the previous always-on behaviour. */
export function parseCommerceConfig(settings: Record<string, string>): CommerceConfig {
  const threshold = Number(settings.free_shipping_threshold);
  const rate = Number(settings.default_shipping_rate);
  return {
    freeShippingEnabled: settings.free_shipping_enabled !== 'false',
    freeShippingThreshold:
      Number.isFinite(threshold) && threshold > 0 ? threshold : FREE_SHIPPING_THRESHOLD,
    defaultShippingRate:
      Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_SHIPPING_RATE,
  };
}

/** Default config used by client context fallbacks and tests. */
export const DEFAULT_COMMERCE_CONFIG: CommerceConfig = {
  freeShippingEnabled: true,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  defaultShippingRate: DEFAULT_SHIPPING_RATE,
};

/** Format a threshold (PKR) as shoppers see it, e.g. "PKR 5,000". */
export const formatPkr = (n: number) => `PKR ${n.toLocaleString()}`;

// ── Config-derived customer copy ────────────────────────────────────────────
// Every surface that mentions the free-shipping promise builds its wording
// from these helpers + the live CommerceConfig, so the threshold (and the
// on/off switch) is typed once in Admin and read everywhere, no surface ever
// hard-codes the number. Server pages pass parseCommerceConfig(settings);
// client components read it from useCommerceSettings().

/** Compact free-shipping label for trust strips / badges, e.g. "Over PKR 5,000". */
export const freeShippingShort = (c: CommerceConfig) =>
  `Over ${formatPkr(c.freeShippingThreshold)}`;

/** Full announcement-bar / banner sentence, derived from the live config.
 *  Falls back to a COD line when free shipping is switched off. */
export const freeShippingSentence = (c: CommerceConfig) =>
  c.freeShippingEnabled
    ? `Free delivery on orders over ${formatPkr(c.freeShippingThreshold)}, COD Nationwide`
    : 'Cash on delivery nationwide';

/** Customer-facing returns window, in days. Shared by the PDP trust copy, the
 *  checkout reassurance strip and the shipping blurb so they never disagree. */
export const RETURNS_WINDOW_DAYS = 7;

/** Order statuses that never represent realized revenue: never paid, the money
 *  was given back, or the sale fell through. Customer lifetime-spend and
 *  average-order-value figures must exclude these so a cancelled or refunded
 *  order doesn't inflate the numbers. Mirrors the v_orders_revenue view's
 *  intent for the per-customer surfaces that can't use that view. */
export const NON_REVENUE_ORDER_STATUSES = [
  'cancelled', 'refunded', 'returned', 'payment_failed',
] as const;

/** The free-shipping threshold formatted as shoppers see it, e.g. "PKR 5,000".
 *  Derive display copy from this so the figure tracks the threshold constant
 *  instead of being re-typed (and left stale) in each surface. */
export const freeShippingLabel = () => `PKR ${FREE_SHIPPING_THRESHOLD.toLocaleString()}`;

// Newsletter welcome offer. The live figures are read from the WELCOME10
// coupon (see lib/offers.ts → getWelcomeOffer) so editing the coupon updates
// the modal + welcome email copy. These are the fallbacks used when the row
// can't be read, and must mirror migration 087's seed.
export const WELCOME_CODE = 'WELCOME10';
export const WELCOME_DISCOUNT_PCT = 10;
export const WELCOME_MIN_ORDER = 1500;
