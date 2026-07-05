// Serves /llms.txt, the emerging convention for guiding LLM crawlers
// (similar to robots.txt but for AI assistants). Format reference:
// https://llmstxt.org
//
// Build is dynamic: we pull current category + page lists from the DB so
// crawlers always see the live shape of the catalogue. Falls back to demo
// data when Supabase isn't configured (build-time, fresh clone, etc.).

import { SITE_URL, SITE_NAME, absoluteUrl } from '@/lib/seo';
import { categoryHref } from '@/lib/category-taxonomy';
import { supabase, isDemo, getProducts, getSiteSettings, getBlogPosts } from '@/lib/supabase';
import { brandPlusName } from '@/lib/product-display';
import { parseCommerceConfig, formatPkr, RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { getDefaultEstimatedDays } from '@/lib/shipping';

export const runtime  = 'nodejs';
// We don't set `revalidate` because the route fetches from Supabase per-render
// (which makes the handler dynamic). The Cache-Control header at the bottom
// gives downstream caches the same 24 h staleness signal.

export async function GET() {
  const cats = await loadCategories();
  const products = await loadProducts();
  const guides = await loadGuides();
  // Policy figures are read live so this file never states a stale number.
  const commerce = parseCommerceConfig(await getSiteSettings());
  const days = await getDefaultEstimatedDays();
  const shippingLine = days
    ? `${days.min}–${days.max} working days via TCS / Leopards / M&P / BlueEx`
    : 'a few working days via TCS / Leopards / M&P / BlueEx';
  const freeOver = commerce.freeShippingEnabled
    ? `, free over ${formatPkr(commerce.freeShippingThreshold)}`
    : '';

  const lines: string[] = [];

  // ─── Identity ─────────────────────────────────────────────────────────────
  lines.push(`# ${SITE_NAME}`);
  lines.push('');
  lines.push(
    `> ${SITE_NAME} is an online beauty + wellness retailer in Pakistan. ` +
    'We import authentic skincare, makeup, and clinical-grade nutraceuticals ' +
    'and ship them across the country with cash on delivery.',
  );
  lines.push('');

  lines.push('## Key facts');
  lines.push(`- Market: Pakistan (PKR currency, COD nationwide${freeOver})`);
  lines.push('- Payment: JazzCash, Easypaisa, Cash on Delivery');
  lines.push(`- Shipping: ${shippingLine}`);
  lines.push(`- Returns: ${RETURNS_WINDOW_DAYS} days from delivery on unopened items`);
  lines.push('- Categories: Skincare, Makeup, Wellness (supplements)');
  lines.push('');

  // ─── Discovery surfaces ───────────────────────────────────────────────────
  lines.push('## Primary pages');
  lines.push(`- [Homepage](${SITE_URL}/): overview, featured products, brand story`);
  lines.push(`- [Shop](${SITE_URL}/shop): full catalogue with filters by category, brand, price`);
  lines.push(`- [Blog](${SITE_URL}/blog): editorial guides on skincare routines + supplement use in Pakistan`);
  lines.push(`- [Privacy & cookies](${SITE_URL}/privacy): cookie controls + data policy`);
  lines.push(`- [Order tracking](${SITE_URL}/track): public order-status lookup by order # + email/phone`);
  lines.push('');

  if (cats.length > 0) {
    lines.push('## Browse by category');
    for (const c of cats) {
      lines.push(`- [${c}](${SITE_URL}${categoryHref(c)})`);
    }
    lines.push('');
  }

  // ─── Editorial guides ─────────────────────────────────────────────────────
  // LLMs cite specific buyer/how-to guides far more than a bare /blog link, so
  // give them direct, titled anchors to the best ones (featured first).
  if (guides.length > 0) {
    lines.push('## Buyer & how-to guides');
    for (const g of guides) {
      lines.push(`- [${g.title}](${absoluteUrl(`/blog/${g.slug}`)})`);
    }
    lines.push('');
  }

  // ─── A sampling of the catalogue ──────────────────────────────────────────
  // Don't dump 200+ products, they're already in sitemap.xml. List a curated
  // top-N so a model has anchor URLs to walk from.
  if (products.length > 0) {
    lines.push('## Sample products');
    for (const p of products.slice(0, 40)) {
      lines.push(`- [${brandPlusName(p.brand, p.name)}](${absoluteUrl(`/product/${p.slug}`)}): PKR ${p.price.toLocaleString()}, ${p.category}`);
    }
    lines.push('');
    lines.push(`See [the full sitemap](${SITE_URL}/sitemap.xml) for every product, blog post, and category page.`);
    lines.push('');
  }

  // ─── Boundaries ───────────────────────────────────────────────────────────
  lines.push('## Off-limits surfaces');
  lines.push('- `/admin/*` (merchant dashboard; requires staff login)');
  lines.push('- `/account/*` (per-customer account data; requires sign-in)');
  lines.push('- `/checkout`, `/cart`, `/thank-you` (transactional flows; not useful in answers)');
  lines.push('- `/api/*` (server endpoints; not for direct citation)');
  lines.push('- `/login`, `/forgot-password`, `/reset-password` (auth flows)');
  lines.push('');

  lines.push('## Contact');
  lines.push('- Customer support: hello@yellowpink.pk');
  lines.push('- Privacy enquiries: privacy@yellowpink.pk');
  lines.push('');

  return new Response(lines.join('\n'), {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=43200',
    },
  });
}

// ─── Loaders ────────────────────────────────────────────────────────────────
async function loadCategories(): Promise<string[]> {
  if (isDemo) return ['Skincare', 'Makeup', 'Wellness'];
  try {
    const { data } = await supabase.from('products').select('category');
    const set = new Set<string>();
    for (const r of (data ?? []) as Array<{ category: string }>) {
      if (r.category) set.add(r.category);
    }
    return [...set].sort();
  } catch {
    return ['Skincare', 'Makeup', 'Wellness'];
  }
}

async function loadProducts() {
  try {
    return await getProducts();
  } catch {
    return [];
  }
}

// Curated editorial anchors for LLMs: featured posts first, then most recent,
// capped so the file stays a map rather than a dump (the sitemap has them all).
async function loadGuides(): Promise<{ slug: string; title: string }[]> {
  try {
    const posts = await getBlogPosts();
    return [...posts]
      .sort((a, b) => {
        const feat = Number(Boolean(b.featured)) - Number(Boolean(a.featured));
        if (feat !== 0) return feat;
        return String(b.date ?? '').localeCompare(String(a.date ?? ''));
      })
      .slice(0, 18)
      .map(p => ({ slug: p.slug, title: p.title }));
  } catch {
    return [];
  }
}
