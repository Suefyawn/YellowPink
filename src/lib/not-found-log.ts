import { supabaseAdmin, isDemo } from '@/lib/supabase';
import { brandSlug } from '@/lib/brands';
import { log } from '@/lib/logger';

// ─── 404 capture ────────────────────────────────────────────────────────────
// Records a storefront miss into not_found_log (aggregated per-path by the
// log_not_found RPC). Called from app/not-found.tsx inside after().
//
// IMPORTANT: Next renders the not-found boundary *speculatively* as part of a
// successful page's SSR tree, so this runs on valid pages too — naively logging
// every render produced false 404s for live URLs (/, /shop, /product/<live>…).
// So before recording, we verify the path genuinely resolves to nothing. The
// check runs in after() (post-response), so it never adds visitor latency.
//
// We capture server-side (not via PostHog) on purpose: the misses that matter
// most are Googlebot/crawler hits on dead URLs, and bots don't run client JS.

const BOT_RE =
  /bot\b|crawl|spider|slurp|googlebot|google-inspectiontool|bingpreview|yandex|baiduspider|duckduck|petalbot|facebookexternalhit|whatsapp|telegrambot|embedly|semrushbot|ahrefsbot|mj12bot|dataforseo|screaming frog/i;

// Structural routes that always exist — never a "broken link", skip the lookup.
const OWNED_EXACT = new Set([
  '/', '/shop', '/blog', '/brands', '/collections', '/k-beauty', '/sitemap',
  '/medical-review-board', '/cart', '/wishlist', '/track', '/account', '/login',
  '/forgot-password', '/reset-password', '/checkout', '/thank-you', '/privacy',
  '/contact', '/faq', '/returns', '/newsletter',
]);

function isAssetLike(path: string): boolean {
  const last = path.split('/').pop() ?? '';
  return /\.[a-z0-9]{1,8}$/i.test(last);
}

/** True only when the path resolves to NO live content (a real 404). False when
 *  it maps to a live route/record (the not-found boundary rendered
 *  speculatively during a successful render — a false positive to ignore). */
async function isGenuine404(path: string): Promise<boolean> {
  if (OWNED_EXACT.has(path)) return false;
  if (path.startsWith('/account') || path.startsWith('/admin')) return false;
  const segs = path.split('/').filter(Boolean);
  if (segs.length < 2) return true;                 // single unknown segment → 404
  const root = segs[0];
  const slug = segs.slice(1).join('/');
  const admin = supabaseAdmin();
  const exists = async (table: string, col: string, val: string): Promise<boolean> => {
    const { count } = await admin.from(table).select('id', { head: true, count: 'exact' }).eq(col, val);
    return (count ?? 0) > 0;
  };
  try {
    switch (root) {
      case 'product':    return !(await exists('products', 'slug', slug));
      case 'blog':       return !(await exists('blog_posts', 'slug', slug));
      case 'page':       return !(await exists('pages', 'slug', slug));
      case 'collection': return !(await exists('collections', 'slug', slug));
      case 'tag':        return !(await exists('product_tags', 'slug', slug));
      case 'medical-review-board': return !(await exists('content_reviewers', 'slug', slug));
      case 'brand': {
        // A brand page renders if EITHER a published brands row exists OR a
        // product's brand slugifies to it (mirrors getBrandRecord +
        // brandNameFromSlug in the route). Check the record first (one query),
        // fall back to the derived set.
        const { count } = await admin
          .from('brands').select('id', { head: true, count: 'exact' })
          .eq('slug', slug).eq('status', 'published');
        if ((count ?? 0) > 0) return false;
        const { data } = await admin.from('products').select('brand').not('brand', 'is', null);
        const slugs = new Set((data ?? []).map((r: { brand: string | null }) => r.brand ? brandSlug(r.brand) : ''));
        return !slugs.has(slug);
      }
      default: return true;                          // unknown root → genuine 404
    }
  } catch {
    // On a lookup error, don't record — better to miss a real 404 than to log a
    // false one (which is the exact bug we're fixing).
    return false;
  }
}

export async function logNotFound(input: {
  path: string | null | undefined;
  referer?: string | null;
  userAgent?: string | null;
  isPrefetch?: boolean;
}): Promise<void> {
  try {
    if (isDemo) return;

    const path = (input.path ?? '').split('?')[0].split('#')[0].trim();
    if (!path || !path.startsWith('/')) return;
    if (input.isPrefetch) return;                                   // router prefetches aren't real misses
    if (path.startsWith('/_next') || path.startsWith('/api/')) return;
    if (isAssetLike(path)) return;                                  // .php/.map/.env probes — noise
    if (path.length > 512) return;                                  // overflow / junk

    // Speculative-render guard: only record paths that genuinely 404.
    if (!(await isGenuine404(path))) return;

    const ua = ((input.userAgent ?? '').slice(0, 512)) || null;
    const referer = ((input.referer ?? '').slice(0, 512)) || null;
    const isBot = ua ? BOT_RE.test(ua) : false;

    const { error } = await supabaseAdmin().rpc('log_not_found', {
      p_path: path.slice(0, 512),
      p_referer: referer,
      p_user_agent: ua,
      p_is_bot: isBot,
    });
    if (error) log.warn('not_found.log_failed', { path, error: error.message });
  } catch (err) {
    log.warn('not_found.log_threw', { err: err instanceof Error ? err.message : String(err) });
  }
}
