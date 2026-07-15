export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { OrdersFilter } from '@/components/admin/OrdersFilter';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { Pagination } from '@/components/admin/Pagination';
import { ExportCSVButton } from '@/components/admin/ExportCSVButton';
import { AdminFlash } from '@/components/admin/AdminFlash';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { orderRangeSinceIso } from '@/lib/order-range';
import type { Order, OrderStatus } from '@/types';

const PAGE_SIZE = 25;

export default async function OrdersPage({
  // permission check happens before searchParams destructure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rawProps}: any) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.view'))) {
    return <NoAccess section="Orders" />;
  }
  const { searchParams } = rawProps;
  return <OrdersPageInner searchParams={searchParams} />;
}

// Whitelisted sortable columns for the ?sort= param — anything else falls
// back to newest-first. Keys are what the column headers put in the URL.
const SORT_COLUMNS: Record<string, string> = {
  number: 'order_number',
  date: 'created_at',
  customer: 'first_name',
  total: 'total',
};

async function OrdersPageInner({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; range?: string; deleted?: string; sort?: string; dir?: string }>;
}) {
  const { status, q, page: pageParam, range, deleted, sort, dir } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;
  const sortColumn = SORT_COLUMNS[sort ?? ''] ?? 'created_at';
  const ascending = dir === 'asc';

  // Map the friendly `range` chip into a created_at lower bound. "Today" is the
  // current PKT calendar day; 7d/30d/90d are rolling windows. Shared with the
  // CSV export button via orderRangeSinceIso so the query and the export agree.
  const rangeSinceIso = orderRangeSinceIso(range);

  // orders RLS (migration 070) removed the anon SELECT path, the table
  // is now service-role / authenticated-self-only. Staff-cookie auth
  // doesn't go through Supabase Auth, so admin reads MUST use the
  // service-role client. The anon path returned 0 rows silently.
  const admin = supabaseAdmin();
  let countQuery = admin.from('orders').select('*', { count: 'exact', head: true });
  // Header-driven sort; created_at desc as tie-breaker so equal values keep
  // a stable, recency-first order.
  let dataQuery = admin.from('orders').select('*').order(sortColumn, { ascending });
  if (sortColumn !== 'created_at') dataQuery = dataQuery.order('created_at', { ascending: false });
  dataQuery = dataQuery.range(from, to);

  // Composite saved views (Shopify-style tabs) on top of the single-status
  // filter: 'tofulfil' = still ours to action; 'unpaid' = live orders whose
  // payment hasn't been reconciled (payment_received_at). Keep the export
  // (exportOrdersCsv in admin/actions.ts) in lock-step with these branches.
  if (status === 'tofulfil') {
    countQuery = countQuery.in('status', ['pending', 'processing']);
    dataQuery = dataQuery.in('status', ['pending', 'processing']);
  } else if (status === 'unpaid') {
    countQuery = countQuery.is('payment_received_at', null).in('status', ['pending', 'processing', 'shipped', 'delivered']);
    dataQuery = dataQuery.is('payment_received_at', null).in('status', ['pending', 'processing', 'shipped', 'delivered']);
  } else if (status && status !== 'all') {
    countQuery = countQuery.eq('status', status as OrderStatus);
    dataQuery = dataQuery.eq('status', status as OrderStatus);
  }
  if (rangeSinceIso) {
    countQuery = countQuery.gte('created_at', rangeSinceIso);
    dataQuery = dataQuery.gte('created_at', rangeSinceIso);
  }
  if (q) {
    // Strip characters that would break the PostgREST `.or()` grammar (commas
    // separate conditions; parens group them). Customers are searched by
    // order number, name, email and phone, support in this market is
    // phone-first, so matching the contact fields is essential.
    const term = q.replace(/[(),*]/g, ' ').trim();
    const filter = `order_number.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count: totalCount }, { data: orders }] = await Promise.all([countQuery, dataQuery]);
  const total = totalCount ?? 0;
  const list = (orders ?? []) as Order[];

  // Latest courier status per listed order (from shipments), so the list mirrors
  // the courier's own dashboard at a glance — in transit / out for delivery /
  // delivery attempted / delivered — populated once the courier sync runs.
  const courierStatus: Record<string, string> = {};
  const orderIds = list.map(o => o.id).filter(Boolean) as string[];
  if (orderIds.length) {
    const { data: ships } = await admin
      .from('shipments')
      .select('order_id, status, updated_at')
      .in('order_id', orderIds)
      .neq('status', 'cancelled')
      .order('updated_at', { ascending: false });
    for (const s of (ships ?? []) as Array<{ order_id: string; status: string }>) {
      // First row per order wins (query is newest-first).
      if (!courierStatus[s.order_id]) courierStatus[s.order_id] = s.status;
    }
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      {/* deleteOrder redirects here with ?deleted=1, surface it as a toast. */}
      <AdminFlash message={deleted ? 'Order deleted.' : null} clearPath="/admin/orders" />
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Orders</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <Link
            href="/admin/orders/new"
            style={{
              padding: '8px 14px', borderRadius: 8, background: '#111827', color: 'white',
              fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
            }}
          >
            + New order
          </Link>
          <ExportCSVButton status={status} q={q} range={range} />
        </div>
      </div>

      <Suspense fallback={null}>
        <OrdersFilter total={total} />
      </Suspense>

      {/* overflowX auto (not hidden): on narrow screens the table is wider than
          the card, and hidden would clip columns with no way to reach them. */}
      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        {/* Suspense: OrdersTable reads useSearchParams for the sort headers. */}
        <Suspense fallback={null}>
          <OrdersTable orders={list} courierStatus={courierStatus} />
        </Suspense>
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/orders" />
      </Suspense>
    </div>
  );
}
