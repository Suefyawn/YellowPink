// Coupon validator shared between CartPage and CheckoutPage. Returns the
// first failure reason as user-facing text, or `{ ok: true }` if every
// constraint passes.
//
// Note: this is best-effort client-side validation for UX (don't accept a
// coupon that's clearly invalid). The authoritative check happens in the
// place_order RPC. Server-side re-validation is tracked as a P1 follow-up.

import type { Coupon, CartItem } from '@/types';

export interface ValidateCouponInput {
  coupon: Coupon;
  cartItems: CartItem[];
  subtotal: number;
  /** Logged-in user's email, if any, needed for `email_restrictions`. */
  email?: string | null;
  /** Number of times THIS user has redeemed THIS coupon in the past. */
  perUserUsedCount?: number;
}

export type ValidateCouponResult = { ok: true } | { ok: false; error: string };

export function validateCoupon({
  coupon: c,
  cartItems,
  subtotal,
  email,
  perUserUsedCount,
}: ValidateCouponInput): ValidateCouponResult {
  // Time gates. (lookup_coupon already hides not-yet-started codes; this
  // covers a coupon restored from localStorage across its start boundary.)
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return { ok: false, error: 'This coupon has expired.' };
  }
  if (c.starts_at && new Date(c.starts_at) > new Date()) {
    return { ok: false, error: 'This coupon is not active yet.' };
  }
  // Global usage cap.
  if (c.max_uses !== null && c.used_count >= c.max_uses) {
    return { ok: false, error: 'This coupon has reached its usage limit.' };
  }
  // Per-user usage cap (only enforceable when the caller knows the user's
  // prior count, guests bypass this and the server will catch them).
  if (
    typeof c.usage_limit_per_user === 'number' &&
    c.usage_limit_per_user > 0 &&
    typeof perUserUsedCount === 'number' &&
    perUserUsedCount >= c.usage_limit_per_user
  ) {
    return { ok: false, error: 'You have already used this coupon the maximum number of times.' };
  }
  // Cart subtotal floor / ceiling.
  if (subtotal < c.min_order) {
    return { ok: false, error: `Minimum order of PKR ${c.min_order.toLocaleString()} required.` };
  }
  if (typeof c.max_order === 'number' && c.max_order > 0 && subtotal > c.max_order) {
    return { ok: false, error: `This coupon only applies to orders up to PKR ${c.max_order.toLocaleString()}.` };
  }
  // Email allowlist (substring or domain match, Woo-style: an entry
  // starting with `*@` is a domain wildcard, e.g. `*@yellowpink.pk`).
  if (c.email_restrictions && c.email_restrictions.length > 0) {
    const e = (email ?? '').trim().toLowerCase();
    if (!e) {
      return { ok: false, error: 'This coupon requires you to be signed in with a specific email.' };
    }
    const ok = c.email_restrictions.some(raw => {
      const r = raw.trim().toLowerCase();
      if (r.startsWith('*@')) return e.endsWith(r.slice(1));
      return e === r;
    });
    if (!ok) return { ok: false, error: 'This coupon is not valid for your account.' };
  }
  // Scoping: a coupon limited to certain products (or barring sale items)
  // must have at least one line it can act on.
  if (couponIsScoped(c) && couponEligibleSubtotal(c, cartItems) <= 0) {
    return { ok: false, error: 'This coupon does not apply to items in your cart.' };
  }
  // Buy X get Y gate: the offer only stands when the cart carries enough
  // "buy" units AND at least one discountable "get" unit. Tell the shopper
  // which half is missing so the message is actionable.
  if (c.bxgy && computeBxgyDiscount(c, cartItems) <= 0) {
    const b = c.bxgy;
    const buyQty = Math.max(b.buy_qty ?? 1, 1);
    const getQty = Math.max(b.get_qty ?? 1, 1);
    const buyIds = new Set(b.buy_product_ids ?? []);
    const getIds = new Set(b.get_product_ids ?? []);
    const overlap = (b.buy_product_ids ?? []).some(id => getIds.has(id));
    // Units needed for one application: when the pools overlap a unit can't
    // count as both buy and get, so the threshold is buyQty + getQty.
    const threshold = overlap ? buyQty + getQty : buyQty;
    const buyUnits = cartItems.reduce((s, it) => s + (buyIds.has(it.id) ? it.qty : 0), 0);
    if (buyUnits < threshold) {
      const n = threshold - buyUnits;
      return { ok: false, error: `Add ${n} more qualifying item${n === 1 ? '' : 's'} to use this offer.` };
    }
    return { ok: false, error: "This offer's discounted items are not in your cart." };
  }
  // Per-category allowlist / denylist: category_ids are UUIDs and CartItem
  // only carries the category name, so the server enforces those (eligibility
  // only — they never change the discount amount, so client and server maths
  // can't drift).
  return { ok: true };
}

