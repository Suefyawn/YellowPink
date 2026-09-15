import { describe, it, expect } from 'vitest';
import {
  extractInternalLinks, findDeadLinks, rankDeadLinks,
  type CatalogueStatus,
} from './internal-links';

// The real shape of an article body: a picks list, a comparison table and a
// closing call to action, all naming the same product. Taken from the markup
// of /blog/best-shampoo-in-pakistan, which is where this bug was found.
const BODY = `
<div class="blog-picks"><ul>
<li><a class="blog-product-link" href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe Anti-Dandruff Hydrating Shampoo</a>, [[price:cerave-anti-dandruff-hydrating-shampoo]], for flakes</li>
<li><a class="blog-product-link" href="/product/ogx-argan-oil-of-morocco-shampoo">OGX Argan Oil Shampoo</a></li>
</ul></div>
<table><tr><td><a href="/product/cerave-anti-dandruff-hydrating-shampoo">CeraVe</a> (355ml)</td></tr></table>
<p>Browse the <a href="/collection/hair-care">hair care range</a>.</p>
<a class="blog-cta" href="/product/cerave-anti-dandruff-hydrating-shampoo">Shop it →</a>
`;

const products = new Map<string, CatalogueStatus>([
  ['ogx-argan-oil-of-morocco-shampoo', 'published'],
  ['cerave-anti-dandruff-hydrating-shampoo', 'draft'],
  ['hello-hair-classic-clean', 'archived'],
]);
const collections = new Map<string, CatalogueStatus>([['hair-care', 'published']]);

describe('extractInternalLinks', () => {
  it('counts every occurrence of a target, not just the first', () => {
    // The whole point: three chances to hit one 404, not one.
    const links = extractInternalLinks(BODY);
    const cerave = links.find(l => l.slug === 'cerave-anti-dandruff-hydrating-shampoo');
    expect(cerave?.occurrences).toBe(3);
  });

  it('finds products and collections, and tells them apart', () => {
    const links = extractInternalLinks(BODY);
    expect(links.filter(l => l.kind === 'product').map(l => l.slug).sort()).toEqual([
      'cerave-anti-dandruff-hydrating-shampoo',
      'ogx-argan-oil-of-morocco-shampoo',
    ]);
    expect(links.filter(l => l.kind === 'collection').map(l => l.slug)).toEqual(['hair-care']);
  });

  it('does not treat a [[price:slug]] token as a link', () => {
    // The token names the same slug but is not a destination; counting it
    // would inflate every figure on the screen.
    expect(extractInternalLinks('[[price:some-product]]')).toEqual([]);
  });

  it('lower-cases slugs, since hand-written hrefs are not consistent', () => {
    expect(extractInternalLinks('<a href="/product/CeraVe-Shampoo">x</a>')[0].slug)
      .toBe('cerave-shampoo');
  });

  it('is not confused by a path that merely contains the word product', () => {
    expect(extractInternalLinks('<a href="/blog/best-product-guide">x</a>')).toEqual([]);
  });

  it('returns nothing for empty, null or undefined bodies', () => {
    expect(extractInternalLinks('')).toEqual([]);
    expect(extractInternalLinks(null)).toEqual([]);
    expect(extractInternalLinks(undefined)).toEqual([]);
  });
});

describe('findDeadLinks', () => {
  it('reports a draft product and leaves the published one alone', () => {
    const dead = findDeadLinks('best-shampoo-in-pakistan', BODY, products, collections);
    expect(dead).toHaveLength(1);
    expect(dead[0]).toMatchObject({
      slug: 'cerave-anti-dandruff-hydrating-shampoo',
      reason: 'draft',
      occurrences: 3,
      source: 'best-shampoo-in-pakistan',
    });
  });

  it('separates a typo from an unpublished product', () => {
    // These need different fixes: a typo wants correcting, an archived
    // product wants a redirect or a replacement. Collapsing them into
    // "broken" makes the screen useless for deciding what to do.
    const dead = findDeadLinks('x', '<a href="/product/hello-hair-classic-clean">a</a><a href="/product/nope-typo">b</a>', products);
    expect(dead.map(d => [d.slug, d.reason]).sort()).toEqual([
      ['hello-hair-classic-clean', 'archived'],
      ['nope-typo', 'missing'],
    ]);
  });

  it('does not guess about collections when no collection map is given', () => {
    const dead = findDeadLinks('x', '<a href="/collection/anything">a</a>', products);
    expect(dead).toEqual([]);
  });

  it('flags a collection that is not published', () => {
    const dead = findDeadLinks('x', '<a href="/collection/gone">a</a>', products,
      new Map<string, CatalogueStatus>([['gone', 'draft']]));
    expect(dead[0]).toMatchObject({ slug: 'gone', kind: 'collection', reason: 'draft' });
  });
});

describe('rankDeadLinks', () => {
  it('puts the most-linked target first', () => {
    const ranked = rankDeadLinks([
      { source: 'a', slug: 'one', kind: 'product', occurrences: 1, reason: 'archived' },
      { source: 'b', slug: 'many', kind: 'product', occurrences: 9, reason: 'draft' },
    ]);
    expect(ranked[0].slug).toBe('many');
  });

  it('breaks a tie by how unrecoverable the link is', () => {
    // A draft product may be back tomorrow; a slug that matches nothing never
    // will, so it needs a person sooner.
    const ranked = rankDeadLinks([
      { source: 'a', slug: 'draft-one', kind: 'product', occurrences: 2, reason: 'draft' },
      { source: 'a', slug: 'gone', kind: 'product', occurrences: 2, reason: 'missing' },
      { source: 'a', slug: 'old', kind: 'product', occurrences: 2, reason: 'archived' },
    ]);
    expect(ranked.map(r => r.reason)).toEqual(['missing', 'archived', 'draft']);
  });

  it('is deterministic when everything else ties', () => {
    const rows = [
      { source: 'b', slug: 'z', kind: 'product' as const, occurrences: 1, reason: 'draft' as const },
      { source: 'a', slug: 'y', kind: 'product' as const, occurrences: 1, reason: 'draft' as const },
    ];
    expect(rankDeadLinks(rows).map(r => r.source)).toEqual(['a', 'b']);
    expect(rankDeadLinks([...rows].reverse()).map(r => r.source)).toEqual(['a', 'b']);
  });
});
