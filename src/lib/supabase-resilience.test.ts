import { beforeEach, describe, expect, it, vi } from 'vitest';

// Pin the two behaviours the 17 Sep 2026 outage taught us: a production read
// failure yields an EMPTY result (never demo rows) and reaches Sentry with a
// fingerprint that names a plan restriction as such; and a cached reader
// still works when Next's data cache is not around (tests, scripts).

const captureException = vi.fn();
vi.mock('@sentry/nextjs', () => ({ captureException: (...args: unknown[]) => captureException(...args) }));

const unstableCache = vi.fn();
vi.mock('next/cache', () => ({ unstable_cache: (...args: unknown[]) => unstableCache(...args) }));

import {
  _resetReportThrottle,
  cachedRead,
  isSupabaseRestricted,
  liveFallback,
  reportSupabaseFailure,
} from './supabase-resilience';

const RESTRICTED_MESSAGE =
  'Service for this project is restricted due to the following violations: exceed_egress_quota. The project owner must upgrade their plan or remove spend caps to restore service.';

beforeEach(() => {
  captureException.mockReset();
  unstableCache.mockReset();
  _resetReportThrottle();
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

describe('isSupabaseRestricted', () => {
  it('recognises the 402 plan-restriction body, as an Error or a PostgrestError-shaped object', () => {
    expect(isSupabaseRestricted(new Error(RESTRICTED_MESSAGE))).toBe(true);
    expect(isSupabaseRestricted({ message: RESTRICTED_MESSAGE, code: '', details: '', hint: '' })).toBe(true);
    expect(isSupabaseRestricted({ message: 'exceed_db_size_quota' })).toBe(true);
  });

  it('does not flag ordinary query errors', () => {
    expect(isSupabaseRestricted(new Error('relation "products" does not exist'))).toBe(false);
    expect(isSupabaseRestricted({ message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' })).toBe(false);
    expect(isSupabaseRestricted(null)).toBe(false);
  });
});

describe('liveFallback', () => {
  it('returns an empty list for list readers and null for single-row readers, never the demo rows', () => {
    const demoRows = [{ id: 'demo-1', slug: 'demo-cerave-moisturising-cream' }];
    expect(liveFallback(demoRows)).toEqual([]);
    expect(liveFallback(demoRows[0])).toBeNull();
    expect(liveFallback(null)).toBeNull();
  });
});

describe('reportSupabaseFailure', () => {
  it('captures a restriction as one fatal issue with its own fingerprint', () => {
    reportSupabaseFailure('getProducts', { message: RESTRICTED_MESSAGE });
    expect(captureException).toHaveBeenCalledTimes(1);
    const [error, ctx] = captureException.mock.calls[0] as [Error, { level: string; fingerprint: string[]; tags: Record<string, string> }];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(RESTRICTED_MESSAGE);
    expect(ctx.level).toBe('fatal');
    expect(ctx.fingerprint).toEqual(['supabase-restricted']);
    expect(ctx.tags.supabase_restricted).toBe('true');
  });

  it('groups other failures per reader and throttles repeats', () => {
    reportSupabaseFailure('getBlogPosts', new Error('boom'));
    reportSupabaseFailure('getBlogPosts', new Error('boom again'));
    reportSupabaseFailure('getProducts', new Error('boom'));
    expect(captureException).toHaveBeenCalledTimes(2);
    const first = captureException.mock.calls[0][1] as { level: string; fingerprint: string[] };
    expect(first.level).toBe('error');
    expect(first.fingerprint).toEqual(['supabase-read-failed', 'getBlogPosts']);
  });

  it('throttles a restriction across readers: one heartbeat per outage, not one per reader', () => {
    reportSupabaseFailure('getProducts', { message: RESTRICTED_MESSAGE });
    reportSupabaseFailure('getSiteSettings', { message: RESTRICTED_MESSAGE });
    reportSupabaseFailure('getBlogPosts', { message: RESTRICTED_MESSAGE });
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('never throws when Sentry itself fails', () => {
    captureException.mockImplementation(() => { throw new Error('sentry down'); });
    expect(() => reportSupabaseFailure('getProducts', new Error('boom'))).not.toThrow();
  });
});

describe('cachedRead', () => {
  it('passes the reader, key parts, tags and TTL to unstable_cache and returns its result', async () => {
    const reader = vi.fn(async (n: number) => n * 2);
    unstableCache.mockImplementation((fn: (...a: unknown[]) => unknown) => fn);
    const read = cachedRead(['k'], reader, { tags: ['t'], revalidate: 60 });
    await expect(read(21)).resolves.toBe(42);
    expect(unstableCache).toHaveBeenCalledWith(reader, ['k'], { tags: ['t'], revalidate: 60 });
  });

  it('runs the reader uncached when Next has no cache to offer (tests, scripts)', async () => {
    const reader = vi.fn(async () => 'fresh');
    unstableCache.mockImplementation(() => async () => {
      throw new Error('Invariant: incrementalCache missing in unstable_cache async () => {}');
    });
    const read = cachedRead(['k'], reader, { tags: ['t'], revalidate: 60 });
    await expect(read()).resolves.toBe('fresh');
    expect(reader).toHaveBeenCalledTimes(1);
  });

  it('propagates the reader\'s own failure so the caller\'s fallback applies and nothing is cached', async () => {
    const reader = vi.fn(async () => { throw new Error(RESTRICTED_MESSAGE); });
    unstableCache.mockImplementation((fn: (...a: unknown[]) => unknown) => fn);
    const read = cachedRead(['k'], reader, { tags: ['t'], revalidate: 60 });
    await expect(read()).rejects.toThrow(/restricted/);
  });
});
