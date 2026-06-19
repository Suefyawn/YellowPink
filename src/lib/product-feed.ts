// Batch loader for product variants used by the Google/Meta product feeds.
// Emitting one feed row per variant (grouped by item_group_id) lets Shopping /
// the Meta catalog show each shade/size with its own price, stock and image.
//
// A variant's human label is composed from its attribute values (the same
// data the PDP variant picker uses), e.g. "Shade 828" or "Red · Large".

// Anon client (not service-role): the feed routes are statically prerendered
// at build time, where SUPABASE_SERVICE_ROLE_KEY isn't available — using the
// admin client there crashes the build. The variant/attribute tables are
// anon-readable (the public PDP reads them the same way), so the anon client
// is both correct and build-safe.
import { supabase } from './supabase';

export interface FeedVariant {
  id: string;
  sku: string | null;
  label: string;
  price: number;
  compare_at_price: number | null;
  stock: number;
  image_url: string | null;
}

/** product_id → enabled variants (with labels). Products with no variants are
 *  simply absent from the map, so callers fall back to a single parent row. */
export async function loadFeedVariants(productIds: string[]): Promise<Map<string, FeedVariant[]>> {
  const out = new Map<string, FeedVariant[]>();
  if (productIds.length === 0) return out;
  const db = supabase;

  const { data: variantRows } = await db
    .from('product_variants')
    .select('id, product_id, sku, price, compare_at_price, stock, image_url, sort_order')
    .in('product_id', productIds)
    .eq('enabled', true)
    .order('sort_order');
  const variants = (variantRows ?? []) as Array<{
    id: string; product_id: string; sku: string | null; price: number;
    compare_at_price: number | null; stock: number; image_url: string | null;
  }>;
  if (variants.length === 0) return out;

  // variant → its attribute-value ids
  const variantIds = variants.map(v => v.id);
  const { data: vav } = await db
    .from('variant_attribute_values')
    .select('variant_id, attribute_value_id')
    .in('variant_id', variantIds);

  // attribute-value id → display text + sort order
  const valueIds = Array.from(new Set((vav ?? []).map(r => r.attribute_value_id as string)));
  const valueText = new Map<string, string>();
  const valueSort = new Map<string, number>();
  if (valueIds.length) {
    const { data: vals } = await db
      .from('attribute_values')
      .select('id, value, sort_order')
      .in('id', valueIds);
    for (const v of (vals ?? []) as Array<{ id: string; value: string; sort_order: number | null }>) {
      valueText.set(v.id, v.value);
      valueSort.set(v.id, v.sort_order ?? 0);
    }
  }

  // Compose a label per variant from its (sorted) value texts.
  const valsByVariant = new Map<string, string[]>();
  for (const row of vav ?? []) {
    const list = valsByVariant.get(row.variant_id as string) ?? [];
    list.push(row.attribute_value_id as string);
    valsByVariant.set(row.variant_id as string, list);
  }
  const labelByVariant = new Map<string, string>();
  for (const [vid, ids] of valsByVariant) {
    const label = ids
      .map(id => ({ t: valueText.get(id), s: valueSort.get(id) ?? 0 }))
      .filter(x => x.t)
      .sort((a, b) => a.s - b.s)
      .map(x => x.t!)
      .join(' · ');
    if (label) labelByVariant.set(vid, label);
  }

  for (const v of variants) {
    const list = out.get(v.product_id) ?? [];
    list.push({
      id: v.id,
      sku: v.sku,
      label: labelByVariant.get(v.id) ?? v.sku ?? 'Variant',
      price: Number(v.price),
      compare_at_price: v.compare_at_price != null ? Number(v.compare_at_price) : null,
      stock: Number(v.stock ?? 0),
      image_url: v.image_url,
    });
    out.set(v.product_id, list);
  }
  return out;
}
