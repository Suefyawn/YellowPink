import { describe, it, expect } from 'vitest';
import {
  bundleEconomics,
  buildVendorBundleExplainer,
  componentUnitCost,
  type BundleComponentRow,
} from './bundle-pricing';
import type { Product } from '@/types';

const P = (over: Partial<Product>): Product => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'X',
  slug: 'x',
  price: 100,
  ...over,
} as Product);

const row = (over: Partial<Product>, qty = 1): BundleComponentRow => ({ product: P(over), qty });

describe('componentUnitCost', () => {
  it('prefers cost_price, falls back to vendor_cost, null when neither', () => {
    expect(componentUnitCost(P({ cost_price: 80, vendor_cost: 70 }))).toEqual({ cost: 80, source: 'explicit' });
    expect(componentUnitCost(P({ vendor_cost: 70 }))).toEqual({ cost: 70, source: 'explicit' });
    expect(componentUnitCost(P({}))).toEqual({ cost: null, source: null });
    expect(componentUnitCost(P({ cost_price: 0 }))).toEqual({ cost: null, source: null });
  });

  it('derives cost from vendor commission when no explicit cost', () => {
    const p = P({ price: 1000, vendor_id: 'v1' });
    expect(componentUnitCost(p, { v1: 35 })).toEqual({ cost: 650, source: 'commission' });
  });

  it('explicit cost overrides commission derivation', () => {
    const p = P({ price: 1000, vendor_id: 'v1', cost_price: 700 });
    expect(componentUnitCost(p, { v1: 35 })).toEqual({ cost: 700, source: 'explicit' });
  });

  it('does not derive without a matching vendor or with a nonsense pct', () => {
    expect(componentUnitCost(P({ price: 1000, vendor_id: 'v2' }), { v1: 35 })).toEqual({ cost: null, source: null });
    expect(componentUnitCost(P({ price: 1000 }), { v1: 35 })).toEqual({ cost: null, source: null });
    expect(componentUnitCost(P({ price: 1000, vendor_id: 'v1' }), { v1: 0 })).toEqual({ cost: null, source: null });
    expect(componentUnitCost(P({ price: 1000, vendor_id: 'v1' }), { v1: 100 })).toEqual({ cost: null, source: null });
  });
});

describe('bundleEconomics', () => {
  it('computes saving against the sum of individual retail prices × qty', () => {
    const eco = bundleEconomics(1500, [
      row({ price: 1000, cost_price: 600 }),
      row({ price: 500, cost_price: 300 }, 2),
    ]);
    expect(eco.individualTotal).toBe(2000);
    expect(eco.saving).toBe(500);
    expect(eco.savingPct).toBe(25);
  });

  it('computes margin only when every component has a cost', () => {
    const eco = bundleEconomics(1500, [
      row({ price: 1000, cost_price: 600 }),
      row({ price: 500, cost_price: 300 }, 2),
    ]);
    expect(eco.costTotal).toBe(1200);
    expect(eco.margin).toBe(300);
    expect(eco.marginPct).toBe(20);
    expect(eco.missingCosts).toEqual([]);
    expect(eco.derivedCosts).toEqual([]);
  });

  it('reports unverifiable (nulls + names) when any cost is missing', () => {
    const eco = bundleEconomics(1500, [
      row({ name: 'Femeez Tablets', price: 1000, cost_price: 600 }),
      row({ name: 'Citowit Syrup', price: 500 }),
    ]);
    expect(eco.costTotal).toBeNull();
    expect(eco.margin).toBeNull();
    expect(eco.marginPct).toBeNull();
    expect(eco.missingCosts).toEqual(['Citowit Syrup']);
  });

  it('derives missing costs from vendor commission and labels them', () => {
    const eco = bundleEconomics(3379, [
      row({ name: 'Femeez', price: 1000, vendor_id: 'nb' }),
      row({ name: 'Citowit', price: 3135, vendor_id: 'nb' }),
    ], { nb: 35 });
    // cost = 0.65 × 4135 = 2687.75 → margin 691.25 (20.5%)
    expect(eco.missingCosts).toEqual([]);
    expect(eco.derivedCosts).toEqual(['Femeez', 'Citowit']);
    expect(eco.costTotal).toBeCloseTo(2687.75);
    expect(eco.margin).toBeCloseTo(691.25);
  });

  it('mixes explicit and derived costs, labeling only the derived ones', () => {
    const eco = bundleEconomics(1500, [
      row({ name: 'Explicit', price: 1000, cost_price: 600, vendor_id: 'nb' }),
      row({ name: 'Derived', price: 1000, vendor_id: 'nb' }),
    ], { nb: 35 });
    expect(eco.derivedCosts).toEqual(['Derived']);
    expect(eco.costTotal).toBeCloseTo(1250);
  });

  it('shows a negative saving when the set costs more than buying separately', () => {
    const eco = bundleEconomics(2500, [row({ price: 1000 }), row({ price: 1200 })]);
    expect(eco.saving).toBe(-300);
  });

  it('handles an empty component list without dividing by zero', () => {
    const eco = bundleEconomics(1000, []);
    expect(eco.individualTotal).toBe(0);
    expect(eco.savingPct).toBe(0);
    expect(eco.costTotal).toBe(0);
    expect(eco.margin).toBe(1000);
  });
});

describe('buildVendorBundleExplainer', () => {
  it('names the set, its price, every component with qty, and the key clarifications', () => {
    const msg = buildVendorBundleExplainer({
      bundleName: 'Women’s Wellness Combo',
      bundlePrice: 4999.4,
      components: [
        row({ name: 'Femeez Tablets' }),
        row({ name: 'Citowit Syrup' }, 2),
      ],
    });
    expect(msg).toContain('"Women’s Wellness Combo"');
    expect(msg).toContain('PKR 4,999');
    expect(msg).toContain('1× Femeez Tablets');
    expect(msg).toContain('2× Citowit Syrup');
    // The three clarifications that make the arrangement unambiguous:
    expect(msg).toContain('Set ka discount hamari taraf se hai');
    expect(msg).toContain('billing har item ke maujooda vendor rate par hi hogi');
    expect(msg).toContain('har product alag se likh kar bhejenge');
  });
});
