export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { NoAccess } from '@/components/admin/NoAccess';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';
import { PK_TZ } from '@/lib/dates';
import {
  CASH_CATEGORIES, categoryMeta, monthlySummary, netCash, runningBalancesNewestFirst,
  type CashDirection,
} from '@/lib/cash';
import { addCashEntry, deleteCashEntry, confirmCashSuggestion, skipCashSuggestion } from './actions';
import { loadCashSuggestions } from '@/lib/cash-suggestions';

// The cashbook. Finance says what was earned; this page says what is actually
// in hand. Entries are real cash movements, recorded by a human, often in
// bulk catch-up sessions — which is why the date is editable and the running
// balance is computed rather than stored.

interface CashRow {
  id: string;
  direction: CashDirection;
  amount: number;
  category: string;
  note: string | null;
  entry_date: string;
  created_by: string | null;
  created_at: string;
  order_id: string | null;
  vendor_id: string | null;
}

const rs = (n: number) => `Rs ${Math.round(n).toLocaleString('en-PK')}`;
const fmtDate = (s: string) =>
  new Date(`${s}T00:00:00`).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: 'numeric', timeZone: PK_TZ });
const monthLabel = (m: string) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString('en-PK', { month: 'long', year: 'numeric', timeZone: PK_TZ });