// ─── Discount amount ────────────────────────────────────────────────────────
// The single source of the coupon maths for the cart, the checkout AND the
// place_order RPC (its SQL mirrors these rules line for line — keep them in
// lock-step or the RPC's drift check will reject honest orders).
//
// A coupon "scoped" to products or non-sale items discounts ONLY the lines it
// applies to, the Shopify "amount off products" semantics. Before 13 Aug 2026
// the lists were an eligibility gate only: one qualifying item in the basket
// discounted the entire cart.

/** True when the coupon's discount base is narrower than the whole cart. */
export function couponIsScoped(c: Coupon): boolean {
  return Boolean(
    (c.product_ids && c.product_ids.length > 0) ||
    (c.excluded_product_ids && c.excluded_product_ids.length > 0) ||
    c.exclude_sale_items,
  );
}

/** A line is "on sale" when it's charged below the product's compare-at price.
 *  `price` on a cart line is the charged unit price (variant price for shade
 *  lines) — the same number place_order recomputes as v_unit_price. */
function lineOnSale(it: CartItem): boolean {
  return it.original_price != null && it.original_price > it.price;
}

function lineEligible(c: Coupon, it: CartItem): boolean {
  if (c.product_ids && c.product_ids.length > 0 && !c.product_ids.includes(it.id)) return false;
  if (c.excluded_product_ids && c.excluded_product_ids.length > 0 && c.excluded_product_ids.includes(it.id)) return false;
  if (c.exclude_sale_items && lineOnSale(it)) return false;
  return true;
}

/** Subtotal of the lines the coupon may discount. */
export function couponEligibleSubtotal(c: Coupon, cartItems: CartItem[]): number {
  return cartItems.reduce((s, it) => s + (lineEligible(c, it) ? it.price * it.qty : 0), 0);
}

/** Buy X Get Y (migration 1130). Mirrors the SQL in
 *  supabase/migrations/20260814_1130_bxgy_discounts.sql LINE FOR LINE — the
 *  place_order RPC recomputes this number and rejects the order when the
 *  client-sent discount differs, so any drift here rejects honest orders.
 *  Returns 0 when the offer doesn't apply to this cart. */
export function computeBxgyDiscount(c: Coupon, cartItems: CartItem[]): number {
  const b = c.bxgy;
  if (!b) return 0;
  const buyQty = Math.max(b.buy_qty ?? 1, 1);
  const getQty = Math.max(b.get_qty ?? 1, 1);
  const pct = Math.min(Math.max(b.pct_off ?? 100, 1), 100);
  const maxApps = Math.max(b.max_per_order ?? 1, 1);
  const buyIds = new Set(b.buy_product_ids ?? []);
  const getIds = new Set(b.get_product_ids ?? []);
  if (buyIds.size === 0 || getIds.size === 0) return 0;
  // Cart lines key on the PRODUCT id (variant lines share it) — sum them all.
  const buyUnits = cartItems.reduce((s, it) => s + (buyIds.has(it.id) ? it.qty : 0), 0);
  // Overlapping pools: one unit can't count as both buy and get, so a full
  // application consumes buyQty + getQty units (the classic "every 3rd free").
  const overlap = (b.buy_product_ids ?? []).some(id => getIds.has(id));
  const apps = Math.min(
    Math.floor(buyUnits / (overlap ? buyQty + getQty : buyQty)),
    maxApps,
  );
  if (apps < 1) return 0;
  // Expand get-pool lines into per-UNIT charged prices and discount the
  // CHEAPEST apps*getQty units (same as the SQL's order-by-price limit).
  const unitPrices: number[] = [];
  for (const it of cartItems) {
    if (!getIds.has(it.id)) continue;
    for (let i = 0; i < it.qty; i++) unitPrices.push(it.price);
  }
  unitPrices.sort((a, z) => a - z);
  const getSum = unitPrices.slice(0, apps * getQty).reduce((s, p) => s + p, 0);
  if (getSum <= 0) return 0;
  // Postgres round() (half away from zero) === Math.round for positives.
  return Math.round(getSum * pct / 100);
}

/** The PKR discount this coupon takes off this cart. Free-shipping-only
 *  coupons (value 0) discount nothing — they zero the delivery charge instead. */
export function computeCouponDiscount(c: Coupon, cartItems: CartItem[]): number {
  // Buy X get Y overrides the value/type maths entirely (the free-shipping
  // flag is still honoured by the checkout's own shipping logic).
  if (c.bxgy) return computeBxgyDiscount(c, cartItems);
  const freeShipOnly = (c.discount_type === 'free_shipping' || c.free_shipping) && !(c.value > 0);
  if (freeShipOnly) return 0;
  const subtotal = cartItems.reduce((s, it) => s + it.price * it.qty, 0);
  const base = couponIsScoped(c) ? couponEligibleSubtotal(c, cartItems) : subtotal;
  if (c.type === 'percent') return Math.round(base * c.value / 100);
  // Fixed amount: never more than the lines it's allowed to touch.
  return Math.min(c.value, base);
}
