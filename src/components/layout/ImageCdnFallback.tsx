'use client';

import { useEffect } from 'react';

// Availability hardening for proxied imagery: every catalogue/blog image is
// resized through the same-origin /img route (which fetches weserv
// server-side; the route itself 302s to the original if weserv fails). This
// client-side layer covers the remaining failure mode — the /img function
// erroring outright — plus legacy weserv URLs still stored in old content.
// Since every original lives first-party (Supabase storage / public assets),
// the worst case should be "slower images", never "broken images": when a
// proxied <img> errors, swap it back to the original URL carried in the
// proxy's ?src= (or legacy ?url=) param. One capture-phase listener covers
// every image on the site — error events don't bubble, so document-level
// capture is the only global hook — with a per-image once-guard so a broken
// ORIGINAL can't loop.
export function ImageCdnFallback() {
  useEffect(() => {
    const onError = (e: Event) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement)) return;
      if (img.dataset.cdnFallback) return;
      const src = img.currentSrc || img.src;
      // Same-origin /img proxy (current) carries the original in ?src=;
      // legacy weserv URLs (older cached HTML / stored content) in ?url=.
      const isProxied = src.includes('/img?') || src.includes('images.weserv.nl');
      if (!isProxied) return;
      try {
        const u = new URL(src, window.location.origin);
        let original = u.searchParams.get('url') ?? u.searchParams.get('src');
        if (original && original.startsWith('/')) original = `${window.location.origin}${original}`;
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
