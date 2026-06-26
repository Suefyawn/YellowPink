// Storefront loader for published collections. Kept out of the big supabase.ts
// getter file so the collections feature stays self-contained.

import { supabase, isDemo, getProducts } from '@/lib/supabase';
import { loadTagData } from '@/lib/shop-facets';
import { resolveCollectionProducts, type Collection } from '@/lib/collections';

export async function getPublishedCollections(limit?: number): Promise<Collection[]> {
  if (isDemo) return [];
  let q = supabase.from('collections').select('*').eq('status', 'published').order('sort_order').order('title');
  if (limit) q = q.limit(limit);
  const { data } = await q;
  return (data ?? []) as Collection[];
}

// Same as getPublishedCollections, but every collection card gets a cover
// image: its own hero_image_url when set, otherwise the first member product's
// image. Keeps the homepage band + /collections index off the bare gradient
// placeholder, and stays correct automatically as membership changes (no
// per-collection image to maintain). For the card surfaces only, the
// collection detail page resolves its own hero separately.
export async function getPublishedCollectionsWithCovers(limit?: number): Promise<Collection[]> {
  const collections = await getPublishedCollections(limit);
  const needCover = collections.filter(c => !c.hero_image_url);
  if (isDemo || needCover.length === 0) return collections;

  const [products, tagData] = await Promise.all([getProducts(), loadTagData()]);

  // Manual collections need their explicit, ordered membership to pick a cover.
  const manualIds = needCover.filter(c => c.type === 'manual').map(c => c.id);
  const manualOrderByCollection = new Map<string, Map<string, number>>();
  if (manualIds.length) {
    const { data: rows } = await supabase
      .from('collection_products')
      .select('collection_id, product_id, position')
      .in('collection_id', manualIds);
    for (const r of (rows ?? []) as Array<{ collection_id: string; product_id: string; position: number }>) {
      const m = manualOrderByCollection.get(r.collection_id) ?? new Map<string, number>();
      m.set(r.product_id, r.position);
      manualOrderByCollection.set(r.collection_id, m);
    }
  }

  return collections.map(c => {
    if (c.hero_image_url) return c;
    const members = resolveCollectionProducts(c, products, {
      manualOrder: manualOrderByCollection.get(c.id),
      productTagMap: tagData.productTagMap,
    });
    const cover = members.find(p => p.image_url)?.image_url ?? null;
    return cover ? { ...c, hero_image_url: cover } : c;
  });
}
