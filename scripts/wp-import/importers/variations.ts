// Variations for every variable product → product_variants + variant_attribute_values.
// Run after `products` so the parent uuid exists.

import { wc } from '../wp';
import { sb, upsertBatched, lookupManyByWpId } from '../sb';
import { uploadIfNeeded } from '../media';

interface WcVariation {
  id: number;
  sku?: string;
  price: string;
  regular_price?: string;
  sale_price?: string;
  stock_quantity?: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  weight?: string;
  status?: 'publish' | 'private';
  menu_order?: number;
  image?: { id: number; src: string; alt?: string };
  attributes?: { id: number; name: string; option: string; slug?: string }[];
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];

  // Find all variable parents in our DB (kind = 'variable').
  const { data: parents } = await sb
    .from('products')
    .select('id, wp_product_id')
    .eq('kind', 'variable')
    .not('wp_product_id', 'is', null);

  const parentRows = (parents ?? []) as { id: string; wp_product_id: number }[];
  if (parentRows.length === 0) return { imported: 0, skipped: 0, errors };

  let totalVariants = 0;
  let totalVavRows = 0;

  for (const parent of parentRows) {
    const variants: WcVariation[] = [];
    for await (const v of wc.paginate<WcVariation>(`/products/${parent.wp_product_id}/variations`, { per_page: 100 })) {
      variants.push(v);
    }
    if (variants.length === 0) continue;

    // Variant rows
    const variantRows = await Promise.all(variants.map(async (v, i) => {
      const reg = Number(v.regular_price ?? v.price ?? 0);
      const sale = Number(v.sale_price || 0);
      const price = sale > 0 && sale < reg ? sale : reg;
      const original = sale > 0 && sale < reg ? reg : null;
      const img = v.image ? await uploadIfNeeded({ id: v.image.id, source_url: v.image.src, alt_text: v.image.alt }) : null;
      return {
        wp_variation_id: v.id,
        product_id:      parent.id,
        sku:             v.sku || null,
        price:           isFinite(price) ? price : 0,
        compare_at_price: original,
        stock:           v.stock_quantity ?? (v.stock_status === 'instock' ? 10 : 0),
        image_url:       img?.url ?? v.image?.src ?? null,
        weight_grams:    v.weight ? Math.round(Number(v.weight) * 1000) : null,
        enabled:         v.status !== 'private',
        sort_order:      v.menu_order ?? i,
      };
    }));

    // Some WP setups attach the same "placeholder" SKU to every variation
    // of one parent (e.g. Pixi Blush Sticks all sharing 'PBSV') because
    // the merchant never assigned per-variant SKUs. The Supabase table
    // has a unique constraint on product_variants.sku — those collisions
    // roll back the whole batch. Null any SKU that appears more than once
    // within the prepared rows. The variation still imports; SKU search
    // just won't reach it (acceptable — it had no real SKU to begin with).
    {
      const seen = new Map<string, number>();
      for (const r of variantRows) {
        if (!r.sku) continue;
        seen.set(r.sku, (seen.get(r.sku) ?? 0) + 1);
      }
      for (const r of variantRows) {
        if (r.sku && (seen.get(r.sku) ?? 0) > 1) r.sku = null;
      }
    }
    const ins = await upsertBatched('product_variants', variantRows, { onConflict: 'wp_variation_id' });
    errors.push(...ins.errors);
    totalVariants += ins.inserted;

    // variant_attribute_values
    const variantIdMap = await lookupManyByWpId('product_variants', 'wp_variation_id', variants.map(v => v.id));
    const vavRows: { variant_id: string; attribute_value_id: string }[] = [];

    for (const v of variants) {
      const variantId = variantIdMap.get(v.id);
      if (!variantId) continue;
      for (const a of v.attributes ?? []) {
        // Woo gives us the parent attribute id (a.id) + the option *name* (a.option).
        // We need the corresponding attribute_value row. Try by wp_term_id when it's
        // a global attribute (a.id > 0); otherwise fall back to (attribute slug, option).
        let valueId: string | null = null;
        // Option A: lookup by slug if available (newer Woo populates a.slug for terms).
        if (a.slug && a.id) {
          const { data } = await sb
            .from('attribute_values')
            .select('id, product_attributes!inner(wp_attribute_id)')
            .eq('slug', a.slug)
            .eq('product_attributes.wp_attribute_id', a.id)
            .maybeSingle();
          valueId = (data as { id?: string } | null)?.id ?? null;
        }
        // Option B: lookup by attribute name + value (covers per-product attributes).
        if (!valueId && a.name) {
          const slug = a.name.replace(/^pa_/, '');
          const optSlug = a.option.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          const { data } = await sb
            .from('attribute_values')
            .select('id, product_attributes!inner(slug)')
            .eq('product_attributes.slug', slug)
            .eq('slug', optSlug)
            .maybeSingle();
          valueId = (data as { id?: string } | null)?.id ?? null;
        }
        if (valueId) vavRows.push({ variant_id: variantId, attribute_value_id: valueId });
      }
    }

    if (vavRows.length) {
      const variantIds = Array.from(new Set(vavRows.map(r => r.variant_id)));
      await sb.from('variant_attribute_values').delete().in('variant_id', variantIds);
      const r = await upsertBatched('variant_attribute_values', vavRows, { ignoreDuplicates: true });
      errors.push(...r.errors);
      totalVavRows += r.inserted;
    }
  }

  return { imported: totalVariants + totalVavRows, skipped: 0, errors };
}
