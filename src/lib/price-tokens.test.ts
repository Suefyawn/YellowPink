import { describe, expect, it } from 'vitest';
import { renderPriceTokens, renderFaqPriceTokens, formatRs } from './price-tokens';

const PRODUCTS = [
  { slug: 'kajal', price: 160 },
  { slug: 'cerave-hydrating-facial-cleanser', price: 5999 },
  { slug: 'no-price', price: null },
];

describe('renderPriceTokens', () => {
  it('replaces tokens with the current formatted price', () => {
    expect(renderPriceTokens('costs [[price:kajal]] today', PRODUCTS)).toBe('costs Rs 160 today');
    expect(renderPriceTokens('at [[price:cerave-hydrating-facial-cleanser]].', PRODUCTS))
      .toBe('at Rs 5,999.');
  });

  it('renders unknown slugs and null prices as empty, never the raw token', () => {
    expect(renderPriceTokens('now [[price:missing]] only', PRODUCTS)).toBe('now  only');
    expect(renderPriceTokens('now [[price:no-price]] only', PRODUCTS)).toBe('now  only');
  });

  it('passes through text without tokens untouched (fast path)', () => {
    const s = 'plain Rs 1,999 text';
    expect(renderPriceTokens(s, PRODUCTS)).toBe(s);
    expect(renderPriceTokens(null, PRODUCTS)).toBe('');
  });

  it('replaces multiple tokens in one body', () => {
    expect(renderPriceTokens('[[price:kajal]] + [[price:kajal]]', PRODUCTS)).toBe('Rs 160 + Rs 160');
  });
});

describe('renderFaqPriceTokens', () => {
  it('renders tokens inside answers', () => {
    const out = renderFaqPriceTokens([{ q: 'Price?', a: 'It is [[price:kajal]].' }], PRODUCTS);
    expect(out).toEqual([{ q: 'Price?', a: 'It is Rs 160.' }]);
  });
  it('returns null for null input', () => {
    expect(renderFaqPriceTokens(null, PRODUCTS)).toBeNull();
  });
});

describe('formatRs', () => {
  it('rounds and comma-groups', () => {
    expect(formatRs(6590)).toBe('Rs 6,590');
    expect(formatRs(60)).toBe('Rs 60');
  });
});
