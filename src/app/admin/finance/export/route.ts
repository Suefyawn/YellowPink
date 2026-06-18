import { NextRequest } from 'next/server';
import { getStaffSession } from '@/lib/staff-auth';
import { resolveRange, rangeStartISO, loadFinanceOrders, toOrderFinanceRow, PAY_METHOD_LABELS } from '@/lib/finance';

export const dynamic = 'force-dynamic';

// CSV-escape: quote cells containing comma, quote or newline; double inner quotes.
function cell(v: string | number | null | undefined): string {
  const s = String(v ?? '');
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const day = (s: string | null) => (s ? new Date(s).toISOString().slice(0, 10) : '');

// Exports the per-order finance table (full set, not capped) for the chosen
// range + optional payment-method filter — the same rows the Finance page
// shows, via the shared helpers. Gated on the same permission as the page.
export async function GET(req: NextRequest) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('analytics')) {
    return new Response('Forbidden', { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const range = resolveRange(sp.get('range') ?? undefined);
  const methodParam = sp.get('method');
  const methodFilter = methodParam && PAY_METHOD_LABELS[methodParam] ? methodParam : null;

  const { orders, cogsByOrder } = await loadFinanceOrders(rangeStartISO(range.days));
  const filtered = methodFilter ? orders.filter(o => (o.pay_method ?? 'unknown') === methodFilter) : orders;
  const rows = [...filtered]
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    .map(o => toOrderFinanceRow(o, cogsByOrder));

  const header = ['Order', 'Date', 'Method', 'Total', 'COGS', 'Delivery', 'Payment fee', 'Costs', 'Gross profit', 'Margin %', 'Payment account', 'Payment received'];
  const lines = [header.map(cell).join(',')];
  for (const r of rows) {
    lines.push([
      r.order_number ?? r.id,
      day(r.created_at),
      PAY_METHOD_LABELS[r.method] ?? r.method,
      Math.round(r.total),
      Math.round(r.cogs),
      Math.round(r.delivery),
      Math.round(r.fee),
      Math.round(r.costs),
      Math.round(r.gross),
      r.margin.toFixed(1),
      r.payment_account ?? '',
      day(r.payment_received_at),
    ].map(cell).join(','));
  }
  // Leading BOM so Excel reads UTF-8; CRLF line endings for the same reason.
  const csv = '﻿' + lines.join('\r\n');
  const fname = `finance-orders-${range.key}${methodFilter ? `-${methodFilter}` : ''}.csv`;
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fname}"`,
      'Cache-Control': 'no-store',
    },
  });
}
