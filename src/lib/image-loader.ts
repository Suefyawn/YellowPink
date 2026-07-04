// Custom next/image loader, routes images through images.weserv.nl, a free
// image CDN/proxy, for on-the-fly resize + modern-format (WebP) delivery.
//
// Why: Vercel's built-in optimiser is metered (we hit the quota on the free
// plan, so it was disabled with `unoptimized: true`), which meant full-size
// originals were shipped to phones, the main mobile-LCP drag. weserv resizes
// to the requested width and re-encodes to WebP, for free, with no Vercel
// quota and no Supabase plan change.
//
// Must stay isomorphic (runs on server AND client): no node-only imports, and
// only NEXT_PUBLIC_* env. Next calls this for every <Image>, once per srcSet
// width, to build the responsive candidates from deviceSizes/imageSizes.

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.yellowpink.pk').replace(/\/$/, '');

// The CDN that actually serves every catalogue/blog image (and the LCP hero).
// Exported so the root layout can <link rel="preconnect"> to it, without it,
// the browser pays a full DNS+TCP+TLS handshake to this host before the LCP
// image can start downloading.
export const IMAGE_CDN_ORIGIN = 'https://images.weserv.nl';

// Social-share (og:image / twitter:image) variant: a ~1200px-wide JPEG under
// the proxy. Raw catalogue PNGs run 0.5–1.8 MB, which makes WhatsApp/Facebook
// link previews slow or drop the thumbnail entirely; a resized JPEG (og
// consumers handle JPEG far more reliably than WebP) is ~100–250 KB. Returns
// the source unchanged for data URIs / already-proxied URLs.
export function ogImageUrl(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith('data:') || src.includes('images.weserv.nl')) return src;
  const abs = /^https?:\/\//i.test(src) ? src : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`;
  return `${IMAGE_CDN_ORIGIN}/?url=${encodeURIComponent(abs)}&w=1200&q=80&output=jpg&we`;
}

export default function weservLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Leave data URIs (blur placeholders, inline SVG) and already-proxied URLs
  // untouched, proxying them is pointless or breaks them.
  if (src.startsWith('data:') || src.includes('images.weserv.nl')) return src;

  // Resolve /public-relative paths to an absolute URL on the canonical host so
  // weserv can fetch them.
  const abs = /^https?:\/\//i.test(src)
    ? src
    : `${SITE}${src.startsWith('/') ? '' : '/'}${src}`;

  const q = quality ?? 75;
  // w = target width, q = quality, output=webp = modern format, we = never
  // upscale past the original's dimensions.
  return `${IMAGE_CDN_ORIGIN}/?url=${encodeURIComponent(abs)}&w=${width}&q=${q}&output=webp&we`;
}
