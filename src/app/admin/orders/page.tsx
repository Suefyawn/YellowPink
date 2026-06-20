export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { OrdersFilter } from '@/components/admin/OrdersFilter';
import { OrdersTable } from '@/components/admin/OrdersTable';
import { Pagination } from '@/components/admin/Pagination';
import { ExportCSVButton } from '@/components/admin/ExportCSVButton';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Order, OrderStatus } from '@/types';

const PAGE_SIZE = 25;

export default async function OrdersPage({
  // permission check happens before searchParams destructure
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...rawProps}: any) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders.view')) {
    return <NoAccess section="Orders" />;
  }
  const { searchParams } = rawProps;
  return <OrdersPageInner searchParams={searchParams} />;
}

async function OrdersPageInner({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string; range?: string }>;
}) {
  const { status, q, page: pageParam, range } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  // Map the friendly `range` chip into a created_at lower bound. Empty / unset
  // / 'all' = no time filter; everything else is "the last N days from now".
  const rangeDays: Record<string, number> = { '1d': 1, '7d': 7, '30d': 30, '90d': 90 };
  // Server component on every request — Date.now() is fine here, the
  // purity rule targets render of client components.
  const rangeSinceIso = range && rangeDays[range]
    // eslint-disable-next-line react-hooks/purity
    ? new Date(Date.now() - rangeDays[range] * 86_400_000).toISOString()
    : null;

  // orders RLS (migration 070) removed the anon SELECT path — the table
  // is now service-role / authenticated-self-only. Staff-cookie auth
  // doesn't go through Supabase Auth, so admin reads MUST use the
  // service-role client. The anon path returned 0 rows silently.
  const admin = supabaseAdmin();
  let countQuery = admin.from('orders').select('*', { count: 'exact', head: true });
  let dataQuery = admin.from('orders').select('*').order('created_at', { ascending: false }).range(from, to);

  if (status && status !== 'all') {
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
    // order number, name, email and phone — support in this market is
    // phone-first, so matching the contact fields is essential.
    const term = q.replace(/[(),*]/g, ' ').trim();
    const filter = `order_number.ilike.%${term}%,first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%`;
    countQuery = countQuery.or(filter);
    dataQuery = dataQuery.or(filter);
  }

  const [{ count: totalCount }, { data: orders }] = await Promise.all([countQuery, dataQuery]);
  const total = totalCount ?? 0;
  const list = (orders ?? []) as Order[];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Orders</h1>
        <ExportCSVButton status={status} q={q} range={range} />
      </div>

      <Suspense fallback={null}>
        <OrdersFilter total={total} />
      </Suspense>

      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        <OrdersTable orders={list} />
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/orders" />
      </Suspense>
    </div>
  );
}
