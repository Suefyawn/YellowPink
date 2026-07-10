export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { EmptyState } from '@/components/admin/EmptyState';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';
import { Pagination } from '@/components/admin/Pagination';
import { ViewTabs } from '@/components/admin/ViewTabs';
import { EmailFilters } from '@/components/admin/EmailFilters';
import { PK_TZ } from '@/lib/dates';

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });

interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  kind: string;
  category: string | null;
  status: string;
  error: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  bounced_at: string | null;
  complained_at: string | null;
  created_at: string;
}

// The DB `status` records the send attempt; the webhook timestamps record the
// delivery lifecycle. This collapses both into the single label the admin sees.
function displayStatus(r: EmailRow): { label: string; color: string } {
  if (r.status === 'failed')      return { label: 'Failed',         color: '#b91c1c' };
  if (r.status === 'skipped')     return { label: 'Skipped',        color: '#6b7280' };
  if (r.bounced_at)               return { label: 'Bounced',        color: '#b91c1c' };
  if (r.complained_at)            return { label: 'Spam complaint', color: '#b91c1c' };
  if (r.clicked_at)               return { label: 'Clicked',        color: '#059669' };
  if (r.opened_at)                return { label: 'Opened',         color: '#2563eb' };
  if (r.delivered_at)             return { label: 'Delivered',      color: '#16a34a' };
  return { label: 'Sent', color: '#ca8a04' };
}

const FILTERS = [
  { key: 'all',    label: 'All' },
  { key: 'sent',   label: 'Sent' },
  { key: 'failed', label: 'Failed' },
  { key: 'skipped', label: 'Skipped' },
];

