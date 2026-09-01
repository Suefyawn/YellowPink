import { describe, it, expect } from 'vitest';
import { composeHomepageRails, capPerBrand, type RailInputs } from './merchandising';
import type { Product } from '@/types';

// Minimal product stubs: only the fields the composer reads.
let seq = 0;
const prod = (over: Partial<Product> = {}): Product => ({
  id: `p-${++seq}`,
  name: `Product ${seq}`,
  slug: `product-${seq}`,
  brand: 'BrandA',
  price: 1000,
  popularity_score: 1,
  trend_score: 0,
  created_at: '2026-08-01T00:00:00Z',
  ...over,
} as unknown as Product);

const inputs = (over: Partial<RailInputs> = {}): RailInputs => ({
  featuredPool: [],
  sellersPool: [],
  trendingPool: [],
  salePool: [],
  newInPool: [],
  kBeautyPool: [],
  wellnessPool: [],
  saleActive: false,
  ...over,
});

describe('composeHomepageRails — Featured fill-up toggle', () => {
  const flagged = [prod({ is_featured: true } as Partial<Product>)];
  const trendingPool = [
    prod({ trend_score: 10, popularity_score: 9 } as Partial<Product>),
    prod({ trend_score: 8, popularity_score: 8 } as Partial<Product>),
    prod({ trend_score: 6, popularity_score: 7 } as Partial<Product>),
    prod({ trend_score: 5, popularity_score: 6 } as Partial<Product>),
  ];

  it('tops the row up from trending by default (fill-up on)', () => {
    const rails = composeHomepageRails(inputs({ featuredPool: flagged, trendingPool }));
    expect(rails.featured.length).toBe(4);
    expect(rails.featured.filter(t => t.reason.startsWith('Fill-up')).length).toBe(3);
  });

  it('featuredFillup=false shows only flagged products, even when short', () => {
    const rails = composeHomepageRails(inputs({ featuredPool: flagged, trendingPool, featuredFillup: false }));
    expect(rails.featured.length).toBe(1);
    expect(rails.featured[0].product.id).toBe(flagged[0].id);
    // The trending products stay available to their own rail instead.
    expect(rails.trending.length).toBeGreaterThan(0);
  });

  it('fill-up never runs when 4+ products are flagged, regardless of the toggle', () => {
    const four = [1, 2, 3, 4].map(() => prod({ is_featured: true } as Partial<Product>));
    const rails = composeHomepageRails(inputs({ featuredPool: four, trendingPool }));
    expect(rails.featured.every(t => !t.reason.startsWith('Fill-up'))).toBe(true);
  });
});

describe('capPerBrand', () => {
  it('caps each brand while preserving order', () => {
    const pool = [
      prod({ brand: 'A' } as Partial<Product>), prod({ brand: 'A' } as Partial<Product>),
      prod({ brand: 'A' } as Partial<Product>), prod({ brand: 'B' } as Partial<Product>),
    ];
    const out = capPerBrand(pool, 2);
    expect(out.length).toBe(3);
    expect(out.filter(p => p.brand === 'A').length).toBe(2);
  });
});
