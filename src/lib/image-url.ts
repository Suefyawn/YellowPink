// ============================================================================
// Supabase Storage image sizing.
//
// Supabase's image transformation endpoint is enabled on this project
// (verified 2026-08-15: /storage/v1/render/image/public/images/<path>?width=…
// returns a resized derivative). `sizedImageUrl` rewrites a *public object*
// URL on our Supabase project into that render URL so a small thumbnail cell
// downloads a small file instead of the multi-megabyte original.
//
// Context on where this actually applies: the catalogue was migrated to
// Cloudflare R2 (images.yellowpink.pk) in Aug 2026, and everything rendered
// through next/image already resizes via the same-origin /img proxy
// (src/lib/image-loader.ts → src/app/img/route.ts). Supabase URLs therefore
// only surface from LEGACY data (old order/cart snapshots, e.g. the review-ask
// and campaign emails, where next/image can't run) and from the Supabase
// fallback path in src/lib/media-storage.ts when R2 env vars are absent.
// This helper is the safety net for exactly those spots.
//
// Safety contract: anything that is not a Supabase public-object image URL
// (R2 URLs, site-relative paths, data: URIs, videos, svg/gif, signed URLs,
// URLs that already carry a query string) passes through COMPLETELY
// unchanged — the helper must never break a working image.
// ============================================================================

// <host>/storage/v1/object/public/<bucket>/<path> with no query/fragment.
const SUPABASE_PUBLIC_OBJECT =
  /^(https:\/\/[^/]+\.supabase\.(?:co|in))\/storage\/v1\/object\/public\/([^?#]+)$/;

// Formats the render endpoint transforms well. Deliberately excludes svg
// (rasterising it is a downgrade), gif (animation would be lost) and any
// video/unknown extension.
const TRANSFORMABLE = /\.(?:jpe?g|png|webp|avif)$/i;

// Supabase transformation bounds (width 16–2500, quality 20–100).
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/**
 * Rewrite a Supabase Storage public-object URL into a sized render URL
 * (`width` px, WebP/AVIF negotiated automatically via the Accept header —
 * no `format` param means "auto"). Any other input is returned unchanged.
 */
export function sizedImageUrl(url: string, width: number, quality = 75): string {
  if (!url) return url;
  const m = SUPABASE_PUBLIC_OBJECT.exec(url);
  if (!m) return url;
  const [, origin, bucketAndPath] = m;
  if (!TRANSFORMABLE.test(bucketAndPath)) return url;
  const w = clamp(width, 16, 2500);
  const q = clamp(quality, 20, 100);
  return `${origin}/storage/v1/render/image/public/${bucketAndPath}?width=${w}&quality=${q}`;
}
