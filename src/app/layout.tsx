// `dynamic = 'force-dynamic'` was previously set here to dodge the
// useSearchParams() inside PageViewTracker prerendering on user-scoped
// pages. That tracker is now wrapped in <Suspense> inside
// `src/components/analytics/PostHogProvider.tsx`, so the layout can
// stay edge-cacheable and per-page `revalidate = N` rules in
// `next.config.ts` actually take effect. Removing the override was the
// P0-1 finding in the 2026-05-19 launch-readiness audit.

import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';

// next/font/google self-hosts the woff2 + emits preload links automatically.
// CSS bridges via the `variable` option, globals.css reads
// --font-display / --font-ui and applies them to .display-*, .h*, body.
const fontDisplay = Fraunces({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
});
const fontUI = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ui',
  display: 'swap',
});
import { SiteChrome } from '@/components/layout/SiteChrome';
import { activeSeasonalTheme } from '@/lib/seasonal-theme';
import { GoogleAnalytics } from '@/components/analytics/GoogleAnalytics';
import { MetaPixel } from '@/components/analytics/MetaPixel';
import { AttributionCapture } from '@/components/analytics/AttributionCapture';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { WebVitalsReporter } from '@/components/layout/WebVitalsReporter';
import { ServiceWorkerRegister } from '@/components/layout/ServiceWorkerRegister';
import { PWAInstallPrompt } from '@/components/layout/PWAInstallPrompt';
import { ImageCdnFallback } from '@/components/layout/ImageCdnFallback';
import { DemoBanner } from '@/components/layout/DemoBanner';
import { ConsentBanner } from '@/components/legal/ConsentBanner';
import { NewsletterModal } from '@/components/marketing/NewsletterModal';
import { getWelcomeOffer } from '@/lib/offers';
import { CartAnnouncer } from '@/components/cart/CartAnnouncer';
import { AddToCartToast } from '@/components/cart/AddToCartToast';
import { CouponCapture } from '@/components/marketing/CouponCapture';
import { getBestsellers } from '@/lib/supabase';
import { getStorefrontSettings } from '@/lib/preview-look';
import { PreviewRibbon } from '@/components/layout/PreviewRibbon';
import { parseCommerceConfig } from '@/lib/commerce';
import { getVendorFreeShipThresholds } from '@/lib/shipping';
import { loadTrendingBrands, loadPopularCategories } from '@/lib/search-data';
import { getPublishedCollections } from '@/lib/collections-data';
import { SITE_URL, SITE_NAME, jsonLd, organizationLd, websiteLd } from '@/lib/seo';
import { socialSameAs } from '@/lib/socials';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Homepage title leads with the concrete high-volume PK head nouns
    // ("skincare", "makeup", "supplements") + the geo keyword, so the root
    // domain is a clear landing target for "skincare/skin care products/
    // korean skincare/makeup Pakistan" queries, not just the brand name.
    // Child pages use the template and supply their own title.
    default: `${SITE_NAME}, Skincare, Makeup & Supplements in Pakistan`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    'Shop authentic imported skincare, Korean beauty, makeup and wellness supplements in Pakistan, 100% genuine brands like CeraVe, Anua & The Ordinary, with COD.',
  applicationName: SITE_NAME,
  // Explicitly opt into large image previews + full snippets in Google. Without
  // a max-image-preview directive Google shows previews at its own (often
  // conservative) discretion, which is a common reason product results render as
  // a plain link with no packshot thumbnail while competitors show one. Pages
  // that must stay out of the index set their own `robots:{index:false}` via
  // pageMeta(), which overrides this; private surfaces are also robots.txt-
  // disallowed. (max-snippet/-video:-1 = no limit.)
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  },
  // We deleted /icon.svg when installing the flower favicon. Next.js
  // auto-generates /icon and /apple-icon link tags from
  // src/app/icon.png + apple-icon.png, so we don't list them here, listing
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
    // Next normalizes this to the slashless form regardless of a trailing
    // slash in the value (verified on a preview build), so the sitemap's root
    // entry uses the slashless URL too — the two must agree, and the
    // canonical side is not configurable.
    canonical: SITE_URL,
  },
  // Google Search Console verification is rendered as a runtime <meta> in
  // RootLayout (below) so the owner can paste the code in Admin → Settings →
  // Integrations without a redeploy; it falls back to GOOGLE_SITE_VERIFICATION.
};

