'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { canonicalTopics } from '@/lib/review-topics';
import { log } from '@/lib/logger';

const str = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? '').trim();

/** The signed-in doctor's own reviewer row, or null. Every review action below
 *  is guarded through this: the doctor can only touch posts whose reviewer_id
 *  is their own row (looked up via auth_user_id, never from the form). */
async function signedInReviewerRow(): Promise<{ id: string; name: string; slug: string } | null> {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await supabaseAdmin()
    .from('content_reviewers')
    .select('id, name, slug')
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (data as { id: string; name: string; slug: string } | null) ?? null;
}

/** "I have reviewed this article": the doctor signs off on a pending
 *  assignment. Sets review_status='approved' + reviewed_at=now(), which is
 *  what makes the public byline and the Article reviewedBy schema render. */
export async function approveReviewAssignment(formData: FormData): Promise<void> {
  const me = await signedInReviewerRow();
  if (!me) redirect('/reviewer/login');
  const postId = str(formData, 'post_id');
  if (!postId) return;

  const admin = supabaseAdmin();
  const { data: post } = await admin
    .from('blog_posts')
    .select('id, slug, title, reviewer_id, review_status')
    .eq('id', postId)
    .maybeSingle();
  // Only the doctor's OWN assignment can be approved; anything else is a
  // stale/forged form post.
  if (!post || post.reviewer_id !== me.id) {
    log.warn('reviewer.approve_not_own_assignment', { postId, reviewerId: me.id });
    return;
  }
  if (post.review_status === 'approved') { revalidatePath('/reviewer'); return; }

  const { error } = await admin
    .from('blog_posts')
    .update({ review_status: 'approved', reviewed_at: new Date().toISOString() })
    .eq('id', postId)
    .eq('reviewer_id', me.id);
  if (error) { log.error('reviewer.approve_failed', { postId, error: error.message }); return; }

  log.info('reviewer.approved_article', { postId, reviewerId: me.id });
  // The approval is what turns the public byline + schema on.
  revalidatePath(`/blog/${post.slug}`);
  revalidatePath(`/medical-review-board/${me.slug}`);
  revalidatePath('/reviewer');
}

/** "Request changes": the doctor flags a pending article with a note. The
 *  post's status is NOT changed (it stays pending, byline stays hidden); the
 *  note lands in admin notifications for the editorial team to act on. */
export async function requestChangesOnAssignment(formData: FormData): Promise<void> {
  const me = await signedInReviewerRow();
  if (!me) redirect('/reviewer/login');
  const postId = str(formData, 'post_id');
  const note = str(formData, 'note').slice(0, 2000);
  if (!postId || !note) return;

  const admin = supabaseAdmin();
  const { data: post } = await admin
    .from('blog_posts')
    .select('id, title, reviewer_id')
    .eq('id', postId)
    .maybeSingle();
  if (!post || post.reviewer_id !== me.id) {
    log.warn('reviewer.changes_not_own_assignment', { postId, reviewerId: me.id });
    return;
  }

  const { error } = await admin.from('admin_notifications').insert({
    kind: 'review_changes_requested',
    title: `${me.name} requests changes on "${post.title}"`,
    body: note,
    link: `/admin/blog/${post.id}`,
    entity_id: post.id,
  });
  if (error) { log.error('reviewer.changes_insert_failed', { postId, error: error.message }); return; }

  log.info('reviewer.changes_requested', { postId, reviewerId: me.id });
  redirect('/reviewer?sent=1');
}

// Doctor self-service profile edit. Updates run through the reviewer's OWN
// session, so RLS (content_reviewers_self_update: auth.uid() = auth_user_id)
// scopes the write to their row. We additionally whitelist columns here, name,
// active, is_default, slug and the account link are NOT editable by the doctor.
export async function updateReviewerProfile(formData: FormData): Promise<void> {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/reviewer/login');

  const topics = canonicalTopics(formData.getAll('review_topics').map(v => String(v)));
  const languages = str(formData, 'languages').split(',').map(t => t.trim()).filter(Boolean);
  const years = parseInt(str(formData, 'experience_years'), 10);
  const { error } = await sb
    .from('content_reviewers')
    .update({
      credentials: str(formData, 'credentials') || null,
      specialty: str(formData, 'specialty') || null,
      bio: str(formData, 'bio') || null,
      photo_url: str(formData, 'photo_url') || null,
      profile_url: str(formData, 'profile_url') || null,
      affiliation: str(formData, 'affiliation') || null,
      education: str(formData, 'education') || null,
      experience_years: Number.isFinite(years) && years > 0 ? years : null,
      languages,
      review_topics: topics,
    })
    .eq('auth_user_id', user.id);

  if (error) { log.error('reviewer.self_update_failed', { error: error.message }); return; }
  revalidatePath('/reviewer');
  revalidatePath('/medical-review-board');
}

export async function signOutReviewer(): Promise<void> {
  const sb = await createServerSupabase();
  await sb.auth.signOut();
  redirect('/reviewer/login');
}
