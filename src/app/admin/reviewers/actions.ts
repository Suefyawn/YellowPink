'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

// The Medical Review Board rides the `blog` permission — it's content/editorial
// governance, the same surface as the journal it reviews.
async function assertBlog() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('blog'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

function slugify(s: string): string {
  return s.toLowerCase().trim()
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '')   // drop honorific from the slug
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function str(fd: FormData, k: string): string { return ((fd.get(k) as string) ?? '').trim(); }

function revalidateAll() {
  revalidatePath('/admin/reviewers');
  revalidatePath('/medical-review-board');
  revalidatePath('/sitemap.xml');
}

/** Create or update a reviewer. Hidden `id` present → update; absent → insert. */
export async function saveReviewer(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  const name = str(formData, 'name');
  if (!name) return;

  const slug = str(formData, 'slug') ? slugify(str(formData, 'slug')) : slugify(name);
  const topics = str(formData, 'review_topics')
    .split(',').map(t => t.trim()).filter(Boolean);

  const row = {
    slug,
    name,
    credentials: str(formData, 'credentials') || null,
    specialty: str(formData, 'specialty') || null,
    bio: str(formData, 'bio') || null,
    photo_url: str(formData, 'photo_url') || null,
    profile_url: str(formData, 'profile_url') || null,
    review_topics: topics,
    active: formData.get('active') != null,
    sort_order: Number(str(formData, 'sort_order')) || 0,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { error } = await admin.from('content_reviewers').update(row).eq('id', id);
    if (error) { log.error('reviewer.update_failed', { id, error: error.message }); return; }
    await logAudit(session, { action: 'reviewer.update', entity: 'content_reviewer', entity_id: id, diff: { name, slug } });
  } else {
    const { error } = await admin.from('content_reviewers').insert(row);
    if (error) { log.error('reviewer.create_failed', { error: error.message }); return; }
    await logAudit(session, { action: 'reviewer.create', entity: 'content_reviewer', diff: { name, slug } });
  }
  revalidateAll();
}

/** Make one reviewer the default (fallback for health posts with no explicit
 *  assignment). Unsets every other default first to satisfy the unique index. */
export async function setDefaultReviewer(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  if (!id) return;
  const admin = supabaseAdmin();
  await admin.from('content_reviewers').update({ is_default: false }).neq('id', id);
  await admin.from('content_reviewers').update({ is_default: true }).eq('id', id);
  await logAudit(session, { action: 'reviewer.set_default', entity: 'content_reviewer', entity_id: id });
  revalidateAll();
}

export async function deleteReviewer(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  if (!id) return;
  // blog_posts.reviewer_id is ON DELETE SET NULL, so posts simply lose the link.
  const { error } = await supabaseAdmin().from('content_reviewers').delete().eq('id', id);
  if (!error) await logAudit(session, { action: 'reviewer.delete', entity: 'content_reviewer', entity_id: id });
  revalidateAll();
}
