// ============================================================================
// Legacy Supabase Storage image sizing.
//
// `sizedImageUrl` rewrites a Supabase *public object* URL into a sized
// derivative so a small thumbnail cell downloads a small file instead of the
// multi-megabyte original. It routes through the site's own /img proxy
// (src/app/img/route.ts → weserv, the same pipeline every storefront
// next/image uses), NOT Supabase's render endpoint: image transformations
// are a Pro-plan feature and the store is moving back to the Free plan
// (owner directive, 16 Aug 2026), where render URLs would 400.
//
// Context on where this actually applies: the catalogue was migrated to
// Cloudflare R2 (images.yellowpink.pk) in Aug 2026, and everything rendered
// through next/image already resizes via /img. Supabase URLs therefore only
// surface from LEGACY data (old order/cart snapshots, e.g. the review-ask
// and campaign emails, where next/image can't run) and from the Supabase
// fallback path in src/lib/media-storage.ts when R2 env vars are absent.
// This helper is the safety net for exactly those spots.
//
// Safety contract: anything that is not a Supabase public-object image URL
// (R2 URLs, site-relative paths, data: URIs, videos, svg/gif, signed URLs,
// URLs that already carry a query string) passes through COMPLETELY
// unchanged — the helper must never break a working image.
// ============================================================================

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.yellowpink.pk';

// <host>/storage/v1/object/public/<bucket>/<path> with no query/fragment.
const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[^/]+\.supabase\.(?:co|in))\/storage\/v1\/object\/public\/([^?#]+)$/;

// Formats the resizer transforms well. Deliberately excludes svg
// (rasterising it is a downgrade), gif (animation would be lost) and any
// video/unknown extension.
const TRANSFORMABLE = /\.(?:jpe?g|png|webp|avif)$/i;

// /img route bounds (mirrors next.config deviceSizes and its quality clamp).
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/**
 * Rewrite a Supabase Storage public-object URL into a sized derivative served
 * by the site's /img proxy (`width` px, WebP, never upscaled). Any other
 * input is returned unchanged.
 */
export function sizedImageUrl(url: string, width: number, quality = 75): string {
  if (!url) return url;
  const m = SUPABASE_PUBLIC_OBJECT.exec(url);
  if (!m) return url;
  if (!TRANSFORMABLE.test(m[2])) return url;
  const w = clamp(width, 16, 1920);
  const q = clamp(quality, 30, 90);
  return `${SITE}/img?src=${encodeURIComponent(url)}&w=${w}&q=${q}`;
}
