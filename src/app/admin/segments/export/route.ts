// CSV export of one custom segment's members (?id=<segment uuid>) — the same
// use case as the Customers export: seed audiences for ad platforms or a
// spreadsheet. Membership is resolved live through segment_customers, so the
// file always matches what the Segments page shows. Admin-gated; the data is
// service-role only and never reachable by anon.

import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { parseCriteria, type SegmentMember } from '@/lib/segments';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const csvCell = (v: unknown): string => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET(req: NextRequest): Promise<Response> {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const id = req.nextUrl.searchParams.get('id') ?? '';
  if (!UUID_RE.test(id)) return new Response('Bad segment id', { status: 400 });

  const admin = supabaseAdmin();
  const { data: seg } = await admin
    .from('customer_segments')
    .select('name, criteria')
    .eq('id', id)
    .maybeSingle();
  if (!seg) return new Response('Segment not found', { status: 404 });

  const criteria = parseCriteria((seg as { criteria: unknown }).criteria);
  const { data, error } = await admin.rpc('segment_customers' as never, { p_criteria: criteria } as never);
  if (error) return new Response('Could not resolve the segment members', { status: 500 });
  const members = ((data ?? []) as unknown as SegmentMember[])
    .sort((a, b) => Number(b.revenue) - Number(a.revenue));

  const header = ['email', 'phone', 'city', 'orders', 'revenue', 'last_order_at', 'first_order_at', 'bucket'];
  const lines = [header.join(',')];
  for (const m of members) {
    lines.push([
      csvCell(m.email), csvCell(m.phone), csvCell(m.city),
      csvCell(m.orders), csvCell(Math.round(Number(m.revenue))),
      csvCell(m.last_order_at ? m.last_order_at.slice(0, 10) : ''),
      csvCell(m.first_order_at ? m.first_order_at.slice(0, 10) : ''),
      csvCell(m.segment),
    ].join(','));
  }
  const csv = lines.join('\n');

  const slug = (seg as { name: string }).name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'segment';
  const stamp = new Date().toISOString().slice(0, 10);

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="yellowpink-segment-${slug}-${stamp}.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
