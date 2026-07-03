import { beforeEach, describe, expect, it, vi } from 'vitest';

// The limiter chooses its backend at module load: Upstash when the REST env
// vars are present, an in-memory per-process fallback otherwise. These tests
// pin the fallback path — no UPSTASH_* env, no network — which is exactly
// what dev/self-hosted and CI environments run with.

async function loadWithoutUpstash() {
  vi.resetModules();
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  return import('./ratelimit');
}

describe('ratelimit fallback (no Upstash env)', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('allows up to the limit, then blocks, without touching the network', async () => {
    const { reviewerApplyLimiter } = await loadWithoutUpstash();
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const id = `ip-${Math.random()}`;

    // reviewerApplyLimiter is 3 per 10 minutes.
    for (let i = 0; i < 3; i++) {
      const res = await reviewerApplyLimiter.limit(id);
      expect(res.success).toBe(true);
    }
    const blocked = await reviewerApplyLimiter.limit(id);
    expect(blocked.success).toBe(false);
    expect(blocked.remaining).toBe(0);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('tracks identifiers independently', async () => {
    const { quizEmailLimiter } = await loadWithoutUpstash();
    const a = `ip-a-${Math.random()}`;
    const b = `ip-b-${Math.random()}`;

    // Exhaust A (5 per 10 minutes)...
    for (let i = 0; i < 5; i++) await quizEmailLimiter.limit(a);
    expect((await quizEmailLimiter.limit(a)).success).toBe(false);
    // ...B is unaffected.
    expect((await quizEmailLimiter.limit(b)).success).toBe(true);
  });

  it('resets the bucket once the window has elapsed', async () => {
    vi.useFakeTimers();
    try {
      const { notFoundLimiter } = await loadWithoutUpstash();
      const id = `ip-${Math.random()}`;

      // notFoundLimiter is 30 per minute.
      for (let i = 0; i < 30; i++) await notFoundLimiter.limit(id);
      expect((await notFoundLimiter.limit(id)).success).toBe(false);

      vi.advanceTimersByTime(61_000);
      expect((await notFoundLimiter.limit(id)).success).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('extracts the client IP from x-forwarded-for', async () => {
    const { ipFromHeaders } = await loadWithoutUpstash();
    expect(ipFromHeaders(new Headers({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' }))).toBe('1.2.3.4');
    expect(ipFromHeaders(new Headers({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(ipFromHeaders(new Headers())).toBe('unknown');
  });
});
