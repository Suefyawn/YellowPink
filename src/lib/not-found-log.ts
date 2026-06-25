import { supabaseAdmin, isDemo } from '@/lib/supabase';
import { log } from '@/lib/logger';

// ─── 404 capture ────────────────────────────────────────────────────────────
// Records a storefront miss into not_found_log (aggregated per-path by the
// log_not_found RPC). Called from app/not-found.tsx inside after(), so it runs
// AFTER the 404 HTML has streamed — zero added latency for the visitor — and is
// wrapped so a logging failure can never surface as a render error.
//
// We capture server-side (not via PostHog) on purpose: the misses that matter
// most for SEO are Googlebot/crawler hits on dead URLs, and bots don't run the
// client analytics bundle.

// Common crawler/bot user-agents. We still LOG bot hits (a bot hammering a dead
// URL is exactly the SEO signal we want) but flag them so the digest/admin can
// distinguish bot noise from real user dead-ends.
const BOT_RE =
  /bot\b|crawl|spider|slurp|googlebot|google-inspectiontool|bingpreview|yandex|baiduspider|duckduck|petalbot|facebookexternalhit|whatsapp|telegrambot|embedly|semrushbot|ahrefsbot|mj12bot|dataforseo|screaming frog/i;

// A path whose last segment carries a file extension (.php, .map, .png, .env…)
// is almost always a vulnerability probe or a stray asset request, not a real
// content URL worth tracking.
function isAssetLike(path: string): boolean {
  const last = path.split('/').pop() ?? '';
  return /\.[a-z0-9]{1,8}$/i.test(last);
}

export async function logNotFound(input: {
  path: string | null | undefined;
  referer?: string | null;
  userAgent?: string | null;
  isPrefetch?: boolean;
}): Promise<void> {
  try {
    if (isDemo) return;

    // Strip query/hash so "/x?add-to-cart=1" and "/x" aggregate into one row.
    const path = (input.path ?? '').split('?')[0].split('#')[0].trim();
    if (!path || !path.startsWith('/')) return;
    if (input.isPrefetch) return;                                   // router prefetches aren't real misses
    if (path.startsWith('/_next') || path.startsWith('/api/')) return;
    if (isAssetLike(path)) return;                                  // .php/.map/.env probes — noise
    if (path.length > 512) return;                                  // overflow / junk

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
