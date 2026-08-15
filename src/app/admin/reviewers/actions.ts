'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { sendReviewerApprovedEmail, sendReviewerProfileInviteEmail } from '@/lib/email';
import { notifyReviewerCredited } from '@/lib/review-assignment';
import { canonicalTopics } from '@/lib/review-topics';
import type { SupabaseClient } from '@supabase/supabase-js';

// The Medical Review Board rides the `blog` permission, it's content/editorial
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

// Feedback carriers — reviewer actions previously succeeded/failed silently
// (no ?saved / ?error, unlike Brands/Collections). Call OUTSIDE try/catch:
// redirect() throws a control-flow signal by design.
const P = '/admin/reviewers';
const ok = (msg: string): never => redirect(`${P}?saved=${encodeURIComponent(msg)}`);
const fail = (msg: string): never => redirect(`${P}?error=${encodeURIComponent(msg)}`);

/** Create or update a reviewer. Hidden `id` present → update; absent → insert. */
export async function saveReviewer(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  const name = str(formData, 'name');
  if (!name) fail('A name is required.');

  const slug = str(formData, 'slug') ? slugify(str(formData, 'slug')) : slugify(name);
  // Topics now come from the catalogue checkbox group (multiple values under
  // the same name); canonicalise so only valid catalogue labels are stored.
  const topics = canonicalTopics(formData.getAll('review_topics').map(v => String(v)));
  const languages = str(formData, 'languages').split(',').map(t => t.trim()).filter(Boolean);
  const years = parseInt(str(formData, 'experience_years'), 10);

  const row = {
    slug,
    name,
    credentials: str(formData, 'credentials') || null,
    specialty: str(formData, 'specialty') || null,
    bio: str(formData, 'bio') || null,
    photo_url: str(formData, 'photo_url') || null,
    profile_url: str(formData, 'profile_url') || null,
    affiliation: str(formData, 'affiliation') || null,
    education: str(formData, 'education') || null,
    experience_years: Number.isFinite(years) && years > 0 ? years : null,
    languages,
    email: str(formData, 'email').toLowerCase() || null,
    review_topics: topics,
    active: formData.get('active') != null,
    sort_order: Number(str(formData, 'sort_order')) || 0,
  };

  const admin = supabaseAdmin();
  if (id) {
    const { error } = await admin.from('content_reviewers').update(row).eq('id', id);
    if (error) { log.error('reviewer.update_failed', { id, error: error.message }); fail(`Could not save: ${error.message}`); }
    await logAudit(session, { action: 'reviewer.update', entity: 'content_reviewer', entity_id: id, diff: { name, slug } });
  } else {
    const { error } = await admin.from('content_reviewers').insert(row);
    if (error) { log.error('reviewer.create_failed', { error: error.message }); fail(`Could not create: ${error.message}`); }
    await logAudit(session, { action: 'reviewer.create', entity: 'content_reviewer', diff: { name, slug } });
  }
  revalidateAll();
  ok(id ? `Saved ${name}.` : `Added ${name} to the review board.`);
}

/** Provision (or link) a login for a reviewer if they don't have one yet, then
 *  email them an invite to sign in and complete their public profile. No-op if
 *  the reviewer has no email on file, add one via the edit form first. */
export async function sendReviewerInvite(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  if (!id) return;
  const admin = supabaseAdmin();

  const { data: r } = await admin
    .from('content_reviewers')
    .select('id, name, email, auth_user_id')
    .eq('id', id).maybeSingle();
  if (!r || !r.email) { log.warn('reviewer.invite_no_email', { id }); return fail('Add an email address to this reviewer first, then send the invite.'); }
  const email = (r.email as string).toLowerCase();

  // Ensure a login exists so /reviewer/login works for them.
  if (!r.auth_user_id) {
    let authUserId: string | null = null;
    const { data: createdUser, error: cuErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
    if (createdUser?.user) authUserId = createdUser.user.id;
    else { if (cuErr) log.warn('reviewer.invite_createuser', { error: cuErr.message }); authUserId = await findAuthUserByEmail(admin, email); }
    if (authUserId) await admin.from('content_reviewers').update({ auth_user_id: authUserId }).eq('id', id);
  }

  try { await sendReviewerProfileInviteEmail({ name: r.name as string, email }); }
  catch (err) { log.warn('reviewer.invite_email_failed', { err: err instanceof Error ? err.message : String(err) }); }

  await logAudit(session, { action: 'reviewer.invite', entity: 'content_reviewer', entity_id: id, diff: { email } });
  revalidatePath('/admin/reviewers');
  ok(`Invite sent to ${email}.`);
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
  ok('Default reviewer updated.');
}

export async function deleteReviewer(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  if (!id) return;
  // blog_posts.reviewer_id is ON DELETE SET NULL, so posts simply lose the link.
  const { error } = await supabaseAdmin().from('content_reviewers').delete().eq('id', id);
  if (error) fail(`Could not delete: ${error.message}`);
  await logAudit(session, { action: 'reviewer.delete', entity: 'content_reviewer', entity_id: id });
  revalidateAll();
  ok('Reviewer deleted.');
}

// ─── Applications (self-serve apply → approve) ──────────────────────────────

/** A slug not already taken by another reviewer (append -2, -3, … if needed). */
async function uniqueReviewerSlug(admin: SupabaseClient, base: string): Promise<string> {
  const root = base || 'reviewer';
  for (let n = 0; n < 50; n++) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const { data } = await admin.from('content_reviewers').select('id').eq('slug', candidate).maybeSingle();
    if (!data) return candidate;
  }
  return `${root}-${Date.now()}`;
}

