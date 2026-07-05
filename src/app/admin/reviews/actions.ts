'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { after } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { issueReviewReward } from '@/lib/review-reward';
import { log } from '@/lib/logger';

async function assertReviews() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function bounceReviews(error: string): never {
  redirect(`/admin/reviews?error=${encodeURIComponent(error)}`);
}

export async function approveReview(formData: FormData): Promise<void> {
  const session = await assertReviews();
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin().from('product_reviews').update({ approved: true }).eq('id', id);
  if (error) {
    redirect(`/admin/reviews?error=${encodeURIComponent('Could not approve review: ' + error.message)}`);
  }
  void logAudit(session, { action: 'review.approve', entity: 'product_reviews', entity_id: id });
  // Review booster: reward a guest reviewer with a one-time discount code.
  // Best-effort and post-response (after()) so a slow/failed email or coupon
  // insert can never break the approve action; falls back to inline when
  // there's no request scope. issueReviewReward is a no-op unless enabled and
  // the review is a guest one that hasn't been rewarded yet.
  try { after(() => issueReviewReward(id)); } catch { await issueReviewReward(id); }
  revalidatePath('/admin/reviews');
}

export async function unapproveReview(formData: FormData): Promise<void> {
  const session = await assertReviews();
  const id = formData.get('id') as string;
  const { error } = await supabaseAdmin().from('product_reviews').update({ approved: false }).eq('id', id);
  if (error) {
    bounceReviews('Could not unapprove review: ' + error.message);
  }
  void logAudit(session, { action: 'review.unapprove', entity: 'product_reviews', entity_id: id });
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

/** Save (or clear, when submitted empty) the store's public reply to a
 *  review. The reply shows on the PDP as "Response from Yellow Pink". */
export async function replyToReview(formData: FormData): Promise<void> {
  const session = await assertReviews();
  const id = formData.get('id') as string;
  const reply = ((formData.get('owner_reply') as string) ?? '').trim().slice(0, 2000);

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('product_reviews')
    .update(reply
      ? { owner_reply: reply, owner_reply_at: new Date().toISOString() }
      : { owner_reply: null, owner_reply_at: null })
    .eq('id', id);
  if (error) {
    log.error('review.reply_failed', { id, error: error.message });
    bounceReviews('Could not save the reply: ' + error.message);
  }

  // Refresh the PDP so the reply appears without waiting out the ISR window.
  const { data: row } = await admin
    .from('product_reviews')
    .select('products(slug)')
    .eq('id', id)
    .maybeSingle();
  const prod = (row as { products?: { slug?: string } | { slug?: string }[] | null } | null)?.products;
  const slug = Array.isArray(prod) ? prod[0]?.slug : prod?.slug;
  if (slug) revalidatePath(`/product/${slug}`);

  void logAudit(session, {
    action: reply ? 'review.reply' : 'review.reply_cleared',
    entity: 'product_reviews', entity_id: id,
    diff: reply ? { chars: reply.length } : undefined,
  });
  revalidatePath('/admin/reviews');
  // Land back on the same filtered/paged view the reply was written from.
  const returnTo = (formData.get('return_to') as string) ?? '';
  const base = returnTo.startsWith('/admin/reviews') ? returnTo : '/admin/reviews';
  redirect(`${base}${base.includes('?') ? '&' : '?'}replied=1`);
}

// ─── Admin-side create + edit ────────────────────────────────────────────────
// Admins can seed reviews (migrated/phoned-in feedback) and fix typos / censor
// language on existing ones. Created-by-admin reviews are approved by default;
// the moderation queue is for customer-submitted reviews only.

const ReviewCreateSchema = z.object({
  product_id: z.string().uuid('Pick a product.'),
  author_name: z.string().trim().min(2, 'Add a name (2+ characters).').max(80),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(3, 'Write a review body (3+ characters).').max(4000),
  verified_purchase: z.coerce.boolean().optional().default(false),
});

const ReviewEditSchema = z.object({
  id: z.string().uuid(),
  author_name: z.string().trim().min(2).max(80),
  rating: z.coerce.number().int().min(1).max(5),
  body: z.string().trim().min(3).max(4000),
});

export async function addReview(formData: FormData): Promise<void> {
  const session = await assertReviews();

  const parsed = ReviewCreateSchema.safeParse({
    product_id: formData.get('product_id'),
    author_name: formData.get('author_name'),
    rating: formData.get('rating'),
    body: formData.get('body'),
    verified_purchase: formData.get('verified_purchase') === 'on',
  });
  if (!parsed.success) {
    bounceReviews(parsed.error.issues[0]?.message ?? 'Please check the review form.');
  }

  const { data, error } = await supabaseAdmin()
    .from('product_reviews')
    .insert({ ...parsed.data, approved: true })
    .select('id')
    .single();
  if (error || !data) {
    log.error('review.create_failed', { error: error?.message });
    bounceReviews(error?.message ?? 'Could not save the review.');
  }

  void logAudit(session, {
    action: 'review.create',
    entity: 'product_reviews',
    entity_id: data.id,
    diff: { product_id: parsed.data.product_id, rating: parsed.data.rating },
  });
  revalidatePath('/admin/reviews');
  redirect('/admin/reviews?created=1');
}

export async function updateReview(formData: FormData): Promise<void> {
  const session = await assertReviews();

  const parsed = ReviewEditSchema.safeParse({
    id: formData.get('id'),
    author_name: formData.get('author_name'),
    rating: formData.get('rating'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    bounceReviews(parsed.error.issues[0]?.message ?? 'Please check the review form.');
  }

  const { id, ...patch } = parsed.data;
  const { error } = await supabaseAdmin()
    .from('product_reviews')
    .update(patch)
    .eq('id', id);
  if (error) {
    log.error('review.update_failed', { error: error.message });
    bounceReviews(error.message);
  }

  void logAudit(session, {
    action: 'review.update',
    entity: 'product_reviews',
    entity_id: id,
    diff: patch,
  });
  revalidatePath('/admin/reviews');
  redirect('/admin/reviews?updated=1');
}
