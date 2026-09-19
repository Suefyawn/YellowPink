import { describe, expect, it } from 'vitest';
import { rowOrThrow } from './supabase';

// Guards the 18-19 Sep 2026 regression: a transient PostgREST failure must
// never become a cached 404. Only "no row" may resolve to null.
describe('rowOrThrow', () => {
  it('returns the row when present', () => {
    expect(rowOrThrow({ data: { id: 1 }, error: null })).toEqual({ id: 1 });
  });
  it('returns null for a genuine miss (maybeSingle)', () => {
    expect(rowOrThrow({ data: null, error: null })).toBeNull();
  });
  it('returns null for a genuine miss (single, PGRST116)', () => {
    expect(rowOrThrow({ data: null, error: { code: 'PGRST116', message: 'no rows' } })).toBeNull();
  });
  it('throws on any other error so the page 500s instead of 404ing', () => {
    expect(() => rowOrThrow({ data: null, error: { code: 'PGRST301', message: 'JWT expired' } })).toThrow('JWT expired');
    expect(() => rowOrThrow({ data: null, error: { message: 'fetch failed' } })).toThrow('fetch failed');
  });
});