/** Find an existing auth user by email (paginated), used when a reviewer's
 *  email already has a customer account, so we link instead of re-creating. */
async function findAuthUserByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  const target = email.toLowerCase();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data?.users?.length) return null;
    const hit = data.users.find(u => (u.email ?? '').toLowerCase() === target);
    if (hit) return hit.id;
    if (data.users.length < 200) return null; // last page
  }
  return null;
}

/** Approve an application: create the public reviewer profile, provision (or
 *  link) a Supabase auth user so the doctor can sign in by magic link, mark the
 *  application approved, and email the doctor their access link. */
export async function approveReviewerApplication(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  if (!id) return;
  const admin = supabaseAdmin();

  const { data: app } = await admin
    .from('reviewer_applications')
    .select('id, name, email, credentials, specialty, bio, profile_url, photo_url, review_topics, status')
    .eq('id', id).maybeSingle();
  if (!app || app.status !== 'pending') return;

  const email = (app.email as string).toLowerCase();
  const slug = await uniqueReviewerSlug(admin, slugify(app.name as string));

  // 1. Public profile row (active so it shows on the board immediately).
  const { data: created, error: insErr } = await admin.from('content_reviewers').insert({
    slug, name: app.name, email,
    credentials: app.credentials ?? null,
    specialty: app.specialty ?? null,
    bio: app.bio ?? null,
    profile_url: app.profile_url ?? null,
    photo_url: app.photo_url ?? null,
    review_topics: app.review_topics ?? [],
    active: true,
  }).select('id').single();
  if (insErr || !created) { log.error('reviewer.approve_insert_failed', { id, error: insErr?.message }); return; }
  const reviewerId = created.id as string;

  // 2. Provision (or link) the auth account for magic-link sign-in.
  let authUserId: string | null = null;
  const { data: createdUser, error: cuErr } = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (createdUser?.user) {
    authUserId = createdUser.user.id;
  } else {
    // Email already registered (e.g. they're also a customer) → link that user.
    if (cuErr) log.warn('reviewer.approve_createuser', { error: cuErr.message });
    authUserId = await findAuthUserByEmail(admin, email);
  }
  if (authUserId) {
    await admin.from('content_reviewers').update({ auth_user_id: authUserId }).eq('id', reviewerId);
  } else {
    log.warn('reviewer.approve_no_auth_user', { id }); // profile is live; login can be linked later
  }

  // 3. Mark the application approved + link to the new profile.
  await admin.from('reviewer_applications')
    .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewer_id: reviewerId })
    .eq('id', id);

  // 4. Tell the doctor (best-effort).
  try {
    await sendReviewerApprovedEmail({ name: app.name as string, email });
  } catch (err) {
    log.warn('reviewer.approve_email_failed', { err: err instanceof Error ? err.message : String(err) });
  }

  await logAudit(session, { action: 'reviewer.approve', entity: 'content_reviewer', entity_id: reviewerId, diff: { name: app.name, email } });
  revalidateAll();
  ok(`Approved ${app.name} — they can now sign in.`);
}

/** Reject an application (kept for audit, with an optional private reason). */
export async function rejectReviewerApplication(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const id = str(formData, 'id');
  if (!id) return;
  const admin = supabaseAdmin();
  await admin.from('reviewer_applications')
    .update({ status: 'rejected', reviewed_at: new Date().toISOString(), notes: str(formData, 'notes') || null })
    .eq('id', id);
  await logAudit(session, { action: 'reviewer.reject', entity: 'reviewer_application', entity_id: id });
  revalidatePath('/admin/reviewers');
  ok('Application rejected.');
}

/** Assign (or clear) a post's medical reviewer from the assignments triage.
 *  The byline + Article.reviewedBy schema change immediately, so the UI keeps
 *  this behind an explicit per-post button — suggestions are never bulk-applied
 *  silently: "medically reviewed by" is a claim about who actually read it. */
export async function assignPostReviewer(formData: FormData): Promise<void> {
  const session = await assertBlog();
  const postId = str(formData, 'post_id');
  const reviewerId = str(formData, 'reviewer_id') || null;
  const A = '/admin/reviewers/assignments';
  const failA = (msg: string): never => redirect(`${A}?error=${encodeURIComponent(msg)}`);
  if (!postId) failA('Missing post.');

  const admin = supabaseAdmin();
  const { data: post } = await admin.from('blog_posts').select('slug, title, reviewer_id').eq('id', postId).single();
  if (!post) failA('Post not found.');

  const { error } = await admin.from('blog_posts').update({ reviewer_id: reviewerId }).eq('id', postId);
  if (error) {
    log.error('reviewer.assign_failed', { postId, reviewerId, error: error.message });
    failA(`Could not update the post: ${error.message}`);
  }

  void logAudit(session, {
    action: 'blog.reviewer_assigned', entity: 'blog_post', entity_id: postId,
    diff: { post: post!.title, from: post!.reviewer_id, to: reviewerId },
  });
  revalidatePath(`/blog/${post!.slug}`);
  revalidatePath('/admin/reviewers/assignments');
  redirect(`${A}?saved=${encodeURIComponent(reviewerId ? 'Reviewer assigned.' : 'Reviewer removed.')}`);
}
