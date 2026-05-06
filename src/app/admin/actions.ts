'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import type { OrderStatus } from '@/types';

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function loginAdmin(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const password = formData.get('password') as string;
  const expected = process.env.ADMIN_PASSWORD ?? 'yellowpink2024';
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

export async function logoutAdmin() {
  const store = await cookies();
  store.delete('admin_session');
  redirect('/admin');
}

// ─── Products ────────────────────────────────────────────────────────────────

export async function createProduct(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const data = {
    brand: formData.get('brand') as string,
    name: formData.get('name') as string,
    variant: (formData.get('variant') as string) || null,
    price: Number(formData.get('price')),
    original_price: formData.get('original_price') ? Number(formData.get('original_price')) : null,
    category: formData.get('category') as string,
    tag: (formData.get('tag') as string) || null,
    slug: formData.get('slug') as string,
    stock: Number(formData.get('stock') ?? 0),
    image_url: (formData.get('image_url') as string) || null,
  };
  const { error } = await supabase.from('products').insert(data);
  if (error) return { error: error.message };
  revalidatePath('/admin/products');
  redirect('/admin/products');
}

export async function updateProduct(
  id: string,
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const data = {
    brand: formData.get('brand') as string,
    name: formData.get('name') as string,
    variant: (formData.get('variant') as string) || null,
    price: Number(formData.get('price')),
    original_price: formData.get('original_price') ? Number(formData.get('original_price')) : null,
    category: formData.get('category') as string,
    tag: (formData.get('tag') as string) || null,
    slug: formData.get('slug') as string,
    stock: Number(formData.get('stock') ?? 0),
    image_url: (formData.get('image_url') as string) || null,
  };
  const { error } = await supabase.from('products').update(data).eq('id', id);
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

export async function createBlogPost(
  _prev: { error?: string } | null,
  formData: FormData
): Promise<{ error: string } | null> {
  const data = {
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    excerpt: formData.get('excerpt') as string,
    category: formData.get('category') as string,
    date: formData.get('date') as string,
    read_time: formData.get('read_time') as string,
    featured: formData.get('featured') === 'on',
    body: (formData.get('body') as string) || null,
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
  const data = {
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    excerpt: formData.get('excerpt') as string,
    category: formData.get('category') as string,
    date: formData.get('date') as string,
    read_time: formData.get('read_time') as string,
    featured: formData.get('featured') === 'on',
    body: (formData.get('body') as string) || null,
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
