'use client';

// Automatic discounts (Shopify's no-code discounts) — shared by CartPage and
// CheckoutPage. An automatic discount IS a coupons row (trigger_kind =
// 'automatic', migration 1120): this hook fetches the active ones via the
// anon-executable `active_automatic_discounts` RPC, runs each through the SAME
// validation + pricing machinery as typed codes, and hands back the best
// eligible one. The order is then placed with coupon_code = that row's code,
// so place_order's entire hardened path works unchanged.
//
// Precedence: a manually entered code always wins (the hook returns null the
// moment `manualCoupon` is set). Automatics are deliberately NOT persisted to
// localStorage or CartContext — they re-evaluate fresh on every load, so an
// expired or deactivated automatic simply stops applying.

import { useEffect, useMemo, useState } from 'react';
import { getBrowserClient } from '@/lib/supabase-browser';
import { validateCoupon, computeCouponDiscount } from '@/lib/coupon-validation';
import type { CartItem, Coupon } from '@/types';

export interface AutomaticDiscount {
  coupon: Coupon;
  /** PKR off the lines (0 for a free-shipping-only automatic, which zeroes
   *  the delivery charge instead — same as a manual free-shipping coupon). */
  discount: number;
}

export function useAutomaticDiscount(
  cartItems: CartItem[],
  subtotal: number,
  manualCoupon: Coupon | null,
): AutomaticDiscount | null {
  const [rows, setRows] = useState<Coupon[]>([]);

  // One fetch per mount, re-run only when the cart's identity actually
  // changes (item/qty/price), never per render — the signature string is the
  // effect's sole dependency, so qty spinner re-renders with the same cart
  // don't refetch.
  const signature = cartItems.map(i => `${i.id}|${i.variant ?? ''}|${i.qty}|${i.price}`).join(',');
  useEffect(() => {
    // Empty cart: nothing to price (the memo below returns null anyway), so
    // skip the round-trip. Stale rows are harmless — every render re-validates
    // them against the live cart.
    if (!signature) return;
    let cancelled = false;
    (async () => {
      const sb = getBrowserClient();
      // coupons has RLS with no anon SELECT (migration 070); the SECURITY
      // DEFINER RPC returns only active automatics within window/caps.
      const { data, error } = await sb.rpc('active_automatic_discounts' as never);
      if (cancelled || error) return;
      setRows((data ?? []) as Coupon[]);
    })();
    return () => { cancelled = true; };
  }, [signature]);

  return useMemo(() => {
    // A manually entered code always wins — no automatic while one is set.
    if (manualCoupon || rows.length === 0 || cartItems.length === 0) return null;
    let best: AutomaticDiscount | null = null;
    for (const c of rows) {
      // Same best-effort client validation as the cart's manual path (no
      // email context); place_order re-validates everything at submit.
      const verdict = validateCoupon({ coupon: c, cartItems, subtotal });
      if (!verdict.ok) continue;
      const discount = computeCouponDiscount(c, cartItems);
      const freeShip = c.discount_type === 'free_shipping' || c.free_shipping;
      // A zero-discount automatic only counts if it grants free shipping.
      if (discount <= 0 && !freeShip) continue;
      if (!best || discount > best.discount) best = { coupon: c, discount };
    }
    return best;
  }, [manualCoupon, rows, cartItems, subtotal]);
}
