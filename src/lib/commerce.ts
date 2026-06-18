// Single source of truth for storefront commerce defaults that are shown to
// the shopper BEFORE the per-zone shipping rate is resolved server-side (see
// lib/shipping.ts, which seeds its own defaults from here). The cart,
// mini-cart and checkout all read these so the free-shipping promise can never
// drift between surfaces — previously each hard-coded `2500`/`200`, so an
// admin change to the threshold silently left the cart copy out of date.
//
// The real, province-aware rate still comes from shipping_rates in the DB;
// these are only the optimistic pre-address defaults.
export const FREE_SHIPPING_THRESHOLD = 2500;
export const DEFAULT_SHIPPING_RATE = 200;

/** Customer-facing returns window, in days. Shared by the PDP trust copy, the
 *  checkout reassurance strip and the shipping blurb so they never disagree. */
export const RETURNS_WINDOW_DAYS = 7;

/** The free-shipping threshold formatted as shoppers see it, e.g. "PKR 2,500".
 *  Derive display copy from this so the figure tracks the threshold constant
 *  instead of being re-typed (and left stale) in each surface. */
export const freeShippingLabel = () => `PKR ${FREE_SHIPPING_THRESHOLD.toLocaleString()}`;
