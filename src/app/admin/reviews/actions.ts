'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

async function assertReviews() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function approveReview(formData: FormData): Promise<void> {
  const session = await assertReviews();
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin().from('product_reviews').update({ approved: true }).eq('id', id);
  if (error) {
    redirect(`/admin/reviews?error=${encodeURIComponent('Could not approve review: ' + error.message)}`);
  }
  void logAudit(session, { action: 'review.approve', entity: 'product_reviews', entity_id: id });
  revalidatePath('/admin/reviews');
}

export async function deleteReview(formData: FormData): Promise<void> {
  const session = await assertReviews();
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin().from('product_reviews').delete().eq('id', id);
  if (error) {
    redirect(`/admin/reviews?error=${encodeURIComponent('Could not delete review: ' + error.message)}`);
  }
  void logAudit(session, { action: 'review.delete', entity: 'product_reviews', entity_id: id });
  revalidatePath('/admin/reviews');
}
