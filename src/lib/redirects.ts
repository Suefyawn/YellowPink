import { permanentRedirect } from 'next/navigation';
import { supabase, isDemo } from '@/lib/supabase';

// ─── manual redirects at the 404 boundary ───────────────────────────────────
// Middleware (src/proxy.ts) consults the `redirects` table for legacy WP URLs,
// but it deliberately SKIPS paths Next already owns (/page/, /product/, /blog/,
// /brand/, /tag/, /collection/) to avoid a DB round-trip on every live page.
//
// That leaves a gap: an *owned dynamic* URL whose record is gone or unpublished
// (e.g. /page/home — an old WordPress draft Google still has indexed) 404s with
// no chance to redirect, and the admin "Broken Links → Add redirect" button
// (which writes to the same table) can't fix it.
//
// This helper closes the gap by checking the table at the route's 404 boundary
// — i.e. only once content is already known missing, so live pages pay nothing.
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
  } catch {
    // Best-effort: a lookup failure must not mask the 404 — fall through.
    return;
  }
  // permanentRedirect throws NEXT_REDIRECT, so it MUST run outside the try above
  // (otherwise the catch would swallow the redirect).
  if (to && to !== pathname) permanentRedirect(to);
}
