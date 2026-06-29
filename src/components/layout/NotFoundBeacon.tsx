'use client';

import { useEffect } from 'react';

// Reports the missed path to /api/404 from the (now static) not-found page.
// Replaces the old server-side headers() read, which forced every route into
// dynamic rendering. Fires once on mount with the real URL; router prefetches
// don't run this effect, so prefetch misses aren't logged (which is correct).
export function NotFoundBeacon() {
  useEffect(() => {
    try {
      const payload = JSON.stringify({
        path: window.location.pathname,
        referer: document.referrer,
      });
      const ok = typeof navigator !== 'undefined' && navigator.sendBeacon
        ? navigator.sendBeacon('/api/404', new Blob([payload], { type: 'application/json' }))
        : false;
      if (!ok) {
        void fetch('/api/404', { method: 'POST', body: payload, keepalive: true, headers: { 'content-type': 'application/json' } });
      }
    } catch {
      /* a dropped 404 beacon is never worth surfacing */
    }
  }, []);
  return null;
}
