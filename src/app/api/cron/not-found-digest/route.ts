// ============================================================================
// Vercel Cron: email the owner a digest of NEW broken links (404s).
//
// Reads not_found_log (populated by app/not-found.tsx via the log_not_found
// RPC) for unresolved misses that haven't been alerted yet, emails a digest,
// then stamps alerted_at so each dead URL is reported once. sendBrokenLinks-
// DigestEmail is a no-op on an empty list, so a clean day is silent.
//
// Invoked by the consolidated daily cron (src/app/api/cron/daily).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendBrokenLinksDigestEmail } from '@/lib/email';

// Don't alert on a single stray hit — wait until a dead URL is hit at least
// twice (a real link, a crawler retry) so one-off junk probes stay quiet.
const MIN_HITS = 2;
const MAX_PER_DIGEST = 50;

async function authorize(req: NextRequest): Promise<boolean> {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail closed
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!(await authorize(req))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await sb
    .from('not_found_log')
    .select('id, path, hit_count, last_referer, is_bot')
    .eq('resolved', false)
    .is('alerted_at', null)
    .gte('hit_count', MIN_HITS)
    .order('hit_count', { ascending: false })
    .limit(MAX_PER_DIGEST);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const items = (data ?? []) as Array<{
    id: string; path: string; hit_count: number; last_referer: string | null; is_bot: boolean;
  }>;

  if (items.length === 0) return NextResponse.json({ ok: true, newBrokenLinks: 0 });

  await sendBrokenLinksDigestEmail({
    items: items.map(i => ({
      path: i.path, hit_count: i.hit_count, last_referer: i.last_referer, is_bot: i.is_bot,
    })),
  });

  // Mark these as alerted so the next run doesn't re-report them.
  await sb
    .from('not_found_log')
    .update({ alerted_at: new Date().toISOString() })
    .in('id', items.map(i => i.id));

  return NextResponse.json({ ok: true, newBrokenLinks: items.length });
}
