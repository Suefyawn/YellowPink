// ============================================================================
// Staff-only label download: GET /api/admin/shipment-label?shipment_id=…
//
// TCS's CN Print endpoint streams the label PDF directly (no URL envelope),
// so a plain <a href> to a stored URL was never possible — every shipment's
// raw_label_url stayed NULL and staff had nothing to print, which is what
// forced the manual re-book on Jul 28 (parcel travelled under a hand-written
// CN while the API consignment sat unscanned). This route fetches the bytes
// through the courier adapter at click time and serves them inline, so the
// "Print label" button on the booking panel always works, label freshness
// included (TCS regenerates on each call).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { getAdapter } from '@/lib/couriers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const shipmentId = new URL(req.url).searchParams.get('shipment_id');
  if (!shipmentId) return NextResponse.json({ error: 'shipment_id required' }, { status: 400 });

  const { data: s } = await supabaseAdmin()
    .from('shipments')
    .select('courier, tracking_number, raw_label_url')
    .eq('id', shipmentId)
    .maybeSingle();
  if (!s) return NextResponse.json({ error: 'Shipment not found' }, { status: 404 });

  // A URL captured at booking time (the rare JSON-envelope deployments) is
  // still the cheapest path — just send the browser there.
  if (s.raw_label_url) return NextResponse.redirect(s.raw_label_url as string);

  const adapter = getAdapter(s.courier as string);
  if (!adapter?.labelPdf) {
    return NextResponse.json(
      { error: `${s.courier} has no label API — print from the courier's portal.` },
      { status: 404 },
    );
  }

  const r = await adapter.labelPdf(s.tracking_number as string);
  if (!('ok' in r) || !r.ok) {
    return NextResponse.json({ error: r.message }, { status: 502 });
  }
  return new NextResponse(Buffer.from(r.base64, 'base64'), {
    status: 200,
    headers: {
      'Content-Type': r.contentType,
      'Content-Disposition': `inline; filename="${s.tracking_number}.pdf"`,
      // Always fetch fresh — the label is cheap to regenerate and staff may
      // reprint after a consignment edit.
      'Cache-Control': 'private, no-store',
    },
  });
}
