export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ReturnsQueue } from '@/components/admin/ReturnsQueue';
import { KpiCard } from '@/components/admin/insights/KpiCard';

interface ReturnRow {
  id: string;
  order_id: string;
  user_id: string | null;
  email: string | null;
  reason: string;
  items: { product_id: string; qty: number; name: string; price: number }[];
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded' | 'cancelled';
  refund_amount: number | null;
  refund_method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct' | null;
  admin_note: string | null;
  created_at: string;
}

const QUEUE_STATUSES = ['all', 'pending', 'approved', 'received', 'refunded', 'rejected'] as const;
type QueueStatus = (typeof QUEUE_STATUSES)[number];

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getStaffSession();
  // Returns gated on its own permission; orders perm also satisfies it for
  // backward-compat with existing staff who only have `orders`. The
  // !session leg is critical: with no middleware, an unauthenticated GET
  // would otherwise fall through this gate and render the returns queue.
  if (!session
      || (!session.isOwner
          && !session.permissions.includes('returns')
          && !session.permissions.includes('orders.view'))) {
    return <NoAccess section="Returns" />;
  }

  // return_requests anon-SELECT is scoped to user_id = auth.uid(); admin
  // moderation needs to see all. orders is fully RLS-locked. Both reads
  // need the service role.
  const { status: statusParam } = await searchParams;
  const status: QueueStatus = QUEUE_STATUSES.includes(statusParam as QueueStatus)
    ? (statusParam as QueueStatus) : 'all';

  const admin = supabaseAdmin();
  let queueQuery = admin
    .from('return_requests')
    .select('id, order_id, user_id, email, reason, items, status, refund_amount, refund_method, admin_note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (status !== 'all') queueQuery = queueQuery.eq('status', status);
  const { data } = await queueQuery;

  const rows = (data ?? []) as ReturnRow[];

  // Pull order numbers for display.
  const orderIds = Array.from(new Set(rows.map(r => r.order_id)));
  const { data: orderRows } = await admin
    .from('orders').select('id, order_number, first_name, last_name, total').in('id', orderIds.length ? orderIds : ['00000000-0000-0000-0000-000000000000']);
  const orderMap = new Map<string, { order_number: string; first_name: string; last_name: string; total: number }>();
  for (const o of (orderRows ?? []) as Array<{ id: string; order_number: string; first_name: string; last_name: string; total: number }>) {
    orderMap.set(o.id, o);
  }

  // ─── Returns insights ───────────────────────────────────────────────────
  // Aggregate over ALL returns (a small table) for accurate KPIs, the queue
  // above is capped at 200 for display. Surfaces which products come back most
  // and why, so the owner can act on a QA / expectations-mismatch problem.
  const { data: allReturns } = await admin
    .from('return_requests')
    .select('status, reason, refund_amount, items, created_at');
  type AggRow = { status: string; reason: string | null; refund_amount: number | null; items: { name?: string; qty?: number }[] | null; created_at: string };
  const ar = (allReturns ?? []) as AggRow[];
  // One-shot clock read for a 90-day window on a dynamic (uncached) admin
  // page. The react-hooks/purity rule flags Date.now() as impure; safe here.
  // eslint-disable-next-line react-hooks/purity
  const since90 = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const last90 = ar.filter(r => Date.parse(r.created_at) >= since90).length;
  const totalRefunded = ar.filter(r => r.status === 'refunded').reduce((s, r) => s + Number(r.refund_amount ?? 0), 0);
  const productCounts = new Map<string, number>();
  const reasonCounts = new Map<string, number>();
  for (const r of ar) {
    for (const it of (r.items ?? [])) {
      if (it?.name) productCounts.set(it.name, (productCounts.get(it.name) ?? 0) + (Number(it.qty) || 1));
    }
    const reason = (r.reason ?? '').trim() || 'Not specified';
    reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
  }
  const topProducts = [...productCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topReasons = [...reasonCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  // Return rate proxy: returns raised in the last 90d ÷ orders that reached
  // the customer in the same window. The denominator must include orders that
  // were delivered and THEN returned/refunded (their status is no longer
  // `delivered`), otherwise every completed return shrinks the denominator
  // while still counting in the numerator and the rate can exceed 100%.
  const { count: deliveredCount } = await admin
    .from('orders').select('*', { count: 'exact', head: true })
    .in('status', ['delivered', 'returned', 'refunded'])
    .gte('created_at', new Date(since90).toISOString());
  // Capped at 100%: returns raised in the window can reference orders PLACED
  // before it (numerator and denominator use different date fields), so the
  // raw ratio can still exceed 1 in edge cases; a ">100% return rate" is
  // never a meaningful thing to show.
  const returnRate = deliveredCount && deliveredCount > 0
    ? Math.min(100, (last90 / deliveredCount) * 100)
    : null;
  const returnRateFormula =
    `Returns raised in the last 90 days (${last90.toLocaleString()}) ÷ orders placed in the last 90 days that reached the customer, i.e. delivered / returned / refunded (${(deliveredCount ?? 0).toLocaleString()}), capped at 100%`;

  // minWidth: 0 lets the KPI cards (grid items) shrink below their content's
  // intrinsic width on phones, the long product/reason labels then truncate
  // with their ellipsis instead of widening the page.
  const kpi: React.CSSProperties = { background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px', minWidth: 0 };
  const kpiLabel: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Returns</h1>
        <Link href="/admin/orders" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← All orders</Link>
      </div>

      {ar.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
            <KpiCard label="Total returns" value={ar.length.toLocaleString()} accent="#C5286A" />
            <KpiCard label="Last 90 days" value={last90.toLocaleString()} accent="#0369a1" />
            <KpiCard label="Refunded (total)" value={`PKR ${Math.round(totalRefunded).toLocaleString()}`} accent="#b45309" />
            <KpiCard
              label="Return rate (90d)"
              value={returnRate == null ? '—' : `${returnRate.toFixed(1)}%`}
              accent="#dc2626"
              hint={returnRateFormula}
            />
          </div>
          <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ ...kpi, padding: '16px' }}>
              <div style={{ ...kpiLabel, marginBottom: 10 }}>Most-returned products</div>
              {topProducts.length === 0 ? <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: 0 }}>No data yet.</p> : topProducts.map(([name, n]) => (
                <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{name}</span>
                  <span style={{ fontWeight: 700, color: '#111827', flexShrink: 0 }}>{n}</span>
                </div>
              ))}
            </div>
            <div style={{ ...kpi, padding: '16px' }}>
              <div style={{ ...kpiLabel, marginBottom: 10 }}>Top reasons</div>
              {topReasons.map(([reason, n]) => (
                <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '5px 0', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{reason}</span>
                  <span style={{ fontWeight: 700, color: '#111827', flexShrink: 0 }}>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Saved-view tabs (orders-style) driven by ?status=. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
        {QUEUE_STATUSES.map(s => {
          const isActive = status === s;
          return (
            <Link
              key={s}
              href={s === 'all' ? '/admin/returns' : `/admin/returns?status=${s}`}
              style={{
                padding: '9px 14px', fontSize: '0.8125rem', textDecoration: 'none',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? '#111827' : '#6b7280',
                borderBottom: `2px solid ${isActive ? '#C5286A' : 'transparent'}`,
                marginBottom: -1,
              }}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Link>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: '#9ca3af', padding: '9px 0' }}>
          {rows.length} return{rows.length === 1 ? '' : 's'}
        </span>
      </div>

      <ReturnsQueue
        rows={rows}
        orderMap={Object.fromEntries(orderMap)}
        canManage={session.isOwner || session.permissions.includes('returns') || session.permissions.includes('orders.edit')}
      />
    </div>
  );
}
