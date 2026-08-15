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

/** "Flag a concern": the credited doctor sends the editorial team a note
 *  about one of their articles (a correction, an objection to the credit,
 *  anything). The note lands in admin notifications; the post itself is not
 *  changed here — staff act on the note (edit, reassign or remove the
 *  credit) from the admin side. */
export async function flagArticleConcern(formData: FormData): Promise<void> {
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
  // Only articles credited to the signed-in doctor; anything else is a
  // stale/forged form post.
  if (!post || post.reviewer_id !== me.id) {
    log.warn('reviewer.concern_not_own_article', { postId, reviewerId: me.id });
    return;
  }

  const { error } = await admin.from('admin_notifications').insert({
    kind: 'review_concern',
    title: `${me.name} flagged "${post.title}"`,
    body: note,
    link: `/admin/blog/${post.id}`,
    entity_id: post.id,
  });
  if (error) { log.error('reviewer.concern_insert_failed', { postId, error: error.message }); return; }

  log.info('reviewer.concern_flagged', { postId, reviewerId: me.id });
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
