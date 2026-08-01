import { describe, expect, it } from 'vitest';
import { linkProductMentions } from './link-product-mentions';
import type { Product } from '@/types';

// Minimal Product stub, only the fields linkProductMentions reads.
function p(slug: string, brand: string, name: string): Product {
  return {
    id: slug,
    slug,
    brand,
    name,
    price: 0,
    stock: 1,
    image_url: '',
    description: '',
    category: 'makeup',
    subcategory: null,
    tag: null,
    benefits: null,
    skin_type: null,
    is_featured: false,
    is_active: true,
    created_at: '',
  } as unknown as Product;
}

describe('linkProductMentions', () => {
  const kiko = p('kiko-3d-hydra', 'Kiko Milano', 'Kiko Milano 3D Hydra Lip Gloss');
  const cerave = p('cerave-cleanser', 'CeraVe', 'CeraVe Hydrating Cleanser');

  it('returns the input unchanged when no products are provided', () => {
    expect(linkProductMentions('<p>Hello world</p>', [])).toBe('<p>Hello world</p>');
  });

  it('links the first mention of a product by full name', () => {
    const html = '<p>We love the Kiko Milano 3D Hydra Lip Gloss this season.</p>';
    const out = linkProductMentions(html, [kiko]);
    expect(out).toContain('href=');
    expect(out).toContain('/product/kiko-3d-hydra');
    expect(out).toContain('Kiko Milano 3D Hydra Lip Gloss');
  });

  it('prefers the longest match (full name over bare brand)', () => {
    const html = '<p>The Kiko Milano 3D Hydra Lip Gloss is a hit.</p>';
    const out = linkProductMentions(html, [kiko]);
    // The anchor must wrap the full phrase, not just "Kiko Milano".
    const m = out.match(/<a [^>]+>([^<]+)<\/a>/);
    expect(m?.[1]).toBe('Kiko Milano 3D Hydra Lip Gloss');
  });

  it('only links the first occurrence of a product', () => {
    const html = '<p>CeraVe Hydrating Cleanser is great. The CeraVe Hydrating Cleanser is also affordable.</p>';
    const out = linkProductMentions(html, [cerave]);
    const matches = out.match(/<a [^>]+>/g) ?? [];
    expect(matches.length).toBe(1);
  });

  it('never matches inside an anchor it just injected (nested-href regression)', () => {
    // Production bug (Aug 2026 audit): the dry-skin post's <h3> mentioned
    // "CeraVe Hydrating Facial Cleanser"; after that phrase was wrapped, a
    // second candidate whose phrase is a substring of the FIRST product's
    // slug matched inside the injected href ("/product/|cerave|-hydrating…")
    // and nested an anchor mid-attribute, emitting /product/<a href=… links.
    const facial = p('cerave-hydrating-facial-cleanser', 'CeraVe', 'CeraVe Hydrating Facial Cleanser');
    const bundle = p('cerave-bundle', 'CeraVe', 'CeraVe Hydrating Cleanser and Moisturizing Cream Bundle');
    const html = '<h3>Best overall: CeraVe Hydrating Facial Cleanser, Rs 1,999</h3><p>Or get the CeraVe Hydrating Cleanser and Moisturizing Cream Bundle.</p>';
    const out = linkProductMentions(html, [facial, bundle]);
    expect(out).not.toContain('/product/<a');
    expect(out).not.toMatch(/href="[^"]*<a /);
    // Both products still get their own, well-formed link.
    expect(out).toContain('/product/cerave-hydrating-facial-cleanser');
    expect(out).toContain('/product/cerave-bundle');
  });

  it('does not link inside an existing <a>', () => {
    const html = '<p>See <a href="/x">CeraVe Hydrating Cleanser</a> review.</p>';
    const out = linkProductMentions(html, [cerave]);
    // No new anchor should be added inside the existing one.
    const matches = out.match(/<a [^>]+>/g) ?? [];
    expect(matches.length).toBe(1);
    expect(out).toContain('href="/x"');
  });

  it('does not link inside <code>', () => {
    const html = '<p>Compare with <code>CeraVe Hydrating Cleanser</code>.</p>';
    const out = linkProductMentions(html, [cerave]);
    expect(out).not.toContain('blog-product-link');
  });

  it('is case-insensitive', () => {
    const html = '<p>cerave hydrating cleanser is solid.</p>';
    const out = linkProductMentions(html, [cerave]);
    expect(out).toContain('blog-product-link');
  });

  it('handles punctuation around the phrase', () => {
    const html = "<p>(CeraVe Hydrating Cleanser), try it.</p>";
    const out = linkProductMentions(html, [cerave]);
    expect(out).toContain('blog-product-link');
  });

  it('does not link a partial-word match', () => {
    // "Kiko Milano" appears as a substring of "KikoMilano" → no link.
    const html = '<p>KikoMilanoBrand is not the same.</p>';
    const out = linkProductMentions(html, [kiko]);
    expect(out).not.toContain('blog-product-link');
  });

  describe('catalogue tier', () => {
    const anua = p('anua-toner', 'Anua', 'Anua Heartleaf 77% Soothing Toner');

    it('links mentions of catalogue products too', () => {
      const html = '<p>Pair it with the Anua Heartleaf 77% Soothing Toner at night.</p>';
      const out = linkProductMentions(html, [], [anua]);
      expect(out).toContain('/product/anua-toner');
      expect(out).toContain('blog-product-link');
    });

    it('does not link a bare brand for catalogue products', () => {
      const html = '<p>Anua makes lovely gentle formulas.</p>';
      const out = linkProductMentions(html, [], [anua]);
      expect(out).not.toContain('blog-product-link');
    });

    it('still links the bare brand for curated related products', () => {
      const html = '<p>Anua makes lovely gentle formulas.</p>';
      const out = linkProductMentions(html, [anua], []);
      expect(out).toContain('/product/anua-toner');
    });

    it('caps the number of catalogue links per post', () => {
      const many = Array.from({ length: 10 }, (_, i) =>
        p(`prod-${i}`, 'BrandCo', `BrandCo Unique Serum Number${i}`));
      const html = `<p>${many.map(x => `Try BrandCo Unique Serum Number${many.indexOf(x)} today.`).join(' ')}</p>`;
      const out = linkProductMentions(html, [], many, 3);
      const matches = out.match(/blog-product-link/g) ?? [];
      expect(matches.length).toBe(3);
    });

    it('curated products win over the same product in the catalogue', () => {
      const html = '<p>CeraVe Hydrating Cleanser twice a day.</p>';
      const out = linkProductMentions(html, [cerave], [cerave, anua]);
      const matches = out.match(/<a [^>]+>/g) ?? [];
      expect(matches.length).toBe(1);
      expect(out).toContain('/product/cerave-cleanser');
    });
  });
});
