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
  // Image optimisation: allow Supabase Storage + the WP source host (set
  // WP_IMAGE_HOST in env if your Woo images live somewhere else).
  images: {
    formats: ['image/avif', 'image/webp'],
    // Tight breakpoint set so we don't generate dozens of derivatives per
    // image. Storefront tiles render at <= 480 px on phones, ~360 px in a
    // 4-up grid on desktop, and full-bleed at 1080 px on hero shots.
    deviceSizes: [360, 480, 640, 828, 1080, 1440, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // 30 d browser cache on the optimized URL (the source URL keeps its
    // own cache headers).
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      // Supabase Storage on the configured project.
      ...(supabaseHost ? [{ protocol: 'https' as const, hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }] : []),
      // Allow the WP origin (until media migration is done). yellowpink.pk
      // is the live WordPress storefront we're migrating from; whitelisting
      // it explicitly so demo data renders without setting WP_IMAGE_HOST.
      ...(process.env.WP_IMAGE_HOST ? [{ protocol: 'https' as const, hostname: process.env.WP_IMAGE_HOST }] : []),
      { protocol: 'https' as const, hostname: 'yellowpink.pk' },
      // Common CDNs people host product imagery on.
      { protocol: 'https' as const, hostname: 'images.unsplash.com' },
      { protocol: 'https' as const, hostname: 'res.cloudinary.com' },
    ],
  },
  // Edge compression.
  compress: true,
  // Allow Claude Preview / common dev tooling to load HMR + dev fonts when the
  // browser hits 127.0.0.1 instead of localhost. Next 16 blocks cross-origin
  // dev resources by default; this is a dev-only allowlist (does NOT affect
  // production routing).
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  // Security + caching response headers. Applied to every storefront response
  // so we get HSTS (closes the Semrush "No HSTS support" finding), a sensible
  // Referrer-Policy + Permissions-Policy, and a strong X-Content-Type-Options.
  // Static `/_next/image/*` results also get a long browser cache.
  async headers() {
    return [
      {
        // Every route. The HSTS preload-list directive is safe here because
        // we're on Vercel HTTPS-only with a wildcard cert.
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options',    value: 'nosniff' },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
          // Conservative defaults — turn on individual features per surface
          // (e.g. camera for a future ID-upload flow) when we actually need them.
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
        ],
      },
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
