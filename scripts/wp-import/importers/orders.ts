// WooCommerce orders → public.orders.
//
// Status map (Woo → ours):
//   pending          → payment_pending
//   on-hold          → pending
//   processing       → pending          (paid + awaiting fulfillment)
//   completed        → delivered
//   cancelled        → cancelled
//   refunded         → refunded
//   failed           → payment_failed

import { wc } from '../wp';
import { sb, upsertBatched, lookupManyByWpId } from '../sb';
import type { OrderStatus } from '@/types';

interface WcLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id?: number;
  quantity: number;
  subtotal: string;
  total: string;
  price?: number;
  sku?: string;
  image?: { src?: string };
}

interface WcAddress {
  first_name?: string; last_name?: string;
  address_1?: string;  address_2?: string;
  city?: string; state?: string; postcode?: string; phone?: string; email?: string;
}

interface WcOrder {
  id: number;
  number: string;
  status: 'pending' | 'on-hold' | 'processing' | 'completed' | 'cancelled' | 'refunded' | 'failed' | string;
  date_created: string;
  customer_id: number;                    // 0 = guest
  customer_note?: string;
  billing: WcAddress;
  shipping: WcAddress;
  payment_method: string;
  payment_method_title: string;
  total: string;
  shipping_total: string;
  discount_total: string;
  total_tax: string;
  line_items: WcLineItem[];
  coupon_lines?: { code: string }[];
  meta_data?: { key: string; value: string }[];
}

const STATUS_MAP: Record<string, OrderStatus> = {
  pending:    'payment_pending',
  'on-hold':  'pending',
  processing: 'pending',
  completed:  'delivered',
  cancelled:  'cancelled',
  refunded:   'refunded',
  failed:     'payment_failed',
};

function mapPayment(woo: string): 'cod' | 'card' | 'bank' | 'jazzcash' | 'easypaisa' | 'gift_card' {
  const m = woo.toLowerCase();
  if (m.includes('cod') || m.includes('cash')) return 'cod';
  if (m.includes('jazz')) return 'jazzcash';
  if (m.includes('easy') || m.includes('paisa')) return 'easypaisa';
  if (m.includes('bank') || m.includes('bacs') || m.includes('transfer')) return 'bank';
  if (m.includes('gift')) return 'gift_card';
  return 'card';
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const orders: WcOrder[] = [];
  for await (const o of wc.paginate<WcOrder>('/orders', { per_page: 50, status: 'any', orderby: 'id', order: 'asc' })) {
    orders.push(o);
  }
  if (orders.length === 0) return { imported: 0, skipped: 0, errors };

  // Map product ids on line items to our uuids so we can populate items[] with
  // brand/slug/etc. that the front-end expects.
  const productWpIds = Array.from(new Set(orders.flatMap(o => (o.line_items ?? []).map(li => li.product_id))));
  const productIdMap = await lookupManyByWpId('products', 'wp_product_id', productWpIds);

  // Pull product detail rows we may need to enrich items.
  const productRowsById = new Map<string, { id: string; brand: string; name: string; slug: string; image_url: string | null }>();
  if (productIdMap.size > 0) {
    const ids = Array.from(productIdMap.values());
    for (let i = 0; i < ids.length; i += 500) {
      const slice = ids.slice(i, i + 500);
      const { data } = await sb.from('products').select('id, brand, name, slug, image_url').in('id', slice);
      for (const r of (data ?? []) as Array<{ id: string; brand: string; name: string; slug: string; image_url: string | null }>) {
        productRowsById.set(r.id, r);
      }
    }
  }

  // Find each customer's auth user via legacy_wp_user_id → profile.id.
  const customerWpIds = Array.from(new Set(orders.map(o => o.customer_id).filter(id => id > 0)));
  const profileMap = new Map<number, string>();
  if (customerWpIds.length) {
    for (let i = 0; i < customerWpIds.length; i += 500) {
      const slice = customerWpIds.slice(i, i + 500);
      const { data } = await sb.from('profiles').select('id, legacy_wp_user_id').in('legacy_wp_user_id', slice);
      for (const r of (data ?? []) as Array<{ id: string; legacy_wp_user_id: number }>) {
        profileMap.set(r.legacy_wp_user_id, r.id);
      }
    }
  }

  const rows = orders.map(o => {
    const items = (o.line_items ?? []).map(li => {
      const ourId = productIdMap.get(li.product_id);
      const prod = ourId ? productRowsById.get(ourId) : null;
      const lineTotal = Number(li.total ?? '0');
      const unit = li.quantity > 0 ? Math.round(lineTotal / li.quantity) : 0;
      return {
        id: ourId ?? '',
        brand: prod?.brand ?? '',
        name:  prod?.name  ?? li.name,
        slug:  prod?.slug  ?? '',
        variant: li.variation_id ? `variation:${li.variation_id}` : undefined,
        image_url: prod?.image_url ?? li.image?.src ?? undefined,
        price: unit,
        qty: li.quantity,
      };
    });
    const billing = o.billing ?? {};
    const ship    = o.shipping ?? {};
    const status  = STATUS_MAP[o.status] ?? 'pending';
    return {
      legacy_wp_order_id:    o.id,
      legacy_wp_customer_id: o.customer_id || null,
      order_number:          `YP-WP${o.number}`,         // preserve legacy number
      email:                 billing.email || null,
      first_name:            billing.first_name || ship.first_name || '',
      last_name:             billing.last_name  || ship.last_name  || '',
      phone:                 billing.phone || '',
      address:               ship.address_1 || billing.address_1 || '',
      city:                  ship.city || billing.city || '',
      province:              ship.state || billing.state || null,
      zip:                   ship.postcode || billing.postcode || null,
      pay_method:            mapPayment(o.payment_method ?? ''),
      subtotal:              Number(o.total) - Number(o.shipping_total) - Number(o.total_tax) + Number(o.discount_total),
      shipping:              Number(o.shipping_total),
      total:                 Number(o.total),
      items,
      status,
      tracking_number:       null,
      coupon_code:           o.coupon_lines?.[0]?.code ?? null,
      discount_amount:       Number(o.discount_total || 0),
      // `notes` removed — orders table has no such column. WP's
      // customer_note is currently dropped; if we ever want to preserve
      // it, add a `notes text` column to orders in a migration first.
      user_id:               profileMap.get(o.customer_id) ?? null,
      created_at:            o.date_created ? new Date(o.date_created).toISOString() : undefined,
    };
  });

  const ins = await upsertBatched('orders', rows, { onConflict: 'legacy_wp_order_id' });
  errors.push(...ins.errors);
  return { imported: ins.inserted, skipped: 0, errors };
}
