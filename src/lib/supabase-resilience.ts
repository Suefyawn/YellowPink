// ============================================================================
// Resilience helpers for the storefront Supabase readers.
//
// Two lessons from the 17 Sep 2026 outage, when Supabase restricted the
// project for exceeding the Free plan's egress quota and answered every call
// with HTTP 402 for two days before anyone noticed:
//
//   1. A production read failure must never be papered over with demo data.
//      The old fallback served the built-in sample catalogue (fake products,
//      fake prices, `demo-` slugs) to real shoppers, so the site looked
//      "up" to every monitor while selling things that do not exist. A
//      failed read now yields an EMPTY result and reports itself.
//   2. Failures must reach a human. Every read failure is captured to
//      Sentry (throttled per process so an outage does not burn the event
//      quota), and a plan restriction gets its own fatal fingerprint so the
//      alert names the fix ("upgrade or wait for the egress reset") rather
//      than looking like a code bug.
//
// `cachedRead` is the third piece: it wraps a reader in Next's data cache so
// the catalogue is fetched once per TTL / per tag bust instead of once per
// render. That is what keeps egress an order of magnitude under the quota.
// ============================================================================

import { unstable_cache } from 'next/cache';
import * as Sentry from '@sentry/nextjs';

/** True when the error is Supabase's plan-restriction gate (the 402 body reads
 *  "Service for this project is restricted due to the following violations:
 *  exceed_egress_quota. The project owner must upgrade their plan…"). */
export function isSupabaseRestricted(err: unknown): boolean {
  const message = errorMessage(err);
  return /service for this project is restricted|exceed_[a-z_]*quota/i.test(message);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return String(err);
}

/** What a production reader returns when its query fails: the empty shape of
 *  its demo fallback (an empty list for list readers, null for single-row
 *  readers). Never the demo rows themselves. */
export function liveFallback<T>(demoFallback: T): T {
  if (Array.isArray(demoFallback)) return [] as unknown as T;
  return null as unknown as T;
}

const REPORT_THROTTLE_MS = 5 * 60_000;
const lastReportAt = new Map<string, number>();

/** Log + Sentry-capture a failed storefront read. Throttled to one capture per
 *  reader (or one per outage for a plan restriction) every five minutes per
 *  process, so a busy outage produces a steady heartbeat, not a flood. */
export function reportSupabaseFailure(label: string, err: unknown): void {
  const restricted = isSupabaseRestricted(err);
  const message = errorMessage(err);
  console.warn(`[supabase] ${label} failed; serving empty. ${message}`);

  const key = restricted ? 'restricted' : label;
  const now = Date.now();
  if ((lastReportAt.get(key) ?? 0) + REPORT_THROTTLE_MS > now) return;
  lastReportAt.set(key, now);

  try {
    const error = err instanceof Error ? err : new Error(message);
    Sentry.captureException(error, {
      level: restricted ? 'fatal' : 'error',
      // One issue per outage for the restriction (the fix is on the billing
      // page, not in code); one per reader for anything else.
      fingerprint: restricted ? ['supabase-restricted'] : ['supabase-read-failed', label],
      tags: { supabase_helper: label, supabase_restricted: String(restricted) },
    });
  } catch {
    /* telemetry must never take the page down; the warn line above landed */
  }
}

/** Reset the report throttle (tests only). */
export function _resetReportThrottle(): void {
  lastReportAt.clear();
}

export interface CachedReadOptions {
  /** Data-cache tags; a matching revalidateTag/updateTag busts the entry. */
  tags: readonly string[];
  /** Safety-net TTL in seconds for when no write busts the tag. */
  revalidate: number;
}

/**
 * Wrap a reader in Next's data cache (`unstable_cache`), keyed by `keyParts`
 * plus the call arguments, so it runs once per TTL / per tag bust instead of
 * once per render. The wrapped function must throw on failure: a thrown
 * error is never cached, which is what keeps an outage from freezing an
 * empty catalogue into the cache for an hour.
 *
 * Outside a Next request (unit tests, one-off scripts) `unstable_cache` has no
 * cache to talk to and throws its "incrementalCache missing" invariant; in
 * that case the reader simply runs uncached.
 */
export function cachedRead<A extends unknown[], T>(
  keyParts: string[],
  fn: (...args: A) => Promise<T>,
  opts: CachedReadOptions,
): (...args: A) => Promise<T> {
  const cached = unstable_cache(fn, keyParts, { tags: [...opts.tags], revalidate: opts.revalidate });
  return async (...args: A) => {
    try {
      return await cached(...args);
    } catch (err) {
      if (err instanceof Error && err.message.includes('incrementalCache missing')) return fn(...args);
      throw err;
    }
  };
}
