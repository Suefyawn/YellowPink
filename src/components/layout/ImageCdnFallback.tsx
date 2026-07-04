'use client';

import { useEffect } from 'react';

// Availability hardening for the images.weserv.nl proxy (2026-07 planned
// session): every catalogue/blog image is optimised through the free weserv
// CDN (measured ~5× smaller, ~3× faster than origin), but that makes a
// third-party the single point of failure for ALL imagery. Since every
// original lives first-party (Supabase storage / public assets), the worst
// case should be "slower images", never "broken images": when a weserv-proxied
// <img> errors, swap it back to the original URL carried in the proxy's ?url=
// param. One capture-phase listener covers every image on the site — error
// events don't bubble, so document-level capture is the only global hook —
// with a per-image once-guard so a broken ORIGINAL can't loop.
export function ImageCdnFallback() {
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.cdnFallback) return;
      const src = img.currentSrc || img.src;
      if (!src.includes('images.weserv.nl')) return;
      try {
        const original = new URL(src).searchParams.get('url');
        if (!original || !/^https?:\/\//i.test(original)) return;
        img.dataset.cdnFallback = '1';
        // srcset would win over src again — clear it so the swap sticks.
        img.removeAttribute('srcset');
        img.removeAttribute('sizes');
        img.src = original;
      } catch {
        /* malformed URL — leave the browser's broken-image state */
      }
    };
    document.addEventListener('error', onError, true);
    return () => document.removeEventListener('error', onError, true);
  }, []);

  return null;
}
