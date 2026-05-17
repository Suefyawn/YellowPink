// ============================================================================
// Domain types. Mirrors the schema in supabase/migrations/.
// ============================================================================

export type OrderStatus =
  | 'payment_pending'
  | 'payment_failed'
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'
  | 'refunded';

export type PayMethod = 'cod' | 'card' | 'bank' | 'jazzcash' | 'easypaisa' | 'gift_card';

// Customer-facing labels for each status. Used on /track, account/orders, admin order detail.
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  payment_pending: 'Awaiting payment',
  payment_failed:  'Payment failed',
  pending:         'Order received',
  processing:      'Preparing',
  shipped:         'Shipped',
  delivered:       'Delivered',
  cancelled:       'Cancelled',
  returned:        'Returned',
  refunded:        'Refunded',
};

// Forward-progress states shown on the /track timeline.
export const ORDER_TIMELINE_STEPS: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

export interface Product {
  id: string;
  brand: string;
  name: string;
  variant?: string;
  price: number;
  original_price?: number;
  category: string;
  subcategory?: string;
  tag?: string;
  slug: string;
  stock: number;
  image_url?: string;
  description?: string;
  how_to_use?: string;
  ingredients?: string;
  tax_class_id?: string | null;
  created_at?: string;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  created_at: string;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  date: string;
  read_time: string;
  featured?: boolean;
  body?: string;
  image_url?: string;
  created_at?: string;
}

export interface CartItem extends Product {
  qty: number;
}

export interface Order {
  id?: string;
  order_number: string;
  email?: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  city: string;
  province?: string;
  zip?: string;
  pay_method: PayMethod;
  subtotal: number;
  shipping: number;
  total: number;
  items: CartItem[];
  status?: OrderStatus;
  tracking_number?: string;
  courier?: string;
  user_id?: string;
  coupon_code?: string;
  discount_amount?: number;
  notes?: string;
  created_at?: string;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note?: string;
  actor_kind: 'customer' | 'staff' | 'system' | 'gateway';
  actor_id?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
}

export interface Profile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  dob?: string | null;
  created_at: string;
}

export interface Address {
  id: string;
  user_id: string;
  label: string | null;
  first_name: string;
  last_name: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  province: string | null;
  zip: string | null;
  is_default: boolean;
  created_at: string;
}

export interface ShippingZone {
  id: string;
  name: string;
  active: boolean;
}

export interface ShippingRate {
  id: string;
  zone_id: string;
  rate: number;
  free_shipping_threshold: number | null;
  label: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

export interface TaxClass {
  id: string;
  name: string;
  rate_percent: number;
  inclusive: boolean;
}

export interface Payment {
  id: string;
  order_id: string;
  gateway: 'jazzcash' | 'easypaisa' | 'cod' | 'bank' | 'manual' | 'gift_card';
  amount: number;
  currency: string;
  status: 'initiated' | 'succeeded' | 'failed' | 'refunded' | 'cancelled';
  txn_ref: string | null;
  raw_payload?: Record<string, unknown>;
  error_message?: string | null;
  created_at: string;
}

export interface ProductReview {
  id: string;
  product_id: string;
  user_id: string | null;
  author_name: string;
  rating: number;
  body: string;
  approved: boolean;
  photo_urls: string[];
  helpful_count: number;
  brand_reply: string | null;
  created_at: string;
}
