export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createVendor, deleteVendor, updateVendor, markSettlementSettled, settleVendorPending } from '@/app/admin/vendor-actions';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DotChip } from '@/components/admin/OrderChips';
import { AdminFlash } from '@/components/admin/AdminFlash';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { fmtDatePK } from '@/lib/dates';
import type { Vendor, VendorSettlement } from '@/types';

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

const inp: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4,
};
const th: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600,
  color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
};
const card: React.CSSProperties = {
  background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden',
};

export default async function VendorsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; saved?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('vendors'))) {
    return <NoAccess section="Vendors" />;
  }
  const { error: feedbackError, saved: savedMsg } = (await searchParams) ?? {};

  const admin = supabaseAdmin();
  // vendors / vendor_settlements RLS has no policy, admin reads need service role.
  const [{ data: vendorData }, { data: settlementData }, { data: orphanRows }] = await Promise.all([
    admin.from('vendors').select('*').order('created_at', { ascending: false }),
    admin.from('vendor_settlements').select('*').order('created_at', { ascending: false }).limit(200),
    // Integrity guard: orders that carry a vendor + engine cost but have NO
    // payout row would silently understate the outstanding totals (this
    // happened once via an unapplied migration). Surface them loudly.
    admin.rpc('vendor_orders_missing_settlement' as never) as unknown as Promise<{ data: { order_id: string; order_number: string }[] | null }>,
  ]);
  const vendors = (vendorData ?? []) as Vendor[];
  const settlements = (settlementData ?? []) as VendorSettlement[];
  const orphans = orphanRows ?? [];

  const orderIds = Array.from(new Set(settlements.map(s => s.order_id)));
  const { data: orderData } = orderIds.length
    ? await admin.from('orders').select('id, order_number').in('id', orderIds)
    : { data: [] };
  const orderMap = new Map(((orderData ?? []) as { id: string; order_number: string }[]).map(o => [o.id, o.order_number]));
  const vendorMap = new Map(vendors.map(v => [v.id, v]));

  // Per-vendor outstanding (pending) total. A vendor's settlement_direction is
  // fixed, so every pending row for a vendor is owed in the same direction.
  const pendingByVendor = new Map<string, number>();
  for (const s of settlements) {
    if (s.status !== 'pending' || !s.vendor_id) continue;
    pendingByVendor.set(s.vendor_id, (pendingByVendor.get(s.vendor_id) ?? 0) + Number(s.amount_due));
  }

  const pending = settlements.filter(s => s.status === 'pending');
  const settled = settlements.filter(s => s.status === 'settled');

  // Headline positions across all vendors: what's flowing in vs out, and the
  // margin the vendor channel has earned overall.
  const owedToUs = pending.filter(s => s.due_to === 'us').reduce((t, s) => t + Number(s.amount_due), 0);
  const weOwe = pending.filter(s => s.due_to === 'vendor').reduce((t, s) => t + Number(s.amount_due), 0);
  const totalMargin = settlements.reduce((t, s) => t + Number(s.our_margin), 0);

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Vendors</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
        Suppliers you forward confirmed orders to. Set each vendor&apos;s commission and who
        collects payment; dispatching an order records the margin and payout.
      </p>

      {/* Success actions surface as a toast; hard errors stay as an inline
          banner so they persist until the next navigation. */}
      <AdminFlash message={savedMsg} type="success" clearPath="/admin/vendors" />
      {feedbackError && (
        <div
          role="status"
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
            background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          }}
        >
          {feedbackError}
        </div>
      )}

      {/* Integrity guard: an order with a vendor but no payout row means the
          outstanding totals below are understating reality. Always empty in a
          healthy system. */}
      {orphans.length > 0 && (
        <div role="alert" style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 8, fontSize: '0.875rem',
          background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a',
        }}>
          {orphans.length} vendor order{orphans.length === 1 ? ' has' : 's have'} no payout recorded — open{' '}
          {orphans.slice(0, 5).map((o, i) => (
            <span key={o.order_id}>
              {i > 0 && ', '}
              <Link href={`/admin/orders/${o.order_id}`} style={{ color: '#b45309', fontWeight: 600 }}>{o.order_number}</Link>
            </span>
          ))}
          {orphans.length > 5 ? '…' : ''} and press <strong>Recalculate from vendor rate</strong> to rebuild the payout.
        </div>
      )}

      {/* Headline positions */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        <KpiCard label="Owed to you · pending" value={fmt(owedToUs)} accent="#15803d"
          hint={owedToUs > 0 ? 'Vendors holding your margin' : 'All collected'} />
        <KpiCard label="You owe · pending" value={fmt(weOwe)} accent="#b45309"
          hint={weOwe > 0 ? 'Vendor costs to pay out' : 'Nothing to pay'} />
        <KpiCard label="Margin earned · all payouts" value={fmt(totalMargin)} accent="#C5286A"
          hint={`${settlements.length} payout${settlements.length === 1 ? '' : 's'} recorded`} />
      </div>

      {/* ── Add vendor ──────────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Add Vendor</h2>
        <form action={createVendor} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label htmlFor="vendor-name" style={lbl}>Name</label>
            <input id="vendor-name" name="name" required placeholder="NB Sons" style={{ ...inp, width: 180 }} />
          </div>
          <div>
            <label htmlFor="vendor-phone" style={lbl}>WhatsApp number</label>
            <input id="vendor-phone" name="phone" required placeholder="+92 300 1234567" style={{ ...inp, width: 170 }} />
          </div>
          <div>
            <label htmlFor="vendor-commission_pct" style={lbl}>Commission % we keep</label>
            <input id="vendor-commission_pct" name="commission_pct" type="number" min={0} max={100} step="0.01" placeholder="35" style={{ ...inp, width: 130 }} />
          </div>
          <div>
            <label htmlFor="vendor-settlement_direction" style={lbl}>Who collects payment</label>
            <select id="vendor-settlement_direction" name="settlement_direction" defaultValue="we_collect" style={{ ...inp, width: 200 }}>
              <option value="we_collect">We collect, we pay the vendor</option>
              <option value="vendor_collects">Vendor collects, they pay us</option>
            </select>
          </div>
          <div>
            <label htmlFor="vendor-delivery_fee" style={lbl}>Delivery fee they charge us</label>
            <input id="vendor-delivery_fee" name="delivery_fee" type="number" min={0} step="1" placeholder="0" style={{ ...inp, width: 150 }} />
          </div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', paddingBottom: 8 }}>
            <input type="checkbox" name="self_delivers" style={{ width: 16, height: 16 }} />
            Vendor delivers to customer
          </label>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label htmlFor="vendor-notes" style={lbl}>Notes (optional)</label>
            <input id="vendor-notes" name="notes" placeholder="What they supply" style={{ ...inp, width: '100%' }} />
          </div>
          <button type="submit" style={{
            padding: '8px 20px', background: '#C5286A', color: 'white',
            border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}>
            + Add
          </button>
        </form>
      </div>

      {/* ── Vendor list ─────────────────────────────────────────────────── */}
      <div style={{ ...card, marginBottom: 32 }}>
        {vendors.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No vendors yet, add your first supplier above.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'WhatsApp', 'Settlement terms', 'Outstanding', ''].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, i) => {
                const outstanding = pendingByVendor.get(v.id) ?? 0;
                const vendorOwesUs = v.settlement_direction === 'vendor_collects';
                return (
                  <tr key={v.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Name" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
                      {v.name}
                      {v.notes && <div style={{ fontSize: '0.75rem', fontWeight: 400, color: '#9ca3af' }}>{v.notes}</div>}
                    </td>
                    <td data-label="WhatsApp" style={{ padding: '12px 16px', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {/* One-tap chat: same wa.me convention as the order-page dispatch. */}
                      <a
                        href={`https://wa.me/${(v.phone ?? '').replace(/[^0-9]/g, '')}`}
                        target="_blank" rel="noopener noreferrer"
                        style={{ color: '#374151', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                        </svg>
                        {v.phone}
                      </a>
                    </td>
                    <td data-label="Settlement terms" style={{ padding: '12px 16px' }}>
                      <form action={updateVendor} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <input type="hidden" name="id" value={v.id} />
                        <input
                          name="commission_pct" type="number" min={0} max={100} step="0.01"
                          defaultValue={v.commission_pct ?? ''} placeholder="—"
                          aria-label={`${v.name} commission %`}
                          style={{ ...inp, width: 72, padding: '6px 8px' }}
                        />
                        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>% kept</span>
                        <select
                          name="settlement_direction" defaultValue={v.settlement_direction ?? 'we_collect'}
                          aria-label={`${v.name} settlement direction`}
                          style={{ ...inp, padding: '6px 8px', fontSize: '0.8125rem' }}
                        >
                          <option value="we_collect">We collect</option>
                          <option value="vendor_collects">Vendor collects</option>
                        </select>
                        <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                          <input type="checkbox" name="self_delivers" defaultChecked={v.self_delivers ?? false} aria-label={`${v.name} delivers directly`} style={{ width: 15, height: 15 }} />
                          delivers
                        </label>
                        <input
                          name="delivery_fee" type="number" min={0} step="1"
                          defaultValue={v.delivery_fee ? Number(v.delivery_fee) : ''} placeholder="fee"
                          aria-label={`${v.name} delivery fee`}
                          style={{ ...inp, width: 64, padding: '6px 8px' }}
                        />
                        <button type="submit" style={{
                          padding: '6px 12px', background: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
                          borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                        }}>Save</button>
                      </form>
                    </td>
                    <td data-label="Outstanding" style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      {outstanding > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, color: vendorOwesUs ? '#16a34a' : '#dc2626' }}>
                            {fmt(outstanding)}
                            <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af' }}>
                              {vendorOwesUs ? 'owed to you' : 'you owe'}
                            </span>
                          </span>
                          {/* One transfer usually clears the whole balance. */}
                          <form action={settleVendorPending}>
                            <input type="hidden" name="vendor_id" value={v.id} />
                            <button type="submit" style={{
                              padding: '5px 11px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                              border: '1px solid #e5e7eb', background: 'white', color: '#374151',
                            }}>
                              Settle all
                            </button>
                          </form>
                        </div>
                      ) : <span style={{ color: '#9ca3af' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <DeleteButton id={v.id} action={deleteVendor} confirmMsg={`Delete vendor "${v.name}"?`} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Payouts ─────────────────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>Payouts</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        One row per order dispatched to a vendor, the margin earned and the amount still to settle.
      </p>
      {settlements.length === 0 ? (
        <div style={{ ...card, padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
          No payouts yet. Dispatch a confirmed order to a vendor from its order page to record one.
        </div>
      ) : (
        <div style={card}>
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Order', 'Date', 'Vendor', 'Gross', 'Our margin', 'To settle', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...pending, ...settled].map((s, i) => {
                const vendor = s.vendor_id ? vendorMap.get(s.vendor_id) : undefined;
                const owedToUs = s.due_to === 'us';
                return (
                  <tr key={s.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Order" style={{ padding: '12px 16px', fontSize: '0.8125rem' }}>
                      <Link href={`/admin/orders/${s.order_id}`} style={{ color: '#C5286A', textDecoration: 'none', fontFamily: 'monospace' }}>
                        {orderMap.get(s.order_id) ?? s.order_id.slice(0, 8)}
                      </Link>
                    </td>
                    <td data-label="Date" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {s.created_at ? fmtDatePK(s.created_at) : '—'}
                    </td>
                    <td data-label="Vendor" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#111827' }}>
                      {vendor?.name ?? s.vendor_name ?? '—'}
                      {!vendor && s.vendor_name && <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af' }}>(deleted)</span>}
                    </td>
                    <td data-label="Gross" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>{fmt(s.gross_amount)}</td>
                    <td data-label="Our margin" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#16a34a' }}>{fmt(s.our_margin)}</td>
                    <td data-label="To settle" style={{ padding: '12px 16px', fontSize: '0.875rem' }}>
                      <span style={{ fontWeight: 700, color: owedToUs ? '#16a34a' : '#dc2626' }}>{fmt(s.amount_due)}</span>
                      <span style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: '#9ca3af' }}>
                        {owedToUs ? 'vendor pays you' : 'you pay vendor'}
                      </span>
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      <DotChip
                        label={s.status === 'settled' ? 'Settled' : 'Pending'}
                        color={s.status === 'settled' ? '#15803d' : '#b45309'}
                      />
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <form action={markSettlementSettled}>
                        <input type="hidden" name="id" value={s.id} />
                        <input type="hidden" name="settle" value={s.status === 'settled' ? 'false' : 'true'} />
                        <button type="submit" style={{
                          padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                          border: '1px solid #e5e7eb',
                          background: s.status === 'settled' ? 'transparent' : '#16a34a',
                          color: s.status === 'settled' ? '#6b7280' : 'white',
                        }}>
                          {s.status === 'settled' ? 'Reopen' : 'Mark settled'}
                        </button>
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
