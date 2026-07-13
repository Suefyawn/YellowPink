// Custom next/image loader → same-origin /img proxy.
//
// History: Vercel's built-in optimiser is metered (the free plan's quota was
// hit once, so it was disabled), and the images.weserv.nl proxy that replaced
// it resizes for free — but weserv's robots.txt blocks crawlers from fetching
// any proxied URL, so with every <img> on the site pointing at weserv, Google
// had ZERO indexable images and no product result ever showed a thumbnail.
//
// Now every <Image> resolves to /img?src=…&w=…&q=… on OUR domain (crawlable,
// cacheable at the Vercel edge); the /img route (src/app/img/route.ts) does
// the actual resize by fetching weserv server-to-server, where robots.txt
// doesn't apply. Same free resizing, but the URLs Google sees are ours.
//
// Must stay isomorphic (runs on server AND client): no node-only imports, and
// only NEXT_PUBLIC_* env. Next calls this for every <Image>, once per srcSet
// width, to build the responsive candidates from deviceSizes/imageSizes.

export default function sameOriginImageLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Leave data URIs (blur placeholders, inline SVG) untouched, and pass
  // legacy already-proxied weserv URLs (stored in old content) through
  // unchanged rather than double-proxying them.
  if (src.startsWith('data:') || src.includes('images.weserv.nl')) return src;
  return `/img?src=${encodeURIComponent(src)}&w=${width}&q=${quality ?? 75}`;
}
