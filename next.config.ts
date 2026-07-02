import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

// Two bundle-analysis paths:
//
//   1. `npm run analyze` — Next 16's first-party Turbopack bundle analyzer
//      (`next experimental-analyze`). Recommended for everyday inspection.
//
//   2. `npm run build:analyze` — the older webpack-based @next/bundle-analyzer
//      treemap. Opts out of Turbopack (--no-turbopack) so the plugin can
//      actually hook the compile. Outputs HTML to `.next/analyze/`.
//
// We wire the webpack plugin here so it activates on the ANALYZE=true env;
// it's a no-op otherwise. Zero cost in normal CI runs.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : null;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  // The admin "User manual" page (/admin/help) reads docs/USER-MANUAL.md from
  // disk at request time. That file isn't statically imported, so Next's trace
  // wouldn't bundle it into the serverless function — force-include it for this
  // route so the read works on Vercel as well as locally.
  outputFileTracingIncludes: {
    '/admin/help': ['./docs/USER-MANUAL.md'],
  },
  // Image optimisation: allow Supabase Storage + the WP source host (set
  // WP_IMAGE_HOST in env if your Woo images live somewhere else).
  images: {
    // Vercel's Image Optimization (the /_next/image transformer) is metered;
    // on the free plan we exhausted the monthly quota, after which it 402s and
    // images render blank. Instead of serving originals un-optimised, we route
    // every <Image> through a custom loader (src/lib/image-loader.ts) that
    // proxies images.weserv.nl — a free CDN that resizes to the requested
    // width and re-encodes to WebP, with no Vercel quota and no Supabase plan
    // change. deviceSizes/imageSizes still drive the responsive srcSet widths.
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    // Tight breakpoint set so we don't request dozens of derivatives per
    // image. Storefront tiles render at <= 480 px on phones, ~360 px in a
    // 4-up grid on desktop, and full-bleed at 1080 px on hero shots.
    deviceSizes: [360, 480, 640, 828, 1080, 1440, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    remotePatterns: [
      // Supabase Storage on the configured project.
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
      // Allow the WP origin (until media migration is done). yellowpink.pk
      // is the live WordPress storefront we're migrating from; whitelisting
      // it explicitly so demo data renders without setting WP_IMAGE_HOST.
      ...(process.env.WP_IMAGE_HOST ? [{ protocol: 'https' as const, hostname: process.env.WP_IMAGE_HOST }] : []),
      { protocol: 'https' as const, hostname: 'yellowpink.pk' },
      // Canonical production host. Product photos committed under /public are
      // served from here and stored as absolute image_urls (they also feed
      // OG/JSON-LD), so next/image must be allowed to optimise this host.
      { protocol: 'https' as const, hostname: 'www.yellowpink.pk' },
      // Common CDNs people host product imagery on.
      { protocol: 'https' as const, hostname: 'images.unsplash.com' },
      { protocol: 'https' as const, hostname: 'res.cloudinary.com' },
      // NB Sons (the in-house brand) Shopify store — a few collection cover
      // banners are reused from there. Forward-compat for if/when image
      // optimization is re-enabled; today images render unoptimized anyway.
      { protocol: 'https' as const, hostname: 'cdn.shopify.com' },
    ],
  },
  // Edge compression.
  compress: true,
  // Allow Claude Preview / common dev tooling to load HMR + dev fonts when the
  // browser hits 127.0.0.1 instead of localhost. Next 16 blocks cross-origin
  // dev resources by default; this is a dev-only allowlist (does NOT affect
  // production routing).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Permanent redirects. `/products/*` (plural) is a stray path — the real
  // product route is the singular `/product/:slug`. A 308 keeps any inbound
  // link or stale crawl pointed at the right URL instead of hitting a 404.
  async redirects() {
    return [
      { source: '/products/:slug', destination: '/product/:slug', permanent: true },
      { source: '/products', destination: '/shop', permanent: true },
      // Policy content lives under /page/:slug; bare /returns is a common
      // inbound guess (and was 404ing), so alias it to the returns policy.
      { source: '/returns', destination: '/page/returns', permanent: true },
      // Blog cannibalization cleanup (migration 192): duplicate posts were
      // consolidated onto one canonical each; 308 the removed slugs so their
      // crawl/link equity flows to the survivor instead of 404ing.
      { source: '/blog/vit-kd-vitamin-d3-10000-iu-k2-pakistan-2', destination: '/blog/vit-kd-vitamin-d3-10000-iu-k2-pakistan', permanent: true },
      { source: '/blog/vit-kd-vitamin-d3-k2-bone-heart-health-pakistan', destination: '/blog/vit-kd-vitamin-d3-10000-iu-k2-pakistan', permanent: true },
      { source: '/blog/how-to-increase-sperm-count-naturally-pakistan', destination: '/blog/increase-sperm-count-naturally-pakistan-guide', permanent: true },
      // Force apex → www as a PERMANENT (308) redirect. The platform default
      // can be a temporary 307 (SEO audit: "temporary redirects"); this pins
      // it at the app layer so link equity consolidates on the www host.
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'yellowpink.pk' }],
        destination: 'https://www.yellowpink.pk/:path*',
        permanent: true,
      },
    ];
  },
  // Security + caching response headers. Applied to every storefront response
  // so we get HSTS (closes the Semrush "No HSTS support" finding), a sensible
  // Referrer-Policy + Permissions-Policy, and a strong X-Content-Type-Options.
  // Static `/_next/image/*` results also get a long browser cache.
  //
  // Caching strategy (Vercel CDN):
  // ─ Public catalog routes (home, shop, PDP, blog, /page/:slug) get a short
  //   `s-maxage` so the CDN serves cached HTML between renders, plus a long
  //   `stale-while-revalidate` window so a slow Supabase fetch never blocks
  //   the visitor.
  // ─ Private surfaces (admin, account, cart, checkout, login flows) get
  //   `private, no-store` so they never land in a shared cache — important
  //   because pages like /account/orders contain user-scoped data.
  // ─ Crawler endpoints (sitemap, robots, llms.txt) get longer s-maxage.
  // ─ Everything else falls through with the framework default.
  async headers() {
    // ── Content-Security-Policy (REPORT-ONLY for now) ──────────────────────
    // Deliberately shipped as Content-Security-Policy-Report-Only first: the
    // storefront loads several third-party SDKs (GA4/gtag, Meta Pixel,
    // PostHog + session replay, Sentry, Vercel Analytics/Speed Insights,
    // Supabase) and an enforcing policy with a missed source would silently
    // break checkout analytics or session auth. Violations surface in the
    // browser console (and at Sentry's CSP endpoint when a DSN is set).
    //
    // TODO(promote): after 2–4 weeks of clean monitoring, rename the header
    // key below to 'Content-Security-Policy' to start enforcing.
    //
    // Source inventory (from the codebase's script srcs / SDK endpoints):
    //   GA4/gtag        script  www.googletagmanager.com
    //                   connect *.google-analytics.com, analytics.google.com,
    //                           stats.g.doubleclick.net (+ Google Ads conversion
    //                           scripts when NEXT_PUBLIC_GOOGLE_ADS_ID is set)
    //   Meta Pixel      script  connect.facebook.net; beacons www.facebook.com/tr
    //   PostHog         script/connect us.i.posthog.com + us-assets.i.posthog.com
    //                   (NEXT_PUBLIC_POSTHOG_HOST default; replay worker = blob:)
    //   Sentry          connect *.ingest.sentry.io / *.ingest.us.sentry.io
    //   Vercel          script /_vercel/* (same-origin in prod),
    //                   va.vercel-scripts.com (dev); connect vitals.vercel-insights.com
    //   Supabase        connect https + wss on the configured project host
    //   Images          images.weserv.nl proxy + assorted CDNs → img-src https:
    //   Fonts           self-hosted via next/font → no Google Fonts origins
    //   Payments        JazzCash/Easypaisa hand-off is a full-page form POST → form-action
    //   wa.me links     plain navigation, not governed by CSP
    const connectSrc = [
      "'self'",
      ...(supabaseHost ? [`https://${supabaseHost}`, `wss://${supabaseHost}`] : []),
      'https://*.google-analytics.com',
      'https://analytics.google.com',
      'https://stats.g.doubleclick.net',
      'https://www.googletagmanager.com',
      // gtag's ad-conversion linking pings (/ccm/collect, /pagead/…) go to
      // www.google.com and the visitor's country domain — for this store's
      // audience that's google.com.pk. First live Sentry CSP reports
      // (YELLOWPINK-2/3/4, 2026-07-02) were exactly these two hosts.
      'https://www.google.com',
      'https://www.google.com.pk',
      'https://www.facebook.com',
      'https://us.i.posthog.com',
      'https://us-assets.i.posthog.com',
      'https://*.ingest.sentry.io',
      'https://*.ingest.us.sentry.io',
      'https://vitals.vercel-insights.com',
      'https://va.vercel-scripts.com',
    ];
    // Vercel's preview toolbar (vercel.live) injects its own script/iframe on
    // preview deployments only — allow it there so previews don't drown the
    // Sentry CSP feed in noise, while production stays strict.
    const isPreview = process.env.VERCEL_ENV === 'preview';
    if (isPreview) connectSrc.push('https://vercel.live', 'wss://*.pusher.com');
    // CSP violation reports → Sentry's security endpoint, derived from the
    // DSN when configured (no-op otherwise; reports then only hit the console).
    const cspReportUri = (() => {
      try {
        const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
        if (!dsn) return null;
        const u = new URL(dsn);
        return `https://${u.host}/api/${u.pathname.replaceAll('/', '')}/security/?sentry_key=${u.username}`;
      } catch { return null; }
    })();
    const CSP_REPORT_ONLY = [
      "default-src 'self'",
      // 'unsafe-inline' is required by the gtag/pixel bootstrap snippets and
      // Next's inline runtime; move to nonces before enforcing if feasible.
      `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://connect.facebook.net https://us.i.posthog.com https://us-assets.i.posthog.com https://va.vercel-scripts.com${isPreview ? ' https://vercel.live' : ''}`,
      "style-src 'self' 'unsafe-inline'",
      // Catalogue imagery is served from many hosts (Supabase, weserv proxy,
      // yellowpink.pk, Cloudinary/Shopify/Unsplash CDNs) plus analytics pixels;
      // a blanket https: keeps this maintainable. data:/blob: for placeholders.
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      `connect-src ${connectSrc.join(' ')}`,
      // Service worker + PostHog session-replay worker (blob:).
      "worker-src 'self' blob:",
      `frame-src 'self' https://www.googletagmanager.com${isPreview ? ' https://vercel.live' : ''}`,
      "object-src 'none'",
      "base-uri 'self'",
      // Checkout hands off to the wallet gateways via auto-submitting form POST.
      "form-action 'self' https://payments.jazzcash.com.pk https://easypay.easypaisa.com.pk",
      "frame-ancestors 'self'",
      ...(cspReportUri ? [`report-uri ${cspReportUri}`] : []),
    ].join('; ');

    const SECURITY: Array<{ key: string; value: string }> = [
      { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
      { key: 'X-Content-Type-Options',    value: 'nosniff' },
      { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
      { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
      { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      // Report-only CSP — see the block comment above; promote to
      // 'Content-Security-Policy' once violation reports come back clean.
      { key: 'Content-Security-Policy-Report-Only', value: CSP_REPORT_ONLY },
    ];

    // 5-minute edge freshness, 24-hour SWR — enough to absorb traffic bursts
    // and survive a Supabase blip, short enough that stock changes on the PDP
    // surface within ~5 min without an explicit revalidate.
    const PUBLIC_CACHE = 'public, s-maxage=300, stale-while-revalidate=86400';

    // 1-hour edge freshness for crawler endpoints — they regenerate from DB
    // but the shape changes less often than the catalog itself.
    const CRAWLER_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';

    // Authenticated / user-scoped routes. CDN must never cache these.
    const PRIVATE_NO_STORE = 'private, no-store, max-age=0';

    return [
      // Every route gets security headers.
      { source: '/:path*', headers: SECURITY },

      // Public catalog HTML — explicit s-maxage so the Vercel edge serves
      // cached renders. Listed individually rather than as one big regex
      // so Vercel's matcher stays predictable.
      { source: '/',                 headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/shop',             headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/product/:slug',    headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/blog',             headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/blog/:slug',       headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/page/:slug',       headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/privacy',          headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      // Remaining public archive routes (all static/ISR now). They were already
      // edge-cached via Next's own ISR headers; list them explicitly so the
      // emitted Cache-Control matches the rest of the catalog (s-maxage + SWR).
      { source: '/brands',                       headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/brand/:slug',                  headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/collections',                  headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/collection/:slug',             headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/tag/:slug',                    headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/k-beauty',                     headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/medical-review-board',         headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },
      { source: '/medical-review-board/:slug',   headers: [{ key: 'Cache-Control', value: PUBLIC_CACHE }] },

      // Crawler endpoints — longer s-maxage. Note: /llms.txt sets its own
      // 24 h Cache-Control inside the route handler, so we don't override
      // it here (handler-set headers can race with these).
      { source: '/sitemap.xml',      headers: [{ key: 'Cache-Control', value: CRAWLER_CACHE }] },
      { source: '/robots.txt',       headers: [{ key: 'Cache-Control', value: CRAWLER_CACHE }] },

      // Private / user-scoped surfaces. Explicitly opt out of any shared
      // cache so a different user's session can't be served from the edge.
      { source: '/admin/:path*',     headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/account/:path*',   headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/cart',             headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/checkout',         headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/wishlist',         headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/track',            headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/login',            headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/forgot-password',  headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/reset-password',   headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/thank-you',        headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
      { source: '/api/:path*',       headers: [{ key: 'Cache-Control', value: PRIVATE_NO_STORE }] },
    ];
  },
  // Next 16 already sets `Cache-Control: public, max-age=…` on /_next/image
  // responses via `images.minimumCacheTTL`. Setting a custom header here
  // triggered a build-time warning + invalid-segment-config error, so we
  // leave it to the framework defaults.
};

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  org: process.env.SENTRY_ORG ?? 'trellee',
  project: process.env.SENTRY_PROJECT ?? 'yellowpink',
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  webpack: {
    automaticVercelMonitors: true,
    treeshake: { removeDebugLogging: true },
  },
});
