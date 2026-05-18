// Product sub-sitemap. Lives under /product/sitemap.xml — every product page
// is listed here, paged at 50k URLs per chunk (Google's cap). Each entry
// includes its primary image so Google Image search picks it up too.

import type { MetadataRoute } from 'next';
import { supabase, isDemo } from '@/lib/supabase';
import { absoluteUrl } from '@/lib/seo';

const PAGE_SIZE = 5000;

interface ProductRow {
  slug: string;
  image_url: string | null;
  updated_at: string | null;
  created_at: string | null;
}

async function loadAllProducts(): Promise<ProductRow[]> {
  if (isDemo) {
    const { DEMO_PRODUCTS } = await import('@/lib/demo-data');
    return DEMO_PRODUCTS.map(p => ({
      slug: p.slug,
      image_url: p.image_url ?? null,
      updated_at: null,
      created_at: null,
    }));
  }
  const { data } = await supabase
    .from('products')
    .select('slug, image_url, updated_at, created_at');
  return ((data ?? []) as ProductRow[]);
}

export async function generateSitemaps() {
  const products = await loadAllProducts();
  const count = Math.max(1, Math.ceil(products.length / PAGE_SIZE));
  return Array.from({ length: count }, (_, id) => ({ id }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const idStr = await props.id;
  const id = Number(idStr) || 0;
  const products = await loadAllProducts();
  const slice = products.slice(id * PAGE_SIZE, (id + 1) * PAGE_SIZE);

  return slice.map(p => {
    const last = p.updated_at ?? p.created_at;
    return {
      url: absoluteUrl(`/product/${p.slug}`),
      lastModified: last ? new Date(last) : new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
      images: p.image_url ? [p.image_url] : undefined,
    };
  });
}
