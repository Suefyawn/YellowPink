// ============================================================================
// SEO helpers, JSON-LD generators, OG/Twitter card builders, canonical URLs.
// Phase 1.10. Used by app/layout.tsx, product/[slug]/page.tsx, blog/[slug]/page.tsx.
// ============================================================================

import type { Metadata } from 'next';
import type { Product, BlogPost, ProductReview, ProductVariant } from '@/types';
import { brandPlusName } from '@/lib/product-display';
import { FREE_SHIPPING_THRESHOLD, DEFAULT_SHIPPING_RATE } from '@/lib/commerce';
import type { MedicalReviewer } from '@/lib/eeat';

/** Shipping inputs for the Offer's OfferShippingDetails. Passed from the PDP
 *  (parseCommerceConfig of the live site settings) so the structured-data rate
 *  matches what the shopper actually pays, instead of a hardcoded "free". */
export interface ShippingLd {
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  defaultShippingRate: number;
}

// Resolution order: explicit NEXT_PUBLIC_SITE_URL (set this once a custom
// domain is live) → Vercel's production URL → a safe default. The final
// fallback must be a real, reachable origin: og:image and the email logo
// are absolute URLs, so a stale default renders them broken.
//
// normalizeOrigin() guarantees a scheme. Both NEXT_PUBLIC_SITE_URL and
// VERCEL_PROJECT_PRODUCTION_URL are routinely set as a bare host
// ("www.yellowpink.pk"), and a scheme-less value makes `new URL()` throw,
// which breaks the production build (metadataBase in app/layout.tsx).
function normalizeOrigin(value: string | undefined | null): string | null {
  const v = value?.trim().replace(/\/+$/, '');
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export const SITE_URL =
  normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL) ??
  normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL) ??
  'https://yellow-pink.vercel.app';

export const SITE_NAME = 'Yellow Pink';

