import { describe, expect, it } from 'vitest';
import { canonicalSlug, cleanSlug, rankCandidates, slugToQuery, slugTokens, tokenScore } from './near-match';

describe('canonicalSlug, the only thing we auto-redirect on', () => {
  it('strips WordPress duplicate suffixes', () => {
    expect(canonicalSlug('clean-shield-duo-copy')).toBe('clean-shield-duo');
    expect(canonicalSlug('glow-bundle-copy-1')).toBe('glow-bundle');
    expect(canonicalSlug('winter-kit-old')).toBe('winter-kit');
    expect(canonicalSlug('daily-duo-duplicate')).toBe('daily-duo');
  });

  it('normalises case and encoding', () => {
    expect(canonicalSlug('CeraVe-Hydrating-Cleanser')).toBe('cerave-hydrating-cleanser');
    expect(canonicalSlug('rose%20water-toner')).toBe('rose-water-toner');
  });

  it('returns null for a slug that is already canonical', () => {
    expect(canonicalSlug('cerave-hydrating-cleanser')).toBeNull();
    expect(canonicalSlug('beauty-cream')).toBeNull();
  });

  // The redirect fires automatically, so a wrong guess silently sells the wrong
  // item. A bare trailing number is never treated as junk: "-30" is the SPF and
  // "-7" is the brand, and both have real neighbours we could land on.
  it('never strips a bare trailing number', () => {
    expect(canonicalSlug('sun-block-spf-30')).toBeNull();
    expect(canonicalSlug('no-7')).toBeNull();
    expect(canonicalSlug('2')).toBeNull();
    // The WordPress "-1" duplicate is given up along with it, on purpose.
    expect(canonicalSlug('cerave-hydrating-cleanser-1')).toBeNull();
  });

  it('never strips a slug down to nothing', () => {
    expect(canonicalSlug('copy')).toBeNull();
    expect(canonicalSlug('old')).toBeNull();
  });
});

describe('tokenScore', () => {
  it('normalises by the longer set so a short slug cannot free-ride', () => {
    // "cream" is a subset of the long slug, but sharing one token out of five
    // is not a match.
    expect(tokenScore(slugTokens('cream'), slugTokens('golden-pearl-brightening-rice-cream')))
      .toBeCloseTo(0.2, 2);
  });

  it('scores an exact token set as 1', () => {
    expect(tokenScore(slugTokens('rose-water'), slugTokens('water-rose'))).toBe(1);
  });

  it('scores disjoint sets as 0', () => {
    expect(tokenScore(slugTokens('lip-gloss'), slugTokens('hair-oil'))).toBe(0);
  });

  it('ignores stopwords, and drops a size number together with its unit', () => {
    expect(slugTokens('the-rose-water-100-ml')).toEqual(['rose', 'water']);
    expect(tokenScore(slugTokens('the-rose-water-100-ml'), slugTokens('rose-water'))).toBe(1);
  });

  it('keeps a number that IS the product identity', () => {
    expect(slugTokens('sun-block-spf-30')).toEqual(['sun', 'block', 'spf', '30']);
    expect(slugTokens('golden-pearl-24k-gold-serum')).toContain('24k');
  });
});

describe('rankCandidates, suggestions only', () => {
  const catalogue = [
    { slug: 'cerave-hydrating-facial-cleanser', haystack: 'CeraVe Hydrating Facial Cleanser' },
    { slug: 'cerave-foaming-facial-cleanser',   haystack: 'CeraVe Foaming Facial Cleanser' },
    { slug: 'hello-hair-onion-shampoo',         haystack: 'Hello Hair Onion Shampoo' },
    { slug: 'nars-light-reflecting-foundation', haystack: 'NARS Light Reflecting Foundation' },
  ];

  it('puts the closest product first', () => {
    const [top] = rankCandidates('cerave-hydrating-cleanser', catalogue);
    expect(top.item.slug).toBe('cerave-hydrating-facial-cleanser');
  });

  it('returns the sibling products too, so the shopper can choose', () => {
    const slugs = rankCandidates('cerave-cleanser', catalogue).map(r => r.item.slug);
    expect(slugs).toContain('cerave-hydrating-facial-cleanser');
    expect(slugs).toContain('cerave-foaming-facial-cleanser');
  });

  it('matches on the name when the slug shares nothing', () => {
    const [top] = rankCandidates('nars-foundation', catalogue);
    expect(top.item.slug).toBe('nars-light-reflecting-foundation');
  });

  it('returns nothing for an unrelated path rather than a page of noise', () => {
    expect(rankCandidates('wp-admin-setup-config', catalogue)).toHaveLength(0);
  });

  it('returns nothing when the slug has no usable tokens', () => {
    expect(rankCandidates('a-of-the', catalogue)).toHaveLength(0);
    expect(rankCandidates('', catalogue)).toHaveLength(0);
  });

  it('honours the limit', () => {
    expect(rankCandidates('cerave', catalogue, { limit: 1 })).toHaveLength(1);
  });
});

describe('slugToQuery', () => {
  it('turns a path segment into a search phrase', () => {
    expect(slugToQuery('golden-pearl')).toBe('golden pearl');
    expect(slugToQuery('cerave-hydrating-cleanser-100-ml')).toBe('cerave hydrating cleanser');
  });

  it('is empty when there is nothing to search for', () => {
    expect(slugToQuery('a-of-the')).toBe('');
  });
});

describe('cleanSlug', () => {
  it('survives a malformed percent escape instead of throwing', () => {
    expect(() => cleanSlug('rose-%E0%A4')).not.toThrow();
  });

  it('collapses separators and trims', () => {
    expect(cleanSlug('  Rose__Water--Toner  ')).toBe('rose-water-toner');
  });
});
