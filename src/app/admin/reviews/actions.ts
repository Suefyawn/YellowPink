'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
  const { error } = await supabase.from('product_reviews').update({ approved: true }).eq('id', id);
  if (error) {
    redirect(`/admin/reviews?error=${encodeURIComponent('Could not approve review: ' + error.message)}`);
  }
  revalidatePath('/admin/reviews');
}

export async function deleteReview(formData: FormData): Promise<void> {
  await assertProducts();
  const id = formData.get('id') as string;
  const { error } = await supabase.from('product_reviews').delete().eq('id', id);
  if (error) {
    redirect(`/admin/reviews?error=${encodeURIComponent('Could not delete review: ' + error.message)}`);
  }
  revalidatePath('/admin/reviews');
}