// ─── URL helpers ────────────────────────────────────────────────────────────
export function absoluteUrl(path: string = '/'): string {
  return `${SITE_URL.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function canonical(path: string = '/'): Pick<Metadata, 'alternates'> {
  return { alternates: { canonical: absoluteUrl(path) } };
}

/** Absolutise a possibly site-relative image path (blog heroes are stored as
 *  "/blog-heroes/x.webp") against SITE_URL. Structured-data validators and
 *  Google reject relative `image` URLs in JSON-LD, so every schema image must
 *  pass through this. Absolute URLs pass through untouched. */
export function absoluteImageUrl(u: string | null | undefined): string | undefined {
  if (!u) return undefined;
  return /^https?:\/\//i.test(u) ? u : absoluteUrl(u);
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
  /** Force the "| Yellow Pink" brand suffix onto the <title> even when the
   *  headline is long (normally long titles drop it). Used by blog posts, whose
   *  H1 is the full headline: keeping the suffix on the title tag makes the two
   *  differ (clears Semrush's "duplicate H1/title" on 100+ posts) at no real
   *  cost — Google just truncates the suffix in the SERP, the headline still
   *  leads. */
  brandSuffix?: boolean;
}

// Google truncates SERP titles around 60 characters and descriptions around
// 160. Strings longer than `MAX` are truncated at the last word boundary
// (no awkward "Foo Ba…"). Used by `pageMeta()` so every page-level helper
// gets safe lengths without each caller having to remember the limits.
//
// The title budget accounts for the root layout's title template, which
// appends " | Yellow Pink" to every child page title. Capping the raw title
// at 60 and THEN appending the 14-char suffix produced ~74-char <title>s
// (2026-07 audit: 8 of 16 sampled titles exceeded 60 chars).
const BRAND_SUFFIX = ` | ${SITE_NAME}`;
const TITLE_MAX = 60 - BRAND_SUFFIX.length;
const DESC_MAX  = 158;

export function truncateOnWord(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return trimmed.replace(/[,;:!\-–—.]+$/, '') + '…';
}

// <title>-specific truncation: same word-boundary trim but WITHOUT the
// trailing ellipsis. A literal "…" inside <title> renders in the SERP/tab
// ("…Chapped Lip Fixes… | Yellow Pink") and reads as a typo — Google adds its
// own visual ellipsis when it truncates, so we must not bake one in. Also
// strips dangling joiners ("&", "|", "·", "(") the cut can expose.
export function truncateTitleOnWord(s: string, max: number): string {
  if (!s || s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  const trimmed = (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd();
  return trimmed.replace(/[,;:!\-–—.&|·(]+$/, '').trimEnd();
}

// Some imported titles (WordPress meta_title rows) already end in
// "| Yellow Pink". The layout template appends the brand again, producing
// "Editorial Standards | Yellow Pink | Yellow Pink". Strip an existing
// trailing separator+brand so the template remains the single source of the
// suffix. Titles merely ENDING in the brand name without a separator
// ("About Yellow Pink") are left alone — the brand is part of the title there.
function stripBrandSuffix(title: string): string {
  return title.replace(/\s*[|\-–—:]\s*Yellow Pink\s*$/i, '').trim() || title.trim();
}

export function pageMeta(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path ?? '/');
  // Share image. Product/brand pages pass an explicit packshot; everything else
  // falls back to the branded 1200x630 card rendered by app/opengraph-image.tsx.
  // We point at that route explicitly because Next's file-convention
  // auto-discovery does NOT reach routes whose generateMetadata returns an
  // openGraph object (observed live: /shop, /collections, /blog, /brands, /tag
  // all shipped with no og:image), so WhatsApp/social shares of those landing
  // pages had no thumbnail. An absolute URL here guarantees one on every page.
  const image = absoluteImageUrl(input.image) ?? absoluteUrl('/opengraph-image');
  const ogImages = [{ url: image }];
  const twImages = [image];

  // Titles: a complete headline beats a branded one. When the headline fits
  // the 60-char SERP budget alongside " | Yellow Pink", let the layout
  // template append the brand. When it doesn't, keep the FULL headline and
  // drop the suffix (title.absolute bypasses the template) — cutting the
  // headline mid-phrase loses tail keywords (usually the "Pakistan" geo
  // modifier) and reads broken in the SERP/social shares, which is worse
  // than a missing brand suffix. Only genuinely oversized headlines (>70,
  // where even Google's pixel cutoff is exceeded) still get a word-boundary
  // trim. Descriptions keep the hard 158-char cap.
  const rawTitle = stripBrandSuffix(input.title);
  const fitsWithBrand = rawTitle.length <= TITLE_MAX;
  const safeTitle = fitsWithBrand ? rawTitle : truncateTitleOnWord(rawTitle, 70);
  const safeDesc  = truncateOnWord(input.description.trim(), DESC_MAX);

  return {
    // brandSuffix: always hand the layout template a plain string (the full,
    // untruncated headline) so it appends " | Yellow Pink" — the tag then
    // differs from the page H1. Otherwise keep the fit-aware behaviour above.
    title: input.brandSuffix ? rawTitle : (fitsWithBrand ? safeTitle : { absolute: safeTitle }),
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

// Stable @id for the publishing Organization. Other nodes (WebSite.publisher)
// reference this rather than re-declaring the entity, which is the linked-data
// pattern Google expects and avoids duplicate Organization nodes.
export const ORGANIZATION_ID = absoluteUrl('/#organization');

export interface OrgContact {
  phone?: string;
  email?: string;
}

// A ContactPoint is only meaningful with an actual contact method. Emitting
// one with just `contactType` triggers "missing telephone" markup warnings,
// so return undefined when neither phone nor email is configured.
function contactPointLd(contact: OrgContact) {
  const phone = contact.phone?.trim();
  const email = contact.email?.trim();
  if (!phone && !email) return undefined;
  return [
    {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      ...(phone ? { telephone: phone } : {}),
      ...(email ? { email } : {}),
      areaServed: 'PK',
      availableLanguage: ['en', 'ur'],
    },
  ];
}

// The single canonical merchant node, rendered site-wide by the root
// layout. `sameAs` is the merchant's social profiles and `contact` the
// store phone/email, both owner-managed via admin Settings. Empty values
// are omitted rather than emitted as null/empty (which markup validators
// flag as errors).
//
// @type is `OnlineStore`, the schema.org subtype of Organization for an
// online-only merchant. We deliberately do NOT use LocalBusiness: that type
// requires a physical address + geo, and Yellow Pink is an online store with
// nationwide COD and no storefront, so a LocalBusiness node would be
// incomplete (Rich Results flags missing `address`) and misleading. OnlineStore
// keeps the same `@id`, so WebSite.publisher and Product.seller references
// still resolve, while qualifying the brand for merchant/store rich results
// and carrying the payment + currency signals Google reads for shopping.
export function organizationLd(sameAs: string[] = [], contact: OrgContact = {}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    '@id': ORGANIZATION_ID,
    name: SITE_NAME,
    url: SITE_URL,
    // Google explicitly recommends raster (PNG/JPG, ≥112×112) for
    // Organization.logo; SVG gets flagged in Rich Results Test.
    logo: absoluteUrl('/icon-192.png'),
    image: absoluteUrl('/icon-192.png'),
    description:
      'Imported beauty, skincare and wellness products delivered across Pakistan with cash-on-delivery.',
    areaServed: { '@type': 'Country', name: 'Pakistan' },
    // NB: currenciesAccepted / paymentAccepted are LocalBusiness properties,     // not valid on Organization/OnlineStore (Google + Semrush flag them as
    // unrecognised markup), so they're deliberately omitted here. Payment
    // methods belong on the Offer/Product schema, where we already set price
    // currency.
    sameAs: sameAs.length ? sameAs : undefined,
    contactPoint: contactPointLd(contact),
  };
}

export function websiteLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absoluteUrl('/#website'),
    name: SITE_NAME,
    url: SITE_URL,
    publisher: { '@id': ORGANIZATION_ID },
    potentialAction: {
      '@type': 'SearchAction',
      // EntryPoint form, the current schema.org/Google recommendation;
      // a bare string `target` is the legacy syntax.
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${SITE_URL}/shop?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

// Reviews used for individual `review` entries, up to 5, most recent / highest signal.
// Only `rating` is required (the aggregate computes from that); the rest are
// nice-to-have so callers that only have ratings can still pass through.
type ReviewForLd = Pick<ProductReview, 'rating'>
  & Partial<Pick<ProductReview, 'body' | 'author_name' | 'created_at'>>;

export function productLd(
  product: Product,
  reviews: ReviewForLd[] = [],
  variants: ProductVariant[] = [],
  shipping?: ShippingLd,
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
  // Untracked products (inventory managed externally) are always available.
  const anyVariantInStock = product.track_inventory === false
    || enabledVariants.some(v => v.stock > 0) || product.stock > 0;

  // Shipping cost for THIS offer, matching what the shopper actually pays:
  // free only once the item's price clears the free-shipping threshold,
  // otherwise the flat default rate. Declaring a blanket "free" when checkout
  // charges 200 is inaccurate markup and Google suppresses the shipping
  // annotation it can't reconcile — so we compute it from the live settings.
  const ship = shipping ?? {
    freeShippingEnabled: true,
    freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
    defaultShippingRate: DEFAULT_SHIPPING_RATE,
  };
  const repPrice = variantPrices.length ? lowPrice : product.price;
  const shippingCost = ship.freeShippingEnabled && repPrice >= ship.freeShippingThreshold
    ? 0
    : ship.defaultShippingRate;

  // Shipping + return policies, these qualify the listing for richer
  // free-shipping / 30-day-returns annotations in Google Shopping.
  const shippingDetails = {
    '@type': 'OfferShippingDetails',
    shippingRate: {
      '@type': 'MonetaryAmount',
      value: shippingCost,
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
        itemCondition: 'https://schema.org/NewCondition',
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
        itemCondition: 'https://schema.org/NewCondition',
        availability: anyVariantInStock
          ? 'https://schema.org/InStock'
          : 'https://schema.org/OutOfStock',
        seller: { '@type': 'Organization', name: SITE_NAME },
        shippingDetails,
        hasMerchantReturnPolicy: returnPolicy,
      };

  // Top reviews (up to 5) for the `review` array, Google uses these to
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
    image: absoluteImageUrl(product.image_url),
    sku: product.id,
    // Omit `brand` entirely when the product has none, emitting
    // `{ name: null }` is an invalid-markup error. Many imported products
    // (generic/local SKUs) legitimately have no brand.
    brand: product.brand ? { '@type': 'Brand', name: product.brand } : undefined,
    category: product.category || undefined,
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

// A byline naming a team/desk/staff is an Organization; a personal name is a
// Person. Picking the right @type matters, Google's Article guidance wants a
// Person for individual authors (E-E-A-T), but flags a Person whose name is
// clearly an organisation. Defaults to Organization when no author is set.
function articleAuthorLd(author?: string | null) {
  const name = author?.trim();
  if (!name) return { '@type': 'Organization', name: SITE_NAME };
  const isOrg = /\b(team|editorial|staff|desk|group|yellow\s*pink)\b/i.test(name);
  return isOrg ? { '@type': 'Organization', name } : { '@type': 'Person', name };
}

export function articleLd(post: BlogPost, opts?: { reviewer?: MedicalReviewer | null }) {
  const reviewer = opts?.reviewer;
  return {
    '@context': 'https://schema.org',
    // `reviewedBy` / `lastReviewed` are MedicalWebPage properties, not Article
    // ones — emitting them on a plain Article made Google + Semrush flag them as
    // unrecognised (72 "structured data markup errors" in the site audit). When
    // a medical reviewer is set, multi-type the node as both Article and
    // MedicalWebPage (the pattern health publishers use) so those E-E-A-T
    // properties are valid; otherwise it stays a plain Article.
    '@type': reviewer ? ['Article', 'MedicalWebPage'] : 'Article',
    headline: post.title,
    description: post.excerpt,
    image: absoluteImageUrl(post.image_url),
    datePublished: post.date,
    // Use updated_at when the row has been edited; falls back to date so
    // Google has a meaningful "Last updated" signal instead of identical
    // dates either side. The DB column exists (used by the blog sitemap)
    // even though the type previously omitted it.
    dateModified: post.updated_at ?? post.date,
    author: articleAuthorLd(post.author),
    // E-E-A-T: a credentialed medical reviewer is the strongest trust signal
    // for YMYL health content. Emitted only when the store has configured a
    // real reviewer (see lib/eeat.ts), never fabricated.
    ...(reviewer
      ? {
          reviewedBy: {
            '@type': 'Person',
            name: reviewer.name,
            ...(reviewer.credentials ? { honorificSuffix: reviewer.credentials } : {}),
            ...(reviewer.specialty ? { jobTitle: reviewer.specialty } : {}),
            // url → the on-site board profile when present (a real author page),
            // else the external profile. sameAs always points at the external,
            // verifiable professional profile.
            ...(reviewer.profileSlug
              ? { url: absoluteUrl(`/medical-review-board/${reviewer.profileSlug}`) }
              : reviewer.url ? { url: reviewer.url } : {}),
            ...(reviewer.url ? { sameAs: [reviewer.url] } : {}),
          },
          lastReviewed: post.updated_at ?? post.date,
        }
      : {}),
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

export interface ListEntry {
  name: string;
  path: string;
  /** Product fields — when present, the ListItem embeds a valid Product with a
   *  minimal priced Offer, making the collection/category/brand page eligible
   *  for product-list rich results. Omit them (e.g. blog index) to fall back to
   *  a lean URL summary ListItem. */
  image?: string | null;
  brand?: string | null;
  price?: number | null;
}

/**
 * ItemList for collection / category / brand / homepage index pages. Google
 * uses it to associate the listed items with the parent page and to power
 * product-list / carousel results.
 *
 * Two element shapes, chosen per item:
 *   • With a price → a full `Product` (name, url, image, brand, priced Offer,
 *     `@id` pointing at the PDP's Product node so they de-duplicate). This is
 *     what makes a listing page product-rich, and it's a VALID Product because
 *     it carries offers, not the partial-Product case validators reject.
 *   • Without a price (e.g. the blog index) → a lean summary ListItem with
 *     `url` + `name`, which is correct for non-product summaries.
 */
export function itemListLd(name: string, items: ListEntry[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    numberOfItems: items.length,
    itemListElement: items.map((it, i) => {
      const base = { '@type': 'ListItem', position: i + 1 } as const;
      if (it.price != null && it.price > 0) {
        return {
          ...base,
          item: {
            '@type': 'Product',
            '@id': absoluteUrl(it.path) + '#product',
            name: brandPlusName(it.brand ?? undefined, it.name),
            url: absoluteUrl(it.path),
            image: absoluteImageUrl(it.image) ?? undefined,
            brand: it.brand ? { '@type': 'Brand', name: it.brand } : undefined,
            offers: {
              '@type': 'Offer',
              url: absoluteUrl(it.path),
              price: it.price,
              priceCurrency: 'PKR',
              itemCondition: 'https://schema.org/NewCondition',
            },
          },
        };
      }
      return { ...base, url: absoluteUrl(it.path), name: it.name };
    }),
  };
}

// FAQ schema, pass an array of plain Q/A pairs. Google will surface the
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

// Lightweight CMS-page Article schema, for editorial /page/* content that
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
    image: absoluteImageUrl(input.image),
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
