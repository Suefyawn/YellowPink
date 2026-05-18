// Root sitemap — static + category landing routes only.
// Product, blog, and CMS-page URLs live in their own sub-sitemaps (see
// src/app/product/sitemap.ts etc.) so each segment can independently chunk +
// scale toward Google's 50k-URLs-per-sitemap cap. robots.ts advertises all of
// them so search engines crawl every one.

import type { MetadataRoute } from 'next';
import { supabase, isDemo } from '@/lib/supabase';
import { SITE_URL, absoluteUrl } from '@/lib/seo';

const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/',         priority: 1.0, freq: 'daily' },
  { path: '/shop',     priority: 0.9, freq: 'daily' },
  { path: '/blog',     priority: 0.7, freq: 'weekly' },
  { path: '/track',    priority: 0.4, freq: 'yearly' },
  { path: '/login',    priority: 0.3, freq: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Derive category landing pages from distinct product categories.
  let categories: string[] = [];
  if (!isDemo) {
    const { data: products } = await supabase.from('products').select('category');
    categories = Array.from(new Set((products ?? []).map(p => p.category as string).filter(Boolean)));
  } else {
    const { DEMO_PRODUCTS } = await import('@/lib/demo-data');
    categories = Array.from(new Set(DEMO_PRODUCTS.map(p => p.category).filter(Boolean)));
  }

  const categoryUrls: MetadataRoute.Sitemap = categories.map(cat => ({
    url: `${SITE_URL}/shop?cat=${encodeURIComponent(cat)}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [
    ...STATIC_ROUTES.map<MetadataRoute.Sitemap[number]>(r => ({
      url: absoluteUrl(r.path),
      lastModified: new Date(),
      changeFrequency: r.freq,
      priority: r.priority,
    })),
    ...categoryUrls,
  ];
}
