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
  // Time gate.
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return { ok: false, error: 'This coupon has expired.' };
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

/** The PKR discount this coupon takes off this cart. Free-shipping-only
 *  coupons (value 0) discount nothing — they zero the delivery charge instead. */
export function computeCouponDiscount(c: Coupon, cartItems: CartItem[]): number {
  const freeShipOnly = (c.discount_type === 'free_shipping' || c.free_shipping) && !(c.value > 0);
  if (freeShipOnly) return 0;
  const subtotal = cartItems.reduce((s, it) => s + it.price * it.qty, 0);
  const base = couponIsScoped(c) ? couponEligibleSubtotal(c, cartItems) : subtotal;
  if (c.type === 'percent') return Math.round(base * c.value / 100);
  // Fixed amount: never more than the lines it's allowed to touch.
  return Math.min(c.value, base);
}
