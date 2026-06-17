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
