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
import { fetchNbSonsCatalog, matchCatalog, stripFormWords, type OurProduct } from '@/lib/price-parity';
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
  const products = ((productRows ?? []) as Array<{ id: string; slug: string; name: string; price: number }>)
    .filter(p => !bundleIds.has(p.id) && !PACK_NAME_RE.test(p.name));

  // A product with size/form/flavour variants is several sellable listings —
  // compare each variant's own price against the vendor's matching variant,
  // never the base row (its price is just the cheapest variant's).
  const variantsByProduct = new Map<string, Array<{ label: string; price: number }>>();
  if (products.length) {
    const { data: variantRows } = await sb
      .from('product_variants')
      .select('id, product_id, price')
      .eq('enabled', true)
      .in('product_id', products.map(p => p.id));
    const vIds = ((variantRows ?? []) as Array<{ id: string }>).map(v => v.id);
    const labelByVariant = new Map<string, string>();
    if (vIds.length) {
      const { data: vavRows } = await sb
        .from('variant_attribute_values')
        .select('variant_id, attribute_value_id')
        .in('variant_id', vIds);
      const valueIds = [...new Set(((vavRows ?? []) as Array<{ attribute_value_id: string }>).map(r => r.attribute_value_id))];
      const { data: valueRows } = valueIds.length
        ? await sb.from('attribute_values').select('id, value').in('id', valueIds)
        : { data: [] };
      const valueById = new Map(((valueRows ?? []) as Array<{ id: string; value: string }>).map(v => [v.id, v.value]));
      for (const r of (vavRows ?? []) as Array<{ variant_id: string; attribute_value_id: string }>) {
        const label = valueById.get(r.attribute_value_id);
        if (!label) continue;
        labelByVariant.set(r.variant_id, [labelByVariant.get(r.variant_id), label].filter(Boolean).join(' '));
      }
    }
    for (const v of (variantRows ?? []) as Array<{ id: string; product_id: string; price: number }>) {
      const list = variantsByProduct.get(v.product_id) ?? [];
      list.push({ label: labelByVariant.get(v.id) ?? '', price: Number(v.price) });
      variantsByProduct.set(v.product_id, list);
    }
  }

  const singles: OurProduct[] = products.flatMap(p => {
    const variants = variantsByProduct.get(p.id);
    if (!variants?.length) return [{ slug: p.slug, name: p.name, price: p.price }];
    return variants.map(v => ({
      slug: `${p.slug}#${v.label || 'variant'}`,
      name: `${stripFormWords(p.name)} ${v.label}`.trim(),
      price: v.price,
    }));
  });

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
