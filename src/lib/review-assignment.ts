import 'server-only';
import { supabaseAdmin } from './supabase';
import { sendReviewAssignmentEmail } from './email';
import { log } from './logger';

// Reviewer-credit notification. Crediting a board doctor on an article can
// happen three ways: the DB trigger at insert (topic-matched auto-assignment),
// the blog form's reviewer picker, and the admin reassignment controls. All
// of them funnel through this helper AFTER the row is written, so the doctor
// is always emailed the moment their name goes on a piece.
//
// Best-effort by design: a mail failure must never fail the post save that
// triggered it. Errors are logged and swallowed.

/** Email the doctor currently credited on this post. Call after the insert or
 *  update that set (or changed) reviewer_id; no-op when the post has no
 *  reviewer or the reviewer has no email on file. */
export async function notifyReviewerCredited(postId: string): Promise<void> {
  try {
    const admin = supabaseAdmin();
    const { data: post } = await admin
      .from('blog_posts')
      .select('id, slug, title, reviewer_id')
      .eq('id', postId)
      .maybeSingle();
    if (!post?.reviewer_id) return;

    const { data: r } = await admin
      .from('content_reviewers')
      .select('name, email')
      .eq('id', post.reviewer_id)
      .maybeSingle();
    if (!r?.email) {
      log.warn('review_assignment.no_reviewer_email', { postId, reviewerId: post.reviewer_id });
      return;
    }

    await sendReviewAssignmentEmail({
      name: r.name as string,
      email: r.email as string,
      postTitle: post.title as string,
      postSlug: post.slug as string,
    });
  } catch (err) {
    log.warn('review_assignment.notify_failed', {
      postId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}
