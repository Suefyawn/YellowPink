// WooCommerce products → public.products (+ M2M categories, images, relations).
// Variations are handled in importers/variations.ts after this step runs.

import { wc } from '../wp';
import { sb, upsertBatched, lookupManyByWpId } from '../sb';
import { uploadIfNeeded } from '../media';
import { CONFIG } from '../config';

interface WcImage { id: number; src: string; alt?: string; position?: number }
interface WcAttribute { id: number; name: string; slug?: string; options: string[]; variation: boolean; visible: boolean }
interface WcProduct {
  id: number;
  name: string;
  slug: string;
  type: 'simple' | 'variable' | 'grouped' | 'external';
  status: 'publish' | 'draft' | 'private' | 'pending';
  description?: string;
  short_description?: string;
  price: string;
  regular_price?: string;
  sale_price?: string;
  sku?: string;
  stock_quantity?: number | null;
  stock_status?: 'instock' | 'outofstock' | 'onbackorder';
  weight?: string;
  categories?: { id: number; name: string; slug: string }[];
  tags?: { id: number; name: string; slug: string }[];
  images?: WcImage[];
  attributes?: WcAttribute[];
  cross_sell_ids?: number[];
  upsell_ids?: number[];
  related_ids?: number[];
  date_created?: string;
}

const WP_STATUS_TO_OURS: Record<string, 'draft' | 'published' | 'archived'> = {
  publish: 'published', draft: 'draft', private: 'draft', pending: 'draft',
};

const KIND_MAP: Record<string, 'simple' | 'variable' | 'bundle' | 'external'> = {
  simple: 'simple', variable: 'variable', grouped: 'bundle', external: 'external',
};

