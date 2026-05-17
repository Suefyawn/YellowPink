// WooCommerce product categories → public.categories (hierarchical).
//
// Two passes:
//   1. Insert/upsert every category with parent_id=null so they all exist.
//   2. Patch parent_id using wp_term_id → uuid lookup.

import { wc } from '../wp';
import { sb, upsertBatched, lookupManyByWpId } from '../sb';
import { uploadIfNeeded } from '../media';
import { CONFIG } from '../config';

interface WcCategory {
  id: number;
  parent: number;
  name: string;
  slug: string;
  description?: string;
  menu_order?: number;
  image?: { id: number; src: string; alt?: string } | null;
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const all: WcCategory[] = [];
  for await (const cat of wc.paginate<WcCategory>('/products/categories', { per_page: 100, orderby: 'id', order: 'asc' })) {
    if (cat.slug === 'uncategorized') continue;
    all.push(cat);
  }
  if (all.length === 0) return { imported: 0, skipped: 0, errors };

  // Pass 1: rows without parent.
  const rows = await Promise.all(all.map(async cat => {
    const media = cat.image ? await uploadIfNeeded({ id: cat.image.id, source_url: cat.image.src, alt_text: cat.image.alt }) : null;
    return {
      wp_term_id:  cat.id,
      slug:        cat.slug,
      name:        cat.name,
      description: cat.description?.replace(/<[^>]*>/g, '').trim() || null,
      image_url:   media?.url ?? cat.image?.src ?? null,
      sort_order:  cat.menu_order ?? 0,
      parent_id:   null,                         // patched in pass 2
    };
  }));

  const ins = await upsertBatched('categories', rows, { onConflict: 'wp_term_id' });
  errors.push(...ins.errors);

  // Pass 2: resolve parents.
  const parentWpIds = all.filter(c => c.parent && c.parent !== 0).map(c => c.parent);
  const idMap = await lookupManyByWpId('categories', 'wp_term_id', [...all.map(c => c.id), ...parentWpIds]);
  if (!CONFIG.dryRun) {
    for (const c of all) {
      if (!c.parent) continue;
      const childId  = idMap.get(c.id);
      const parentId = idMap.get(c.parent);
      if (!childId || !parentId) continue;
      const { error } = await sb.from('categories').update({ parent_id: parentId }).eq('id', childId);
      if (error) errors.push(`category ${c.slug}: ${error.message}`);
    }
  }

  return { imported: ins.inserted, skipped: 0, errors };
}
