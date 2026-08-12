import { describe, expect, it } from 'vitest';
import { wpPatternRedirect } from './proxy';

const at = (pathname: string, query = '') =>
  wpPatternRedirect(pathname, new URLSearchParams(query));

// A doubled prefix is the residue of a relative link inside a section page:
// `/product//product/<slug>` arrives here with the empty segment already
// collapsed. It matches no route, and because `/product/` is an owned path the
// redirects-table lookup never runs on it, so it used to die on the 404 page
// with the real product live all along.
describe('wpPatternRedirect: doubled prefix', () => {
  it('collapses the repeat and keeps the slug intact', () => {
    expect(at('/product/product/f-lium-drops')).toBe('/product/f-lium-drops');
  });

  it('covers every slug kind, not just products', () => {
    expect(at('/blog/blog/how-to-use-niacinamide')).toBe('/blog/how-to-use-niacinamide');
    expect(at('/brand/brand/cerave')).toBe('/brand/cerave');
    expect(at('/collection/collection/sunscreens')).toBe('/collection/sunscreens');
    expect(at('/tag/tag/acne')).toBe('/tag/acne');
    expect(at('/page/page/about')).toBe('/page/about');
    expect(at('/category/category/skincare')).toBe('/category/skincare');
    expect(at('/author/author/tanya')).toBe('/author/tanya');
  });

  it('collapses a triple, not just a pair', () => {
    expect(at('/product/product/product/f-lium-drops')).toBe('/product/f-lium-drops');
  });

  // The failure that would matter: eating part of a real slug.
  it('leaves a slug that merely starts with the kind name alone', () => {
    expect(at('/product/product-tag-remover')).toBeNull();
    expect(at('/blog/blogging-for-beauty-brands')).toBeNull();
  });

  it('does not redirect a page genuinely slugged after its kind', () => {
    // No trailing segment to promote — redirecting would be a self-loop.
    expect(at('/product/product')).toBeNull();
    expect(at('/product/product/')).toBeNull();
  });

  it('ignores an unrelated kind pair', () => {
    expect(at('/product/blog/something')).toBeNull();
  });

  it('leaves ordinary paths untouched', () => {
    expect(at('/product/f-lium-drops')).toBeNull();
    expect(at('/shop')).toBeNull();
  });
});

// Guard the rules the new one now runs ahead of.
describe('wpPatternRedirect: existing rules still fire', () => {
  it('strips WordPress feed suffixes', () => {
    expect(at('/product/calin-g/feed')).toBe('/product/calin-g');
    expect(at('/feed')).toBe('/');
  });

  it('folds WP pagination onto query params', () => {
    expect(at('/shop/page/2/')).toBe('/shop?page=2');
    expect(at('/blog/page/3')).toBe('/blog?page=3');
  });

  it('funnels legacy product-tag URLs into the tag route', () => {
    expect(at('/product-tag/acne')).toBe('/tag/acne');
    // A feed suffix unwraps first and reaches /tag on the next hop; the feed
    // rule deliberately runs ahead of the taxonomy rules.
    expect(at('/product-tag/acne/feed/')).toBe('/product-tag/acne');
  });

  it('maps WP standard page slugs', () => {
    expect(at('/about-us')).toBe('/page/about');
    expect(at('/privacy-policy')).toBe('/privacy');
  });

  it('routes guessed search URLs to the shop', () => {
    expect(at('/search', 'q=cerave')).toBe('/shop?q=cerave');
    expect(at('/', 's=serum')).toBe('/shop?q=serum');
  });
});
