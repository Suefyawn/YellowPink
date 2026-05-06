export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import type { AdminUser } from '@/types';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function UsersPage() {
  const { data: users } = await (supabase as any).rpc('get_admin_users');
  const list = (users ?? []) as AdminUser[];

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Customers</h1>
        <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>{list.length} registered account{list.length !== 1 ? 's' : ''}</p>
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {list.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No customers have signed up yet
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
              {list.map((u, i) => (
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
    </div>
  );
}
