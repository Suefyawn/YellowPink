// WooCommerce global attributes + terms → product_attributes + attribute_values.

import { wc } from '../wp';
import { upsertBatched, lookupManyByWpId } from '../sb';

interface WcAttribute {
  id: number;
  name: string;
  slug: string;         // "pa_color" — Woo prefixes with pa_
  type: string;
  order_by: string;
  has_archives: boolean;
}

interface WcAttributeTerm {
  id: number;
  name: string;
  slug: string;
  description?: string;
  menu_order?: number;
  count?: number;
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];

  // Step 1: attributes
  const attrs: WcAttribute[] = [];
  for await (const a of wc.paginate<WcAttribute>('/products/attributes', { per_page: 100 })) attrs.push(a);

  const attrRows = attrs.map(a => ({
    wp_attribute_id:  a.id,
    slug:             a.slug.replace(/^pa_/, ''),
    name:             a.name,
    visible_on_pdp:   true,
    usable_in_filter: true,
    sort_order:       0,
  }));
  const attrIns = await upsertBatched('product_attributes', attrRows, { onConflict: 'wp_attribute_id' });
  errors.push(...attrIns.errors);

  // Step 2: terms per attribute
  const attrIdMap = await lookupManyByWpId('product_attributes', 'wp_attribute_id', attrs.map(a => a.id));

  let termsImported = 0;
  for (const a of attrs) {
    const attributeId = attrIdMap.get(a.id);
    if (!attributeId) continue;
    const terms: WcAttributeTerm[] = [];
    for await (const t of wc.paginate<WcAttributeTerm>(`/products/attributes/${a.id}/terms`, { per_page: 100 })) terms.push(t);
    const rows = terms.map(t => ({
      attribute_id: attributeId,
      wp_term_id:   t.id,
      slug:         t.slug,
      value:        t.name,
      sort_order:   t.menu_order ?? 0,
    }));
    const ins = await upsertBatched('attribute_values', rows, { onConflict: 'attribute_id,slug' });
    errors.push(...ins.errors);
    termsImported += ins.inserted;
  }

  return { imported: attrIns.inserted + termsImported, skipped: 0, errors };
}
