'use client';

// Google tag (gtag.js) loader — GA4 analytics AND Google Ads (conversions +
// remarketing). Activated by a GA4 Measurement ID and/or Google Ads ID, which
// the owner can set in Admin → Settings → Integrations (stored in
// site_settings and passed in as props by the root layout) OR via the
// NEXT_PUBLIC_GA_MEASUREMENT_ID / NEXT_PUBLIC_GOOGLE_ADS_ID env vars as a
// fallback. Gated on analytics consent (visitors who haven't opted in never
// download the script).
//
// GA4 commerce events (view_item / add_to_cart / purchase / …) are forwarded to
// window.gtag by lib/analytics.ts's track() helper. On top of that:
//   • configuring the AW- id arms Google Ads remarketing audiences, and
//   • AdsConversionBridge fires the Ads purchase *conversion* on checkout,
//     using the order number as transaction_id (dedup across uploads).

import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { useConsent } from '@/lib/consent';
import type { TrackEvent } from '@/lib/analytics';

const ADS_PURCHASE_LABEL = process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL;  // conversion action label

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

// Fires a manual `page_view` on every route change (App Router doesn't auto-fire
// on soft nav). GA4 only — no-op when GA4 isn't configured.
function PageviewTracker({ gaId }: { gaId?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  useEffect(() => {
    if (!gaId || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const qs = searchParams?.toString();
    const path = qs ? `${pathname}?${qs}` : pathname;
    window.gtag('event', 'page_view', {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [gaId, pathname, searchParams]);
  return null;
}

// Fires the Google Ads purchase conversion from the yp:track bus. Remarketing
// is handled by the AW- config below; this adds the conversion action so Ads
// can attribute revenue. No-op unless an Ads id + purchase label are set.
function AdsConversionBridge({ adsId }: { adsId?: string }) {
  useEffect(() => {
    if (!adsId || !ADS_PURCHASE_LABEL) return;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<TrackEvent>).detail;
      if (detail?.name !== 'purchase' || typeof window.gtag !== 'function') return;
      const p = detail.payload as { value?: number; currency?: string; transaction_id?: string };
      window.gtag('event', 'conversion', {
        send_to: `${adsId}/${ADS_PURCHASE_LABEL}`,
        value: p.value,
        currency: p.currency ?? 'PKR',
        transaction_id: p.transaction_id,
      });
    };
    window.addEventListener('yp:track', handler as EventListener);
    return () => window.removeEventListener('yp:track', handler as EventListener);
  }, [adsId]);
  return null;
}

export function GoogleAnalytics({ measurementId, adsId }: { measurementId?: string; adsId?: string } = {}) {
  const { consent } = useConsent();
  // Admin-settings value wins; fall back to the build-time env var.
  const gaId = (measurementId?.trim() || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) || undefined;
  const ads = (adsId?.trim() || process.env.NEXT_PUBLIC_GOOGLE_ADS_ID) || undefined;
  const primaryId = gaId ?? ads;
  if (!primaryId) return null;
  if (!consent?.analytics) return null;
  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${primaryId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          window.gtag = gtag;
          gtag('js', new Date());
          ${gaId ? `gtag('config', '${gaId}', { send_page_view: false, anonymize_ip: true });` : ''}
          ${ads ? `gtag('config', '${ads}');` : ''}
        `}
      </Script>
      {/* useSearchParams() requires a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <PageviewTracker gaId={gaId} />
      </Suspense>
      <AdsConversionBridge adsId={ads} />
    </>
  );
}
