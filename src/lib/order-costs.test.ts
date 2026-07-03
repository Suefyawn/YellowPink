import { describe, it, expect } from 'vitest';
import { resolveOrderCosts, type CostItem, type CostProductInfo } from './order-costs';

const nbSons = { id: 'v1', name: 'NB Sons Distributors', commission_pct: 12.5 };

const products = (entries: Record<string, CostProductInfo>) =>
  new Map(Object.entries(entries));

describe('resolveOrderCosts', () => {
  it('uses the vendor commission % when the vendor is set and the product has no fixed cost', () => {
    const items: CostItem[] = [{ id: 'p1', name: 'Serum', qty: 2, price: 1000 }];
    const r = resolveOrderCosts(items, nbSons, products({ p1: {} }));
    // 1000 × (1 − 0.125) = 875/unit → 1750 for 2
    expect(r.totalCost).toBe(1750);
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0]).toMatchObject({ id: 'p1', qty: 2, unitCost: 875, basis: 'commission' });
    expect(r.unknownCount).toBe(0);
    expect(r.basisLabel).toBe('NB Sons Distributors @ 12.5% margin');
  });

  it('prefers the product\'s fixed vendor_cost over the commission %', () => {
    const items: CostItem[] = [{ id: 'p1', name: 'Serum', qty: 2, price: 1000 }];
    const r = resolveOrderCosts(items, nbSons, products({ p1: { vendor_cost: 800 } }));
    expect(r.totalCost).toBe(1600);
    expect(r.lines[0].basis).toBe('vendor_cost');
    expect(r.basisLabel).toBe('per-product costs');
  });

  it('falls back to the product cost_price when there is no vendor / no commission', () => {
    const items: CostItem[] = [{ id: 'p1', qty: 3, price: 500 }];
    const r = resolveOrderCosts(items, null, products({ p1: { cost_price: 320 } }));
    expect(r.totalCost).toBe(960);
    expect(r.lines[0].basis).toBe('cost_price');
    expect(r.basisLabel).toBe('per-product costs');
  });

  it('vendor with a NULL commission % still uses per-product costs, else unknown', () => {
    const items: CostItem[] = [
      { id: 'p1', qty: 1, price: 500 },
      { id: 'p2', qty: 1, price: 700 },
    ];
    const r = resolveOrderCosts(
      items,
      { id: 'v2', name: 'No-Rate Vendor', commission_pct: null },
      products({ p1: { cost_price: 300 } }),
    );
    expect(r.lines[0].basis).toBe('cost_price');
    expect(r.lines[1].basis).toBe('unknown');
    expect(r.totalCost).toBe(300);
    expect(r.unknownCount).toBe(1);
  });

  it('costs unknown lines at 0 and counts them', () => {
    const items: CostItem[] = [{ id: 'p1', qty: 4, price: 250 }];
    const r = resolveOrderCosts(items, null, products({ p1: {} }));
    expect(r.totalCost).toBe(0);
    expect(r.unknownCount).toBe(1);
    expect(r.lines[0].basis).toBe('unknown');
    expect(r.basisLabel).toBe('unknown');
  });

  it('handles a mixed cart: fixed vendor_cost + commission + labelled as mixed', () => {
    const items: CostItem[] = [
      { id: 'fixed', name: 'Fixed', qty: 1, price: 1000 },
      { id: 'pct', name: 'Pct', qty: 2, price: 400 },
    ];
    const r = resolveOrderCosts(items, nbSons, products({ fixed: { vendor_cost: 700 }, pct: {} }));
    // 700 + 2 × 400×0.875 (= 350) = 1400
    expect(r.totalCost).toBe(1400);
    expect(r.lines[0].basis).toBe('vendor_cost');
    expect(r.lines[1].basis).toBe('commission');
    expect(r.basisLabel).toBe('NB Sons Distributors @ 12.5% margin + per-product costs');
  });

  it('items missing from productsById still cost via the vendor commission', () => {
    const items: CostItem[] = [{ id: 'ghost', qty: 1, price: 200 }];
    const r = resolveOrderCosts(items, nbSons, new Map());
    expect(r.totalCost).toBe(175);
    expect(r.lines[0].basis).toBe('commission');
  });

  it('rounds money to 2 dp (per line and total)', () => {
    // 999 × (1 − 1/3×100...) — use 33.33%: 999 × 0.6667 = 666.0333 → 666.03
    const items: CostItem[] = [{ id: 'p1', qty: 3, price: 999 }];
    const r = resolveOrderCosts(items, { id: 'v', name: 'V', commission_pct: 33.33 }, new Map());
    expect(r.lines[0].unitCost).toBe(666.03);
    expect(r.totalCost).toBe(1998.09);
  });

  it('empty carts and defensive inputs (qty/price missing or negative)', () => {
    expect(resolveOrderCosts([], nbSons, new Map()).totalCost).toBe(0);
    const r = resolveOrderCosts(
      [{ id: 'p1', qty: -2, price: -100 }, { id: 'p2' }],
      nbSons,
      new Map(),
    );
    expect(r.totalCost).toBe(0);
    // Negative/absent qty and price clamp to 0 but the basis is still the
    // vendor commission (a rate exists, the line just costs nothing).
    expect(r.lines.every(l => l.basis === 'commission')).toBe(true);
  });

  it('formats whole-number commission percentages without trailing zeros', () => {
    const r = resolveOrderCosts(
      [{ id: 'p1', qty: 1, price: 100 }],
      { id: 'v', name: 'Rivaj', commission_pct: 18.0 },
      new Map(),
    );
    expect(r.basisLabel).toBe('Rivaj @ 18% margin');
    expect(r.totalCost).toBe(82);
  });
});
