import { describe, it, expect } from 'vitest';
import { validateCoupon, computeCouponDiscount, computeBxgyDiscount, couponEligibleSubtotal } from './coupon-validation';
import type { Coupon, CartItem } from '@/types';

// Money-adjacent logic shared by CartPage and CheckoutPage. The place_order
// RPC is the authority, but this gate decides what discount the customer
// SEES before submitting, regressions here mean checkout surprises.

function coupon(overrides: Partial<Coupon> = {}): Coupon {
  return {
    id: 'c-1',
    code: 'SAVE10',
    type: 'percent',
    value: 10,
    min_order: 0,
    max_uses: null,
    used_count: 0,
    active: true,
    expires_at: null,
    ...overrides,
  } as Coupon;
}

function item(overrides: Partial<CartItem> = {}): CartItem {
  return {
    id: 'p-1',
    name: 'Test Product',
    slug: 'test-product',
    price: 1000,
    qty: 1,
    ...overrides,
  } as CartItem;
}

const baseInput = { cartItems: [item()], subtotal: 1000 };

describe('validateCoupon', () => {
  it('accepts a plain valid coupon', () => {
    expect(validateCoupon({ coupon: coupon(), ...baseInput })).toEqual({ ok: true });
  });

  it('rejects an expired coupon', () => {
    const res = validateCoupon({
      coupon: coupon({ expires_at: '2020-01-01T00:00:00Z' }),
      ...baseInput,
    });
    expect(res.ok).toBe(false);
  });

  it('accepts a coupon expiring in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(validateCoupon({ coupon: coupon({ expires_at: future }), ...baseInput }).ok).toBe(true);
  });

  it('rejects when the global usage cap is reached', () => {
    const res = validateCoupon({
      coupon: coupon({ max_uses: 5, used_count: 5 }),
      ...baseInput,
    });
    expect(res.ok).toBe(false);
  });

  it('enforces the per-user cap only when the prior count is known', () => {
    const c = coupon({ usage_limit_per_user: 1 });
    // Guest path, count unknown, server enforces later.
    expect(validateCoupon({ coupon: c, ...baseInput }).ok).toBe(true);
    expect(validateCoupon({ coupon: c, ...baseInput, perUserUsedCount: 0 }).ok).toBe(true);
    expect(validateCoupon({ coupon: c, ...baseInput, perUserUsedCount: 1 }).ok).toBe(false);
  });

  it('enforces the minimum-order floor inclusively', () => {
    const c = coupon({ min_order: 2500 });
    expect(validateCoupon({ coupon: c, cartItems: [item()], subtotal: 2499 }).ok).toBe(false);
    expect(validateCoupon({ coupon: c, cartItems: [item()], subtotal: 2500 }).ok).toBe(true);
  });

  it('enforces the maximum-order ceiling inclusively', () => {
    const c = coupon({ max_order: 5000 });
    expect(validateCoupon({ coupon: c, cartItems: [item()], subtotal: 5000 }).ok).toBe(true);
    expect(validateCoupon({ coupon: c, cartItems: [item()], subtotal: 5001 }).ok).toBe(false);
  });

  describe('email restrictions', () => {
    const c = coupon({ email_restrictions: ['vip@example.com', '*@yellowpink.pk'] });

    it('requires an email when restrictions exist', () => {
      expect(validateCoupon({ coupon: c, ...baseInput }).ok).toBe(false);
      expect(validateCoupon({ coupon: c, ...baseInput, email: '' }).ok).toBe(false);
    });

    it('matches exact entries case-insensitively', () => {
      expect(validateCoupon({ coupon: c, ...baseInput, email: 'VIP@Example.com' }).ok).toBe(true);
      expect(validateCoupon({ coupon: c, ...baseInput, email: 'other@example.com' }).ok).toBe(false);
    });

    it('matches *@domain wildcards', () => {
      expect(validateCoupon({ coupon: c, ...baseInput, email: 'staff@yellowpink.pk' }).ok).toBe(true);
      expect(validateCoupon({ coupon: c, ...baseInput, email: 'staff@notyellowpink.com' }).ok).toBe(false);
    });
  });

  describe('product allowlist / denylist', () => {
    it('requires at least one cart item on the allowlist', () => {
      const c = coupon({ product_ids: ['p-9'] });
      expect(validateCoupon({ coupon: c, ...baseInput }).ok).toBe(false);
      expect(validateCoupon({
        coupon: c,
        cartItems: [item(), item({ id: 'p-9' })],
        subtotal: 2000,
      }).ok).toBe(true);
    });

    it('rejects only when EVERY cart item is excluded', () => {
      const c = coupon({ excluded_product_ids: ['p-1'] });
      expect(validateCoupon({ coupon: c, ...baseInput }).ok).toBe(false);
      expect(validateCoupon({
        coupon: c,
        cartItems: [item(), item({ id: 'p-2' })],
        subtotal: 2000,
      }).ok).toBe(true);
    });

    it('rejects when the only allowlisted line is a sale item and sale items are excluded', () => {
      const c = coupon({ product_ids: ['p-1'], exclude_sale_items: true });
      const saleLine = item({ id: 'p-1', price: 800, original_price: 1000 });
      expect(validateCoupon({ coupon: c, cartItems: [saleLine], subtotal: 800 }).ok).toBe(false);
    });
  });
});