function stripHtml(html: string | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function pickBrand(p: WcProduct): string {
  // 1. Look for a "brand" attribute (Woo doesn't have a first-class brand field).
  const brandAttr = (p.attributes ?? []).find(a => /brand/i.test(a.name));
  if (brandAttr?.options?.length) return brandAttr.options[0];
  // 2. Fallback: first tag.
  if (p.tags?.length) return p.tags[0].name;
  // 3. Last resort: derive from the name's first word.
  return p.name.split(' ')[0] ?? 'YellowPink';
}

function pickPrimaryCategory(p: WcProduct): string {
  return p.categories?.[0]?.name ?? 'Uncategorized';
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];

  // Only publish — drafts/pending/private aren't customer-facing on the
  // live WP site and importing them caused slug collisions when a draft
  // shared a slug with a published product (WP's editor lets them
  // coexist; the draft would be auto-renamed on publish). Audit
  // expects the new storefront to mirror what's actually shoppable.
  // Variations are pulled later in the variations importer.
  const products: WcProduct[] = [];
  for await (const p of wc.paginate<WcProduct>('/products', { per_page: 100, status: 'publish' })) {
    products.push(p);
  }
  if (products.length === 0) return { imported: 0, skipped: 0, errors };

  // Stash WP category ids → our uuids for the M2M step.
  const catWpIds = Array.from(new Set(products.flatMap(p => (p.categories ?? []).map(c => c.id))));
  const catIdMap = await lookupManyByWpId('categories', 'wp_term_id', catWpIds);

  // ── pass 1: upsert products ─────────────────────────────────────────────
  const rows = products.map(p => {
    const reg = Number(p.regular_price ?? p.price ?? 0);
    const sale = Number(p.sale_price || 0);
    const price = sale > 0 && sale < reg ? sale : reg;
    const original = sale > 0 && sale < reg ? reg : null;
    return {
      wp_product_id:    p.id,
      brand:            pickBrand(p),
      name:             p.name,
      slug:             p.slug,
      kind:             KIND_MAP[p.type] ?? 'simple',
      status:           WP_STATUS_TO_OURS[p.status] ?? 'draft',
      price:            isFinite(price) ? price : 0,
      original_price:   original,
      category:         pickPrimaryCategory(p),                      // legacy text col
      stock:            p.stock_quantity ?? (p.stock_status === 'instock' ? 50 : 0),
      description:      stripHtml(p.description) || null,
      short_description: stripHtml(p.short_description) || null,
      weight_grams:     p.weight ? Math.round(Number(p.weight) * 1000) : null,
      image_url:        p.images?.[0]?.src ?? null,    // legacy single-image fallback; multi-image goes in product_images
    };
  });

  const ins = await upsertBatched('products', rows, { onConflict: 'wp_product_id' });
  errors.push(...ins.errors);

  // ── pass 2: product → uuid map ──────────────────────────────────────────
  const prodIdMap = await lookupManyByWpId('products', 'wp_product_id', products.map(p => p.id));

  // ── pass 3: product_categories M2M ──────────────────────────────────────
  const m2m: { product_id: string; category_id: string; is_primary: boolean }[] = [];
  for (const p of products) {
    const productId = prodIdMap.get(p.id);
    if (!productId) continue;
    let isFirst = true;
    for (const c of p.categories ?? []) {
      const categoryId = catIdMap.get(c.id);
      if (!categoryId) continue;
      m2m.push({ product_id: productId, category_id: categoryId, is_primary: isFirst });
      isFirst = false;
    }
  }
  if (m2m.length) {
    // Clear existing M2M for these products so re-runs don't accumulate stale rows.
    if (!CONFIG.dryRun) {
      const productIds = Array.from(new Set(m2m.map(r => r.product_id)));
      await sb.from('product_categories').delete().in('product_id', productIds);
    }
    const r = await upsertBatched('product_categories', m2m, { onConflict: 'product_id,category_id', ignoreDuplicates: true });
    errors.push(...r.errors);
  }

  // ── pass 4: product_images ──────────────────────────────────────────────
  const imageRows: { product_id: string; url: string; alt: string | null; sort_order: number; wp_media_id: number }[] = [];
  for (const p of products) {
    const productId = prodIdMap.get(p.id);
    if (!productId) continue;
    for (const [i, img] of (p.images ?? []).entries()) {
      const m = await uploadIfNeeded({ id: img.id, source_url: img.src, alt_text: img.alt });
      if (!m) continue;
      imageRows.push({
        product_id:  productId,
        url:         m.url,
        alt:         img.alt ?? p.name,
        sort_order:  img.position ?? i,
        wp_media_id: img.id,
      });
    }
  }
  if (imageRows.length) {
    // Replace product images on re-run so order stays clean.
    if (!CONFIG.dryRun) {
      const productIds = Array.from(new Set(imageRows.map(r => r.product_id)));
      await sb.from('product_images').delete().in('product_id', productIds).is('variant_id', null);
    }
    const r = await upsertBatched('product_images', imageRows, {});
    errors.push(...r.errors);
  }

  // ── pass 5: cross-sell / upsell relations ───────────────────────────────
  const relRows: { product_id: string; related_product_id: string; kind: string; sort_order: number }[] = [];
  for (const p of products) {
    const productId = prodIdMap.get(p.id);
    if (!productId) continue;
    for (const [i, rid] of (p.cross_sell_ids ?? []).entries()) {
      const target = prodIdMap.get(rid);
      if (target && target !== productId) relRows.push({ product_id: productId, related_product_id: target, kind: 'cross_sell', sort_order: i });
    }
    for (const [i, rid] of (p.upsell_ids ?? []).entries()) {
      const target = prodIdMap.get(rid);
      if (target && target !== productId) relRows.push({ product_id: productId, related_product_id: target, kind: 'upsell', sort_order: i });
    }
    for (const [i, rid] of (p.related_ids ?? []).entries()) {
      const target = prodIdMap.get(rid);
      if (target && target !== productId) relRows.push({ product_id: productId, related_product_id: target, kind: 'related', sort_order: i });
    }
  }
  if (relRows.length) {
    if (!CONFIG.dryRun) {
      const productIds = Array.from(new Set(relRows.map(r => r.product_id)));
      await sb.from('product_relations').delete().in('product_id', productIds);
    }
    const r = await upsertBatched('product_relations', relRows, { ignoreDuplicates: true });
    errors.push(...r.errors);
  }

  return { imported: ins.inserted, skipped: 0, errors };
}
