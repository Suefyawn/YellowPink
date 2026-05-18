import { createClient } from '@supabase/supabase-js';
import type { Product, BlogPost, Order } from '@/types';
import { DEMO_PRODUCTS, DEMO_BLOG_POSTS, DEMO_SITE_SETTINGS } from './demo-data';

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** True when no Supabase env vars are configured. Storefront helpers fall
 *  back to stub data so the site renders for design / a11y review on a
 *  fresh clone without setting up Supabase. */
export const isDemo = !envUrl || !envKey;

// Placeholder URL/key so createClient doesn't throw on import in demo mode.
const supabaseUrl = envUrl || 'https://demo.invalid';
const supabaseAnonKey = envKey || 'demo-anon-key';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ─── Resilience layer ───────────────────────────────────────────────────────
// Every public storefront getter routes through this so a missing-table or
// RLS-denied error returns the demo fallback instead of throwing — that way a
// half-configured production (env vars set but schema not yet migrated) still
// renders pages instead of triggering the global-error boundary on every
// page that touches the database. Errors are logged so the deployment can
// still be debugged via Vercel logs.

async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Don't spam the demo client with errors — demo mode is opt-in for offline
    // rendering and the placeholder URL deliberately can't be reached.
    if (!isDemo) {
      // eslint-disable-next-line no-console
      console.warn(`[supabase] ${label} failed; falling back. ${(err as Error).message}`);
    }
    return fallback;
  }
}

export async function getProducts(): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS;
  return safe('getProducts', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('id');
    if (error) throw error;
    return (data ?? []) as Product[];
  }, DEMO_PRODUCTS);
}

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isDemo) return DEMO_PRODUCTS.find(p => p.slug === slug) ?? null;
  return safe('getProductBySlug', async () => {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('slug', slug)
      .single();
    if (data) return data as Product;

    // Fallback: some slugs have a doubled brand prefix (e.g. cerave-cerave-acne-control-cleanser).
    // If the exact slug fails, try matching any slug that ends with -{slug}.
    const { data: fallback } = await supabase
      .from('products')
      .select('*')
      .ilike('slug', `%-${slug}`)
      .limit(1)
      .single();
    return (fallback as Product | null) ?? null;
  }, DEMO_PRODUCTS.find(p => p.slug === slug) ?? null);
}

export async function getProductsByCategory(category: string): Promise<Product[]> {
  if (isDemo) return category === 'All' ? DEMO_PRODUCTS : DEMO_PRODUCTS.filter(p => p.category === category);
  return safe('getProductsByCategory', async () => {
    const query = supabase.from('products').select('*').order('id');
    if (category !== 'All') query.eq('category', category);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []) as Product[];
  }, category === 'All' ? DEMO_PRODUCTS : DEMO_PRODUCTS.filter(p => p.category === category));
}

export async function getProductsByTag(tag: string, limit = 8): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.tag === tag).slice(0, limit);
  return safe('getProductsByTag', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('tag', tag)
      .order('id')
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
  }, DEMO_PRODUCTS.filter(p => p.tag === tag).slice(0, limit));
}

export async function getProductsByCategoryAndTag(category: string, limit = 4): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.category === category).slice(0, limit);
  return safe('getProductsByCategoryAndTag', async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('category', category)
      .order('id')
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
  }, DEMO_PRODUCTS.filter(p => p.category === category).slice(0, limit));
}

export async function getBlogPosts(): Promise<BlogPost[]> {
  if (isDemo) return DEMO_BLOG_POSTS;
  return safe('getBlogPosts', async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as BlogPost[];
  }, DEMO_BLOG_POSTS);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (isDemo) return DEMO_BLOG_POSTS.find(p => p.slug === slug) ?? null;
  return safe('getBlogPostBySlug', async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('slug', slug)
      .single();
    if (error) return null;
    return data as BlogPost;
  }, DEMO_BLOG_POSTS.find(p => p.slug === slug) ?? null);
}

export async function getSiteSettings(): Promise<Record<string, string>> {
  if (isDemo) return DEMO_SITE_SETTINGS;
  return safe('getSiteSettings', async () => {
    const { data } = await supabase.from('site_settings').select('key, value');
    return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value]));
  }, DEMO_SITE_SETTINGS);
}

export async function updateSiteSetting(key: string, value: string): Promise<void> {
  await supabase.from('site_settings').upsert({ key, value });
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
