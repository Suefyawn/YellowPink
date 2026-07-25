'use client';

// Meta (Facebook/Instagram) Pixel loader. Activated by NEXT_PUBLIC_META_PIXEL_ID
// and gated on MARKETING consent (the Pixel powers ad targeting/measurement, so
// it belongs to the marketing bucket, GA4 sits in the analytics bucket). When
// no Pixel ID is set, or the visitor hasn't opted into marketing cookies, the
// script never loads.
//
// Commerce events are mirrored from the app's `yp:track` bus (the same bus the
// PostHog forwarder uses) onto Meta standard events (ViewContent, AddToCart,
// InitiateCheckout, Purchase, …) so the IG/FB ad pixel measures the funnel with
// no per-component wiring. Server-side Conversions API is a later addition.

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';
import { useConsent } from '@/lib/consent';
import type { TrackEvent } from '@/lib/analytics';

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
  }
}

const CURRENCY = 'PKR';

// Map our GA4-style events onto Meta standard events + parameters. Events with
// no sensible Meta standard equivalent (view_cart, remove_from_cart) are
// dropped rather than sent as noisy custom events.
function toMetaEvent(e: TrackEvent): { name: string; params: Record<string, unknown> } | null {
  // content_ids must be the CATALOGUE item id — the Meta feed's g:id is the
  // product slug (matching the Google feed and the JSON-LD sku). Sending the
  // DB UUID here made every event unmatchable against the catalogue, which
  // silently disables dynamic/Advantage+ catalogue ads. Slug first; UUID only
  // as a legacy fallback for payloads that predate the slug field.
  const contentId = (p: { slug?: string; product_id?: string }) => p.slug || p.product_id;
  const ids = (p: { slug?: string; product_id?: string }) => (contentId(p) ? [contentId(p)] : undefined);
  switch (e.name) {
    case 'view_item':
      return { name: 'ViewContent', params: {
        content_type: 'product', content_ids: ids(e.payload), content_name: e.payload.product_name,
        value: e.payload.price, currency: e.payload.currency ?? CURRENCY } };
    case 'add_to_cart':
      return { name: 'AddToCart', params: {
        content_type: 'product', content_ids: ids(e.payload), content_name: e.payload.product_name,
        value: e.payload.price, currency: e.payload.currency ?? CURRENCY } };
    case 'begin_checkout':
      return { name: 'InitiateCheckout', params: {
        value: e.payload.value, currency: e.payload.currency ?? CURRENCY,
        num_items: e.payload.items?.length,
        content_ids: e.payload.items?.map(contentId).filter(Boolean) } };
    case 'purchase':
      return { name: 'Purchase', params: {
        value: e.payload.value, currency: e.payload.currency ?? CURRENCY,
        content_type: 'product',
        content_ids: e.payload.items?.map(contentId).filter(Boolean),
        num_items: e.payload.items?.length } };
    case 'search':
      return { name: 'Search', params: { search_string: e.payload.query } };
    case 'sign_up':
      return { name: 'CompleteRegistration', params: { status: true } };
    default:
      return null;
  }
}

// Fire PageView on soft navigations. The base init script already fires the
// first PageView on load, so skip the initial effect run to avoid a double
// count (mirrors the GA4 component's approach).
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    if (typeof window === 'undefined' || typeof window.fbq !== 'function') return;
    window.fbq('track', 'PageView');
  }, [pathname, searchParams]);
  return null;
}

// Bridge `yp:track` → fbq standard events.
function EventBridge() {
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<TrackEvent>).detail;
      if (!detail || typeof window.fbq !== 'function') return;
      const mapped = toMetaEvent(detail);
      if (!mapped) return;
      // Strip undefined params so the pixel payload stays clean.
      const params = Object.fromEntries(Object.entries(mapped.params).filter(([, v]) => v !== undefined));
      // Dedup key for Purchase: the order number, matching the event_id the
      // server-side Conversions API sends, so Meta collapses the two into one.
      const eventID =
        detail.name === 'purchase'
          ? (detail.payload as { transaction_id?: string }).transaction_id
          : undefined;
      try {
        window.fbq('track', mapped.name, params, eventID ? { eventID } : undefined);
      } catch { /* ignore */ }
    };
    window.addEventListener('yp:track', handler as EventListener);
    return () => window.removeEventListener('yp:track', handler as EventListener);
  }, []);
  return null;
}

export function MetaPixel() {
  const { consent } = useConsent();
  if (!PIXEL_ID) return null;
  if (!consent?.marketing) return null;
  return (
    <>
      <Script id="meta-pixel-init" strategy="afterInteractive">
        {`
          !function(f,b,e,v,n,t,s)
          {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};
          if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
          n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];
          s.parentNode.insertBefore(t,s)}(window,document,'script',
          'https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${PIXEL_ID}');
          fbq('track', 'PageView');
        `}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img height="1" width="1" alt="" style={{ display: 'none' }}
          src={`https://www.facebook.com/tr?id=${PIXEL_ID}&ev=PageView&noscript=1`} />
      </noscript>
      {/* useSearchParams() requires a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      <EventBridge />
    </>
  );
}
