'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createServerSupabase } from '@/lib/supabase-server';
import { log } from '@/lib/logger';

const str = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? '').trim();

// Doctor self-service profile edit. Updates run through the reviewer's OWN
// session, so RLS (content_reviewers_self_update: auth.uid() = auth_user_id)
// scopes the write to their row. We additionally whitelist columns here, name,
// active, is_default, slug and the account link are NOT editable by the doctor.
export async function updateReviewerProfile(formData: FormData): Promise<void> {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) redirect('/reviewer/login');

  const topics = str(formData, 'review_topics').split(',').map(t => t.trim()).filter(Boolean);
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
