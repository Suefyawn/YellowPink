import { supabase, isDemo } from '@/lib/supabase';

// Medical Review Board data access (E-E-A-T). Public reads go through the
// anon-keyed storefront client; RLS exposes only active reviewers.

export interface Reviewer {
  id: string;
  slug: string;
  name: string;
  credentials: string | null;
  specialty: string | null;
  bio: string | null;
  photo_url: string | null;
  profile_url: string | null;   // PMDC / hospital / LinkedIn, schema sameAs
  affiliation: string | null;   // current clinic / hospital / practice
  education: string | null;     // medical school / training (schema alumniOf)
  experience_years: number | null;
  languages: string[];
  review_topics: string[];
  is_default: boolean;
  sort_order: number;
}

const COLS = 'id, slug, name, credentials, specialty, bio, photo_url, profile_url, affiliation, education, experience_years, languages, review_topics, is_default, sort_order';

export async function getActiveReviewers(): Promise<Reviewer[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('content_reviewers')
    .select(COLS)
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true });
  return (data ?? []) as Reviewer[];
}

export async function getReviewerBySlug(slug: string): Promise<Reviewer | null> {
  if (isDemo) return null;
  const { data } = await supabase
    .from('content_reviewers')
    .select(COLS)
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  return (data as Reviewer | null) ?? null;
}

export async function getReviewerById(id: string): Promise<Reviewer | null> {
  if (isDemo || !id) return null;
  const { data } = await supabase
    .from('content_reviewers')
    .select(COLS)
    .eq('id', id)
    .eq('active', true)
    .maybeSingle();
  return (data as Reviewer | null) ?? null;
}

/** "Dr. Ayesha Khan, MBBS, FCPS (Gynaecology)" */
export function reviewerFullLabel(r: Pick<Reviewer, 'name' | 'credentials'>): string {
  return r.credentials ? `${r.name}, ${r.credentials}` : r.name;
}
