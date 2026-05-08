import { createClient } from '@supabase/supabase-js';
import type { Product, BlogPost, Order } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function getProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .order('id');
  if (error) throw error;
  return data ?? [];
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .single();
  if (data) return data;

  // Fallback: some slugs have a doubled brand prefix (e.g. cerave-cerave-acne-control-cleanser).
  // If the exact slug fails, try matching any slug that ends with -{slug}.
  const { data: fallback } = await supabase
    .from('products')
    .select('*')
    .ilike('slug', `%-${slug}`)
    .limit(1)
    .single();
  return fallback ?? null;
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  const query = supabase.from('products').select('*').order('id');
  if (category !== 'All') query.eq('category', category);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('date', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) return null;
  return data;
}

export async function createOrder(order: Omit<Order, 'id' | 'created_at'>): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();
  if (error) throw error;
  return data;
}
