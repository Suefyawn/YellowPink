import { describe, it, expect } from 'vitest';
import { resolveCollectionProducts, type Collection } from './collections';
import type { Product } from '@/types';

// The three hair collections added on 15 Sep, checked against the real rule
// JSON and the real tag membership as they were written to the database, run
// through the actual resolver the storefront uses.
//
// The point is not to test resolveCollectionProducts, which has its own tests.
// It is to catch the failure these pages are actually exposed to: a smart
// collection whose rules no longer select what its copy promises. The page
// keeps rendering, the SEO description keeps claiming "four shampoos and three
// matching conditioners", and the grid quietly empties out.

const RULES = {
  'shampoo-conditioner': { match: 'any', conditions: [{ field: 'tag', op: 'in', value: ['shampoo', 'conditioner'] }] },
  'anti-dandruff':       { match: 'any', conditions: [{ field: 'tag', op: 'in', value: ['anti-dandruff'] }] },
  'hair-growth':         { match: 'any', conditions: [{ field: 'tag', op: 'in', value: ['hair-growth'] }] },
} as const;

// slug → tags, exactly as 20260915_2000_hair_care_merchandising.sql inserts them.
const TAGGING: Record<string, string[]> = {
  'cerave-anti-dandruff-hydrating-shampoo':        ['shampoo', 'anti-dandruff'],
  'cerave-anti-dandruff-hydrating-conditioner':    ['conditioner', 'anti-dandruff'],
  'la-roche-posay-kerium-ds-anti-dandruff-shampoo':['shampoo', 'anti-dandruff'],
  'ogx-argan-oil-of-morocco-shampoo':              ['shampoo'],
  'ogx-argan-oil-of-morocco-conditioner':          ['conditioner'],
  'ogx-biotin-collagen-shampoo':                   ['shampoo', 'hair-growth'],
  'ogx-biotin-collagen-conditioner':               ['conditioner', 'hair-growth'],
  'minoxidil':                                     ['hair-growth'],
  'the-ordinary-multi-peptide-hair-density-serum': ['hair-growth'],
  'rosemary-oil':                                  ['hair-growth'],
  'castor-oil':                                    ['hair-growth'],
  'hair-growth-oil':                               ['hair-growth'],
  // Published Hair Care products carrying none of the four tags. They belong
  // to /collection/hair-care and must not leak into the narrower pages.
  'argan-oil-of-morocco-hair-mask':                [],
  'olaplex-no-3-hair-perfector':                   [],
};

const CATALOGUE: Product[] = Object.keys(TAGGING).map((slug, i) => ({
  id: `id-${i}`, slug, name: slug, brand: null, category: 'Hair Care',
  price: 1000 + i, status: 'published',
} as unknown as Product));

const TAG_MAP = Object.fromEntries(
  CATALOGUE.map(p => [p.id, TAGGING[p.slug] ?? []]),
);

function resolve(key: keyof typeof RULES): string[] {
  const collection = { type: 'smart', rules: RULES[key] } as unknown as Pick<Collection, 'type' | 'rules'>;
  return resolveCollectionProducts(collection, CATALOGUE, { productTagMap: TAG_MAP }).map(p => p.slug);
}

describe('the hair collections resolve to what their copy promises', () => {
  it('Shampoo & Conditioner holds four shampoos and three conditioners', () => {
    const got = resolve('shampoo-conditioner');
    expect(got).toHaveLength(7);
    expect(got.filter(s => s.includes('shampoo'))).toHaveLength(4);
    expect(got.filter(s => s.includes('conditioner'))).toHaveLength(3);
  });

  it('Anti-Dandruff holds the CeraVe pair and Kerium DS, and nothing else', () => {
    expect(resolve('anti-dandruff').sort()).toEqual([
      'cerave-anti-dandruff-hydrating-conditioner',
      'cerave-anti-dandruff-hydrating-shampoo',
      'la-roche-posay-kerium-ds-anti-dandruff-shampoo',
    ]);
  });

  it('Hair Growth holds seven, including the biotin pair it shares with shampoo', () => {
    const got = resolve('hair-growth');
    expect(got).toHaveLength(7);
    expect(got).toContain('minoxidil');
    expect(got).toContain('the-ordinary-multi-peptide-hair-density-serum');
    // Deliberate overlap: "biotin shampoo" is its own search, 2,400/mo.
    expect(got).toContain('ogx-biotin-collagen-shampoo');
    expect(got).toContain('ogx-biotin-collagen-conditioner');
  });

  it('never shows an empty grid under a page that promises products', () => {
    // The specific way a smart collection fails: a renamed tag or a retagged
    // product leaves the rules matching nothing, and the page still ships.
    for (const key of Object.keys(RULES) as (keyof typeof RULES)[]) {
      expect(resolve(key).length, `${key} resolves to an empty grid`).toBeGreaterThan(0);
    }
  });

  it('keeps the untagged hair products out of the narrow collections', () => {
    // Olaplex and the argan hair mask are neither shampoo, conditioner,
    // anti-dandruff nor a growth treatment. They live on /collection/hair-care.
    for (const key of Object.keys(RULES) as (keyof typeof RULES)[]) {
      expect(resolve(key)).not.toContain('olaplex-no-3-hair-perfector');
      expect(resolve(key)).not.toContain('argan-oil-of-morocco-hair-mask');
    }
  });
});
