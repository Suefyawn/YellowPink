// ============================================================================
// SEO helpers — JSON-LD generators, OG/Twitter card builders, canonical URLs.
// Phase 1.10. Used by app/layout.tsx, product/[slug]/page.tsx, blog/[slug]/page.tsx.
// ============================================================================

import type { Metadata } from 'next';
import type { Product, BlogPost, ProductReview, ProductVariant } from '@/types';
import { brandPlusName } from '@/lib/product-display';

const _vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (_vercelUrl ? (_vercelUrl.startsWith('http') ? _vercelUrl : `https://${_vercelUrl}`) : null) ??
  'https://yellowpink.pk';

export const SITE_NAME = 'Yellow Pink';

// ─── URL helpers ────────────────────────────────────────────────────────────
export function absoluteUrl(path: string = '/'): string {
  return `${SITE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function canonical(path: string = '/'): Pick<Metadata, 'alternates'> {
  return { alternates: { canonical: absoluteUrl(path) } };
}

// ─── Metadata helpers ───────────────────────────────────────────────────────
interface PageMetaInput {
  title: string;
  description: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article' | 'product';
  keywords?: string[];
  noIndex?: boolean;
}

// Google truncates SERP titles around 60 characters and descriptions around
// 160. Strings longer than `MAX` are truncated at the last word boundary
// (no awkward "Foo Ba…"). Used by `pageMeta()` so every page-level helper
// gets safe lengths without each caller having to remember the limits.
const TITLE_MAX = 60;
const DESC_MAX  = 158;

export function truncateOnWord(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return trimmed.replace(/[,;:!\-–—.]+$/, '') + '…';
}

export function pageMeta(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path ?? '/');
  // If the caller didn't supply an explicit image, leave `images` undefined so
  // Next's file-convention auto-discovery picks up the generated
  // `app/opengraph-image.tsx` (1200x630 branded fallback). Setting any value
  // here — even a default — would shadow that and force every page to use the
  // same image.
  const image = input.image;
  const ogImages = image ? [{ url: image }] : undefined;
  const twImages = image ? [image] : undefined;

  // Cap title + description so we don't get Semrush "Title element is too
  // long" / "meta description too long" warnings. The original `title` is
  // still used for the OG/Twitter title where length matters less and the
  // canonical-URL alternate is unaffected.
  const safeTitle = truncateOnWord(input.title.trim(), TITLE_MAX);
  const safeDesc  = truncateOnWord(input.description.trim(), DESC_MAX);

  return {
    title: safeTitle,
    description: safeDesc,
    keywords: input.keywords,
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: safeTitle,
      description: safeDesc,
      url,
      siteName: SITE_NAME,
      locale: 'en_PK',
      type: input.type === 'article' ? 'article' : 'website',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title: safeTitle,
      description: safeDesc,
      images: twImages,
    },
  };
}

// ─── JSON-LD generators ─────────────────────────────────────────────────────
// Embed via <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(...) }} />.
export function jsonLd<T extends Record<string, unknown>>(obj: T): string {
  // Strip undefined keys to keep payload small.
  return JSON.stringify(obj, (_k, v) => (v === undefined ? undefined : v));
}

export function organizationLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    // Google explicitly recommends raster (PNG/JPG, ≥112×112) for
    // Organization.logo; SVG gets flagged in Rich Results Test.
    logo: absoluteUrl('/icon-192.png'),
    sameAs: [
      'https://instagram.com/yellowpink.pk',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        areaServed: 'PK',
        availableLanguage: ['en', 'ur'],
      },
    ],
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: SITE_URL,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/shop?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

// Reviews used for individual `review` entries — up to 5, most recent / highest signal.
// Only `rating` is required (the aggregate computes from that); the rest are
// nice-to-have so callers that only have ratings can still pass through.
type ReviewForLd = Pick<ProductReview, 'rating'>
  & Partial<Pick<ProductReview, 'body' | 'author_name' | 'created_at'>>;

export function productLd(
  product: Product,
  reviews: ReviewForLd[] = [],
  variants: ProductVariant[] = [],
) {
  const ratingCount = reviews.length;
  const avg = ratingCount
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
    : null;

  // ── Offer construction ──
  // If there are variants with distinct prices, emit an AggregateOffer with
  // lowPrice / highPrice so the SERP can show "from PKR X". Otherwise emit a
  // single Offer pulled from the parent product. Either way, hand Google the
  // shippingDetails + hasMerchantReturnPolicy blocks it needs for the
  // free-shipping / return-policy badges in product results.
  const enabledVariants = variants.filter(v => v.enabled);
  const variantPrices = enabledVariants.map(v => v.price);
  const lowPrice = variantPrices.length ? Math.min(...variantPrices) : product.price;
  const highPrice = variantPrices.length ? Math.max(...variantPrices) : product.price;
  const anyVariantInStock = enabledVariants.some(v => v.stock > 0) || product.stock > 0;

  // Shipping + return policies — these qualify the listing for richer
  // free-shipping / 30-day-returns annotations in Google Shopping.
  const shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      // We charge for shipping under PKR 2,500, free above.
      value: 0,
      currency: 'PKR',
    },
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'PK',
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime:  { '@type': 'QuantitativeValue', minValue: 2, maxValue: 5, unitCode: 'DAY' },
    },
  };
  const returnPolicy = {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: 'PK',
    returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
    merchantReturnDays: 7,
    returnMethod: 'https://schema.org/ReturnByMail',
    returnFees: 'https://schema.org/FreeReturn',
  };

  // Google increasingly wants priceValidUntil on Offer / AggregateOffer.
  // Use a 12-month forward window; the page itself revalidates often
  // enough that this stays roughly accurate.
  const priceValidUntil = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const offers = variantPrices.length > 1 && lowPrice !== highPrice
    ? {
        '@type': 'AggregateOffer',
        url: absoluteUrl(`/product/${product.slug}`),
        priceCurrency: 'PKR',
        lowPrice,
        highPrice,
        offerCount: enabledVariants.length,
        priceValidUntil,
        availability: anyVariantInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: SITE_NAME },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      }
    : {
        '@type': 'Offer',
        url: absoluteUrl(`/product/${product.slug}`),
        priceCurrency: 'PKR',
        price: product.price,
        priceValidUntil,
        availability: anyVariantInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: SITE_NAME },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      };

  // Top reviews (up to 5) for the `review` array — Google uses these to
  // surface review snippets even when there's no aggregate yet.
  const topReviews = reviews
    .slice(0, 5)
    .map(r => ({
      '@type': 'Review',
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating,
        bestRating: 5,
        worstRating: 1,
      },
      author: { '@type': 'Person', name: r.author_name ?? 'Verified buyer' },
      reviewBody: r.body ?? undefined,
      datePublished: r.created_at ?? undefined,
    }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': absoluteUrl(`/product/${product.slug}#product`),
    name: `${brandPlusName(product.brand, product.name)}${product.variant ? ` ${product.variant}` : ''}`,
    description: product.description ?? undefined,
    image: product.image_url ?? undefined,
    sku: product.id,
    brand: { '@type': 'Brand', name: product.brand },
    category: product.category,
    offers,
    aggregateRating: avg
      ? {
          '@type': 'AggregateRating',
          ratingValue: avg,
          reviewCount: ratingCount,
          bestRating: 5,
          worstRating: 1,
        }
      : undefined,
    review: topReviews.length ? topReviews : undefined,
  };
}