export default async function EmailLogPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; kind?: string; page?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('system_tools'))) {
    return <NoAccess section="Email log" />;
  }

  const { status, q = '', kind = '', page } = await searchParams;
  const activeFilter = FILTERS.some(f => f.key === status) ? status! : 'all';
  const search = q.trim();
  const PAGE_SIZE = 50;
  const currentPage = Math.max(1, parseInt(page ?? '1', 10) || 1);
  const from = (currentPage - 1) * PAGE_SIZE;

  const admin = supabaseAdmin();
  // The `react-hooks/purity` rule flags Date.now() as impure; a one-shot read
  // for a query window is fine here.
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Shared q/kind filters, applied to the list AND the status-tab counts so
  // the tab numbers always reconcile with the list they switch to.
  const applyFilters = <T,>(query: T): T => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let qb = query as any;
    if (kind) qb = qb.eq('kind', kind);
    if (search) {
      const term = search.replace(/[,()]/g, ' ').trim();
      qb = qb.or(`recipient.ilike.%${term}%,subject.ilike.%${term}%`);
    }
    return qb as T;
  };

  // Paginated so one newsletter-import burst can't push older log rows past a
  // hard cap and off the UI entirely (the whole page also stopped scrolling
  // sanely at ~72,000px tall on mobile).
  let listQuery = applyFilters(
    admin
      .from('email_log')
      .select('id, recipient, subject, kind, category, status, error, delivered_at, opened_at, clicked_at, bounced_at, complained_at, created_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1),
  );
  if (activeFilter !== 'all') listQuery = listQuery.eq('status', activeFilter);

  const countFor = (key: string) => {
    let cq = applyFilters(admin.from('email_log').select('id', { count: 'exact', head: true }));
    if (key !== 'all') cq = cq.eq('status', key);
    return cq;
  };

  const [{ data: rows, count: totalRows }, sent30, failed30, opened30, ...tabCounts] = await Promise.all([
    listQuery,
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', thirtyDaysAgo),
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', thirtyDaysAgo),
    admin.from('email_log').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null).gte('created_at', thirtyDaysAgo),
    ...FILTERS.map(f => countFor(f.key)),
  ]);
  const countByTab = new Map(FILTERS.map((f, i) => [f.key, tabCounts[i].count ?? 0]));

  const tabHref = (key: string) => {
    const p = new URLSearchParams();
    if (key !== 'all') p.set('status', key);
    if (search) p.set('q', search);
    if (kind) p.set('kind', kind);
    return p.toString() ? `/admin/emails?${p}` : '/admin/emails';
  };

  const emails = (rows ?? []) as EmailRow[];
  const sentCount = sent30.count ?? 0;
  const openedCount = opened30.count ?? 0;
  // Open rate over the same window, '—' when the denominator is zero so the
  // card doesn't display 0% / NaN% before any mail has gone out. Stays '—'
  // (with the explainer below) until the Resend webhook is delivering events;
  // sentCount > 0 with openedCount = 0 most often means the webhook isn't wired.
  const openRate = sentCount === 0 ? '—' : `${Math.round((openedCount / sentCount) * 1000) / 10}%`;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Email log</h1>
      <p style={{ margin: '0 0 24px', color: '#6b7280', fontSize: '0.875rem' }}>
        Every email the store sends, order updates, newsletters, alerts. Delivered / Opened / Clicked
        fill in automatically once the Resend webhook is connected.
      </p>

      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Sent · 30 days" value={sentCount} accent="#15803d" />
        <KpiCard label="Failed · 30 days" value={failed30.count ?? 0} accent="#dc2626" href="/admin/emails?status=failed" />
        <KpiCard label="Opened · 30 days" value={openedCount} accent="#2563eb"
          hint="Approximate, see note below" />
        <KpiCard label="Open rate · 30 days" value={openRate} accent="#C5286A"
          hint={sentCount === 0 ? 'Shows once emails have been sent' : 'Approximate, see note below'} />
      </div>

      {/* Open-tracking is inherently under-counted: it relies on a 1×1 pixel
          the mail client must load. Apple Mail Privacy Protection, Gmail's
          image proxy and "block remote images" all defeat or distort it, so
          treat opens as a floor, not a precise figure. Delivered and Clicked
          are reliable; opens are the soft number. */}
      <p style={{ margin: '-6px 0 20px', color: '#9ca3af', fontSize: '0.75rem', lineHeight: 1.5, maxWidth: 760 }}>
        <strong style={{ color: '#6b7280' }}>About open rates:</strong> opens are tracked by a tiny
        invisible image, which many mail apps block or pre-load (Apple Mail Privacy Protection, Gmail
        image proxy, image-blocking). Real opens are almost always higher than shown, and some are
        counted automatically. Read <strong>Delivered</strong> and <strong>Clicked</strong> as the
        dependable signals; treat opens as a rough floor.
      </p>

      {/* Saved-view tabs — shared underline grammar with counts that respect
          the active search/type filters. */}
      <ViewTabs
        active={activeFilter}
        tabs={FILTERS.map(f => ({
          value: f.key, label: f.label, count: countByTab.get(f.key) ?? 0, href: tabHref(f.key),
        }))}
      />

      <Suspense fallback={null}>
        <EmailFilters />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)', overflow: 'hidden' }}>
        {emails.length === 0 ? (
          search || kind || activeFilter !== 'all' ? (
            <EmptyState compact icon="search" title="No emails match this filter">
              Try clearing the search or switching back to the All tab.
            </EmptyState>
          ) : (
            <EmptyState icon="inbox" title="No emails logged yet">
              Every order confirmation, shipping update and review request the system sends will appear here with its delivery status.
            </EmptyState>
          )
        ) : (
          <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Recipient', 'Subject', 'Type', 'Status', 'Sent'].map(h => (
                  <th key={h} scope="col" style={{ padding: '11px 20px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {emails.map((r, i) => {
                const st = displayStatus(r);
                return (
                  <tr key={r.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Recipient" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#374151', whiteSpace: 'nowrap' }}>
                      {r.recipient}
                    </td>
                    <td data-label="Subject" style={{ padding: '12px 20px', fontSize: '0.875rem', color: '#111827' }}>
                      {r.subject}
                      {r.error && (
                        <div style={{ fontSize: '0.75rem', color: '#dc2626', marginTop: 2 }}>{r.error}</div>
                      )}
                    </td>
                    <td data-label="Type" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#374151' }}>
                      {r.category ?? (r.kind === 'batch' ? 'Batch' : 'Transactional')}
                    </td>
                    <td data-label="Status" style={{ padding: '12px 20px' }}>
                      <DotChip label={st.label} color={st.color} />
                    </td>
                    <td data-label="Sent" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {fmtDateTime(r.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <Pagination total={totalRows ?? 0} pageSize={PAGE_SIZE} currentPage={currentPage} basePath="/admin/emails" />
    </div>
  );
}
