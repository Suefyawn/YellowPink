'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';

async function assertProducts() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products'))) {
    throw new Error('Unauthorized');
  }
}

export async function approveReview(formData: FormData): Promise<void> {
  await assertProducts();
  const id = formData.get('id') as string;
  await supabase.from('product_reviews').update({ approved: true }).eq('id', id);
  revalidatePath('/admin/reviews');
}

export async function deleteReview(formData: FormData): Promise<void> {
  await assertProducts();
  const id = formData.get('id') as string;
  await supabase.from('product_reviews').delete().eq('id', id);
  revalidatePath('/admin/reviews');
}
