export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ViewTabs } from '@/components/admin/ViewTabs';
import { PK_TZ } from '@/lib/dates';

interface SegmentRow {
  cust_key: string;
  user_id: string | null;
  email: string | null;
  orders: number;
  revenue: number;
  last_order_at: string;
  segment: 'VIP' | 'Loyal' | 'Engaged' | 'New / Recent' | 'At risk' | 'Lapsed' | 'Casual';
}

const SEGMENT_ORDER: SegmentRow['segment'][] = ['VIP', 'Loyal', 'Engaged', 'New / Recent', 'At risk', 'Lapsed', 'Casual'];

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

export default async function SegmentsPage({ searchParams }: { searchParams: Promise<{ segment?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return <NoAccess section="Customer segments" />;
  }

  const { segment } = await searchParams;
  const focus = segment ?? null;

  // v_customer_segments is built over orders, whose RLS blocks the anon
  // client, read it through the service role (this page is staff-gated).
  const admin = supabaseAdmin();
  let query = admin.from('v_customer_segments').select('*').order('revenue', { ascending: false }).limit(500);
  if (focus) query = query.eq('segment', focus);

  const { data } = await query;
  const rows = (data ?? []) as SegmentRow[];

  // Build a summary regardless of filter (separate query when filtered).
  let summary: SegmentRow[];
  if (!focus) {
    summary = rows;
  } else {
    const { data: all } = await admin.from('v_customer_segments').select('segment, revenue').limit(50000);
    summary = (all ?? []) as SegmentRow[];
  }
  const byKey = new Map<string, { customers: number; revenue: number }>();
  for (const r of summary) {
    const cur = byKey.get(r.segment) ?? { customers: 0, revenue: 0 };
    cur.customers++;
    cur.revenue += Number(r.revenue);
    byKey.set(r.segment, cur);
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Customer segments</h1>
        <Link href="/admin/analytics" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>→ Analytics</Link>
      </div>

      {/* Saved-view tabs — the shared underline grammar (was a bespoke chip
          row, one of five divergent filter treatments the audit flagged). */}
      <ViewTabs
        active={focus ?? 'all'}
        tabs={[
          { value: 'all', label: 'All', count: summary.length, href: '/admin/segments' },
          ...SEGMENT_ORDER.map(s => ({
            value: s, label: s, count: byKey.get(s)?.customers ?? 0,
            href: `/admin/segments?segment=${encodeURIComponent(s)}`,
          })),
        ]}
      />

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>No customers in this segment yet.</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Customer', 'Segment', 'Orders', 'Revenue', 'Last order'].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.cust_key} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Customer" style={{ padding: '10px 16px', color: '#111827' }}>
                    {/* Guest ids mirror /admin/users: the identity key is
                        base64url-encoded behind a `guest-` prefix so it stays
                        path-safe; the detail page decodes it. */}
                    <Link
                      href={r.user_id
                        ? `/admin/users/${r.user_id}`
                        : `/admin/users/guest-${Buffer.from(r.cust_key, 'utf8').toString('base64url')}`}
                      style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}
                    >
                      {r.email ?? <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.cust_key.slice(0, 16)}…</span>}
                    </Link>
                    {r.user_id && <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>registered</div>}
                  </td>
                  <td data-label="Segment" style={{ padding: '10px 16px' }}>{r.segment}</td>
                  <td data-label="Orders" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums' }}>{r.orders}</td>
                  <td data-label="Revenue" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(Number(r.revenue))}</td>
                  <td data-label="Last order" style={{ padding: '10px 16px', color: '#6b7280', fontSize: '0.75rem' }}>
                    {new Date(r.last_order_at).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit', timeZone: PK_TZ })}
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