export function articleLd(post: BlogPost) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.image_url ?? undefined,
    datePublished: post.date,
    // Use updated_at when the row has been edited; falls back to date so
    // Google has a meaningful "Last updated" signal instead of identical
    // dates either side. The DB column exists (used by the blog sitemap)
    // even though the type previously omitted it.
    dateModified: post.updated_at ?? post.date,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      // Raster logo per Google's Article schema requirements.
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-192.png'), width: 192, height: 192 },
    },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

// LocalBusiness / Store schema for Pakistan — Google uses this for Knowledge
// Panel + Maps placement. We're a digital-first storefront serving the whole
// country, so areaServed is national and we don't claim a single brick-and-
// mortar address. If the merchant later opens a physical pickup point, fill
// `address` and switch `@type` to `Store`.
export function localBusinessLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': absoluteUrl('/#store'),
    name: SITE_NAME,
    url: SITE_URL,
    // Raster logo per Google guidance — Rich Results Test warns on SVG.
    logo: absoluteUrl('/icon-192.png'),
    image: absoluteUrl('/icon-192.png'),
    description:
      'Imported beauty, skincare and wellness products delivered across Pakistan with cash-on-delivery.',
    // priceRange should be free-form ($–$$$$ or a currency range) — bare
    // 'PKR' is ignored. Set a meaningful range covering most of the catalog.
    priceRange: 'PKR 500–PKR 25,000',
    currenciesAccepted: 'PKR',
    paymentAccepted: 'Cash on Delivery, JazzCash, Easypaisa',
    areaServed: {
      '@type': 'Country',
      name: 'Pakistan',
    },
    address: {
      '@type': 'PostalAddress',
      addressCountry: 'PK',
    },
    sameAs: [
      'https://instagram.com/yellowpink.pk',
      'https://facebook.com/yellowpinkpk',
      'https://tiktok.com/@yellowpinkpk',
    ],
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'customer service',
        areaServed: 'PK',
        availableLanguage: ['en', 'ur'],
      },
    ],
  };
}

// FAQ schema — pass an array of plain Q/A pairs. Google will surface the
// matching pairs as expandable cards in the SERP for the source URL.
export function faqLd(items: { question: string; answer: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: items.map(item => ({
      '@type': 'Question',
      name: item.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: item.answer,
      },
    })),
  };
}

// Lightweight CMS-page Article schema — for editorial /page/* content that
// isn't a blog post (about, returns policy, shipping policy, etc.). Optional
// `dateModified` if the CMS exposes it; falls back to `datePublished`.
export function pageArticleLd(input: {
  title: string;
  description: string;
  path: string;
  datePublished?: string;
  dateModified?: string;
  image?: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.title,
    description: input.description,
    image: input.image ?? undefined,
    datePublished: input.datePublished ?? undefined,
    dateModified: input.dateModified ?? input.datePublished ?? undefined,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon-192.png'), width: 192, height: 192 },
    },
    mainEntityOfPage: absoluteUrl(input.path),
  };
}
