// Public database probe for uptime monitoring.
//
// /api/health is gated behind a secret because it enumerates every table.
// This route exists so an external monitor (Sentry Uptime, or anything that
// can fetch a URL every few minutes) can tell, without a secret, whether the
// store can read its database. It answers 200 when one trivial read succeeds
// and 503 when it does not, which is the signal every page-level monitor
// missed on 17-18 Sep 2026: for two days the storefront returned 200 with
// the built-in demo catalogue while Supabase rejected every call with a
// plan restriction.
//
// Deliberately minimal: one read of one row from a public-select table, no
// counts, no env-var inventory, nothing an attacker can map. Never cached.

import { NextResponse } from 'next/server';
import { supabase, isDemo } from '@/lib/supabase';
import { isSupabaseRestricted } from '@/lib/supabase-resilience';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET() {
  // Demo mode has no database by design (fresh clone, CI); that is not an
  // outage, so it reports healthy and says why.
  if (isDemo) {
    return NextResponse.json({ ok: true, demo: true }, { headers: NO_STORE });
  }
  try {
    const { error } = await supabase.from('site_settings').select('key').limit(1);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (err) {
    const restricted = isSupabaseRestricted(err);
    return NextResponse.json(
      { ok: false, reason: restricted ? 'restricted' : 'unreachable' },
      { status: 503, headers: NO_STORE },
    );
  }
}
