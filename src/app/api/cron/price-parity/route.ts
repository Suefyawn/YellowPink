// ============================================================================
// Vercel Cron: weekly NB Sons price-parity check.
//
// The arrangement with NB Sons: their individual products are never sold
// below their own store price — discounts live only in bundles. This job
// pulls nbsons.com's public catalog and compares every published single of
// theirs on our shelf; anything of ours priced below their list is emailed
// to the owner. A clean week is silent.
//
// Invoked by the consolidated daily cron (src/app/api/cron/daily) but only
// does the comparison on Mondays — vendor list prices don't move often
// enough to justify hammering their store daily. `?force=1` runs it any day
// (manual spot-checks).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { fetchNbSonsCatalog, matchCatalog, type OurProduct } from '@/lib/price-parity';
import { sendPriceParityAlertEmail } from '@/lib/email';
import { log } from '@/lib/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// Our own multi-item sets are allowed to discount, so they never enter the
// comparison. Bundle parents are excluded by table lookup as well — this
// regex only catches packs that predate bundle_components rows.
const PACK_NAME_RE = /\b(bundle|combo|stack|pack|trio|duo|set|kit)\b/i;

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  return req.headers.get('authorization') === `Bearer ${expected}`;
}

export async function GET(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const force = new URL(req.url).searchParams.get('force') === '1';
  // Daily cron fires at 09:00 UTC; compare once a week, on Mondays.
  if (!force && new Date().getUTCDay() !== 1) {
    return NextResponse.json({ ok: true, skipped: 'runs Mondays (pass ?force=1 to override)' });
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );

  const { data: vendor } = await sb.from('vendors').select('id, name').ilike('name', '%nazir%').maybeSingle();
  if (!vendor) return NextResponse.json({ ok: true, skipped: 'NB Sons vendor not found' });

  const [{ data: productRows, error }, { data: bundleRows }] = await Promise.all([
    sb.from('products').select('id, slug, name, price')
      .eq('vendor_id', vendor.id as string)
      .eq('status', 'published'),
    sb.from('bundle_components').select('bundle_product_id'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const bundleIds = new Set(((bundleRows ?? []) as Array<{ bundle_product_id: string }>).map(r => r.bundle_product_id));
  const singles: OurProduct[] = ((productRows ?? []) as Array<{ id: string; slug: string; name: string; price: number }>)
    .filter(p => !bundleIds.has(p.id) && !PACK_NAME_RE.test(p.name))
    .map(p => ({ slug: p.slug, name: p.name, price: p.price }));

  let theirs;
  try {
    theirs = await fetchNbSonsCatalog();
  } catch (err) {
    // Their store being down isn't our incident — log and retry next week.
    log.error('price_parity.fetch_failed', { error: err instanceof Error ? err.message : String(err) });
    return NextResponse.json({ ok: false, error: 'vendor catalog unreachable' }, { status: 502 });
  }
  if (theirs.length === 0) return NextResponse.json({ ok: false, error: 'vendor catalog empty' }, { status: 502 });

  const result = matchCatalog(singles, theirs);

  if (result.violations.length > 0) {
    await sendPriceParityAlertEmail({
      vendor: 'NB Sons',
      items: result.violations.map(v => ({
        name: v.name, slug: v.slug, ourPrice: v.ourPrice, theirPrice: v.theirPrice, theirHandle: v.theirHandle,
      })),
    });
  }

  log.info('price_parity.checked', {
    vendor: vendor.name,
    compared: result.compared,
    unmatched: result.unmatched.length,
    violations: result.violations.length,
  });

  return NextResponse.json({
    ok: true,
    compared: result.compared,
    unmatched: result.unmatched,
    violations: result.violations,
  });
}
