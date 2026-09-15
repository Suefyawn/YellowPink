import { describe, it, expect } from 'vitest';
import {
  checkRecoveryCoupon, stripCouponSentence, explainRejection,
  type RecoveryCoupon,
} from './recovery-coupon';

// COMEBACK15 exactly as it sits in public.coupons, read 15 Sep 2026.
const COMEBACK15: RecoveryCoupon = {
  code: 'COMEBACK15', active: true, value: '15', min_order: '1500',
  expires_at: null, starts_at: null, max_uses: null, used_count: 0,
};

const NOW = new Date('2026-09-15T09:00:00Z');

describe('checkRecoveryCoupon', () => {
  it('promises the coupon that actually exists', () => {
    const v = checkRecoveryCoupon(COMEBACK15, 6599, NOW);
    expect(v).toEqual({ code: 'COMEBACK15', reason: null, percent: 15 });
  });

  it('promises nothing when the configured code has no coupon behind it', () => {
    // The bug this file exists for: COMEBACK10 was named in two files and has
    // never existed in the table, so the lookup hands back nothing.
    expect(checkRecoveryCoupon(null, 6599, NOW)).toEqual({ code: null, reason: 'missing', percent: null });
    expect(checkRecoveryCoupon(undefined, 6599, NOW).reason).toBe('missing');
  });

  it('drops a coupon that is switched off', () => {
    expect(checkRecoveryCoupon({ ...COMEBACK15, active: false }, 6599, NOW).reason).toBe('inactive');
  });

  it('drops an expired coupon even while it is still flagged active', () => {
    // AZADI14 is live proof this happens: active = true, expired 15 Aug 2026.
    const azadi: RecoveryCoupon = {
      code: 'AZADI14', active: true, value: '14', min_order: '0',
      expires_at: '2026-08-15T19:00:00Z', starts_at: null, max_uses: null, used_count: 2,
    };
    expect(checkRecoveryCoupon(azadi, 6599, NOW).reason).toBe('expired');
  });

  it('drops a coupon whose start date has not arrived', () => {
    expect(checkRecoveryCoupon({ ...COMEBACK15, starts_at: '2026-10-01T00:00:00Z' }, 6599, NOW).reason)
      .toBe('not-started');
  });

  it('drops a coupon that has been used up', () => {
    expect(checkRecoveryCoupon({ ...COMEBACK15, max_uses: 1, used_count: 1 }, 6599, NOW).reason)
      .toBe('exhausted');
    // Not yet used up.
    expect(checkRecoveryCoupon({ ...COMEBACK15, max_uses: 2, used_count: 1 }, 6599, NOW).code)
      .toBe('COMEBACK15');
  });

  it('drops a 0% coupon rather than promising a discount of nothing', () => {
    // AUTO-KIKOB2G1 is a real row at value 0 (a Buy-X-Get-Y carrier).
    expect(checkRecoveryCoupon({ ...COMEBACK15, value: '0' }, 6599, NOW).reason).toBe('no-value');
  });

  it('drops the coupon when the cart is under its minimum order', () => {
    expect(checkRecoveryCoupon(COMEBACK15, 1200, NOW).reason).toBe('below-min');
    expect(checkRecoveryCoupon(COMEBACK15, 1500, NOW).code).toBe('COMEBACK15');
  });

  it('skips the minimum-order rule when there is no cart to judge', () => {
    // The admin queue checks the coupon once for the whole list.
    expect(checkRecoveryCoupon(COMEBACK15, undefined, NOW).code).toBe('COMEBACK15');
    expect(checkRecoveryCoupon(COMEBACK15, null, NOW).code).toBe('COMEBACK15');
  });

  it('clears all four lost carts from the 30 days to 15 Sep', () => {
    // 6,599 / 4,210 / 7,740 / 5,500 — every one above the 1,500 minimum, so
    // the real COMEBACK15 would have been promisable on all of them.
    for (const subtotal of [6599, 4210, 7740, 5500]) {
      expect(checkRecoveryCoupon(COMEBACK15, subtotal, NOW).code).toBe('COMEBACK15');
    }
  });

  it('treats a malformed value as no discount rather than NaN', () => {
    expect(checkRecoveryCoupon({ ...COMEBACK15, value: 'abc' }, 6599, NOW).reason).toBe('no-value');
    expect(checkRecoveryCoupon({ ...COMEBACK15, expires_at: 'not-a-date' }, 6599, NOW).code)
      .toBe('COMEBACK15');
  });
});

describe('stripCouponSentence', () => {
  const RENDERED =
    "Hi Sara! It's Yellow Pink 💛 You were about to order CeraVe Hydrating Cleanser (PKR 6,599) and we saved your cart for you: https://www.yellowpink.pk/cart?restore=abc " +
    'Cash on delivery is available nationwide. Use code COMEBACK15 for a discount if you order today. Reply here if anything held you back, happy to help!';

  it('removes only the sentence carrying the code', () => {
    const out = stripCouponSentence(RENDERED, 'COMEBACK15');
    expect(out).not.toContain('COMEBACK15');
    expect(out).not.toContain('Use code');
    // Everything that still matters survives.
    expect(out).toContain('we saved your cart for you');
    expect(out).toContain('https://www.yellowpink.pk/cart?restore=abc');
    expect(out).toContain('Cash on delivery is available nationwide.');
    expect(out).toContain('Reply here if anything held you back');
  });

  it('leaves a message alone when the code does not appear', () => {
    expect(stripCouponSentence(RENDERED, 'NOTHERE')).toBe(RENDERED);
  });

  it('is a no-op for an empty code', () => {
    expect(stripCouponSentence(RENDERED, '')).toBe(RENDERED);
  });

  it('does not leave double spaces behind', () => {
    expect(stripCouponSentence(RENDERED, 'COMEBACK15')).not.toMatch(/\s{2,}/);
  });

  it('handles a staff-edited template that puts the code first', () => {
    const custom = 'Use COMEBACK15 today! Your cart is saved: https://x.test/cart';
    const out = stripCouponSentence(custom, 'COMEBACK15');
    expect(out).toBe('Your cart is saved: https://x.test/cart');
  });
});

describe('explainRejection', () => {
  it('names the code and says what happens next, for every reason', () => {
    const reasons = ['missing', 'inactive', 'expired', 'not-started', 'exhausted', 'no-value', 'below-min'] as const;
    for (const r of reasons) {
      const text = explainRejection(r, 'COMEBACK15');
      expect(text.length).toBeGreaterThan(20);
      if (r !== 'missing') expect(text).toContain('COMEBACK15');
    }
  });
});
