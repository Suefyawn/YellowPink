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
      // ── Crawler cost control (Aug 9, owner request) ────────────────────
      // Every bot page-hit is a Vercel function invocation and every image
      // it pulls is Supabase egress; both quotas were breached in Aug. These
      // crawlers bring no Pakistani shoppers and no referral traffic, so
      // they are blocked site-wide. Deliberately NOT blocked: Googlebot,
      // Bingbot (rankings), and the AI assistants' crawlers — GPTBot,
      // OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-User, PerplexityBot,
      // Perplexity-User — because AI referrals are ~half of storefront
      // sessions and delivered the largest order of the sale week.
      ...['Bytespider', 'TikTokSpider', 'Amazonbot', 'PetalBot', 'MJ12bot',
          'DotBot', 'BLEXBot', 'DataForSeoBot', 'serpstatbot', 'SeekportBot',
          'ZoominfoBot', 'MegaIndex.ru'].map(bot => ({
        userAgent: bot,
        disallow: '/',
      })),
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
          // P1 audit fixes, user-scoped or utility-only pages should not
          // be in indexes either.
          '/cart',
          '/wishlist',
          '/track',
          // Outbound WhatsApp redirect: keeps crawlers on our domain so they
          // never probe (and 429-flag) the external wa.me chat link.
          '/go/',
        ],
      },
    ],
    // One comprehensive sitemap covers products, blog posts and CMS pages
    // (see app/sitemap.ts), well under Google's 50k-URL cap.
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL.replace(/^https?:\/\//, ''),
  };
}
