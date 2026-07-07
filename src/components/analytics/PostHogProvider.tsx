'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, Suspense } from 'react';
import type { PostHog } from 'posthog-js';
import { isInternalTraffic } from '@/lib/internal-traffic';

// ─── Lazy, deferred PostHog loader ──────────────────────────────────────────
// posthog-js is ~55 KiB and used to be hard-imported into the initial bundle,
// so it parsed + ran on the LCP critical path (mobile LCP ~5.7s, TBT 250ms,
// 2.2s main-thread work). Now it's dynamically imported and initialised only
// once the page is idle. Every capture goes through a queue, so pageviews /
// ecommerce events fired before the SDK finishes loading are flushed the moment
// it's ready — nothing is dropped, it just doesn't block first paint.
let ph: PostHog | null = null;
let loading = false;
const queue: Array<[string, Record<string, unknown> | undefined]> = [];

function initPostHog() {
  if (ph || loading) return;
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || typeof window === 'undefined') return;
  loading = true;
  import('posthog-js')
    .then(({ default: posthog }) => {
      posthog.init(key, {
        api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com',
        capture_pageview: false,
        capture_pageleave: true,
        person_profiles: 'identified_only',
        // Drop events that aren't real storefront customer behaviour, so the
        // funnel/top-pages numbers the owner reads aren't skewed:
        //  1. Anything inside /admin (staff working in the dashboard).
        //  2. Any browser flagged internal (staff who also browse the storefront
        //     to test — the dominant source of "direct" long sessions).
        before_send: (event) => {
          if (event) {
            if (isInternalTraffic()) return null;
            const raw = event.properties?.['$current_url'] ?? event.properties?.['$pathname'];
            let path = '';
            if (typeof raw === 'string') {
              try { path = new URL(raw, 'http://_').pathname; } catch { path = raw; }
            }
            if (path.startsWith('/admin')) return null;
          }
          return event;
        },
      });
      ph = posthog;
      // Flush anything captured before the SDK finished loading.
      for (const [name, payload] of queue.splice(0)) {
        try { posthog.capture(name, payload); } catch { /* ignore */ }
      }
    })
    .catch(() => { loading = false; });
}

// Schedule the (deferred) load without blocking first paint.
function scheduleInit() {
  if (typeof window === 'undefined') return;
  const ric = (window as unknown as { requestIdleCallback?: typeof requestIdleCallback }).requestIdleCallback;
  if (typeof ric === 'function') ric(() => initPostHog(), { timeout: 4000 });
  else setTimeout(initPostHog, 2000);
}

function capture(name: string, payload?: Record<string, unknown>) {
  if (ph) { try { ph.capture(name, payload); } catch { /* ignore */ } return; }
  queue.push([name, payload]);
  // Ensure the SDK is (being) loaded so the queue eventually flushes even if
  // the idle callback hasn't fired yet.
  scheduleInit();
}

function PageViewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!pathname) return;
    let url = window.origin + pathname;
    const qs = searchParams.toString();
    if (qs) url += `?${qs}`;
    capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// Forward `yp:track` window events (dispatched by lib/analytics.ts) to PostHog.
// lib/analytics stays vendor-neutral; PostHog gets the ecommerce events
// (add_to_cart, begin_checkout, purchase, etc.) without lib/analytics
// hard-importing posthog-js.
function YpTrackForwarder() {
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ name?: string; payload?: Record<string, unknown> }>).detail;
      if (!detail?.name) return;
      capture(detail.name, detail.payload);
    };
    window.addEventListener('yp:track', handler);
    return () => window.removeEventListener('yp:track', handler);
  }, []);
  return null;
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  // Warm the SDK once the page is idle so the first pageview is ready to send
  // without competing with LCP.
  useEffect(() => { scheduleInit(); }, []);

  return (
    <>
      <Suspense fallback={null}>
        <PageViewTracker />
      </Suspense>
      <YpTrackForwarder />
      {children}
    </>
  );
}
