export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { fmtPKR as fmt } from '@/lib/money';

// COD reconciliation — the cash side of the business that's hardest to track.
// "Payment received" lives per-order on the order page; this page rolls it up
// so the owner can see, at a glance:
//   • Outstanding — delivered COD orders not yet marked paid (cash to confirm)
//   • Collected   — delivered COD orders reconciled to an account
//   • In transit  — COD value still out for delivery (expected to collect)
// Gated on the same `analytics` permission as Finance.

interface CodOrder {
  id: string;
  order_number: string;
  first_name: string | null;
  last_name: string | null;
  total: number | null;
  status: string;
  payment_received_at: string | null;
  payment_account: string | null;
  created_at: string;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: '2-digit' });

export default async function CodReconciliationPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('analytics')) {
    return <NoAccess section="COD reconciliation" />;
  }

  const admin = supabaseAdmin();
  const { data } = await admin
    .from('orders')
    .select('id, order_number, first_name, last_name, total, status, payment_received_at, payment_account, created_at')
    .eq('pay_method', 'cod')
    .in('status', ['processing', 'shipped', 'delivered'])
    .order('created_at', { ascending: false });
  const rows = (data ?? []) as CodOrder[];

  const outstanding = rows.filter(r => r.status === 'delivered' && !r.payment_received_at);
  const collected   = rows.filter(r => r.status === 'delivered' && r.payment_received_at);
  const inTransit   = rows.filter(r => r.status === 'processing' || r.status === 'shipped');
  const sum = (list: CodOrder[]) => list.reduce((s, r) => s + Number(r.total ?? 0), 0);

  const card: React.CSSProperties = { background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px' };
  const kpiLabel: React.CSSProperties = { fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>COD reconciliation</h1>
        <Link href="/admin/finance" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← Finance</Link>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Cash-on-delivery money owed and collected. Mark a payment received on each order&apos;s page; it then moves from
        Outstanding to Collected here.
      </p>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
        <div style={{ ...card, padding: '16px 18px', borderColor: outstanding.length ? '#fde68a' : '#e5e7eb', background: outstanding.length ? '#fffbeb' : 'white' }}>
          <div style={kpiLabel}>Outstanding · to confirm</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: outstanding.length ? '#b45309' : '#111827', marginTop: 2 }}>{fmt(sum(outstanding))}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{outstanding.length} delivered order{outstanding.length === 1 ? '' : 's'}</div>
        </div>
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={kpiLabel}>Collected · reconciled</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#15803d', marginTop: 2 }}>{fmt(sum(collected))}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{collected.length} delivered order{collected.length === 1 ? '' : 's'}</div>
        </div>
        <div style={{ ...card, padding: '16px 18px' }}>
          <div style={kpiLabel}>In transit · expected</div>
          <div style={{ fontSize: '1.375rem', fontWeight: 700, color: '#111827', marginTop: 2 }}>{fmt(sum(inTransit))}</div>
          <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>{inTransit.length} order{inTransit.length === 1 ? '' : 's'} out for delivery</div>
        </div>
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Outstanding — delivered, not yet confirmed</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          These parcels were delivered but the cash hasn&apos;t been marked received. Open each to record payment.
        </p>
        {outstanding.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            All caught up — every delivered COD order is reconciled. 🎉
          </div>
        ) : (
          <div className="adm-table-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Order', 'Customer', 'Delivered', 'Amount', ''].map((h, i) => (
                    <th scope="col" key={h || i} style={{ padding: '8px 12px', textAlign: i === 3 ? 'right' : 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outstanding.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #f9fafb' }}>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{r.order_number}</td>
                    <td style={{ padding: '10px 12px', color: '#374151' }}>{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                    <td style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total ?? 0)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <Link href={`/admin/orders/${r.id}`} style={{ color: '#C5286A', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600 }}>Record →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
