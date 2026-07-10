export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DotChip } from '@/components/admin/OrderChips';
import { Pagination } from '@/components/admin/Pagination';
import { ViewTabs } from '@/components/admin/ViewTabs';
import { AuditFilters } from '@/components/admin/AuditFilters';
import { PK_TZ } from '@/lib/dates';

interface AuditRow {
  id: string;
  actor_kind: 'owner' | 'staff' | 'system' | 'customer';
  actor_email: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
}

const ROW_LIMIT = 50;

// Friendly labels for the events the activity triggers + audit helper emit.
const ACTION_LABELS: Record<string, string> = {
  'order.placed':          'Order placed',
  'order.status_changed':  'Order status changed',
  'customer.signup':       'New customer',
  'review.submitted':      'Review submitted',
  'subscription.created':  'Subscribed to product',
  'newsletter.signup':     'Newsletter signup',
};

function prettyAction(code: string): string {
  if (ACTION_LABELS[code]) return ACTION_LABELS[code];
  const spaced = code.replace(/[._]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// Where an entity row links to in the admin, when it has a detail page.
function entityHref(entity: string | null, entityId: string | null): string | null {
  if (!entity || !entityId) return null;
  if (entity === 'order')     return `/admin/orders/${entityId}`;
  if (entity === 'customer')  return `/admin/users/${entityId}`;
  if (entity === 'product')   return `/admin/products/${entityId}`;
  if (entity === 'blog_post') return `/admin/blog/${entityId}`;
  if (entity === 'coupons')   return '/admin/coupons';
  return null;
}

const ACTOR_COLORS: Record<string, string> = {
  owner: '#C5286A', staff: '#3b82f6', customer: '#16a34a', system: '#6b7280',
};

const ACTOR_TABS: { key: string; label: string }[] = [
  { key: 'all',      label: 'All activity' },
  { key: 'customer', label: 'Customers' },
  { key: 'staff',    label: 'Staff' },
  { key: 'owner',    label: 'Owner' },
  { key: 'system',   label: 'System' },
];

const RANGE_HOURS: Record<string, number> = { '24h': 24, '7d': 24 * 7, '30d': 24 * 30 };

// Render a jsonb diff as readable key/value rows instead of a raw JSON dump.
// Values are kept short; nested objects fall back to compact JSON.
function DiffView({ diff }: { diff: Record<string, unknown> }) {
  const entries = Object.entries(diff);
  if (entries.length === 0) return null;
  return (
    <dl style={{ margin: '6px 0 0', display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '2px 10px', maxWidth: 420 }}>
      {entries.slice(0, 12).map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt style={{ color: '#9ca3af', fontFamily: 'monospace' }}>{k}</dt>
          <dd style={{ margin: 0, color: '#374151', overflowWrap: 'anywhere' }}>
            {typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v)}
          </dd>
        </div>
      ))}
      {entries.length > 12 && <div style={{ gridColumn: '1 / -1', color: '#9ca3af' }}>… {entries.length - 12} more</div>}
    </dl>
  );
}

// Collapse consecutive runs of the same event by the same actor (bulk
// newsletter imports, signup bursts) into one expandable row. Only runs of
// 3+ collapse — pairs read fine as-is. Grouping is per page slice, which is
// exactly the span the reader is scanning.
type Grouped = { kind: 'single'; row: AuditRow } | { kind: 'run'; rows: AuditRow[] };

function groupRuns(rows: AuditRow[]): Grouped[] {
  const out: Grouped[] = [];
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    // actor_email is deliberately NOT in the key: a signup burst is one
    // event repeated by many different people, which is exactly the run
    // worth collapsing. The expanded list shows each actor.
    while (
      j < rows.length &&
      rows[j].action === rows[i].action &&
      rows[j].actor_kind === rows[i].actor_kind &&
      (rows[j].entity ?? '') === (rows[i].entity ?? '')
    ) j++;
    if (j - i >= 3) out.push({ kind: 'run', rows: rows.slice(i, j) });
    else for (let k = i; k < j; k++) out.push({ kind: 'single', row: rows[k] });
    i = j;
  }
  return out;
}

