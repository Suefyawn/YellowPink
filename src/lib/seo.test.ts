import { describe, expect, it } from 'vitest';
import { breadcrumbLd, jsonLd, productLd } from './seo';
import type { Product, ProductReview } from '@/types';

const sampleProduct: Product = {
  id: 'p1', brand: 'CeraVe', name: 'Moisturizing Cream', slug: 'cerave-moisturizing-cream',
  price: 2400, category: 'Skincare', stock: 10, image_url: 'https://example.com/img.jpg',
  description: 'A cream',
};

describe('SEO JSON-LD helpers', () => {
  it('builds a Product schema with availability based on stock', () => {
    const ld = productLd(sampleProduct);
    expect(ld['@type']).toBe('Product');
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/InStock');
  });

  it('marks out-of-stock products as OutOfStock', () => {
    const ld = productLd({ ...sampleProduct, stock: 0 });
    expect((ld.offers as { availability: string }).availability).toBe('https://schema.org/OutOfStock');
  });

  it('omits aggregateRating when there are no reviews', () => {
    const ld = productLd(sampleProduct);
    expect(ld.aggregateRating).toBeUndefined();
  });

  it('computes aggregateRating from review array', () => {
    const reviews: Pick<ProductReview, 'rating'>[] = [{ rating: 5 }, { rating: 4 }, { rating: 5 }];
    const ld = productLd(sampleProduct, reviews);
    const ar = ld.aggregateRating as { ratingValue: number; reviewCount: number };
    expect(ar.reviewCount).toBe(3);
    expect(ar.ratingValue).toBeCloseTo(4.7, 1);
  });

  it('strips undefined when serialising via jsonLd', () => {
    const out = jsonLd({ a: 1, b: undefined, c: 'x' });
    expect(out).not.toMatch(/undefined/);
    expect(JSON.parse(out)).toEqual({ a: 1, c: 'x' });
  });

  it('builds breadcrumb with positional list', () => {
    const ld = breadcrumbLd([
      { name: 'Home', path: '/' },
      { name: 'Shop', path: '/shop' },
    ]);
    const list = ld.itemListElement as Array<{ position: number; name: string }>;
    expect(list[0].position).toBe(1);
    expect(list[1].name).toBe('Shop');
  });
});
