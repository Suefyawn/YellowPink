import { describe, it, expect } from 'vitest';
import { ALL_CATEGORIES, canonicalCategory, categorySlug, findTaxon } from './category-taxonomy';

describe('categorySlug', () => {
  it('collapses an apostrophe into the separator', () => {
    // Documents why the alias below has to exist at all.
    expect(categorySlug("Women's Health")).toBe('women-s-health');
    expect(categorySlug("Men's Health")).toBe('men-s-health');
  });
});

describe('canonicalCategory', () => {
  it('resolves the canonical slug', () => {
    expect(canonicalCategory('women-s-health')).toBe("Women's Health");
  });

  it('resolves the apostrophe-free slug people actually write', () => {
    // Four blog posts linked to /category/womens-health, which used to fall
    // through to shop search instead of the category (Semrush audit, 6 Sep 2026).
    expect(canonicalCategory('womens-health')).toBe("Women's Health");
    expect(canonicalCategory('mens-health')).toBe("Men's Health");
  });

  it('resolves the label itself, in any case', () => {
    expect(canonicalCategory("women's health")).toBe("Women's Health");
    expect(canonicalCategory("WOMEN'S HEALTH")).toBe("Women's Health");
  });

  it('returns null for All and for unknown values', () => {
    expect(canonicalCategory('all')).toBeNull();
    expect(canonicalCategory('')).toBeNull();
    expect(canonicalCategory(null)).toBeNull();
    expect(canonicalCategory('not-a-category')).toBeNull();
  });

  it('gives every leaf category a slug that round-trips', () => {
    for (const c of ALL_CATEGORIES) {
      expect(canonicalCategory(categorySlug(c))).toBe(c);
    }
  });

  it('never lets an alias claim another category', () => {
    // A collision would silently point one category's alias at a different
    // category's page, so assert every key resolves back to its own label.
    for (const c of ALL_CATEGORIES) {
      expect(canonicalCategory(categorySlug(c.replace(/['\u2019]/g, '')))).toBe(c);
    }
  });

  it('maps a taxon input to the taxon label, which does not live at /category', () => {
    const label = canonicalCategory('makeup');
    expect(label).not.toBeNull();
    expect(findTaxon(label!)).toBeTruthy();
  });
});
