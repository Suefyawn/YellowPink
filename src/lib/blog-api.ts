// ============================================================================
// Blog management API, shared auth, validation and serialization helpers for
// the /api/blog route handlers.
//
// This is a programmatic CRUD surface over the blog_posts table, intended for
// scripts, automation (Zapier/n8n) and AI content pipelines that need to manage
// the journal without signing into the admin UI. It mirrors the admin server
// actions (same Zod schema, same IndexNow/Google ping on write) so content
// created either way is identical.
//
// Auth: a single static bearer token in BLOG_API_TOKEN, the same pattern the
// cron routes use (CRON_SECRET). If the env var is unset the endpoints return
// 503, so the API is closed-by-default and can never be left wide open.
//
// Server-only (node:crypto + service-role Supabase). Never import client-side.
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { blogPostInputSchema } from '@/lib/validators';

// Columns returned by every endpoint, the full row minus nothing sensitive
// (blog_posts has no private columns). Keep in sync with the table.
export const BLOG_COLUMNS =
  'id, slug, title, seo_title, excerpt, category, date, read_time, featured, body, image_url, author, created_at, updated_at';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** A path segment is either a row UUID or a slug, pick the column to match. */
export function idColumn(idOrSlug: string): 'id' | 'slug' {
  return UUID_RE.test(idOrSlug) ? 'id' : 'slug';
}

// Unlike the admin form (https-only), the API also accepts site-relative image
// paths (e.g. "/blog-heroes/x.webp"), our own hero assets live under /public.
const apiImageUrl = z
  .string()
  .refine(
    u => u === '' || u.startsWith('/') || /^https?:\/\//i.test(u),
    'image_url must be a site-relative path (starting with /) or an http(s) URL',
  )
  .optional()
  .nullable();

// Create: same shape as the admin schema, but `date` is optional (the route
// defaults it to today) and image_url is relaxed per above.
export const blogApiCreateSchema = blogPostInputSchema.extend({
  image_url: apiImageUrl,
  // Same ISO 'YYYY-MM-DD' constraint as the base schema, just optional (the
  // route defaults it to today when omitted).
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format').optional(),
});

// Update: every field optional (partial PATCH). `slug` is still validated when
// present so a rename can't write a malformed slug.
export const blogApiUpdateSchema = blogApiCreateSchema.partial();

/** Bearer-token gate. Returns a ready-to-send error response when the request
 *  is not authorized, or `null` when it is. */
export function authorizeBlogApi(req: NextRequest): NextResponse | null {
  const expected = process.env.BLOG_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: 'Blog API is not configured. Set the BLOG_API_TOKEN environment variable.' },
      { status: 503 },
    );
  }
  const header = req.headers.get('authorization') ?? '';
  const provided = /^Bearer\s+(.+)$/i.exec(header)?.[1] ?? '';
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const ok = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!ok) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }
  return null;
}
