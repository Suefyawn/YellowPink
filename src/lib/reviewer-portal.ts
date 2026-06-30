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
  slug: string;
  title: string;
  status: string;
  created_at: string;
}

/** Articles credited to this reviewer (newest first). Read with the service
 *  role so the dashboard can show drafts/unpublished assignments too. */
export async function getReviewedPosts(reviewerId: string): Promise<ReviewedPost[]> {
  const { data } = await supabaseAdmin()
    .from('blog_posts')
    .select('slug, title, status, created_at')
    .eq('reviewer_id', reviewerId)
    .order('created_at', { ascending: false });
  return (data ?? []) as ReviewedPost[];
}
