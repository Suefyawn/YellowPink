// Shared shapes + helpers for owner-defined customer segments (the
// `customer_segments` table + `segment_customers(p_criteria jsonb)` RPC,
// both service-role only). Kept out of the 'use server' actions file so the
// page, the form and the newsletter can all import the sync helpers.

/** The fixed RFM bucket labels segment_customers() computes per customer. */
export const SEGMENT_BUCKETS = [
  'VIP', 'Loyal', 'New / Recent', 'Engaged', 'Lapsed', 'At risk', 'Casual',
] as const;
export type SegmentBucket = (typeof SEGMENT_BUCKETS)[number];

/** Criteria stored in customer_segments.criteria. Every key optional; the
 *  RPC ANDs whatever is present. Keys must match the RPC exactly. */
export interface SegmentCriteria {
  min_orders?: number;
  max_orders?: number;
  min_revenue?: number;
  max_revenue?: number;
  ordered_within_days?: number;
  not_ordered_within_days?: number;
  city?: string;
  bucket?: SegmentBucket;
  has_account?: boolean;
  tag_ids?: string[];
}

export interface CustomSegment {
  id: string;
  name: string;
  criteria: SegmentCriteria;
  created_at: string;
  updated_at: string;
}

/** One row from segment_customers(). */
export interface SegmentMember {
  cust_key: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  orders: number;
  revenue: number;
  last_order_at: string | null;
  first_order_at: string | null;
  segment: string;
}

const pkr = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

/** Human-readable one-liner for a criteria object, e.g.
 *  "2+ orders, spent PKR 5,000+, ordered in last 90 days, Lahore". */
export function summarizeCriteria(
  c: SegmentCriteria,
  tagNamesById?: Map<string, string>,
): string {
  const parts: string[] = [];
  if (c.min_orders != null && c.max_orders != null) parts.push(`${c.min_orders} to ${c.max_orders} orders`);
  else if (c.min_orders != null) parts.push(`${c.min_orders}+ order${c.min_orders === 1 ? '' : 's'}`);
  else if (c.max_orders != null) parts.push(`up to ${c.max_orders} order${c.max_orders === 1 ? '' : 's'}`);
  if (c.min_revenue != null && c.max_revenue != null) parts.push(`spent ${pkr(c.min_revenue)} to ${pkr(c.max_revenue)}`);
  else if (c.min_revenue != null) parts.push(`spent ${pkr(c.min_revenue)}+`);
  else if (c.max_revenue != null) parts.push(`spent up to ${pkr(c.max_revenue)}`);
  if (c.ordered_within_days != null) parts.push(`ordered in last ${c.ordered_within_days} days`);
  if (c.not_ordered_within_days != null) parts.push(`no order in ${c.not_ordered_within_days} days`);
  if (c.city) parts.push(c.city);
  if (c.bucket) parts.push(`${c.bucket} bucket`);
  if (c.has_account === true) parts.push('account holders');
  if (c.has_account === false) parts.push('guests only');
  if (c.tag_ids && c.tag_ids.length > 0) {
    const names = c.tag_ids.map(id => tagNamesById?.get(id) ?? 'a deleted tag');
    parts.push(`tagged ${names.join(' or ')}`);
  }
  return parts.length > 0 ? parts.join(', ') : 'All customers';
}

/** Defensive read of a stored criteria jsonb: keeps only known keys with
 *  sane types, so a hand-edited row can't crash the page or the RPC call. */
export function parseCriteria(raw: unknown): SegmentCriteria {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const c: SegmentCriteria = {};
  const num = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined;
  const int = (v: unknown): number | undefined => {
    const n = num(v);
    return n != null && Number.isInteger(n) ? n : undefined;
  };
  if (int(o.min_orders) != null) c.min_orders = int(o.min_orders);
  if (int(o.max_orders) != null) c.max_orders = int(o.max_orders);
  if (num(o.min_revenue) != null) c.min_revenue = num(o.min_revenue);
  if (num(o.max_revenue) != null) c.max_revenue = num(o.max_revenue);
  if (int(o.ordered_within_days) != null) c.ordered_within_days = int(o.ordered_within_days);
  if (int(o.not_ordered_within_days) != null) c.not_ordered_within_days = int(o.not_ordered_within_days);
  if (typeof o.city === 'string' && o.city.trim()) c.city = o.city.trim();
  if (typeof o.bucket === 'string' && (SEGMENT_BUCKETS as readonly string[]).includes(o.bucket)) {
    c.bucket = o.bucket as SegmentBucket;
  }
  if (typeof o.has_account === 'boolean') c.has_account = o.has_account;
  if (Array.isArray(o.tag_ids)) {
    const ids = o.tag_ids.filter((t): t is string => typeof t === 'string' && t.length > 0);
    if (ids.length > 0) c.tag_ids = ids;
  }
  return c;
}
