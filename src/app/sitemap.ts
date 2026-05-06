import type { MetadataRoute } from 'next';
import { supabase } from '@/lib/supabase';

const BASE = 'https://yellowpink.pk';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: products }, { data: posts }] = await Promise.all([
    supabase.from('products').select('slug, created_at'),
    supabase.from('blog_posts').select('slug, created_at'),
  ]);

  const productUrls = (products ?? []).map(p => ({
    url: `${BASE}/product/${p.slug}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  const blogUrls = (posts ?? []).map(p => ({
    url: `${BASE}/blog/${p.slug}`,
    lastModified: p.created_at ? new Date(p.created_at) : new Date(),
    changeFrequency: 'monthly' as const,
    priority: 0.6,
  }));

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE}/track`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.4 },
    ...productUrls,
    ...blogUrls,
  ];
}
