// ============================================================================
// /api/blog/[id], single-post endpoints for the blog management API.
// [id] may be either the row UUID or the post slug.
//   GET    → fetch one post
//   PATCH  → partial update (any subset of fields)
//   DELETE → remove the post
// See src/lib/blog-api.ts for auth + validation. Authorize with
//   Authorization: Bearer <BLOG_API_TOKEN>
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { submitToSearchEnginesQuietly } from '@/lib/indexing';
import { authorizeBlogApi, blogApiUpdateSchema, idColumn, BLOG_COLUMNS } from '@/lib/blog-api';
import { revalidateBlogPost } from '@/lib/revalidate-storefront';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: Promise<{ id: string }> };

// GET /api/blog/:idOrSlug
export async function GET(req: NextRequest, { params }: Params) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  const { id } = await params;
  const { data, error } = await supabaseAdmin()
    .from('blog_posts')
    .select(BLOG_COLUMNS)
    .eq(idColumn(id), id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  return NextResponse.json({ post: data });
}

// PATCH /api/blog/:idOrSlug  { any subset of fields }
export async function PATCH(req: NextRequest, { params }: Params) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  const { id } = await params;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = blogApiUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', issues: parsed.error.flatten() }, { status: 422 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided.' }, { status: 422 });
  }

  // blog_posts.updated_at has no auto-update trigger; bump it so the sitemap's
  // lastModified and any "recently updated" view stay accurate.
  const patch = { ...parsed.data, updated_at: new Date().toISOString() };

  const { data, error } = await supabaseAdmin()
    .from('blog_posts')
    .update(patch)
    .eq(idColumn(id), id)
    .select(BLOG_COLUMNS)
    .maybeSingle();
  if (error) {
    const status = error.code === '23505' ? 409 : 500; // duplicate slug on rename
    return NextResponse.json({ error: error.message }, { status });
  }
  if (!data) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });

  // Bust the ISR entries BEFORE the search-engine ping (see POST /api/blog):
  // an edit that only pings leaves the crawler reading the pre-edit body.
  const { slug } = data as { slug: string };
  revalidateBlogPost(slug);
  await submitToSearchEnginesQuietly([`/blog/${slug}`]);
  return NextResponse.json({ post: data });
}

// DELETE /api/blog/:idOrSlug
export async function DELETE(req: NextRequest, { params }: Params) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  const { id } = await params;
  const { data, error } = await supabaseAdmin()
    .from('blog_posts')
    .delete()
    .eq(idColumn(id), id)
    .select('id, slug')
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: 'Post not found.' }, { status: 404 });
  revalidateBlogPost((data as { slug: string }).slug);
  return NextResponse.json({ deleted: data });
}
