'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { hashPassword, setStaffCookie, clearStaffCookie } from '@/lib/staff-auth';
import type { OrderStatus } from '@/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginAdmin(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const password = formData.get('password') as string;
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: 'Admin access is not configured. Set ADMIN_PASSWORD environment variable.' };
  if (password !== expected) return { error: 'Incorrect password' };
  const store = await cookies();
  store.set('admin_session', Buffer.from(expected).toString('base64'), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
    sameSite: 'lax',
  });
  redirect('/admin/dashboard');
}

export async function loginStaff(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const email = (formData.get('email') as string).trim().toLowerCase();
  const password = formData.get('password') as string;
  if (!email || !password) return { error: 'Email and password are required' };

  const { data } = await supabase
    .from('staff_members')
    .select('id, password_hash, password_salt, is_active')
    .eq('email', email)
    .single();

  if (!data || !data.is_active) return { error: 'Invalid email or password' };

  const hash = hashPassword(password, data.password_salt);
  if (hash !== data.password_hash) return { error: 'Invalid email or password' };

  await setStaffCookie(data.id);
  redirect('/admin/dashboard');
}

export async function logoutAdmin() {
  const store = await cookies();
  store.delete('admin_session');
  await clearStaffCookie();
  redirect('/admin');
}

// ─── Products ────────────────────────────────────────────────────────────────

function validateProduct(formData: FormData): { error: string } | null {
  const brand = (formData.get('brand') as string).trim();
  const name = (formData.get('name') as string).trim();
  const slug = (formData.get('slug') as string).trim();
  const category = (formData.get('category') as string).trim();
  const price = Number(formData.get('price'));
  const stock = Number(formData.get('stock') ?? 0);
  const imageUrl = (formData.get('image_url') as string).trim();

  if (!brand) return { error: 'Brand is required' };
  if (!name) return { error: 'Product name is required' };
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { error: 'Slug must be lowercase letters, numbers, and hyphens only' };
  if (!category) return { error: 'Category is required' };
  if (isNaN(price) || price < 0) return { error: 'Price must be a positive number' };
  if (isNaN(stock) || stock < 0) return { error: 'Stock must be 0 or more' };
  if (imageUrl && !/^https?:\/\//.test(imageUrl)) return { error: 'Image URL must start with http:// or https://' };
  return null;
}

function parseProduct(formData: FormData) {
  return {
    brand: (formData.get('brand') as string).trim(),
    name: (formData.get('name') as string).trim(),
    variant: (formData.get('variant') as string).trim() || null,
    price: Number(formData.get('price')),
    original_price: formData.get('original_price') ? Number(formData.get('original_price')) : null,
    category: (formData.get('category') as string).trim(),
    tag: (formData.get('tag') as string) || null,
    slug: (formData.get('slug') as string).trim(),
    stock: Number(formData.get('stock') ?? 0),
    image_url: (formData.get('image_url') as string).trim() || null,
    description: (formData.get('description') as string).trim() || null,
    how_to_use: (formData.get('how_to_use') as string).trim() || null,
    ingredients: (formData.get('ingredients') as string).trim() || null,
  };
}

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const validationError = validateProduct(formData);
  if (validationError) return validationError;
  const { error } = await supabase.from('products').insert(parseProduct(formData));
  if (error) return { error: error.message };
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function updateProduct(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const validationError = validateProduct(formData);
  if (validationError) return validationError;
  const { error } = await supabase.from('products').update(parseProduct(formData)).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function deleteProduct(formData: FormData) {
  const id = formData.get('id') as string;
  await supabase.from('products').delete().eq('id', id);
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

// ─── Blog ─────────────────────────────────────────────────────────────────────

function validateBlogPost(formData: FormData): { error: string } | null {
  const title = (formData.get('title') as string).trim();
  const slug = (formData.get('slug') as string).trim();
  const excerpt = (formData.get('excerpt') as string).trim();
  const category = (formData.get('category') as string).trim();

  if (!title) return { error: 'Title is required' };
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) return { error: 'Slug must be lowercase letters, numbers, and hyphens only' };
  if (!excerpt || excerpt.length > 300) return { error: 'Excerpt is required and must be under 300 characters' };
  if (!category) return { error: 'Category is required' };
  return null;
}

export async function createBlogPost(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const validationError = validateBlogPost(formData);
  if (validationError) return validationError;
  const data = {
    title: (formData.get('title') as string).trim(),
    slug: (formData.get('slug') as string).trim(),
    excerpt: (formData.get('excerpt') as string).trim(),
    category: (formData.get('category') as string).trim(),
    date: formData.get('date') as string,
    read_time: (formData.get('read_time') as string).trim() || '3 min read',
    featured: formData.get('featured') === 'on',
    body: (formData.get('body') as string) || null,
    image_url: (formData.get('image_url') as string).trim() || null,
  };
  const { error } = await supabase.from('blog_posts').insert(data);
  if (error) return { error: error.message };
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function updateBlogPost(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const validationError = validateBlogPost(formData);
  if (validationError) return validationError;
  const data = {
    title: (formData.get('title') as string).trim(),
    slug: (formData.get('slug') as string).trim(),
    excerpt: (formData.get('excerpt') as string).trim(),
    category: (formData.get('category') as string).trim(),
    date: formData.get('date') as string,
    read_time: (formData.get('read_time') as string).trim() || '3 min read',
    featured: formData.get('featured') === 'on',
    body: (formData.get('body') as string) || null,
    image_url: (formData.get('image_url') as string).trim() || null,
  };
  const { error } = await supabase.from('blog_posts').update(data).eq('id', id);
  if (error) return { error: error.message };
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

export async function deleteBlogPost(formData: FormData) {
  const id = formData.get('id') as string;
  await supabase.from('blog_posts').delete().eq('id', id);
  revalidatePath('/admin/blog');
  redirect('/admin/blog');
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export async function bulkUpdateOrderStatus(ids: string[], status: OrderStatus) {
  await supabase.from('orders').update({ status }).in('id', ids);
  revalidatePath('/admin/orders');
}

export async function updateOrderStatus(
  id: string,
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const status = formData.get('status') as OrderStatus;
  const tracking_number = (formData.get('tracking_number') as string) || null;
  const { error } = await supabase
    .from('orders')
    .update({ status, tracking_number })
    .eq('id', id);
  if (error) return { error: error.message };
  revalidatePath(`/admin/orders/${id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}
