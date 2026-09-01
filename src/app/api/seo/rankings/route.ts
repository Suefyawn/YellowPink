// ============================================================================
// /api/seo/rankings, the ranking-check automation's data surface.
//   GET  → the tracked keyword list (what to check) + when it was last checked
//   POST → append a batch of ranking snapshots (one per keyword checked)
//
// Exists so the twice-monthly SEO ranking Routine never needs database
// access: scheduled tasks talk to the site only through token-authed APIs
// (owner directive, 1 Sep 2026 — same rule as the daily blog publish). Uses
// the same bearer token as /api/blog:
//   Authorization: Bearer <BLOG_API_TOKEN>
// ============================================================================

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabase';
import { authorizeBlogApi } from '@/lib/blog-api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/seo/rankings?all=true
// Returns tracked keywords (active only, unless all=true) and the timestamp of
// the most recent snapshot so the caller can tell how stale the dashboard is.
export async function GET(req: NextRequest) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  const all = new URL(req.url).searchParams.get('all') === 'true';

  let query = supabaseAdmin()
    .from('seo_tracked_keywords')
    .select('keyword, volume, target_url, tag, active')
    .order('volume', { ascending: false, nullsFirst: false });
  if (!all) query = query.eq('active', true);
  const { data: keywords, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: latest } = await supabaseAdmin()
    .from('seo_ranking_snapshots')
    .select('checked_at')
    .order('checked_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    keywords: keywords ?? [],
    last_checked_at: (latest as { checked_at: string } | null)?.checked_at ?? null,
  });
}

// One row per keyword checked. `position: null` records "not ranking" — send
// it rather than omitting the keyword, so the dashboard can tell "dropped out"
// from "not checked".
const snapshotSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  position: z.number().min(1).max(200).nullable(),
  volume: z.number().int().min(0).nullable().optional(),
  url: z.string().trim().max(500).nullable().optional(),
});

const batchSchema = z.object({
  // One batch = one check run; every row shares the run's timestamp.
  checked_at: z.string().datetime({ offset: true }).optional(),
  source: z.string().trim().min(1).max(50).optional(),
  snapshots: z.array(snapshotSchema).min(1).max(200),
});

// POST /api/seo/rankings  { checked_at?, source?, snapshots: [{keyword, position, volume?, url?}] }
export async function POST(req: NextRequest) {
  const denied = authorizeBlogApi(req);
  if (denied) return denied;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed.', issues: parsed.error.flatten() }, { status: 422 });
  }

  const checkedAt = parsed.data.checked_at ?? new Date().toISOString();
  const source = parsed.data.source ?? 'semrush_pk';
  const rows = parsed.data.snapshots.map(s => ({
    checked_at: checkedAt,
    source,
    keyword: s.keyword,
    position: s.position,
    volume: s.volume ?? null,
    url: s.url ?? null,
  }));

  const { error } = await supabaseAdmin().from('seo_ranking_snapshots').insert(rows);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ inserted: rows.length, checked_at: checkedAt, source }, { status: 201 });
}
