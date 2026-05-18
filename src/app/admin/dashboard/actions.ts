'use server';

import { revalidatePath } from 'next/cache';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const PH_PROJECT_ID = 429225;
const PH_BASE = 'https://us.posthog.com';
const SENTRY_ORG = 'trellee';
const SENTRY_PROJECT = 'yellowpink';

// `createClient` without explicit generics returns a client whose `.from()`
// inference treats every table as `never`, so any .upsert / .insert payload
// type-errors. We aren't using Supabase's generated types here, so widen to a
// permissive shape — the runtime contract (a single row keyed by `key`) is
// owned by the analytics_cache migration.
type PermissiveSupabase = SupabaseClient<unknown, never, never, never, never>;

async function phQuery(apiKey: string, sql: string) {
  const res = await fetch(`${PH_BASE}/api/projects/${PH_PROJECT_ID}/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query: sql } }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`PostHog ${res.status}: ${await res.text()}`);
  return (await res.json()).results as unknown[][];
}

async function refreshPostHog(supabase: PermissiveSupabase) {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY;
  if (!apiKey) throw new Error('POSTHOG_PERSONAL_API_KEY not configured');

  const W7 = `timestamp >= now() - interval 7 day`;
  const PV = `event = '$pageview'`;

  const [pvRows, uuRows, sessRows, trendRows] = await Promise.all([
    phQuery(apiKey, `SELECT count() FROM events WHERE ${PV} AND ${W7}`),
    phQuery(apiKey, `SELECT count(distinct distinct_id) FROM events WHERE ${PV} AND ${W7}`),
    phQuery(apiKey, `SELECT count(distinct properties.\`$session_id\`) FROM events WHERE ${PV} AND ${W7}`),
    phQuery(apiKey, `SELECT toString(toDate(timestamp)) as d, count() FROM events WHERE ${PV} AND ${W7} GROUP BY d ORDER BY d`),
  ]);

  const data = {
    pageviews: Number(pvRows[0]?.[0] ?? 0),
    uniqueUsers: Number(uuRows[0]?.[0] ?? 0),
    sessions: Number(sessRows[0]?.[0] ?? 0),
    trend: trendRows.map(([date, count]) => ({ date: String(date), count: Number(count) })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('analytics_cache') as any).upsert({ key: 'posthog', data, updated_at: new Date().toISOString() });
}

async function refreshSentry(supabase: PermissiveSupabase) {
  const token = process.env.SENTRY_AUTH_TOKEN;
  if (!token) throw new Error('SENTRY_AUTH_TOKEN not configured');

  const res = await fetch(
    `https://sentry.io/api/0/projects/${SENTRY_ORG}/${SENTRY_PROJECT}/issues/?query=is:unresolved&limit=25`,
    { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' },
  );
  if (!res.ok) throw new Error(`Sentry ${res.status}: ${await res.text()}`);

  const issues: Array<{ id: string; title: string; level: string; count: string; lastSeen: string; permalink: string }> = await res.json();

  const data = {
    total: issues.length,
    errors: issues.filter(i => i.level === 'error' || i.level === 'fatal').length,
    warnings: issues.filter(i => i.level === 'warning').length,
    issues: issues.slice(0, 10).map(i => ({
      id: i.id, title: i.title, level: i.level,
      count: i.count, lastSeen: i.lastSeen, permalink: i.permalink,
    })),
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from('analytics_cache') as any).upsert({ key: 'sentry', data, updated_at: new Date().toISOString() });
}

export async function refreshAnalytics(): Promise<{ ok: boolean; errors?: string[] }> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  ) as PermissiveSupabase;

  const results = await Promise.allSettled([
    refreshPostHog(supabase),
    refreshSentry(supabase),
  ]);

  const errors = results
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map(r => String(r.reason instanceof Error ? r.reason.message : r.reason));

  revalidatePath('/admin/dashboard');

  return errors.length ? { ok: false, errors } : { ok: true };
}
