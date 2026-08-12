import { describe, expect, it } from 'vitest';
import { isSellable, purchasableCap, stockIsEnforced } from './sellable';

// The owner's rule: a live listing is never shown sold out, because if we do
// not hold it we will source it. The count stays honest; only the SELLING gate
// relaxes. These pin both halves so a future edit cannot quietly reintroduce
// dead listings or, worse, start refusing orders.

const own       = { track_inventory: true,  continue_selling_when_out: false };
const backorder = { track_inventory: true,  continue_selling_when_out: true };
const external  = { track_inventory: false, continue_selling_when_out: false };

describe('stockIsEnforced', () => {
  it('enforces only for stock we hold and have opted into selling out', () => {
    expect(stockIsEnforced({ ...own, stock: 3 })).toBe(true);
    expect(stockIsEnforced({ ...backorder, stock: 3 })).toBe(false);
    expect(stockIsEnforced({ ...external, stock: 0 })).toBe(false);
  });

  // The column defaults to true and older callers select rows without it.
  // Absent must read as "keep selling", never as "sold out".
  it('treats a missing flag as keep-selling', () => {
    expect(stockIsEnforced({ track_inventory: true, stock: 0 })).toBe(false);
    expect(stockIsEnforced({ stock: 0 })).toBe(false);
  });
});

describe('isSellable', () => {
  it('keeps a backordered product buyable at zero', () => {
    expect(isSellable({ ...backorder, stock: 0 })).toBe(true);
  });

  it('keeps an externally held product buyable at zero', () => {
    expect(isSellable({ ...external, stock: 0 })).toBe(true);
  });

  it('still refuses a genuine sell-out when the owner asked for it', () => {
    expect(isSellable({ ...own, stock: 0 })).toBe(false);
    expect(isSellable({ ...own, stock: 1 })).toBe(true);
  });

  it('prefers the caller-supplied count, so a shade decides its own fate', () => {
    // Parent reads 0, the chosen shade has 4 — the shade wins.
    expect(isSellable({ ...own, stock: 0 }, 4)).toBe(true);
    // Parent reads 50, this shade is empty — still refused.
    expect(isSellable({ ...own, stock: 50 }, 0)).toBe(false);
  });
});

describe('purchasableCap', () => {
  it('is unbounded when the count is not enforced', () => {
    expect(purchasableCap({ ...backorder, stock: 0 })).toBe(Infinity);
    expect(purchasableCap({ ...external, stock: 2 })).toBe(Infinity);
  });

  it('caps at the count for a genuine sell-out product', () => {
    expect(purchasableCap({ ...own, stock: 3 })).toBe(3);
  });

  it('never returns a negative cap', () => {
    expect(purchasableCap({ ...own, stock: -5 })).toBe(0);
  });

  it('uses the shade count when given one', () => {
    expect(purchasableCap({ ...own, stock: 99 }, 2)).toBe(2);
  });
});