export const viewport: Viewport = {
  themeColor: '#F7C948',
  // Every theme is light; declaring it stops native controls (selects,
  // suggestion popups, scrollbars) rendering dark on dark-mode devices —
  // the checkout city dropdown was appearing as a detached dark overlay.
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [{ settings, preview }, searchTrending, searchCategories, welcomeOffer, footerCollections, cartCrossSell, vendorFreeShipThresholds] = await Promise.all([
    // Storefront-effective settings: identical to the stored settings except
    // for a staff member holding a look preview (Sales & occasions), whose
    // request renders with the previewed occasion overlaid.
    getStorefrontSettings(),
    loadTrendingBrands(),
    loadPopularCategories(),
    getWelcomeOffer(),
    // Footer "Collections" column: published collections, curated order.
    // Slimmed to {slug,title} below so the client chrome payload stays tiny.
    getPublishedCollections(6),
    // Bestseller pool for the mini-cart's cross-sell row. Over-fetched so the
    // drawer can skip whatever's already in the bag (and variable/sold-out
    // items) and still have a candidate.
    getBestsellers(6),
    // Vendor free-shipping thresholds (NB Sons ≥ Rs 1,999) so the cart bar,
    // mini-cart and checkout's optimistic estimate apply the same rule the
    // server enforces instead of telling a qualified basket to "add more".
    getVendorFreeShipThresholds(),
  ]);
  // Social profiles + store contact are owner-managed (admin Settings); the
  // JSON-LD reads from the same source as the footer.
  const sameAs = socialSameAs(settings);
  const orgContact = { phone: settings.store_phone, email: settings.store_email };
  // Seasonal theme (manual switch or scheduled window, resolved in one place
  // by activeSeasonalTheme). This server value is the initial paint; the
  // chrome re-resolves on the client clock because this layout render lives
  // in the route's long-cached shell (see SiteChrome).
  const seasonal = activeSeasonalTheme(settings);
  // GA4 + Search Console are owner-managed (Admin → Settings → Integrations),
  // stored in site_settings; fall back to env so existing deployments keep
  // working. Reading them here means changing the IDs needs no redeploy.
  const gaMeasurementId = settings.ga_measurement_id?.trim() || undefined;
  const gscVerification = settings.google_site_verification?.trim() || process.env.GOOGLE_SITE_VERIFICATION || undefined;
  // Meta (Facebook/Instagram) domain verification, required in Business Manager
  // to claim the domain for Aggregated Event Measurement and to control which
  // ad accounts may run conversion events for it. Owner-set in admin, env
  // fallback; rendered as a runtime <meta> like the GSC tag above.
  const fbDomainVerification = settings.facebook_domain_verification?.trim() || process.env.FACEBOOK_DOMAIN_VERIFICATION || undefined;
  // Bing Webmaster Tools meta-tag verification (msvalidate.01). Same
  // owner-set-in-admin / env-fallback pattern as the Google tag; importing
  // the property from Search Console needs no tag, this is the backup route.
  const bingVerification = settings.bing_site_verification?.trim() || process.env.BING_SITE_VERIFICATION || undefined;
  // Single source of truth for free-shipping copy/threshold across the
  // storefront, seeds the client CommerceSettings provider so the cart,
  // mini-cart, PDP and checkout never drift from the owner's setting.
  const commerce = { ...parseCommerceConfig(settings), vendorFreeShipThresholds };
  // Origin that serves catalogue/blog images, used for an early preconnect.
  const supabaseOrigin = (() => {
    try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin; } catch { return null; }
  })();
  return (
    <html
      lang="en"
      // Initial palette. SiteChrome re-stamps this attribute client-side on
      // the live clock, so a scheduled flip lands on time even when this
      // shell render is cache-stale.
      data-theme={seasonal?.key ?? 'default'}
      className={`${fontDisplay.variable} ${fontUI.variable}`}
    >
      <head>
        {/* Images are served same-origin via /img (src/app/img/route.ts) so
            crawlers can index them; no third-party image-CDN preconnect is
            needed any more. The Supabase origin is still preconnected: the
            JS client hits it for data/API. */}
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} crossOrigin="anonymous" />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
        {/* Google Search Console ownership verification (owner-set in admin,
            env fallback). Only rendered when a code is present. */}
        {gscVerification && <meta name="google-site-verification" content={gscVerification} />}
        {/* Meta domain verification (owner-set in admin, env fallback). */}
        {fbDomainVerification && <meta name="facebook-domain-verification" content={fbDomainVerification} />}
        {bingVerification && <meta name="msvalidate.01" content={bingVerification} />}
        {/* Site-wide JSON-LD: a single Organization node (@id-referenced by
            WebSite.publisher) plus WebSite for the sitelinks search box.
            Both render on every page, the duplication-across-pages pattern
            is what Google expects for this class of markup. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationLd(sameAs, orgContact)) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteLd()) }}
        />
      </head>
      <body>
        <a href="#main" className="skip-link">Skip to main content</a>
        {preview && <PreviewRibbon name={preview.name} />}
        <DemoBanner />
        <ConsentBanner />
        <NewsletterModal discountPct={welcomeOffer ? welcomeOffer.pct : null} />
        <GoogleAnalytics measurementId={gaMeasurementId} />
        <MetaPixel />
        <AttributionCapture />
        <WebVitalsReporter />
        <Analytics />
        <SpeedInsights />
        <ServiceWorkerRegister />
        <PWAInstallPrompt />
        <ImageCdnFallback />
        <Providers commerce={commerce}>
          <CartAnnouncer />
          <AddToCartToast />
          <CouponCapture />
          <SiteChrome
            settings={settings}
            seasonal={seasonal}
            searchTrending={searchTrending}
            searchCategories={searchCategories}
            footerCollections={footerCollections.map(c => ({ slug: c.slug, title: c.title }))}
            cartCrossSell={cartCrossSell}
          >
            {/* tabindex=-1 so the skip-link can focus #main programmatically
                without making it a sequential Tab stop. */}
            <div id="main" tabIndex={-1} style={{ outline: 'none' }}>{children}</div>
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
