export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';
import { Pagination } from '@/components/admin/Pagination';
import { UsersFilter } from '@/components/admin/UsersFilter';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { AdminUser } from '@/types';

const PAGE_SIZE = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('customers')) {
    return <NoAccess section="Customers" />;
  }
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));

  // get_admin_users RPC doesn't support filtering — fetch all and filter/slice in JS
  const { data: users } = await supabase.rpc('get_admin_users' as never);
  let list = (users ?? []) as AdminUser[];

  if (q) {
    const lower = q.toLowerCase();
    list = list.filter(u =>
      u.email?.toLowerCase().includes(lower) ||
      u.first_name?.toLowerCase().includes(lower) ||
      u.last_name?.toLowerCase().includes(lower)
    );
  }

  const total = list.length;
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Customers</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{total} registered account{total !== 1 ? 's' : ''}</p>
      </div>

      <Suspense fallback={null}>
        <UsersFilter total={total} />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {paginated.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            {q ? `No customers matching "${q}"` : 'No customers have signed up yet'}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Email', 'Name', 'Phone', 'Joined', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((u, i) => (
                <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                    {u.email}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {u.first_name || u.last_name
                      ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim()
                      : <span style={{ color: '#9ca3af' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {u.phone ?? <span style={{ color: '#d1d5db' }}>—</span>}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {fmtDate(u.created_at)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/admin/users/${u.id}`} style={{
                      padding: '5px 12px', background: '#f3f4f6', color: '#374151',
                      borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                    }}>
                      View →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/users" />
      </Suspense>
    </div>
  );
}
