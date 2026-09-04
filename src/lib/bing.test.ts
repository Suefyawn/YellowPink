import { describe, expect, it } from 'vitest';
import { parseBingDate } from './bing';

// Bing's JSON API returns WCF dates; the widget and the cache key on ISO days.
describe('parseBingDate', () => {
  it('parses WCF /Date(ms-offset)/ strings to an ISO day', () => {
    expect(parseBingDate('/Date(1693526400000-0700)/')).toBe('2023-09-01');
    expect(parseBingDate('/Date(1693526400000)/')).toBe('2023-09-01');
  });
  it('passes plain ISO strings through', () => {
    expect(parseBingDate('2026-09-01T00:00:00Z')).toBe('2026-09-01');
  });
  it('returns null for junk', () => {
    expect(parseBingDate('')).toBeNull();
    expect(parseBingDate(undefined)).toBeNull();
    expect(parseBingDate('/Date(abc)/')).toBeNull();
  });
});
