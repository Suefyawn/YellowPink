import { describe, it, expect } from 'vitest';
import { brandsFromProducts, productsForBrandSlug, brandSlug } from './brands';

describe('brandSlug', () => {
  it('lowercases, trims and hyphenates', () => {
    expect(brandSlug('  La Roche-Posay ')).toBe('la-roche-posay');
    expect(brandSlug('Beauty of Joseon')).toBe('beauty-of-joseon');
  });

  it('maps casing variants of one brand to the same slug', () => {
    expect(brandSlug('PIXI')).toBe(brandSlug('Pixi'));
  });
});

// Regression: the catalogue carried one brand under two spellings ("PIXI" on 7
// products, "Pixi" on 3). That split /brands into two entries pointing at the
// same URL, emitted /brand/pixi twice in sitemap.xml, and — worst of the three
// — hid 3 products from the PIXI brand page, which filtered on an exact string.
describe('brand identity is keyed on slug, not raw spelling', () => {
  const catalogue = [
    { brand: 'PIXI' }, { brand: 'PIXI' }, { brand: 'PIXI' },
    { brand: 'Pixi' }, { brand: 'Pixi' },
    { brand: 'CeraVe' },
    { brand: null },
  ];

  it('collapses casing variants into one brand entry', () => {
    const brands = brandsFromProducts(catalogue);
    expect(brands.filter(b => b.slug === 'pixi')).toHaveLength(1);
  });

  it('counts every spelling against the single entry', () => {
    const pixi = brandsFromProducts(catalogue).find(b => b.slug === 'pixi');
    expect(pixi?.count).toBe(5);
  });

  it('labels the group with the most-used spelling', () => {
    const pixi = brandsFromProducts(catalogue).find(b => b.slug === 'pixi');
    expect(pixi?.name).toBe('PIXI');
  });

  it('yields one sitemap URL per brand', () => {
    const slugs = brandsFromProducts(catalogue).map(b => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('returns products under every spelling for a brand page', () => {
    expect(productsForBrandSlug('pixi', catalogue)).toHaveLength(5);
    expect(productsForBrandSlug('cerave', catalogue)).toHaveLength(1);
  });

  it('ignores products with no brand', () => {
    expect(brandsFromProducts(catalogue).some(b => !b.slug)).toBe(false);
  });
});
