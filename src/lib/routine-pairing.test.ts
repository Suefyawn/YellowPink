import { describe, it, expect } from 'vitest';
import { routineStepFor, routineComplements } from './routine-pairing';
import type { Product } from '@/types';

const P = (over: Partial<Product>): Product => ({
  id: over.id ?? Math.random().toString(36).slice(2),
  name: 'X',
  slug: 'x',
  price: 100,
  category: 'Cleansers & Treatments',
  status: 'published',
  stock: 10,
  ...over,
} as Product);

const CATALOG: Product[] = [
  // "Milk" deliberately matches no concern rule ("foaming" would count as an
  // acne keyword via the quiz rules, defeating the preference test below).
  P({ id: 'c1', name: 'Gentle Milk Cleanser', category: 'Cleansers & Treatments', popularity_score: 50 }),
  P({ id: 'c2', name: 'Acne Salicylic Face Wash', category: 'Cleansers & Treatments', popularity_score: 10 }),
  P({ id: 's1', name: 'Niacinamide Acne Serum', category: 'Cleansers & Treatments', popularity_score: 80 }),
  P({ id: 'm1', name: 'Ceramide Moisturizer Cream', category: 'Moisturizers', popularity_score: 40 }),
  P({ id: 'p1', name: 'UV Shield Sunscreen SPF50', category: 'Moisturizers', popularity_score: 30 }),
  P({ id: 'oos', name: 'Sold Out Toner Treatment', category: 'Cleansers & Treatments', stock: 0 }),
  P({ id: 'w1', name: 'Zinc Immunity Syrup', category: 'Immunity' }),
];

describe('routineStepFor', () => {
  it('classifies by priority order (SPF before moisturise)', () => {
    expect(routineStepFor(P({ name: 'Sun Cream Moisturizer SPF30' }))).toBe('protect');
    expect(routineStepFor(P({ name: 'Hydrating Gel Cream' }))).toBe('moisturize');
    expect(routineStepFor(P({ name: 'Vitamin C Serum' }))).toBe('treat');
    expect(routineStepFor(P({ name: 'Lipstick Set' }))).toBeNull();
  });
});

describe('routineComplements', () => {
  it('offers one product from each missing step, in routine order', () => {
    const anchor = P({ id: 'anchor', name: 'Niacinamide Acne Serum Plus', category: 'Cleansers & Treatments' });
    const picks = routineComplements(anchor, CATALOG);
    expect(picks.map(p => routineStepFor(p))).toEqual(['cleanse', 'moisturize', 'protect']);
  });

  it('prefers shared-concern products over more popular ones', () => {
    const anchor = P({ id: 'anchor', name: 'Niacinamide Acne Serum Plus' });
    const picks = routineComplements(anchor, CATALOG);
    // Acne face wash (concern match, popularity 10) beats gentle cleanser (popularity 50).
    expect(picks[0].id).toBe('c2');
  });

  it('never suggests out-of-stock or non-skincare products', () => {
    const anchor = P({ id: 'anchor', name: 'Ceramide Moisturizer' , category: 'Moisturizers' });
    const ids = routineComplements(anchor, CATALOG).map(p => p.id);
    expect(ids).not.toContain('oos');
    expect(ids).not.toContain('w1');
  });

  it('returns [] for non-skincare anchors and unclassifiable names', () => {
    expect(routineComplements(P({ name: 'Zinc Syrup', category: 'Immunity' }), CATALOG)).toEqual([]);
    expect(routineComplements(P({ name: 'Beauty Tool Kit', category: 'Cleansers & Treatments' }), CATALOG)).toEqual([]);
  });
});
