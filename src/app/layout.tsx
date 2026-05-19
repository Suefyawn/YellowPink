// `dynamic = 'force-dynamic'` is restored here after a failed attempt to
// rely on per-page opt-in. The root layout renders the PostHog provider,
// whose PageViewTracker uses useSearchParams() — and prerender chokes on
// that on every user-scoped page (/_not-found, /account/*, …) without a
// Suspense boundary high enough in the tree. Wrapping every consumer in
// Suspense would also work, but force-dynamic at the layout is the
// smaller, safer surface for a launch. The audit perf finding (P0-7) is
// re-queued for a follow-up that splits the PostHog provider into a
// suspended client island.
export const dynamic = 'force-dynamic';

import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { WebVitalsReporter } from '@/components/layout/WebVitalsReporter';
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister';
import { PWAInstallPrompt } from '@/components/layout/PWAInstallPrompt';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { ConsentBanner } from '@/components/legal/ConsentBanner';
import { NewsletterModal } from '@/components/marketing/NewsletterModal';
import { CartAnnouncer } from '@/components/cart/CartAnnouncer';
import { AddToCartToast } from '@/components/cart/AddToCartToast';
import { getSiteSettings } from '@/lib/supabase';
import { getActivePromos, audienceFor } from '@/lib/promos';
import { SITE_URL, SITE_NAME, jsonLd, organizationLd, websiteLd, localBusinessLd } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Imported Beauty & Wellness`,
    template: `%s | ${SITE_NAME}`,
  },
  description: 'International skincare, makeup, and clinical-grade nutraceuticals. Now in Pakistan with COD.',
  applicationName: SITE_NAME,
  // We deleted /icon.svg when installing the flower favicon. Next.js
  // auto-generates /icon and /apple-icon link tags from
  // src/app/icon.png + apple-icon.png, so we don't list them here — listing
  // /icon.svg explicitly was causing a 404'd <link rel="apple-touch-icon">.
  // The .ico is picked up automatically from src/app/favicon.ico too.
  openGraph: {
    siteName: SITE_NAME,
    locale: 'en_PK',
    type: 'website',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: '#F7C948',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  // TODO: read auth session + lifetime-order count to refine the audience.
  // For now everyone is treated as 'guest' so any null-audience or
  // guest-audience promo will match; logged_in / first_time / returning
  // rows will simply not show until the audience resolver is wired to
  // session data.
  const promos = await getActivePromos(audienceFor(false, false));
  return (
    <html lang="en">
      <head>
        {/* Site-wide JSON-LD: Organization + WebSite (sitelinks search box) +
            OnlineStore (PK localisation — currency, payment methods, area
            served). All three render on every page; they are cheap and the
            duplication-across-pages pattern is what Google expects for this
            class of markup. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(localBusinessLd()) }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        <DemoBanner />
        <ConsentBanner />
        <NewsletterModal />
        <WebVitalsReporter />
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
        <Providers>
          <CartAnnouncer />
          <AddToCartToast />
          <SiteChrome settings={settings} promos={promos}>
            {/* tabindex=-1 so the skip-link can focus #main programmatically
                without making it a sequential Tab stop. */}
            <div id="main" tabIndex={-1} style={{ outline: 'none' }}>{children}</div>
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
