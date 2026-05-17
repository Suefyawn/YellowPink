// ============================================================================
// SEO helpers — JSON-LD generators, OG/Twitter card builders, canonical URLs.
// Phase 1.10. Used by app/layout.tsx, product/[slug]/page.tsx, blog/[slug]/page.tsx.
// ============================================================================

import type { Metadata } from 'next';
import type { Product, BlogPost, ProductReview } from '@/types';

export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.VERCEL_PROJECT_PRODUCTION_URL?.replace(/^https?:\/\//, 'https://') ??
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

export function pageMeta(input: PageMetaInput): Metadata {
  const url = absoluteUrl(input.path ?? '/');
  const image = input.image ?? absoluteUrl('/icon.svg');
  return {
    title: input.title,
    description: input.description,
    keywords: input.keywords,
    robots: input.noIndex ? { index: false, follow: false } : undefined,
    alternates: { canonical: url },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: SITE_NAME,
      locale: 'en_PK',
      type: input.type === 'article' ? 'article' : 'website',
      images: [{ url: image }],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [image],
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
    logo: absoluteUrl('/icon.svg'),
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

export function productLd(product: Product, reviews: Pick<ProductReview, 'rating'>[] = []) {
  const ratingCount = reviews.length;
  const avg = ratingCount
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / ratingCount) * 10) / 10
    : null;

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${product.brand} ${product.name}${product.variant ? ` ${product.variant}` : ''}`,
    description: product.description ?? undefined,
    image: product.image_url ?? undefined,
    brand: { '@type': 'Brand', name: product.brand },
    category: product.category,
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/product/${product.slug}`),
      priceCurrency: 'PKR',
      price: product.price,
      availability: product.stock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: { '@type': 'Organization', name: SITE_NAME },
    },
    aggregateRating: avg
      ? {
          '@type': 'AggregateRating',
          ratingValue: avg,
          reviewCount: ratingCount,
        }
      : undefined,
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
    dateModified: post.date,
    author: { '@type': 'Organization', name: SITE_NAME },
    publisher: {
      '@type': 'Organization',
      name: SITE_NAME,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') },
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