// The discount maths mirrored line-for-line by place_order's SQL — a change
// here without the matching migration (or vice versa) makes the RPC's drift
// check reject honest checkouts.
describe('computeCouponDiscount', () => {
  it('unscoped percent discounts the whole subtotal', () => {
    const items = [item({ price: 1000 }), item({ id: 'p-2', price: 500 })];
    expect(computeCouponDiscount(coupon({ value: 10 }), items)).toBe(150);
  });

  it('product-scoped percent discounts only the qualifying lines', () => {
    // The pre-13-Aug bug: this coupon discounted the whole 3,000 cart (300)
    // instead of the single 1,000 qualifying line (100).
    const c = coupon({ value: 10, product_ids: ['p-1'] });
    const items = [item({ id: 'p-1', price: 1000 }), item({ id: 'p-2', price: 2000 })];
    expect(computeCouponDiscount(c, items)).toBe(100);
  });

  it('excluded products drop out of the discount base', () => {
    const c = coupon({ value: 50, excluded_product_ids: ['p-2'] });
    const items = [item({ id: 'p-1', price: 1000 }), item({ id: 'p-2', price: 2000 })];
    expect(computeCouponDiscount(c, items)).toBe(500);
  });

  it('exclude_sale_items removes discounted lines from the base', () => {
    const c = coupon({ value: 10, exclude_sale_items: true });
    const items = [
      item({ id: 'p-1', price: 800, original_price: 1000 }), // on sale
      item({ id: 'p-2', price: 1000 }),                      // full price
    ];
    expect(computeCouponDiscount(c, items)).toBe(100);
    expect(couponEligibleSubtotal(c, items)).toBe(1000);
  });

  it('fixed amount is capped at the eligible lines', () => {
    const c = coupon({ type: 'fixed', value: 500, product_ids: ['p-1'] });
    const items = [item({ id: 'p-1', price: 300 }), item({ id: 'p-2', price: 5000 })];
    expect(computeCouponDiscount(c, items)).toBe(300);
  });

  it('quantities multiply into the eligible base', () => {
    const c = coupon({ value: 10, product_ids: ['p-1'] });
    const items = [item({ id: 'p-1', price: 250, qty: 4 }), item({ id: 'p-2', price: 9999 })];
    expect(computeCouponDiscount(c, items)).toBe(100);
  });

  it('free-shipping-only coupons discount nothing', () => {
    const c = coupon({ type: 'fixed', value: 0, free_shipping: true, discount_type: 'free_shipping' });
    expect(computeCouponDiscount(c, [item()])).toBe(0);
  });
});

