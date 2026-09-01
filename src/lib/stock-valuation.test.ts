import { describe, it, expect } from 'vitest';
import { computeStockValuation, type ValuationProduct, type ValuationVariant } from './stock-valuation';

const P = (over: Partial<ValuationProduct>): ValuationProduct => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  kind: 'simple', track_inventory: true, stock: 0, price: 1000, cost_price: null, ...over,
});

describe('computeStockValuation', () => {
  it('values tracked simple stock at cost and retail', () => {
    const v = computeStockValuation([P({ stock: 5, price: 1000, cost_price: 400 })], []);
    expect(v).toMatchObject({ units: 5, atCost: 2000, atRetail: 5000, unitsMissingCost: 0 });
  });

  it('excludes external/dropship listings entirely', () => {
    const v = computeStockValuation([P({ stock: 50, track_inventory: false })], []);
    expect(v.units).toBe(0);
    expect(v.atRetail).toBe(0);
  });

  it('uses variant stock (not the parent aggregate) for variable products', () => {
    const parent = P({ id: 'var-1', kind: 'variable', stock: 99, price: 3999, cost_price: 1100 });
    const variants: ValuationVariant[] = [
      { product_id: 'var-1', stock: 2, price: null, enabled: true },
      { product_id: 'var-1', stock: 1, price: 4500, enabled: true },
      { product_id: 'var-1', stock: 7, price: 4500, enabled: false }, // disabled shade
    ];
    const v = computeStockValuation([parent], variants);
    expect(v.units).toBe(3);
    expect(v.atRetail).toBe(2 * 3999 + 4500);
    expect(v.atCost).toBe(3 * 1100);
  });

  it('counts missing-cost stock in retail but flags it', () => {
    const v = computeStockValuation([P({ stock: 4, price: 500, cost_price: null })], []);
    expect(v.atRetail).toBe(2000);
    expect(v.atCost).toBe(0);
    expect(v.unitsMissingCost).toBe(4);
    expect(v.productsMissingCost).toBe(1);
  });

  it('ignores negative stock counters', () => {
    const v = computeStockValuation([P({ stock: -3, cost_price: 100 })], []);
    expect(v.units).toBe(0);
  });
});
