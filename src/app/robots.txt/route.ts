// Serves /robots.txt as a plain-text route rather than Next's typed
// `robots()` metadata export. The typed export can only emit User-agent /
// Allow / Disallow / Sitemap / Host, and the file now also carries a
// Content-Signal line (contentsignals.org), which declares the store's AI
// policy in a form the AI crawlers read. Everything else is byte-for-byte
// what the metadata export produced.

import { SITE_URL } from '@/lib/seo';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

// ── Crawler cost control (Aug 9, owner request) ──────────────────────────
// Every bot page-hit is a Vercel function invocation and every image it pulls
// is Supabase egress; both quotas were breached in Aug. These crawlers bring
// no Pakistani shoppers and no referral traffic, so they are blocked
// site-wide.
const BLOCKED = [
  'Bytespider', 'TikTokSpider', 'Amazonbot', 'PetalBot', 'MJ12bot', 'DotBot',
  'BLEXBot', 'DataForSeoBot', 'serpstatbot', 'SeekportBot', 'ZoominfoBot',
  'MegaIndex.ru',
];

// ── AI assistants: explicitly allowed ─────────────────────────────────────
// AI referrals are roughly half of storefront sessions and delivered the
// largest order of the sale week, so the assistants' crawlers get the same
// access as Googlebot. Listed by name (rather than relying on `*`) so the
// policy is unambiguous to a scanner and to anyone reading the file:
// wildcard rules are ignored by a crawler once any named block for it
// exists elsewhere, so a named Allow is the only durable statement.
const AI_ALLOWED = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User',
  'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'Claude-Web',
  'PerplexityBot', 'Perplexity-User',
  'Google-Extended', 'Applebot-Extended', 'meta-externalagent',
];

const PRIVATE_PATHS = [
  '/admin/', '/account/', '/checkout', '/thank-you', '/api/', '/login',
  '/forgot-password', '/reset-password',
  // P1 audit fixes, user-scoped or utility-only pages should not be in
  // indexes either.
  '/cart', '/wishlist', '/track',
  // Outbound WhatsApp redirect: keeps crawlers on our domain so they never
  // probe (and 429-flag) the external wa.me chat link.
  '/go/',
];

export function buildRobotsTxt(isProd: boolean): string {
  // Preview/staging gets a global "noindex" so SERPs don't see it.
  if (!isProd) return 'User-Agent: *\nDisallow: /\n';

  const out: string[] = [];
  for (const bot of BLOCKED) out.push(`User-Agent: ${bot}`, 'Disallow: /', '');
  for (const bot of AI_ALLOWED) {
    out.push(`User-Agent: ${bot}`, 'Allow: /');
    for (const p of PRIVATE_PATHS) out.push(`Disallow: ${p}`);
    out.push('');
  }
  out.push('User-Agent: *', 'Allow: /');
  for (const p of PRIVATE_PATHS) out.push(`Disallow: ${p}`);
  out.push('');
  // The store WANTS to be found and quoted by assistants: search results,
  // answers that cite the page, and model training are all yes. This is the
  // same decision as allowing the crawlers above, stated in the vocabulary
  // the crawlers now read.
  out.push('Content-Signal: search=yes, ai-input=yes, ai-train=yes', '');
  out.push(`Host: ${SITE_URL.replace(/^https?:\/\//, '')}`);
  // One comprehensive sitemap covers products, blog posts and CMS pages (see
  // app/sitemap.ts), well under Google's 50k-URL cap.
  out.push(`Sitemap: ${SITE_URL}/sitemap.xml`, '');
  return out.join('\n');
}

export function GET() {
  const isProd =
    process.env.VERCEL_ENV === 'production' ||
    (!process.env.VERCEL_ENV && process.env.NODE_ENV === 'production');
  return new Response(buildRobotsTxt(isProd), {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
