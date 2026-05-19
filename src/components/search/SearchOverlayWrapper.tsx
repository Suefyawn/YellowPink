import { SearchOverlay } from './SearchOverlay';
import { supabase, isDemo } from '@/lib/supabase';

// Server component that resolves the "Trending" list from real catalog data,
// then hands it down to the client SearchOverlay. The hardcoded fallback
// was the source of the audit's SEV-2 "dead-end search" — typing 'CeraVe'
// returned no results because the catalog didn't have any. Pulling top
// brands by product count fixes that automatically as the catalog evolves.
async function loadTrendingBrands(): Promise<string[]> {
  if (isDemo) return ['CeraVe', 'NARS', 'Kiko Milano', 'PIXI', 'Rhode'];
  try {
    // Cheap query — we only need the brand column. Group + count + top-5
    // is done client-side because Supabase REST doesn't expose GROUP BY
    // without a view, and the catalog row count (266) is tiny.
    const { data } = await supabase
      .from('products')
      .select('brand')
      .eq('status', 'published')
      .gt('stock', 0)
      .limit(1000);
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
  } catch {
    return [];
  }
}

// Sub-categories the merchant has stocked. Same logic as brands — derive
// from what's actually in inventory instead of guessing.
async function loadPopularCategories(): Promise<string[]> {
  if (isDemo) return ['Skincare', 'Lip Tints', 'Foundations', 'Sunscreen', 'Wellness'];
  try {
    const { data } = await supabase
      .from('products')
      .select('subcategory, category')
      .eq('status', 'published')
      .gt('stock', 0)
      .limit(1000);
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
  } catch {
    return [];
  }
}

export async function SearchOverlayWrapper() {
  const [trending, categories] = await Promise.all([
    loadTrendingBrands(),
    loadPopularCategories(),
  ]);
  return <SearchOverlay trending={trending} categories={categories} />;
}
