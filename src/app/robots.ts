import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  // Production blocks nothing public but keeps the admin/account/checkout out
  // of indexes. Preview/staging gets a global "noindex" so SERPs don't see it.
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');

  if (!isProd) {
    return { rules: [{ userAgent: '*', disallow: '/' }] };
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/admin/',
          '/account/',
          '/checkout',
          '/thank-you',
          '/api/',
          '/login',
          '/forgot-password',
          '/reset-password',
        ],
      },
    ],
    // Advertise every sub-sitemap individually so crawlers don't need a
    // sitemap-index round-trip. The product/blog sub-sitemaps publish under
    // /<segment>/sitemap/<id>.xml — pointing at id 0 covers shops up to the
    // 5 000-URL chunk size; if we cross that, add another entry.
    sitemap: [
      `${SITE_URL}/sitemap.xml`,
      `${SITE_URL}/product/sitemap/0.xml`,
      `${SITE_URL}/blog/sitemap/0.xml`,
      `${SITE_URL}/page/sitemap.xml`,
    ],
    host: SITE_URL.replace(/^https?:\/\//, ''),
  };
}
