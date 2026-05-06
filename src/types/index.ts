export type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

export interface Product {
  id: string;
  brand: string;
  name: string;
  variant?: string;
  price: number;
  original_price?: number;
  category: string;
  tag?: string;
  slug: string;
  stock: number;
  image_url?: string;
  description?: string;
  how_to_use?: string;
  ingredients?: string;
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
  pay_method: 'cod' | 'card' | 'bank';
  subtotal: number;
  shipping: number;
  total: number;
  items: CartItem[];
  status?: OrderStatus;
  tracking_number?: string;
  user_id?: string;
  coupon_code?: string;
  discount_amount?: number;
  created_at?: string;
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
  created_at: string;
}
