// WooCommerce coupons → public.coupons (with the new Woo-parity fields).

import { wc } from '../wp';
import { upsertBatched, lookupManyByWpId } from '../sb';

interface WcCoupon {
  id: number;
  code: string;
  description?: string;
  discount_type: 'percent' | 'fixed_cart' | 'fixed_product';
  amount: string;
  date_expires?: string | null;
  individual_use?: boolean;
  product_ids?: number[];
  excluded_product_ids?: number[];
  product_categories?: number[];
  excluded_product_categories?: number[];
  exclude_sale_items?: boolean;
  minimum_amount?: string;
  maximum_amount?: string;
  email_restrictions?: string[];
  usage_limit?: number | null;
  usage_limit_per_user?: number | null;
  free_shipping?: boolean;
  usage_count?: number;
  status?: string;
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const all: WcCoupon[] = [];
  for await (const c of wc.paginate<WcCoupon>('/coupons', { per_page: 100 })) all.push(c);

  if (all.length === 0) return { imported: 0, skipped: 0, errors };

  // Map Woo product/category ids → our uuids.
  const allProductIds = Array.from(new Set(all.flatMap(c => [...(c.product_ids ?? []), ...(c.excluded_product_ids ?? [])])));
  const allCatIds     = Array.from(new Set(all.flatMap(c => [...(c.product_categories ?? []), ...(c.excluded_product_categories ?? [])])));
  const productMap = await lookupManyByWpId('products',   'wp_product_id', allProductIds);
  const categoryMap = await lookupManyByWpId('categories', 'wp_term_id',    allCatIds);

  const rows = all.map(c => ({
    wp_coupon_id:        c.id,
    code:                c.code.toUpperCase(),
    type:                c.discount_type === 'percent' ? 'percent' : 'fixed',   // legacy
    discount_type:       c.discount_type === 'fixed_cart' || c.discount_type === 'fixed_product' || c.discount_type === 'percent'
                           ? c.discount_type
                           : 'fixed_cart',
    value:               Number(c.amount) || 0,
    description:         c.description?.trim() || null,
    min_order:           Number(c.minimum_amount || 0),
    max_order:           c.maximum_amount ? Number(c.maximum_amount) : null,
    max_uses:            c.usage_limit ?? null,
    usage_limit_per_user: c.usage_limit_per_user ?? null,
    used_count:          c.usage_count ?? 0,
    active:              (c.status ?? 'publish') === 'publish',
    expires_at:          c.date_expires ? new Date(c.date_expires).toISOString() : null,
    individual_use:      Boolean(c.individual_use),
    exclude_sale_items:  Boolean(c.exclude_sale_items),
    free_shipping:       Boolean(c.free_shipping),
    product_ids:          (c.product_ids ?? []).map(id => productMap.get(id)).filter(Boolean),
    excluded_product_ids: (c.excluded_product_ids ?? []).map(id => productMap.get(id)).filter(Boolean),
    category_ids:          (c.product_categories ?? []).map(id => categoryMap.get(id)).filter(Boolean),
    excluded_category_ids: (c.excluded_product_categories ?? []).map(id => categoryMap.get(id)).filter(Boolean),
    email_restrictions:    (c.email_restrictions ?? []).map(e => e.toLowerCase()),
  }));

  const ins = await upsertBatched('coupons', rows, { onConflict: 'wp_coupon_id' });
  errors.push(...ins.errors);
  return { imported: ins.inserted, skipped: 0, errors };
}
