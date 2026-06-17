export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { addExpense, deleteExpense } from './actions';

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const RANGES: { key: string; label: string; days: number | null }[] = [
  { key: '7d', label: '7 days', days: 7 },
  { key: '30d', label: '30 days', days: 30 },
  { key: '90d', label: '90 days', days: 90 },
  { key: 'all', label: 'All time', days: null },
];

const EXPENSE_CATEGORIES = ['Ads', 'Salaries', 'Packaging', 'Marketing', 'Rent & Utilities', 'Other'];
const AD_CHANNELS = ['Meta', 'Instagram', 'Facebook', 'Google', 'TikTok', 'Other'];
// Orders in these states never count as revenue.
const DEAD_STATES = new Set(['cancelled', 'payment_failed', 'refunded']);

interface OrderRow { id: string; total: number | null; delivery_cost: number | null; payment_fee: number | null; utm_source: string | null; status: string | null; }
interface SettlementRow { order_id: string; vendor_cost: number | null; }
interface ExpenseRow { id: string; incurred_on: string; category: string; channel: string | null; amount: number | string; note: string | null; }

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; err?: string; ok?: string; costs?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('analytics')) {
    return <NoAccess section="Finance" />;
  }

  const { range: rangeParam, err, ok } = await searchParams;
  const range = RANGES.find(r => r.key === rangeParam) ?? RANGES[1]; // default 30d
  // `new Date()` (allowed) rather than Date.now() — the strict react-hooks
  // purity lint rejects Date.now() in a server-component render.
  const fromDate = range.days ? new Date(new Date().getTime() - range.days * 86_400_000) : null;
  const fromISO = fromDate?.toISOString() ?? null;
  const fromDay = fromDate?.toISOString().slice(0, 10) ?? null;

  const admin = supabaseAdmin();

  // Orders in range.
  let oq = admin.from('orders').select('id, total, delivery_cost, payment_fee, utm_source, status');
  if (fromISO) oq = oq.gte('created_at', fromISO);
  const { data: orderData } = await oq;
  const orders = ((orderData ?? []) as OrderRow[]).filter(o => !DEAD_STATES.has(o.status ?? ''));
  const orderIds = orders.map(o => o.id);

  // Vendor cost (COGS) for those orders, from the settlements the vendor flow writes.
  let cogs = 0;
  if (orderIds.length) {
    const { data: settle } = await admin.from('vendor_settlements').select('order_id, vendor_cost').in('order_id', orderIds);
    const activeSet = new Set(orderIds);
    for (const s of (settle ?? []) as SettlementRow[]) {
      if (activeSet.has(s.order_id)) cogs += Number(s.vendor_cost ?? 0);
    }
  }

  // Operating expenses in range (ad spend + overheads).
  let eq = admin.from('expenses').select('id, incurred_on, category, channel, amount, note');
  if (fromDay) eq = eq.gte('incurred_on', fromDay);
  const { data: expenseData } = await eq.order('incurred_on', { ascending: false });
  const expenses = (expenseData ?? []) as ExpenseRow[];

  // ── Aggregate ──
  const num = (v: number | string | null | undefined) => Number(v ?? 0) || 0;
  const revenue = orders.reduce((s, o) => s + num(o.total), 0);
  const deliveryCost = orders.reduce((s, o) => s + num(o.delivery_cost), 0);
  const paymentFees = orders.reduce((s, o) => s + num(o.payment_fee), 0);
  const grossProfit = revenue - cogs - deliveryCost - paymentFees;

  const expByCat = new Map<string, number>();
  let adSpend = 0;
  const adByChannel = new Map<string, number>();
  for (const e of expenses) {
    const amt = num(e.amount);
    expByCat.set(e.category, (expByCat.get(e.category) ?? 0) + amt);
    if (e.category === 'Ads') {
      adSpend += amt;
      const ch = e.channel || 'Other';
      adByChannel.set(ch, (adByChannel.get(ch) ?? 0) + amt);
    }
  }
  const totalOpex = [...expByCat.values()].reduce((s, v) => s + v, 0);
  const netProfit = grossProfit - totalOpex;
  const margin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

  // ROAS — revenue attributable to a paid source (orders carrying a utm_source).
  const bySource = new Map<string, { revenue: number; orders: number }>();
  for (const o of orders) {
    if (!o.utm_source) continue;
    const cur = bySource.get(o.utm_source) ?? { revenue: 0, orders: 0 };
    cur.revenue += num(o.total); cur.orders += 1;
    bySource.set(o.utm_source, cur);
  }
  const attributedRevenue = [...bySource.values()].reduce((s, v) => s + v.revenue, 0);
  const blendedRoas = adSpend > 0 ? attributedRevenue / adSpend : null;

  const card: React.CSSProperties = { background: 'white', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' };
  const profitColor = netProfit >= 0 ? '#15803d' : '#dc2626';

  const kpis = [
    { label: 'Revenue', value: fmt(revenue), color: '#0369a1' },
    { label: 'Net profit', value: fmt(netProfit), color: profitColor },
    { label: 'Net margin', value: `${margin.toFixed(1)}%`, color: profitColor },
    { label: 'Ad spend', value: fmt(adSpend), color: '#b45309' },
  ];

  const pnlLines: { label: string; value: number; kind?: 'sub' | 'total' | 'net' }[] = [
    { label: 'Revenue (paid orders)', value: revenue },
    { label: 'Vendor cost (COGS)', value: -cogs, kind: 'sub' },
    { label: 'Delivery cost', value: -deliveryCost, kind: 'sub' },
    { label: 'Payment fees', value: -paymentFees, kind: 'sub' },
    { label: 'Gross profit', value: grossProfit, kind: 'total' },
    ...[...expByCat.entries()].map(([c, v]) => ({ label: `– ${c}`, value: -v, kind: 'sub' as const })),
    { label: 'Net profit', value: netProfit, kind: 'net' as const },
  ];

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Finance</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>Profit &amp; loss, ad spend and ROAS — last {range.label.toLowerCase()}.</p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGES.map(r => (
            <a key={r.key} href={`/admin/finance?range=${r.key}`} style={{
              padding: '7px 12px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
              border: '1px solid', borderColor: r.key === range.key ? '#111827' : '#e5e7eb',
              background: r.key === range.key ? '#111827' : 'white', color: r.key === range.key ? '#fff' : '#6b7280',
            }}>{r.label}</a>
          ))}
        </div>
      </div>

      {err && <div style={{ ...card, padding: '12px 16px', marginBottom: 16, background: '#fef2f2', color: '#991b1b', fontSize: '0.875rem' }}>{err}</div>}
      {ok && <div style={{ ...card, padding: '12px 16px', marginBottom: 16, background: '#f0fdf4', color: '#166534', fontSize: '0.875rem' }}>Saved.</div>}

      {/* KPIs */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: '18px 20px' }}>
            <div style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: k.color, fontVariantNumeric: 'tabular-nums' }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* P&L breakdown */}
        <div style={card}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Profit &amp; loss</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <tbody>
              {pnlLines.map((l, i) => (
                <tr key={i} style={{
                  borderTop: l.kind === 'total' || l.kind === 'net' ? '1px solid #e5e7eb' : 'none',
                }}>
                  <td style={{ padding: '8px 0', color: l.kind === 'net' ? '#111827' : '#374151', fontWeight: l.kind === 'total' || l.kind === 'net' ? 700 : 400, paddingLeft: l.kind === 'sub' ? 12 : 0 }}>{l.label}</td>
                  <td style={{ padding: '8px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: l.kind === 'total' || l.kind === 'net' ? 700 : 400,
                    color: l.kind === 'net' ? profitColor : l.value < 0 ? '#b91c1c' : '#111827' }}>
                    {l.value < 0 ? `(${fmt(-l.value)})` : fmt(l.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ROAS */}
        <div style={card}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Ad performance (ROAS)</h2>
          <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Blended ROAS {blendedRoas != null ? <strong style={{ color: '#111827' }}>{blendedRoas.toFixed(2)}×</strong> : '—'} · {fmt(attributedRevenue)} revenue from tagged orders vs {fmt(adSpend)} ad spend
          </p>
          {bySource.size === 0 && adByChannel.size === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
              No tagged orders or ad spend yet. Add UTM tags to ad links (e.g. <code>?utm_source=instagram</code>) and log ad spend below.
            </p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead><tr style={{ color: '#6b7280', textAlign: 'left' }}>
                <th style={{ padding: '4px 0', fontWeight: 600 }}>Source</th>
                <th style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>Orders</th>
                <th style={{ padding: '4px 0', fontWeight: 600, textAlign: 'right' }}>Revenue</th>
              </tr></thead>
              <tbody>
                {[...bySource.entries()].sort((a, b) => b[1].revenue - a[1].revenue).map(([src, v]) => (
                  <tr key={src} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 0', color: '#374151' }}>{src}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{v.orders}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(v.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Expenses ledger */}
      <div style={card}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Expenses</h2>

        <form action={addExpense} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 20 }}>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Date<br />
            <input type="date" name="incurred_on" defaultValue={new Date().toISOString().slice(0, 10)} style={inp} />
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Category<br />
            <select name="category" defaultValue="Ads" style={inp}>
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Channel (ads)<br />
            <input list="ad-channels" name="channel" placeholder="Meta" style={inp} />
            <datalist id="ad-channels">{AD_CHANNELS.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Amount (PKR)<br />
            <input type="number" name="amount" min="0" step="1" required placeholder="0" style={inp} />
          </label>
          <label style={{ fontSize: '0.75rem', color: '#6b7280', flex: '1 1 160px' }}>Note<br />
            <input type="text" name="note" placeholder="optional" style={{ ...inp, width: '100%' }} />
          </label>
          <button type="submit" style={{ padding: '9px 18px', background: '#C5286A', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Add</button>
        </form>

        {expenses.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>No expenses logged in this period.</p>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead><tr style={{ color: '#6b7280', textAlign: 'left', background: '#f9fafb' }}>
              {['Date', 'Category', 'Channel', 'Amount', 'Note', ''].map(h => <th key={h} style={{ padding: '8px 10px', fontWeight: 600 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {expenses.map(e => (
                <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td data-label="Date" style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{fmtDate(e.incurred_on)}</td>
                  <td data-label="Category" style={{ padding: '8px 10px' }}>{e.category}</td>
                  <td data-label="Channel" style={{ padding: '8px 10px', color: '#6b7280' }}>{e.channel ?? '—'}</td>
                  <td data-label="Amount" style={{ padding: '8px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(e.amount))}</td>
                  <td data-label="Note" style={{ padding: '8px 10px', color: '#6b7280' }}>{e.note ?? ''}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                    <form action={deleteExpense.bind(null, e.id)}>
                      <button type="submit" style={{ background: 'none', border: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.8125rem' }} title="Delete">✕ Delete</button>
                    </form>
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

const inp: React.CSSProperties = {
  display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827', background: 'white',
};
