// ============================================================================
// /api/blog, collection endpoints for the blog management API.
//   GET  → list posts (newest first; filter by category / featured / search)
//   POST → create a post
// See src/lib/blog-api.ts for auth + validation. Authorize with
//   Authorization: Bearer <BLOG_API_TOKEN>
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { submitToSearchEnginesQuietly } from '@/lib/indexing';
import { authorizeBlogApi, blogApiCreateSchema, BLOG_COLUMNS } from '@/lib/blog-api';
import { deriveReadTime } from '@/lib/reading-time';
import { revalidateBlogPost } from '@/lib/revalidate-storefront';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/blog?limit=&offset=&category=&featured=&q=
export async function GET(req: NextRequest) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 100);
  const offset = Math.max(Number(searchParams.get('offset')) || 0, 0);
  const category = searchParams.get('category');
  const featured = searchParams.get('featured');
  const q = searchParams.get('q');

  let query = supabaseAdmin().from('blog_posts').select(BLOG_COLUMNS, { count: 'exact' });
  if (category) query = query.eq('category', category);
  if (featured === 'true' || featured === 'false') query = query.eq('featured', featured === 'true');
  if (q) {
    // Escape the LIKE wildcards / commas a caller might inject into the filter.
    const safe = q.replace(/[,%_]/g, m => `\\${m}`);
    query = query.or(`title.ilike.%${safe}%,excerpt.ilike.%${safe}%`);
  }
  query = query.order('date', { ascending: false }).order('created_at', { ascending: false }).range(offset, offset + limit - 1);

  const { data, error, count } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ posts: data ?? [], total: count ?? 0, limit, offset });
}

// POST /api/blog  { title, slug, excerpt, category, body, ... }
export async function POST(req: NextRequest) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  // Default the publish date to today when the caller omits it.
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && !(raw as Record<string, unknown>).date) {
    (raw as Record<string, unknown>).date = new Date().toISOString().slice(0, 10);
  }

  const parsed = blogApiCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', issues: parsed.error.flatten() }, { status: 422 });
  }

  // Blank read time → derive it from the body, same rule as the admin form.
  const insertRow: Record<string, unknown> = { ...parsed.data };
  if (!String(insertRow.read_time ?? '').trim()) {
    insertRow.read_time = deriveReadTime(String(insertRow.body ?? ''));
  }

  const { data, error } = await supabaseAdmin()
    .from('blog_posts')
    .insert(insertRow)
    .select(BLOG_COLUMNS)
    .single();
  if (error) {
    // 23505 = unique_violation (duplicate slug) → 409 Conflict.
    const status = error.code === '23505' ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  // Bust the ISR entries BEFORE the search-engine ping, so the crawler we are
  // about to invite reads the new post rather than a stale cache entry.
  const { slug } = data as { slug: string };
  revalidateBlogPost(slug);
  // Blog posts go live immediately, nudge the search engines (best-effort).
  await submitToSearchEnginesQuietly([`/blog/${slug}`]);
  return NextResponse.json({ post: data }, { status: 201 });
}