export default async function CashPage({
  searchParams,
}: { searchParams: Promise<{ ok?: string; error?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !can(session, 'finance'))) {
    return <NoAccess section="Cash" />;
  }
  const { ok: okMsg, error: errMsg } = await searchParams;

  const admin = supabaseAdmin();
  const [{ data }, suggestions, { data: vendorRows }] = await Promise.all([
    admin
      .from('cash_entries')
      .select('id, direction, amount, category, note, entry_date, created_by, created_at, order_id, vendor_id')
      .order('entry_date', { ascending: false })
      .order('created_at', { ascending: false }),
    loadCashSuggestions(admin),
    // All vendors (not just active): the form's vendor picker and the ledger's
    // vendor chips — money can still move to a vendor who has since been
    // deactivated.
    admin.from('vendors').select('id, name').order('name'),
  ]);
  const entries = ((data ?? []) as CashRow[]).map(e => ({ ...e, amount: Number(e.amount) }));
  const vendors = (vendorRows ?? []) as Array<{ id: string; name: string }>;
  const vendorNameById = new Map(vendors.map(v => [v.id, v.name]));

  // Order numbers for the linked-order chips, one query for all linked ids.
  const linkedOrderIds = [...new Set(entries.map(e => e.order_id).filter((v): v is string => Boolean(v)))];
  const { data: orderRows } = linkedOrderIds.length
    ? await admin.from('orders').select('id, order_number').in('id', linkedOrderIds)
    : { data: [] };
  const orderNoById = new Map(
    ((orderRows ?? []) as Array<{ id: string; order_number: string }>).map(o => [o.id, o.order_number]),
  );

  const inHand = netCash(entries);
  const balances = runningBalancesNewestFirst(entries);
  const months = monthlySummary(entries);
  const thisMonth = months[0]?.month === new Date().toISOString().slice(0, 7) ? months[0] : null;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Cash</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
        The actual money, separate from profit. Record every real movement — stock bought from pocket, fees,
        COD money the courier pays over, capital you put in — and the balance here is what the business
        holds right now. Finance stays the profit story; this is the till.
      </p>

      {errMsg && (
        <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{errMsg}</div>
      )}
      {okMsg && (
        <div role="status" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{okMsg}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }} className="adm-stat-grid">
        <KpiCard label="Cash in hand" value={rs(inHand)} accent={inHand >= 0 ? '#16a34a' : '#dc2626'} />
        <KpiCard label="In this month" value={rs(thisMonth?.inflow ?? 0)} accent="#1d4ed8" />
        <KpiCard label="Out this month" value={rs(thisMonth?.outflow ?? 0)} accent="#d97706" />
      </div>

      {/* ─── Suggested entries ───────────────────────────────────────────────
          Movements already recorded elsewhere (vendor settlements, reconciled
          online payments) proposed for one-tap confirmation. Nothing enters
          the cashbook until confirmed; confirmed/skipped sources never come
          back. */}
      {suggestions.length > 0 && (
        <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: 16, marginBottom: 24 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#92400e' }}>
            Suggested from the rest of the admin ({suggestions.length})
          </h2>
          <p style={{ margin: '0 0 12px', fontSize: '0.75rem', color: '#a16207' }}>
            Vendor settlements and reconciled payments that look like real money moving. Confirm the
            ones that were actually cash, skip the ones that weren&apos;t (e.g. netted off against stock).
          </p>
          <div style={{ display: 'grid', gap: 8 }}>
            {suggestions.map(s => (
              <div key={s.sourceKey} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: 'white', border: '1px solid #f3f4f6', borderRadius: 8, padding: '8px 12px' }}>
                <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDate(s.date)}</span>
                <span style={{ fontSize: '0.8125rem', color: '#111827', flex: '1 1 200px' }}>{s.label}</span>
                <DotChip
                  label={categoryMeta(s.category).label}
                  color={categoryMeta(s.category).direction === 'in' ? '#15803d' : '#d97706'}
                />
                <strong style={{ fontSize: '0.8125rem', color: categoryMeta(s.category).direction === 'in' ? '#15803d' : '#d97706', fontVariantNumeric: 'tabular-nums' }}>
                  {categoryMeta(s.category).direction === 'in' ? '+' : '−'}{rs(s.amount)}
                </strong>
                <form action={confirmCashSuggestion} style={{ display: 'inline' }}>
                  <input type="hidden" name="source_key" value={s.sourceKey} />
                  <input type="hidden" name="category" value={s.category} />
                  <input type="hidden" name="amount" value={s.amount} />
                  <input type="hidden" name="entry_date" value={s.date} />
                  <input type="hidden" name="note" value={s.label} />
                  {s.orderId && <input type="hidden" name="order_id" value={s.orderId} />}
                  {s.vendorId && <input type="hidden" name="vendor_id" value={s.vendorId} />}
                  <button type="submit" style={{ padding: '6px 14px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    Add to cashbook
                  </button>
                </form>
                <form action={skipCashSuggestion} style={{ display: 'inline' }}>
                  <input type="hidden" name="source_key" value={s.sourceKey} />
                  <button type="submit" style={{ padding: '6px 10px', background: 'transparent', color: '#9ca3af', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
                    Skip
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Record a movement ───────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Record a movement</h2>
      <form
        action={addCashEntry}
        className="adm-stock-form"
        style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr 1fr 1fr auto', gap: 12, alignItems: 'end' }}
      >
        <div>
          <label htmlFor="category" style={lbl}>What happened?</label>
          <select id="category" name="category" required defaultValue="" style={inp}>
            <option value="" disabled>Choose…</option>
            <optgroup label="Money out">
              {CASH_CATEGORIES.filter(c => c.direction === 'out').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </optgroup>
            <optgroup label="Money in">
              {CASH_CATEGORIES.filter(c => c.direction === 'in').map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
        <div>
          <label htmlFor="amount" style={lbl}>Amount (PKR)</label>
          <input id="amount" name="amount" type="number" required min={1} step="0.01" placeholder="e.g. 12500" style={inp} />
        </div>
        <div>
          <label htmlFor="entry_date" style={lbl}>Date</label>
          <input id="entry_date" name="entry_date" type="date" style={inp} />
        </div>
        <div>
          <label htmlFor="note" style={lbl}>Note (optional)</label>
          <input id="note" name="note" type="text" maxLength={500} placeholder="e.g. CeraVe restock from Saddar, 40 units" style={inp} />
        </div>
        <div>
          <label htmlFor="order_no" style={lbl}>For order (optional)</label>
          <input id="order_no" name="order_no" type="text" maxLength={40} placeholder="YP-XXXX" style={inp} />
        </div>
        <div>
          <label htmlFor="vendor_id" style={lbl}>Vendor (optional)</label>
          <select id="vendor_id" name="vendor_id" defaultValue="" style={inp}>
            <option value="">—</option>
            {vendors.map(v => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        </div>
        <button type="submit" style={btn}>Record</button>
      </form>

      {/* ─── Monthly summary ─────────────────────────────────────────────── */}
      {months.length > 0 && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24, maxWidth: 560 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6' }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>By month</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Month', 'In', 'Out', 'Net'].map((h, i) => (
                  <th scope="col" key={h} style={{ ...th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map(m => (
                <tr key={m.month} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={td}>{monthLabel(m.month)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#065f46' }}>{rs(m.inflow)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#991b1b' }}>{rs(m.outflow)}</td>
                  <td style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: m.net >= 0 ? '#065f46' : '#991b1b' }}>
                    {m.net >= 0 ? '+' : '−'}{rs(Math.abs(m.net))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── The book ────────────────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Movements</h2>
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {entries.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            Nothing recorded yet. Start with what the business holds today: record it as
            “Capital put in” and the balance above becomes real from this moment on.
          </div>
        ) : (
          <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Date', 'What', 'Note', 'Amount', 'Balance after', 'By', ''].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const meta = categoryMeta(e.category);
                return (
                  <tr key={e.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td data-label="Date" style={{ ...td, whiteSpace: 'nowrap', color: '#6b7280', fontSize: '0.75rem' }}>{fmtDate(e.entry_date)}</td>
                    <td data-label="What" style={td}>
                      <DotChip label={meta.label} color={e.direction === 'in' ? '#065f46' : '#92400e'} />
                    </td>
                    <td data-label="Note" style={{ ...td, color: '#374151', maxWidth: 320 }}>
                      {e.note ?? '—'}
                      {e.order_id && orderNoById.has(e.order_id) && (
                        <Link
                          href={`/admin/orders/${e.order_id}`}
                          style={{ marginLeft: 8, color: '#C5286A', fontWeight: 600, textDecoration: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                          {orderNoById.get(e.order_id)}
                        </Link>
                      )}
                      {e.vendor_id && vendorNameById.has(e.vendor_id) && (
                        <Link
                          href="/admin/vendors"
                          style={{ marginLeft: 8, color: '#6b7280', fontWeight: 600, textDecoration: 'none', fontSize: '0.75rem', whiteSpace: 'nowrap' }}
                        >
                          {vendorNameById.get(e.vendor_id)}
                        </Link>
                      )}
                    </td>
                    <td data-label="Amount" style={{ ...td, textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: e.direction === 'in' ? '#065f46' : '#991b1b' }}>
                      {e.direction === 'in' ? '+' : '−'}{rs(e.amount)}
                    </td>
                    <td data-label="Balance after" style={{ ...td, textAlign: 'right', fontFamily: 'monospace', color: '#111827' }}>{rs(balances[i])}</td>
                    <td data-label="By" style={{ ...td, fontSize: '0.6875rem', color: '#6b7280' }}>{e.created_by ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>
                      <form action={deleteCashEntry} style={{ display: 'inline' }}>
                        <input type="hidden" name="id" value={e.id} />
                        <button type="submit" style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                          Delete
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ marginTop: 12, fontSize: '0.75rem', color: '#9ca3af' }}>
        Deleting an entry is for correcting mistakes; the activity log keeps a record of what was removed.
      </p>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', background: 'white' };
const btn: React.CSSProperties = { padding: '9px 18px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
const th: React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td: React.CSSProperties = { padding: '10px 16px', verticalAlign: 'top' };
