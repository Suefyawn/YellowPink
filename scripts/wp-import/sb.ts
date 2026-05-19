// Service-role Supabase client + a typed `safeUpsert` that respects DRY_RUN.

import { createClient } from '@supabase/supabase-js';
import { CONFIG } from './config';

export const sb = createClient(CONFIG.sb.url, CONFIG.sb.serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Row = Record<string, unknown>;

export async function upsert(
  table: string,
  rows: Row | Row[],
  opts: { onConflict?: string; ignoreDuplicates?: boolean } = {}
): Promise<{ inserted: number; error?: string }> {
  const arr = Array.isArray(rows) ? rows : [rows];
  if (arr.length === 0) return { inserted: 0 };
  if (CONFIG.dryRun) {
    return { inserted: arr.length };
  }
  // Don't `.select('id')` after — join tables (product_categories,
  // product_relations) have composite PKs and no `id` column, which
  // would fail the post-insert SELECT. Use { count: 'exact' } to get
  // the row count without selecting any columns; falls back to
  // arr.length if PostgREST omits the count (e.g. ignoreDuplicates).
  const { error, count } = await sb
    .from(table)
    .upsert(arr, { onConflict: opts.onConflict, ignoreDuplicates: opts.ignoreDuplicates ?? false, count: 'exact' });
  if (error) {
    return { inserted: 0, error: error.message };
  }
  return { inserted: count ?? arr.length };
}

// Batch wrapper — splits a long list and upserts in chunks so we don't blow
// PostgREST's request size limit.
export async function upsertBatched(
  table: string,
  rows: Row[],
  opts: { onConflict?: string; ignoreDuplicates?: boolean; batchSize?: number } = {}
): Promise<{ inserted: number; errors: string[] }> {
  const size = opts.batchSize ?? CONFIG.batchSize;
  let inserted = 0;
  const errors: string[] = [];
  for (let i = 0; i < rows.length; i += size) {
    const slice = rows.slice(i, i + size);
    const res = await upsert(table, slice, opts);
    inserted += res.inserted;
    if (res.error) errors.push(`batch ${i / size}: ${res.error}`);
  }
  return { inserted, errors };
}

// Map lookup helper — turn a WP id into our Supabase uuid via the
// `wp_*_id` columns. The `column` arg matches the legacy column we set on
// import (e.g. 'wp_product_id', 'wp_term_id', 'wp_variation_id').
export async function lookupByWpId(
  table: string,
  column: string,
  wpId: number
): Promise<string | null> {
  const { data } = await sb.from(table).select('id').eq(column, wpId).maybeSingle();
  return ((data as { id?: string } | null)?.id) ?? null;
}

// Bulk version for performance — returns a map of wpId → uuid.
export async function lookupManyByWpId(
  table: string,
  column: string,
  wpIds: number[]
): Promise<Map<number, string>> {
  const result = new Map<number, string>();
  if (wpIds.length === 0) return result;
  const uniq = Array.from(new Set(wpIds));
  // PostgREST IN with up to a few thousand values is fine; chunk just in case.
  for (let i = 0; i < uniq.length; i += 500) {
    const slice = uniq.slice(i, i + 500);
    const { data } = await sb.from(table).select(`id, ${column}`).in(column, slice);
    // Dynamic select strings confuse Supabase's strict types; double-cast.
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    for (const row of rows) {
      const wpId = Number(row[column]);
      const id   = String(row.id);
      if (wpId && id) result.set(wpId, id);
    }
  }
  return result;
}
