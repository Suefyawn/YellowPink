import 'server-only';
import { createServerSupabase } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';

// Server-only data access for the doctor portal (/reviewer). Kept apart from
// lib/reviewers.ts (which is the public, anon-keyed board) because everything
// here is auth-scoped: the signed-in doctor's own row (RLS self_read) and the
// articles credited to them.

export interface ReviewerSelf {
  id: string;
  slug: string;
  name: string;
  credentials: string | null;
  specialty: string | null;
  bio: string | null;
  photo_url: string | null;
  profile_url: string | null;
  affiliation: string | null;
  education: string | null;
  experience_years: number | null;
  languages: string[];
  review_topics: string[];
  active: boolean;
  email: string | null;
}

const SELF_COLS =
  'id, slug, name, credentials, specialty, bio, photo_url, profile_url, affiliation, education, experience_years, languages, review_topics, active, email';

/** The signed-in doctor's own reviewer row (via RLS self_read), or null when
 *  the visitor isn't signed in or isn't a linked/approved reviewer. */
export async function getSignedInReviewer(): Promise<ReviewerSelf | null> {
  const sb = await createServerSupabase();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb
    .from('content_reviewers')
    .select(SELF_COLS)
    .eq('auth_user_id', user.id)
    .maybeSingle();
  return (data as ReviewerSelf | null) ?? null;
}

export interface ReviewedPost {
  id: string;
  slug: string;
  title: string;
  date: string;
  created_at: string;
  /** 'pending' = waiting for this doctor's sign-off; 'approved' = signed off.
   *  (null shouldn't occur on assigned posts, treat it as pending.) */
  review_status: 'pending' | 'approved' | null;
  reviewed_at: string | null;
}

/** Articles assigned to this reviewer (newest first), including their
 *  sign-off state so the dashboard can split "waiting for your review"
 *  (pending) from "reviewed" (approved). Every assigned post is live on the
 *  storefront, but the public byline only renders once approved. Read with
 *  the service role so the dashboard isn't gated by the storefront read
 *  policy. */
export async function getReviewedPosts(reviewerId: string): Promise<ReviewedPost[]> {
  const { data } = await supabaseAdmin()
    .from('blog_posts')
    .select('id, slug, title, date, created_at, review_status, reviewed_at')
    .eq('reviewer_id', reviewerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as ReviewedPost[];
}
