import { permanentRedirect } from 'next/navigation';
import { supabase, isDemo } from '@/lib/supabase';
import { canonicalSlug, cleanSlug } from '@/lib/near-match';

// ─── manual redirects at the 404 boundary ───────────────────────────────────
// Middleware (src/proxy.ts) consults the `redirects` table for legacy WP URLs,
// but it deliberately SKIPS paths Next already owns (/page/, /product/, /blog/,
// /brand/, /tag/, /collection/) to avoid a DB round-trip on every live page.
//
// That leaves a gap: an *owned dynamic* URL whose record is gone or unpublished
// (e.g. /page/home, an old WordPress draft Google still has indexed) 404s with
// no chance to redirect, and the admin "Broken Links → Add redirect" button
// (which writes to the same table) can't fix it.
//
// This helper closes the gap by checking the table at the route's 404 boundary
//, i.e. only once content is already known missing, so live pages pay nothing.
// Issues a 308 permanent redirect (SEO-equivalent to 301) when a mapping
// exists; returns normally otherwise so the caller falls through to notFound().

/**
 * If `pathname` has a row in the `redirects` table, permanently redirect to its
 * target. Returns (does nothing) when there's no mapping. Call immediately
 * before notFound() in a dynamic route:
 *
 *   const page = await loadPage(slug);
 *   if (!page) { await redirectIfMapped(`/page/${slug}`); notFound(); }
 */
export async function redirectIfMapped(pathname: string): Promise<void> {
  if (isDemo) return;
  let to: string | null = null;
  try {
    const { data } = await supabase
      .from('redirects')
      .select('to_path')
      .eq('from_path', pathname)
      .maybeSingle();
    to = (data as { to_path: string } | null)?.to_path ?? null;
    // No hand-written mapping — try to recover the URL structurally before
    // giving up. Only runs on a path already known to be missing.
    to ??= await resolveCanonicalPath(pathname);
  } catch {
    // Best-effort: a lookup failure must not mask the 404, fall through.
    return;
  }
  // permanentRedirect throws NEXT_REDIRECT, so it MUST run outside the try above
  // (otherwise the catch would swallow the redirect).
  if (to && to !== pathname) permanentRedirect(to);
}

/**
 * Which table backs each dynamic route, and how that table marks a row live —
 * the three storefront gates are NOT the same column. Routes whose slug is
 * derived rather than stored (/brand, /tag, /category, /author) are absent on
 * purpose: there is no row to look the slug up in.
 */
// 'published' = a status column set to 'published'. 'not-scheduled' = the
// blog's gate, which has no status column at all: a future `date` means the
// post is scheduled rather than live.
type LiveGate = 'published' | 'not-scheduled';

const SLUG_TABLES: Record<string, { table: string; gate: LiveGate }> = {
  product:    { table: 'products',    gate: 'published' },
  collection: { table: 'collections', gate: 'published' },
  page:       { table: 'pages',       gate: 'published' },
  blog:       { table: 'blog_posts',  gate: 'not-scheduled' },
};

/**
 * Recover a missed URL whose slug is a mangled form of a real one: a
 * WordPress "-copy" suffix, mixed case, a stray %20. Returns the corrected
 * path only when that exact slug is genuinely live, otherwise null.
 *
 * This is intentionally narrow. Fuzzy "closest product" matching is NOT done
 * here: on a beauty catalogue the near misses are different products at
 * different prices, so an automatic hop would quietly sell the wrong item.
 * Those cases get ranked suggestions on the 404 page instead, where a person
 * makes the call — see /api/404/suggest.
 */
async function resolveCanonicalPath(pathname: string): Promise<string | null> {
  // Anchored at the END, not the start, so a doubled path recovers too. A
  // relative <a href="product/x"> on a PDP resolves to
  // /product/<current>/product/x — the single most common real 404 from a
  // human in this store's log. Taking the last /kind/slug pair rescues it.
  // A path whose second-to-last segment is not a known kind (/product/a/b)
  // still falls through, because "a" is not in SLUG_TABLES.
  const m = /\/([a-z]+)\/([^/?#]+)\/?$/.exec(pathname);
  if (!m) return null;
  const [, kind, rawSlug] = m;
  const entry = SLUG_TABLES[kind];
  if (!entry) return null;

  // canonicalSlug returns null for an already-clean slug, but the path can
  // still be wrong (the doubled case above), so fall back to the cleaned slug
  // and let the path comparison decide whether there is anything to fix.
  const candidate = canonicalSlug(rawSlug) ?? cleanSlug(rawSlug);
  if (!candidate || `/${kind}/${candidate}` === pathname) return null;

  const base = supabase.from(entry.table).select('slug').eq('slug', candidate);
  const { data } = await (entry.gate === 'published'
    ? base.eq('status', 'published')
    : base.lte('date', new Date().toISOString().slice(0, 10))
  ).maybeSingle();
  return data ? `/${kind}/${candidate}` : null;
}
