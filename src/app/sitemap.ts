import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';
import { SITE_URL, absoluteUrl } from '@/lib/seo';

const STATIC_ROUTES: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/',         priority: 1.0, freq: 'daily' },
  { path: '/shop',     priority: 0.9, freq: 'daily' },
  { path: '/blog',     priority: 0.7, freq: 'weekly' },
  { path: '/track',    priority: 0.4, freq: 'yearly' },
  { path: '/login',    priority: 0.3, freq: 'yearly' },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: products }, { data: posts }] = await Promise.all([
    supabase.from('products').select('slug, category, updated_at, created_at'),
    supabase.from('blog_posts').select('slug, updated_at, created_at'),
  ]);

  const productUrls: MetadataRoute.Sitemap = (products ?? []).map(p => ({
    url: absoluteUrl(`/product/${p.slug}`),
    lastModified: p.updated_at ?? p.created_at ? new Date(p.updated_at ?? p.created_at) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.8,
  }));

  const blogUrls: MetadataRoute.Sitemap = (posts ?? []).map(p => ({
    url: absoluteUrl(`/blog/${p.slug}`),
    lastModified: p.updated_at ?? p.created_at ? new Date(p.updated_at ?? p.created_at) : new Date(),
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  // Derive category landing pages from the product table to keep the sitemap fresh.
  const categories = Array.from(new Set((products ?? []).map(p => p.category as string).filter(Boolean)));
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
    ...productUrls,
    ...blogUrls,
  ];
}
