// CMS-page sub-sitemap (about, shipping, returns, faq, ...). Lives under
// /page/sitemap.xml. Only published pages are listed; drafts and archived
// pages are filtered server-side.

import type { MetadataRoute } from 'next';
import { supabase, isDemo } from '@/lib/supabase';
import { absoluteUrl } from '@/lib/seo';

interface PageRow {
  slug: string;
  updated_at: string | null;
  created_at: string | null;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  if (isDemo) return [];

  const { data } = await supabase
    .from('pages')
    .select('slug, updated_at, created_at')
    .eq('status', 'published');

  const rows = (data ?? []) as PageRow[];
  return rows.map(p => {
    const last = p.updated_at ?? p.created_at;
    return {
      url: absoluteUrl(`/page/${p.slug}`),
      lastModified: last ? new Date(last) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.5,
    };
  });
}
