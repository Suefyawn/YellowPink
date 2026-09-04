import { describe, expect, it } from 'vitest';
import { renderContentTokens, renderFaqTokens, formatRs, currentMonthLabel, renderDateTokens, withRenderedDates } from './price-tokens';

const PRODUCTS = [
  { slug: 'kajal', price: 160 },
  { slug: 'cerave-hydrating-facial-cleanser', price: 5999 },
  { slug: 'no-price', price: null },
];

describe('renderContentTokens', () => {
  it('replaces tokens with the current formatted price', () => {
    expect(renderContentTokens('costs [[price:kajal]] today', PRODUCTS)).toBe('costs Rs 160 today');
    expect(renderContentTokens('at [[price:cerave-hydrating-facial-cleanser]].', PRODUCTS))
      .toBe('at Rs 5,999.');
  });

  it('renders unknown slugs and null prices as empty, never the raw token', () => {
    expect(renderContentTokens('now [[price:missing]] only', PRODUCTS)).toBe('now  only');
    expect(renderContentTokens('now [[price:no-price]] only', PRODUCTS)).toBe('now  only');
  });

  it('passes through text without tokens untouched (fast path)', () => {
    const s = 'plain Rs 1,999 text';
    expect(renderContentTokens(s, PRODUCTS)).toBe(s);
    expect(renderContentTokens(null, PRODUCTS)).toBe('');
  });

  it('replaces multiple tokens in one body', () => {
    expect(renderContentTokens('[[price:kajal]] + [[price:kajal]]', PRODUCTS)).toBe('Rs 160 + Rs 160');
  });
});

describe('renderFaqTokens', () => {
  it('renders tokens inside answers', () => {
    const out = renderFaqTokens([{ q: 'Price?', a: 'It is [[price:kajal]].' }], PRODUCTS);
    expect(out).toEqual([{ q: 'Price?', a: 'It is Rs 160.' }]);
  });
  it('returns null for null input', () => {
    expect(renderFaqTokens(null, PRODUCTS)).toBeNull();
  });
});

describe('formatRs', () => {
  it('rounds and comma-groups', () => {
    expect(formatRs(6590)).toBe('Rs 6,590');
    expect(formatRs(60)).toBe('Rs 60');
  });
});

// Freshness tokens: a hand-typed "(September 2026)" in a price heading goes
// stale silently, which is exactly what the 4 Sep fact-check found.
describe('date tokens', () => {
  const AUG = new Date('2026-08-15T12:00:00Z');

  it('renders [[month]] as the month and year in Pakistan time', () => {
    expect(renderContentTokens('Prices ([[month]])', PRODUCTS, AUG)).toBe('Prices (August 2026)');
    expect(renderContentTokens('[[year]] guide', PRODUCTS, AUG)).toBe('2026 guide');
  });

  it('uses the Pakistan calendar, not the server clock', () => {
    // 31 Aug 20:00 UTC is already 1 September in Karachi (UTC+5).
    expect(currentMonthLabel(new Date('2026-08-31T20:00:00Z'))).toBe('September 2026');
  });

  it('renders price and date tokens in one pass', () => {
    expect(renderContentTokens('[[price:kajal]] as of [[month]]', PRODUCTS, AUG))
      .toBe('Rs 160 as of August 2026');
  });

  it('still fast-paths text with no tokens at all', () => {
    expect(renderContentTokens('September 2026 in plain text', PRODUCTS, AUG))
      .toBe('September 2026 in plain text');
  });
});

// Headline date tokens. 151 of 261 post titles hard-coded "2026"; these
// resolve at the data layer so every title consumer gets the live year.
describe('renderDateTokens / withRenderedDates', () => {
  const AUG = new Date('2026-08-15T12:00:00Z');

  it('resolves [[year]] and [[month]] with no product list', () => {
    expect(renderDateTokens('Best Sunscreen in Pakistan [[year]]', AUG)).toBe('Best Sunscreen in Pakistan 2026');
    expect(renderDateTokens('Prices ([[month]])', AUG)).toBe('Prices (August 2026)');
  });

  it('leaves price tokens alone: a headline is never a price surface', () => {
    expect(renderDateTokens('costs [[price:kajal]]', AUG)).toBe('costs [[price:kajal]]');
  });

  it('fast-paths text with no tokens and tolerates null', () => {
    expect(renderDateTokens('plain 2026 title', AUG)).toBe('plain 2026 title');
    expect(renderDateTokens(null, AUG)).toBe('');
  });

  it('renders title and seo_title on a post, returning the same object when untouched', () => {
    const post = { slug: 'x', title: 'Guide [[year]]', seo_title: 'Guide [[year]] | Yellow Pink', body: 'b' };
    const out = withRenderedDates(post, AUG);
    expect(out.title).toBe('Guide 2026');
    expect(out.seo_title).toBe('Guide 2026 | Yellow Pink');
    expect(out.body).toBe('b');
    const plain = { slug: 'y', title: 'No token', seo_title: null };
    expect(withRenderedDates(plain, AUG)).toBe(plain);
  });
});
