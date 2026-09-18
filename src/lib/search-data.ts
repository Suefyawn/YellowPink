// Server-only helpers that derive the "Trending brands" and "Popular categories"
// lists shown in the search overlay from real catalog data.
//
// Lives in lib/ (not in components/) because the calling tree starts at
// app/layout.tsx (a server component). SiteChrome is `'use client'`, so we
// cannot pass an async server-component wrapper through it, the data has
// to be resolved at the layout level and handed down as plain props.

import { supabase, isDemo } from '@/lib/supabase';
import { cachedRead } from '@/lib/supabase-resilience';
import { CATALOG_CACHE_TAG } from '@/lib/cache-tags';

// Both lists are rendered by the root layout, i.e. on every dynamic page, so
// they are cached across requests under the catalogue tag (17 Sep 2026
// egress outage: ~3,000 reads a day each for a list that changes when a
// product is published).
const catalog = { tags: [CATALOG_CACHE_TAG], revalidate: 3600 } as const;

const readTrendingBrands = cachedRead(['search:trending-brands'], async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('brand')
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true')
      .limit(1000);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ brand: string | null }>) {
      const b = row.brand?.trim();
      if (!b) continue;
      counts.set(b, (counts.get(b) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([brand]) => brand);
}, catalog);

export async function loadTrendingBrands(): Promise<string[]> {
  if (isDemo) return ['CeraVe', 'NARS', 'Kiko Milano', 'PIXI', 'Rhode'];
  try {
    return await readTrendingBrands();
  } catch {
    return [];
  }
}

const readPopularCategories = cachedRead(['search:popular-categories'], async (): Promise<string[]> => {
    const { data, error } = await supabase
      .from('products')
      .select('subcategory, category')
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true')
      .limit(1000);
    if (error) throw error;
    const counts = new Map<string, number>();
    for (const row of (data ?? []) as Array<{ subcategory: string | null; category: string | null }>) {
      const c = row.subcategory?.trim() || row.category?.trim();
      if (!c) continue;
      counts.set(c, (counts.get(c) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([c]) => c);
}, catalog);

export async function loadPopularCategories(): Promise<string[]> {
  if (isDemo) return ['Skincare', 'Lip Tints', 'Foundations', 'Sunscreen', 'Wellness'];
  try {
    return await readPopularCategories();
  } catch {
    return [];
  }
}
