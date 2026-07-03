export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';
import { PK_TZ } from '@/lib/dates';

const fmtDateTime = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });

interface EmailRow {
  id: string;
  recipient: string;
  subject: string;
  kind: string;
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
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    return <NoAccess section="Email log" />;
  }

  const { status } = await searchParams;
  const activeFilter = FILTERS.some(f => f.key === status) ? status! : 'all';

  const admin = supabaseAdmin();
  // The `react-hooks/purity` rule flags Date.now() as impure; a one-shot read
  // for a query window is fine here.
  // eslint-disable-next-line react-hooks/purity
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let listQuery = admin
    .from('email_log')
    .select('id, recipient, subject, kind, status, error, delivered_at, opened_at, clicked_at, bounced_at, complained_at, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (activeFilter !== 'all') listQuery = listQuery.eq('status', activeFilter);

  const [{ data: rows }, sent30, failed30, opened30] = await Promise.all([
    listQuery,
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('status', 'sent').gte('created_at', thirtyDaysAgo),
    admin.from('email_log').select('id', { count: 'exact', head: true }).eq('status', 'failed').gte('created_at', thirtyDaysAgo),
    admin.from('email_log').select('id', { count: 'exact', head: true }).not('opened_at', 'is', null).gte('created_at', thirtyDaysAgo),
  ]);

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
        <KpiCard label="Opened · 30 days" value={openedCount} accent="#2563eb" />
        <KpiCard label="Open rate · 30 days" value={openRate} accent="#C5286A"
          hint={sentCount === 0 ? 'Shows once emails have been sent' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTERS.map(f => {
          const on = f.key === activeFilter;
          return (
            <Link
              key={f.key}
              href={f.key === 'all' ? '/admin/emails' : `/admin/emails?status=${f.key}`}
              style={{
                padding: '6px 13px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600,
                textDecoration: 'none', border: 'none',
                background: on ? '#111827' : '#f3f4f6',
                color: on ? '#fff' : '#6b7280',
              }}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      <div style={{ background: 'white', borderRadius: 12, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)', overflow: 'hidden' }}>
        {emails.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No emails logged yet.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                    <td data-label="Type" style={{ padding: '12px 20px', fontSize: '0.8125rem', color: '#6b7280', textTransform: 'capitalize' }}>
                      {r.kind}
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
      {emails.length === 200 && (
        <p style={{ margin: '12px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Showing the 200 most recent emails.</p>
      )}
    </div>
  );
}
