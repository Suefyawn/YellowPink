// Build the 301-redirect map from imported entities.
//
// WP's default URL structure:
//   • Product   → /product/<slug>            ← same as ours, but we double-check
//   • Category  → /product-category/<slug>   → /shop?cat=<slug>
//   • Post      → /<year>/<month>/<slug>     OR /<slug>/      → /blog/<slug>
//   • Page      → /<slug>/                                    → /page/<slug>
//
// The WP_SITE_URL pretty-permalink may differ; we extract from the actual
// `link` field returned by REST when present, to capture custom permalinks.

import { wp, wc } from '../wp';
import { sb, upsertBatched } from '../sb';

interface LinkRow { id?: number; slug: string; link?: string }
type RedirectRow = { from_path: string; to_path: string; status_code: 301; source: 'wp_import' };

function pathOf(absoluteUrl: string | undefined, fallback: string): string {
  if (!absoluteUrl) return fallback;
  try {
    const u = new URL(absoluteUrl);
    return u.pathname.replace(/\/$/, '') || fallback;
  } catch {
    return fallback;
  }
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const rows: RedirectRow[] = [];

  // Products
  for await (const p of wc.paginate<LinkRow>('/products', { per_page: 100, status: 'any', _fields: 'id,slug,link' })) {
    const from = pathOf(p.link, `/product/${p.slug}`);
    const to   = `/product/${p.slug}`;
    if (from && from !== to) rows.push({ from_path: from, to_path: to, status_code: 301, source: 'wp_import' });
  }

  // Categories
  for await (const c of wc.paginate<LinkRow>('/products/categories', { per_page: 100, _fields: 'id,slug,link' })) {
    if (c.slug === 'uncategorized') continue;
    const from = pathOf(c.link, `/product-category/${c.slug}`);
    const to   = `/shop?cat=${encodeURIComponent(c.slug)}`;
    rows.push({ from_path: from, to_path: to, status_code: 301, source: 'wp_import' });
  }

  // Posts
  for await (const p of wp.paginate<LinkRow>('/posts', { per_page: 100, status: 'publish', _fields: 'id,slug,link' })) {
    const from = pathOf(p.link, `/${p.slug}`);
    const to   = `/blog/${p.slug}`;
    if (from !== to) rows.push({ from_path: from, to_path: to, status_code: 301, source: 'wp_import' });
  }

  // Pages
  for await (const p of wp.paginate<LinkRow>('/pages', { per_page: 100, status: 'publish', _fields: 'id,slug,link' })) {
    const from = pathOf(p.link, `/${p.slug}`);
    const to   = `/page/${p.slug}`;
    if (from !== to) rows.push({ from_path: from, to_path: to, status_code: 301, source: 'wp_import' });
  }

  // De-dupe by from_path (keep first).
  const seen = new Set<string>();
  const dedup = rows.filter(r => {
    if (!r.from_path || r.from_path === '/') return false;
    if (seen.has(r.from_path)) return false;
    seen.add(r.from_path);
    return true;
  });

  // Wipe prior wp_import-sourced rows so we don't carry stale ones.
  await sb.from('redirects').delete().eq('source', 'wp_import');

  const ins = await upsertBatched('redirects', dedup, { onConflict: 'from_path' });
  errors.push(...ins.errors);
  return { imported: ins.inserted, skipped: rows.length - dedup.length, errors };
}
