import { NextRequest } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { supabaseAdmin } from '@/lib/supabase';
import { fetchAll } from '@/lib/fetch-all';

export const dynamic = 'force-dynamic';

// CSV-escape: quote cells containing comma, quote or newline; double inner quotes.
function cell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const day = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '');
const STATUS_LABEL: Record<string, string> = {
  processing: 'Processing', shipped: 'Out for delivery', delivered: 'Delivered (to collect)',
};

// Active COD list as a runner/collection manifest, every COD order still in
// flight (processing / shipped) plus delivered-but-unconfirmed, with the
// address + amount. Gated on the same `analytics` permission as the COD page.
// Service-role read (orders RLS blocks anon).
export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('finance'))) {
    return new Response('Forbidden', { status: 403 });
  }

  const onlyOutstanding = req.nextUrl.searchParams.get('outstanding') === '1';

  type Row = { order_number: string; status: string; first_name: string | null; last_name: string | null; phone: string | null; address: string | null; city: string | null; province: string | null; total: number | null; payment_received_at: string | null; created_at: string };
  // fetchAll pages past PostgREST's silent 1000-row cap so a busy COD backlog
  // exports in full instead of truncating at 1000 rows.
  const { data } = await fetchAll<Row>(
    supabaseAdmin()
      .from('orders')
      .select('order_number, status, first_name, last_name, phone, address, city, province, total, payment_received_at, created_at')
      .eq('pay_method', 'cod')
      .in('status', ['processing', 'shipped', 'delivered'])
      .order('created_at', { ascending: false }),
  );
  let rows = data ?? [];
  // The "to collect" subset: delivered but cash not yet reconciled.
  if (onlyOutstanding) rows = rows.filter(r => r.status === 'delivered' && !r.payment_received_at);

  const header = ['Order', 'Status', 'Customer', 'Phone', 'Address', 'City', 'Province', 'Amount (PKR)', 'Placed'];
  const lines = [header.map(cell).join(',')];
  for (const r of rows) {
    lines.push([
      r.order_number,
      STATUS_LABEL[r.status] ?? r.status,
      [r.first_name, r.last_name].filter(Boolean).join(' '),
      r.phone ?? '',
      r.address ?? '',
      r.city ?? '',
      r.province ?? '',
      Math.round(Number(r.total ?? 0)),
      day(r.created_at),
    ].map(cell).join(','));
  }
  // Leading BOM so Excel reads UTF-8; CRLF line endings for the same reason.
  const csv = '﻿' + lines.join('\r\n');
  const fname = `cod-${onlyOutstanding ? 'to-collect' : 'active'}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
