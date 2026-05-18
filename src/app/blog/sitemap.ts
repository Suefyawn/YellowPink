// Blog sub-sitemap. Lives under /blog/sitemap.xml. Includes hero image so
// blog posts can appear in Google Discover image results too.

import type { MetadataRoute } from 'next';
import { supabase, isDemo } from '@/lib/supabase';
import { absoluteUrl } from '@/lib/seo';

const PAGE_SIZE = 5000;

interface PostRow {
  slug: string;
  image_url: string | null;
  updated_at: string | null;
  date: string | null;
}

async function loadAllPosts(): Promise<PostRow[]> {
  if (isDemo) {
    const { DEMO_BLOG_POSTS } = await import('@/lib/demo-data');
    return DEMO_BLOG_POSTS.map(p => ({
      slug: p.slug,
      image_url: p.image_url ?? null,
      updated_at: null,
      date: p.date ?? null,
    }));
  }
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, image_url, updated_at, date');
  return ((data ?? []) as PostRow[]);
}

export async function generateSitemaps() {
  const posts = await loadAllPosts();
  const count = Math.max(1, Math.ceil(posts.length / PAGE_SIZE));
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const idStr = await props.id;
  const id = Number(idStr) || 0;
  const posts = await loadAllPosts();
  const slice = posts.slice(id * PAGE_SIZE, (id + 1) * PAGE_SIZE);

  return slice.map(p => {
    const last = p.updated_at ?? p.date;
    return {
      url: absoluteUrl(`/blog/${p.slug}`),
      lastModified: last ? new Date(last) : new Date(),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
      images: p.image_url ? [p.image_url] : undefined,
    };
  });
}
