// Vendor-scoped free shipping (migration 770): the pure eligibility rule the
// checkout quote uses; place_order enforces the same rule in SQL. Motivating
// case: NB Sons free-ships above Rs 1,999 on their own store, so any NB Sons
// basket of ours between Rs 2,000 and the zone threshold was cheaper at the
// source (a real July 29 order was cancelled over exactly this).
import { describe, it, expect } from 'vitest';
import { vendorFreeShippingEligible } from './shipping';

const NB = 'vendor-nb-sons';
const OTHER = 'vendor-other';
const thresholds = new Map([[NB, 1999]]);

describe('vendorFreeShippingEligible', () => {
  it('frees shipping when one vendor’s items alone reach its threshold', () => {
    // The cancelled order: 2 × M-Sol @ 1,150 = 2,300 ≥ 1,999.
    expect(vendorFreeShippingEligible(
      [{ vendor_id: NB, price: 1150, qty: 2 }],
      thresholds,
    )).toBe(true);
  });

  it('does not free shipping below the threshold', () => {
    expect(vendorFreeShippingEligible(
      [{ vendor_id: NB, price: 1150, qty: 1 }],
      thresholds,
    )).toBe(false);
  });

  it('ignores items from vendors without a threshold', () => {
    // Rs 5,000 of make-up from another vendor must not trigger the NB rule.
    expect(vendorFreeShippingEligible(
      [
        { vendor_id: OTHER, price: 5000, qty: 1 },
        { vendor_id: NB, price: 1150, qty: 1 },
      ],
      thresholds,
    )).toBe(false);
  });

  it('sums only the eligible vendor’s lines in a mixed basket', () => {
    expect(vendorFreeShippingEligible(
      [
        { vendor_id: NB, price: 1150, qty: 1 },
        { vendor_id: NB, price: 900, qty: 1 },   // 2,050 ≥ 1,999
        { vendor_id: null, price: 300, qty: 1 },
      ],
      thresholds,
    )).toBe(true);
  });

  it('handles vendor-less items and empty thresholds safely', () => {
    expect(vendorFreeShippingEligible([{ vendor_id: null, price: 9000, qty: 1 }], thresholds)).toBe(false);
    expect(vendorFreeShippingEligible([{ vendor_id: NB, price: 9000, qty: 1 }], new Map())).toBe(false);
  });
});
