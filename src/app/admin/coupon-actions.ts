'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';

export async function createCoupon(formData: FormData) {
  const code = (formData.get('code') as string).trim().toUpperCase();
  const type = formData.get('type') as 'percent' | 'fixed';
  const value = Number(formData.get('value'));
  const min_order = Number(formData.get('min_order') ?? 0);
  const max_uses = formData.get('max_uses') ? Number(formData.get('max_uses')) : null;
  const expires_at = (formData.get('expires_at') as string) || null;

  if (!code || !type || !value) return;
  if (!/^[A-Z0-9_-]+$/.test(code)) return;
  if (value <= 0) return;

  await supabase.from('coupons').insert({ code, type, value, min_order, max_uses, expires_at });
  revalidatePath('/admin/coupons');
}

export async function deleteCoupon(formData: FormData) {
  const id = formData.get('id') as string;
  await supabase.from('coupons').delete().eq('id', id);
  revalidatePath('/admin/coupons');
}

export async function toggleCoupon(id: string, active: boolean) {
  await supabase.from('coupons').update({ active }).eq('id', id);
  revalidatePath('/admin/coupons');
}
