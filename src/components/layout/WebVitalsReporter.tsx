'use client';

import { useEffect } from 'react';
import { captureMessage } from '@/lib/monitoring';

// Reports Core Web Vitals (LCP, CLS, INP, etc.) using Next.js' built-in
// reportWebVitals hook via useReportWebVitals. We forward to:
//   • console (dev)
//   • Sentry / captureMessage (prod, when configured)
//
// Next 16 ships useReportWebVitals via 'next/web-vitals' (per the docs).
// If that import path differs in your install, swap to next/script + the
// `<script>` snippet from the Vercel Speed Insights docs.

import { useReportWebVitals } from 'next/web-vitals';

interface Metric {
  name: string;
  value: number;
  id: string;
  rating?: 'good' | 'needs-improvement' | 'poor';
  navigationType?: string;
}

export function WebVitalsReporter() {
  useReportWebVitals((metric: Metric) => {
    // Dev: log to console for inspection.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.debug('[vitals]', metric.name, Math.round(metric.value), metric.rating);
    }
    // Prod: surface only poor metrics so we don't flood the monitor.
    if (metric.rating === 'poor') {
      void captureMessage(`Web Vital ${metric.name} = ${Math.round(metric.value)} (poor)`, 'warning');
    }
  });

  // Render nothing — it's a side-effect-only component.
  useEffect(() => () => undefined, []);
  return null;
}