export default async function ActivityLogPage({
  searchParams,
}: {
  searchParams: Promise<{ actor?: string; q?: string; range?: string; page?: string }>;
}) {
  const session = await getStaffSession();
  if (!session?.isOwner) {
    return <NoAccess section="Activity log" />;
  }

  const { actor = 'all', q = '', range = '', page } = await searchParams;
  const search = q.trim();
  const currentPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const from = (currentPage - 1) * ROW_LIMIT;
  // The `react-hooks/purity` rule flags Date.now() as impure; a one-shot read
  // for a query window is fine here (same waiver as the email log page).
  // eslint-disable-next-line react-hooks/purity
  const nowMs = Date.now();
  const sinceIso = RANGE_HOURS[range]
    ? new Date(nowMs - RANGE_HOURS[range] * 3600_000).toISOString()
    : null;

  // audit_log RLS has no anon SELECT policy. Service role bypasses RLS
  // and is the correct credential for an owner-only internal view.
  const admin = supabaseAdmin();
  const applyFilters = <T,>(query: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qb = query as any;
    if (sinceIso) qb = qb.gte('created_at', sinceIso);
    if (search) {
      // entity_id is text (not uuid), so partial-id search works too.
      const term = search.replace(/[,()]/g, ' ').trim();
      qb = qb.or(`action.ilike.%${term}%,actor_email.ilike.%${term}%,entity_id.ilike.%${term}%,entity.ilike.%${term}%`);
    }
    return qb as T;
  };

  let listQuery = applyFilters(
    admin
      .from('audit_log')
      .select('id, actor_kind, actor_email, action, entity, entity_id, diff, ip, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + ROW_LIMIT - 1),
  );
  if (actor !== 'all') listQuery = listQuery.eq('actor_kind', actor);

  // Per-actor counts under the SAME q/range filters so the tab numbers always
  // reconcile with the list they switch to.
  const countFor = (kind: string) => {
    let cq = applyFilters(admin.from('audit_log').select('id', { count: 'exact', head: true }));
    if (kind !== 'all') cq = cq.eq('actor_kind', kind);
    return cq;
  };

  const [{ data, count: totalRows }, ...tabCounts] = await Promise.all([
    listQuery,
    ...ACTOR_TABS.map(t => countFor(t.key)),
  ]);
  const rows = (data ?? []) as AuditRow[];
  const grouped = groupRuns(rows);
  const countByTab = new Map(ACTOR_TABS.map((t, i) => [t.key, tabCounts[i].count ?? 0]));

  const tabHref = (kind: string) => {
    const p = new URLSearchParams();
    if (kind !== 'all') p.set('actor', kind);
    if (search) p.set('q', search);
    if (range) p.set('range', range);
    return p.toString() ? `/admin/audit?${p}` : '/admin/audit';
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Activity log</h1>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Everything happening across the store, orders, signups, reviews, subscriptions and staff actions.
        Newest first, {ROW_LIMIT} per page. Owner-only.
      </p>

      {/* Saved-view tabs — shared underline grammar with counts that respect
          the active search/time filters. */}
      <ViewTabs
        active={actor}
        tabs={ACTOR_TABS.map(t => ({
          value: t.key, label: t.label, count: countByTab.get(t.key) ?? 0, href: tabHref(t.key),
        }))}
      />

      <Suspense fallback={null}>
        <AuditFilters />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>
            {search || actor !== 'all' || range ? 'No activity matches this filter.' : 'No activity yet.'}
          </div>
        ) : (
          <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['When', 'Actor', 'Event', 'Entity', 'Details'].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grouped.map(g => {
                if (g.kind === 'run') {
                  const first = g.rows[0];
                  const last = g.rows[g.rows.length - 1];
                  const t = (iso: string) => new Date(iso).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });
                  return (
                    <tr key={first.id} style={{ borderTop: '1px solid #f3f4f6', background: '#fcfcfd' }}>
                      <td data-label="When" style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: '#6b7280', fontSize: '0.75rem' }}>
                        {t(last.created_at)} – {t(first.created_at)}
                      </td>
                      <td data-label="Actor" style={{ padding: '10px 16px', color: '#111827' }}>
                        <DotChip
                          label={first.actor_kind.charAt(0).toUpperCase() + first.actor_kind.slice(1)}
                          color={ACTOR_COLORS[first.actor_kind] ?? '#6b7280'}
                        />
                        {(() => {
                          const emails = new Set(g.rows.map(r => r.actor_email ?? ''));
                          if (emails.size === 1 && first.actor_email) {
                            return <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{first.actor_email}</div>;
                          }
                          return <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{emails.size} different accounts</div>;
                        })()}
                      </td>
                      <td data-label="Event" style={{ padding: '10px 16px', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                        {prettyAction(first.action)}
                        <span style={{ marginLeft: 6, padding: '1px 8px', borderRadius: 999, background: '#f3f4f6', color: '#6b7280', fontSize: '0.6875rem', fontWeight: 700 }}>
                          × {g.rows.length}
                        </span>
                      </td>
                      <td data-label="Entity" style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {first.entity ? `${g.rows.length} ${first.entity}${g.rows.length !== 1 ? 's' : ''}` : '—'}
                      </td>
                      <td data-label="Details" style={{ padding: '10px 16px', fontSize: '0.6875rem', color: '#374151' }}>
                        <details>
                          <summary style={{ cursor: 'pointer', color: '#6b7280' }}>show all {g.rows.length}</summary>
                          <ul style={{ margin: '6px 0 0', paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {g.rows.map(r => {
                              const href = entityHref(r.entity, r.entity_id);
                              const label = `${t(r.created_at)}${r.actor_email ? ` · ${r.actor_email}` : ''}${r.entity_id ? ` · ${r.entity_id.slice(0, 8)}…` : ''}`;
                              return (
                                <li key={r.id}>
                                  {href
                                    ? <Link href={href} style={{ color: '#C5286A', textDecoration: 'none' }}>{label}</Link>
                                    : <span>{label}</span>}
                                </li>
                              );
                            })}
                          </ul>
                        </details>
                      </td>
                    </tr>
                  );
                }
                const r = g.row;
                return (
                <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="When" style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: '#6b7280', fontSize: '0.75rem' }}>
                    {new Date(r.created_at).toLocaleString('en-PK', { day: '2-digit', month: 'short', year: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ })}
                  </td>
                  <td data-label="Actor" style={{ padding: '10px 16px', color: '#111827' }}>
                    <DotChip
                      label={r.actor_kind.charAt(0).toUpperCase() + r.actor_kind.slice(1)}
                      color={ACTOR_COLORS[r.actor_kind] ?? '#6b7280'}
                    />
                    {r.actor_email && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{r.actor_email}</div>}
                  </td>
                  <td data-label="Event" style={{ padding: '10px 16px', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', whiteSpace: 'nowrap' }}>
                    {prettyAction(r.action)}
                  </td>
                  <td data-label="Entity" style={{ padding: '10px 16px', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                    {(() => {
                      if (!r.entity) return <span style={{ color: '#6b7280' }}>—</span>;
                      const label = `${r.entity}${r.entity_id ? ` ${r.entity_id.slice(0, 8)}…` : ''}`;
                      const href = entityHref(r.entity, r.entity_id);
                      return href
                        ? <Link href={href} style={{ color: '#C5286A', textDecoration: 'none' }}>{label}</Link>
                        : <span style={{ color: '#6b7280' }}>{label}</span>;
                    })()}
                  </td>
                  <td data-label="Details" style={{ padding: '10px 16px', fontSize: '0.6875rem', color: '#374151' }}>
                    {r.diff && Object.keys(r.diff).length > 0
                      ? <details><summary style={{ cursor: 'pointer', color: '#6b7280' }}>{Object.keys(r.diff).slice(0, 3).join(', ')}{Object.keys(r.diff).length > 3 ? '…' : ''}</summary><DiffView diff={r.diff} /></details>
                      : '—'}
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {/* Pagination reappends the live query string itself, so basePath stays
          bare — actor/q/range survive page flips via useSearchParams. */}
      <Pagination total={totalRows ?? 0} pageSize={ROW_LIMIT} currentPage={currentPage} basePath="/admin/audit" />
    </div>
  );
}
