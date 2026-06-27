'use client';

import { useEffect } from 'react';
import { captureMessage } from '@/lib/monitoring';
import { useConsent } from '@/lib/consent';

// Reports Core Web Vitals (LCP, CLS, INP, etc.) using Next.js' built-in
// reportWebVitals hook via useReportWebVitals. We forward to:
//   • console (dev), always, regardless of consent (developer signal only)
//   • /api/vitals (prod), ONLY on consent — persists every Core Web Vital so
//     the admin Analytics page can show real in-app p75 field performance
//     (Vercel Speed Insights has no public query API to pull those from)
//   • Sentry / captureMessage (prod), poor scores only, as before
//
// Next 16 ships useReportWebVitals via 'next/web-vitals'.

import { useReportWebVitals } from 'next/web-vitals';
import { isInternalTraffic } from '@/lib/internal-traffic';

interface Metric {
  name: string;
  value: number;
  id: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
}

// Only the standard Core Web Vitals are worth persisting; Next also emits
// Next-hydration/render custom metrics we don't store. Mirrors the allow-list
// in the /api/vitals route (defence in depth — cheaper to skip the beacon).
const CWV = new Set(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']);

// Fire-and-forget beacon. sendBeacon survives page unload (when LCP/CLS often
// finalise), falling back to keepalive fetch where it's unavailable.
function beacon(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon('/api/vitals', new Blob([body], { type: 'application/json' }));
    } else {
      void fetch('/api/vitals', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } });
    }
  } catch {
    // A dropped vitals sample is never worth surfacing.
  }
}

export function WebVitalsReporter() {
  const { consent } = useConsent();
  const analyticsAllowed = consent?.analytics === true;

  useReportWebVitals((metric: Metric) => {
    // Dev console is always-on, pure developer signal, no PII leaves the
    // browser. Production reporting is gated on consent.
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[vitals]', metric.name, Math.round(metric.value), metric.rating);
      return;
    }
    if (!analyticsAllowed) return;
    // Staff/owner testing skews the field p75; drop their samples too.
    if (isInternalTraffic()) return;

    // Persist every Core Web Vital for the in-app dashboard. Pathname only (no
    // query string) so routes group cleanly and no token/email rides along.
    if (CWV.has(metric.name)) {
      const nav = typeof navigator !== 'undefined'
        ? (navigator as Navigator & { connection?: { effectiveType?: string } }).connection
        : undefined;
      beacon({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        route: typeof window !== 'undefined' ? window.location.pathname : undefined,
        connection: nav?.effectiveType,
      });
    }

    if (metric.rating === 'poor') {
      void captureMessage(`Web Vital ${metric.name} = ${Math.round(metric.value)} (poor)`, 'warning');
    }
  });

  // Render nothing, it's a side-effect-only component.
  useEffect(() => () => undefined, []);
  return null;
}
