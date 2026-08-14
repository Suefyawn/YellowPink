export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { ViewTabs } from '@/components/admin/ViewTabs';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { SegmentForm } from '@/components/admin/SegmentForm';
import { PK_TZ } from '@/lib/dates';
import { parseCriteria, summarizeCriteria, type SegmentMember } from '@/lib/segments';
import { deleteSegment } from './actions';

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
const fmtDay = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit', timeZone: PK_TZ }) : '—';

/** /admin/users profile link for a member row (guest keys are base64url-
 *  encoded behind a `guest-` prefix, same as the fixed-bucket table). */
const customerHref = (userId: string | null, custKey: string) =>
  userId ? `/admin/users/${userId}` : `/admin/users/guest-${Buffer.from(custKey, 'utf8').toString('base64url')}`;

const thStyle: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
};

const PlusIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
);

export default async function SegmentsPage({ searchParams }: {
  searchParams: Promise<{ segment?: string; view?: string; create?: string; edit?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return <NoAccess section="Customer segments" />;
  }
  const canEdit = can(session, 'customers.edit');

  const { segment, view, create, edit } = await searchParams;
  const focus = segment ?? null;

  // v_customer_segments is built over orders, whose RLS blocks the anon
  // client, read it through the service role (this page is staff-gated).
  // customer_segments / segment_customers are service-role only too.
  const admin = supabaseAdmin();

  // ─── Custom segments (owner-defined criteria over segment_customers) ──────
  const [{ data: segRows }, { data: tagRows }] = await Promise.all([
    admin.from('customer_segments').select('id, name, criteria, created_at, updated_at').order('created_at', { ascending: true }),
    admin.from('customer_tags').select('id, name').order('name'),
  ]);
  const customSegments = ((segRows ?? []) as Array<{ id: string; name: string; criteria: unknown }>).map(s => ({
    id: s.id, name: s.name, criteria: parseCriteria(s.criteria),
  }));
  const tags = (tagRows ?? []) as Array<{ id: string; name: string }>;
  const tagNamesById = new Map(tags.map(t => [t.id, t.name]));

  // Live member count per segment (one RPC each — fine at this scale), and
  // the full member list for the segment being viewed.
  const memberships = await Promise.all(customSegments.map(async s => {
    const { data } = await admin.rpc('segment_customers' as never, { p_criteria: s.criteria } as never);
    return (data ?? []) as unknown as SegmentMember[];
  }));
  const countById = new Map(customSegments.map((s, i) => [s.id, memberships[i].length]));
  const viewed = view ? customSegments.find(s => s.id === view) ?? null : null;
  const viewedMembers = viewed
    ? [...memberships[customSegments.indexOf(viewed)]].sort((a, b) => Number(b.revenue) - Number(a.revenue))
    : [];
  const editing = edit ? customSegments.find(s => s.id === edit) ?? null : null;
  const showForm = canEdit && (create === '1' || !!editing);

  // ─── Fixed buckets (v_customer_segments) ──────────────────────────────────
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

      {/* ── Custom segments — owner-defined criteria, Shopify's segment editor
             simplified to pickers. Counts are resolved live per render. ── */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '18px 20px', marginBottom: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Custom segments</h2>
          {canEdit && !showForm && (
            <Link href="/admin/segments?create=1" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 8, background: '#C5286A', color: 'white', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none' }}>
              {PlusIcon} Create segment
            </Link>
          )}
        </div>
        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Groups of customers defined by your own criteria. Membership updates itself as customers order, and each segment can be picked as a Newsletter audience.
        </p>

        {showForm && (
          <SegmentForm
            initial={editing ? { id: editing.id, name: editing.name, criteria: editing.criteria } : undefined}
            tags={tags}
          />
        )}

        {customSegments.length === 0 ? (
          !showForm && (
            <div style={{ padding: '20px 0 6px', color: '#9ca3af', fontSize: '0.8125rem' }}>
              No custom segments yet.{canEdit ? ' Create one to group customers by orders, spend, recency, city, account status or tags.' : ''}
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto', border: '1px solid #f3f4f6', borderRadius: 8 }}>
            <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <th scope="col" style={thStyle}>Segment</th>
                  <th scope="col" style={thStyle}>Members</th>
                  <th scope="col" style={thStyle}>Criteria</th>
                  <th scope="col" style={{ ...thStyle, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customSegments.map(s => (
                  <tr key={s.id} style={{ borderTop: '1px solid #f3f4f6', background: viewed?.id === s.id ? '#fdf2f8' : undefined }}>
                    <td data-label="Segment" style={{ padding: '10px 16px', fontWeight: 600, color: '#111827' }}>
                      <Link href={`/admin/segments?view=${s.id}`} style={{ color: '#111827', textDecoration: 'none' }}>{s.name}</Link>
                    </td>
                    <td data-label="Members" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums' }}>
                      {(countById.get(s.id) ?? 0).toLocaleString()}
                    </td>
                    <td data-label="Criteria" style={{ padding: '10px 16px', color: '#6b7280' }}>
                      {summarizeCriteria(s.criteria, tagNamesById)}
                    </td>
                    <td data-label="Actions" style={{ padding: '10px 16px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <Link href={`/admin/segments?view=${s.id}`} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none', marginRight: 12 }}>
                        View members
                      </Link>
                      {canEdit && (
                        <>
                          <Link href={`/admin/segments?edit=${s.id}`} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#374151', textDecoration: 'none', marginRight: 12 }}>
                            Edit
                          </Link>
                          <DeleteButton id={s.id} action={deleteSegment} confirmMsg={`Delete the segment "${s.name}"? Customers themselves are not affected.`} />
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {viewed && (
          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}>
                {viewed.name} · {viewedMembers.length.toLocaleString()} member{viewedMembers.length === 1 ? '' : 's'}
              </div>
              <div style={{ display: 'flex', gap: 14 }}>
                <a href={`/admin/segments/export?id=${viewed.id}`} style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}>
                  Export CSV
                </a>
                <Link href="/admin/segments" style={{ fontSize: '0.75rem', color: '#6b7280', textDecoration: 'none' }}>
                  Close
                </Link>
              </div>
            </div>
            {viewedMembers.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
                No customers match these criteria yet.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', border: '1px solid #f3f4f6', borderRadius: 8 }}>
                <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                      {['Customer', 'City', 'Orders', 'Revenue', 'Last order'].map(h => (
                        <th scope="col" key={h} style={thStyle}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewedMembers.map(m => (
                      <tr key={m.cust_key} style={{ borderTop: '1px solid #f3f4f6' }}>
                        <td data-label="Customer" style={{ padding: '10px 16px', color: '#111827' }}>
                          <Link href={customerHref(m.user_id, m.cust_key)} style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}>
                            {m.email ?? m.phone ?? <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{m.cust_key.slice(0, 16)}…</span>}
                          </Link>
                          {m.email && m.phone && <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{m.phone}</div>}
                        </td>
                        <td data-label="City" style={{ padding: '10px 16px', color: '#374151' }}>{m.city ?? '—'}</td>
                        <td data-label="Orders" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums' }}>{m.orders}</td>
                        <td data-label="Revenue" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(Number(m.revenue))}</td>
                        <td data-label="Last order" style={{ padding: '10px 16px', color: '#6b7280', fontSize: '0.75rem' }}>{fmtDay(m.last_order_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Fixed buckets over v_customer_segments (VIP / Loyal / …) ── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Fixed buckets</h2>

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
                  <th scope="col" key={h} style={thStyle}>{h}</th>
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
                      href={customerHref(r.user_id, r.cust_key)}
                      style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}
                    >
                      {r.email ?? <span style={{ color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.75rem' }}>{r.cust_key.slice(0, 16)}…</span>}
                    </Link>
                    {r.user_id && <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>registered</div>}
                  </td>
                  <td data-label="Segment" style={{ padding: '10px 16px' }}>{r.segment}</td>
                  <td data-label="Orders" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums' }}>{r.orders}</td>
                  <td data-label="Revenue" style={{ padding: '10px 16px', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{fmt(Number(r.revenue))}</td>
                  <td data-label="Last order" style={{ padding: '10px 16px', color: '#6b7280', fontSize: '0.75rem' }}>{fmtDay(r.last_order_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