// Buy X get Y (migration 1130) — mirrors the SQL in
// supabase/migrations/20260814_1130_bxgy_discounts.sql; any drift here makes
// place_order's recomputation reject honest orders.
describe('computeBxgyDiscount', () => {
  const bxgy = (overrides: Partial<NonNullable<Coupon['bxgy']>> = {}): Coupon =>
    coupon({
      type: 'percent', value: 0,
      bxgy: {
        buy_product_ids: ['p-1'], buy_qty: 2,
        get_product_ids: ['p-1'], get_qty: 1,
        pct_off: 100, max_per_order: 1,
        ...overrides,
      },
    });

  it('overlapping pools: buy 2 get 1 free needs 3 units (every 3rd free)', () => {
    const c = bxgy();
    expect(computeBxgyDiscount(c, [item({ qty: 2 })])).toBe(0);
    expect(computeBxgyDiscount(c, [item({ qty: 3 })])).toBe(1000);
    // Second application blocked by max_per_order = 1.
    expect(computeBxgyDiscount(c, [item({ qty: 6 })])).toBe(1000);
    expect(computeBxgyDiscount(bxgy({ max_per_order: 2 }), [item({ qty: 6 })])).toBe(2000);
  });

  it('disjoint pools: buy units alone trigger, cheapest get units discounted', () => {
    const c = bxgy({ buy_product_ids: ['p-1'], get_product_ids: ['p-2'], buy_qty: 2 });
    const items = [item({ qty: 2 }), item({ id: 'p-2', price: 400, qty: 2 })];
    // One application, cheapest single p-2 unit free.
    expect(computeBxgyDiscount(c, items)).toBe(400);
    // No get-pool line in the cart: not applicable.
    expect(computeBxgyDiscount(c, [item({ qty: 2 })])).toBe(0);
  });

  it('discounts the CHEAPEST qualifying units across lines', () => {
    const c = bxgy({
      buy_product_ids: ['p-1'], get_product_ids: ['p-2', 'p-3'],
      buy_qty: 1, get_qty: 2, max_per_order: 1,
    });
    const items = [
      item({ qty: 1 }),
      item({ id: 'p-2', price: 900 }),
      item({ id: 'p-3', price: 300, qty: 2 }),
    ];
    // Two cheapest units are the 300s, not the 900.
    expect(computeBxgyDiscount(c, items)).toBe(600);
  });

  it('pct_off takes a percentage off the get units and rounds like Postgres', () => {
    const c = bxgy({ pct_off: 50 });
    expect(computeBxgyDiscount(c, [item({ qty: 3, price: 999 })])).toBe(Math.round(999 * 50 / 100));
  });

  it('computeCouponDiscount routes a bxgy coupon through the bxgy maths', () => {
    // value/type say "0%", the config says buy-2-get-1-free: config wins.
    expect(computeCouponDiscount(bxgy(), [item({ qty: 3 })])).toBe(1000);
  });

  it('validateCoupon explains a short buy pool and a missing get pool', () => {
    const c = bxgy();
    const short = validateCoupon({ coupon: c, cartItems: [item({ qty: 2 })], subtotal: 2000 });
    expect(short).toEqual({ ok: false, error: 'Add 1 more qualifying item to use this offer.' });
    const disjoint = bxgy({ buy_product_ids: ['p-1'], get_product_ids: ['p-2'] });
    const missingGet = validateCoupon({ coupon: disjoint, cartItems: [item({ qty: 2 })], subtotal: 2000 });
    expect(missingGet).toEqual({ ok: false, error: "This offer's discounted items are not in your cart." });
    expect(validateCoupon({ coupon: c, cartItems: [item({ qty: 3 })], subtotal: 3000 }).ok).toBe(true);
  });
});
