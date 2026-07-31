import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { AdminFlash } from '@/components/admin/AdminFlash';
import { RangePicker } from '@/components/admin/insights/RangePicker';
import { ExportVendorCsvButton } from '@/components/admin/ExportVendorCsvButton';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { updateVendor, markSettlementSettled, settleVendorPending, setProductVendorCost } from '@/app/admin/vendor-actions';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { fmtDatePK } from '@/lib/dates';
import type { Vendor, VendorSettlement, OrderStatus } from '@/types';

const lbl = { display: 'block', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase' as const, letterSpacing: '0.04em', marginBottom: 4 };
const inp = { padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.875rem', color: '#111827', background: 'white' };

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

// Per-vendor trading record (owner request): everything the store has done
// with one supplier over a chosen window — KPIs, then one row per order with
// its payout state — and a CSV of exactly the same window for settlement
// calls. The Vendors index shows the all-time rollup; this page answers
// "what happened with them recently and what's still open".
export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ days?: string; error?: string; saved?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('vendors'))) {
    return <NoAccess section="Vendors" />;
  }
  const { id } = await params;
  const { days, error: feedbackError, saved: savedMsg } = (await searchParams) ?? {};
  const selfPath = `/admin/vendors/${id}${days ? `?days=${days}` : ''}`;
  const daysNum = Number(days);
  // Async server component renders once per request; Date.now() is fine here
  // (same pattern as analytics/page.tsx — the purity rule targets client
  // components the React Compiler may re-render).
  const windowed = Number.isFinite(daysNum) && daysNum > 0;
  // eslint-disable-next-line react-hooks/purity
  const sinceIso = windowed ? new Date(Date.now() - daysNum * 86400_000).toISOString() : null;

  const admin = supabaseAdmin();
  const { data: vendorRow } = await admin.from('vendors').select('*').eq('id', id).maybeSingle();
  if (!vendorRow) {
    return (
      <div className="adm-page" style={{ padding: '32px 36px' }}>
        <p style={{ color: '#6b7280' }}>Vendor not found. <Link href="/admin/vendors" style={{ color: '#C5286A' }}>Back to Vendors</Link></p>
      </div>
    );
  }
  const vendor = vendorRow as Vendor;

  let oq = admin
    .from('orders')
    .select('id, order_number, created_at, status, total, pay_method')
    .eq('vendor_id', id)
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  if (sinceIso) oq = oq.gte('created_at', sinceIso);
  const { data: orderRows } = await oq;
  const orders = (orderRows ?? []) as { id: string; order_number: string | null; created_at: string | null; status: OrderStatus | null; total: number | null; pay_method: string | null }[];

  const [{ data: settleRows }, { data: pendingRows }, { data: productRows }] = await Promise.all([
    orders.length
      ? admin.from('vendor_settlements').select('*').eq('vendor_id', id).in('order_id', orders.map(o => o.id))
      : Promise.resolve({ data: [] }),
    // Pending payouts are shown regardless of the date window: an old unpaid
    // balance is exactly the thing a window must never hide.
    admin.from('vendor_settlements').select('*').eq('vendor_id', id).eq('status', 'pending').order('created_at', { ascending: true }),
    admin.from('products').select('id, name, brand, price, status, vendor_cost, cost_price').eq('vendor_id', id).order('name'),
  ]);
  const settleByOrder = new Map(((settleRows ?? []) as VendorSettlement[]).map(s => [s.order_id, s]));
  const pendingAll = (pendingRows ?? []) as VendorSettlement[];
  const products = (productRows ?? []) as { id: string; name: string; brand: string | null; price: number | null; status: string | null; vendor_cost: number | null; cost_price: number | null }[];
  const pendingOrderNumbers = new Map<string, string>();
  if (pendingAll.length) {
    const { data: pendingOrders } = await admin.from('orders').select('id, order_number').in('id', pendingAll.map(s => s.order_id));
    for (const o of (pendingOrders ?? []) as { id: string; order_number: string }[]) pendingOrderNumbers.set(o.id, o.order_number);
  }
  const waVendor = whatsappUrlForCustomer(vendor.phone);

  // Window KPIs. Sales counts delivered orders only (a returned parcel earned
  // nothing); costs/margin come from the recorded payout rows.
  let delivered = 0, returned = 0, sales = 0, cogs = 0, margin = 0, pendingDue = 0, settledDue = 0;
  for (const o of orders) {
    const st = (o.status ?? '').toLowerCase();
    if (st === 'delivered') { delivered += 1; sales += Number(o.total) || 0; }
    if (st === 'returned') returned += 1;
    const s = settleByOrder.get(o.id);
    if (s) {
      cogs += Number(s.vendor_cost) || 0;
      margin += Number(s.our_margin) || 0;
      if (s.status === 'pending') pendingDue += Number(s.amount_due) || 0;
      if (s.status === 'settled') settledDue += Number(s.amount_due) || 0;
    }
  }

  const kpi = (label: string, value: string, color = '#111827') => (
    <div style={{ background: 'white', borderRadius: 10, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', minWidth: 150 }}>
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '1.125rem', fontWeight: 700, color, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );

  const num = { padding: '9px 10px', textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums' as const, whiteSpace: 'nowrap' as const, fontSize: '0.8125rem' };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 4 }}>
        <Link href="/admin/vendors" style={{ fontSize: '0.8125rem', color: '#6b7280', textDecoration: 'none' }}>← Vendors</Link>
      </div>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>{vendor.name}</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Suspense fallback={null}>
            <RangePicker
              value={days ?? 'all'}
              options={[
                { value: 'all', label: 'All time' },
                { value: '30',  label: 'Last 30d' },
                { value: '90',  label: 'Last 90d' },
                { value: '365', label: 'Last year' },
              ]}
            />
          </Suspense>
          <ExportVendorCsvButton vendorId={id} vendorName={vendor.name} days={days} />
        </div>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
        {vendor.phone}
        {waVendor && <> · <a href={waVendor} target="_blank" rel="noopener noreferrer" style={{ color: '#16a34a', fontWeight: 600, textDecoration: 'none' }}>WhatsApp them</a></>}
        {' · '}{vendor.settlement_direction === 'vendor_collects' ? 'They collect payment and owe you your margin' : 'You collect payment and pay them their cost'}
        {vendor.self_delivers ? ' · delivers to the customer themselves' : ''}
      </p>

      <AdminFlash message={savedMsg ?? null} type="success" clearPath={selfPath} />
      {feedbackError && (
        <div role="status" style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca' }}>
          {feedbackError}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {kpi('Orders', String(orders.length))}
        {kpi('Delivered', String(delivered), '#15803d')}
        {kpi('Returned', String(returned), returned > 0 ? '#dc2626' : '#111827')}
        {kpi('Sales', fmt(sales))}
        {kpi('Vendor cost', fmt(cogs))}
        {kpi('Your margin', fmt(margin), '#15803d')}
        {kpi('Unsettled', fmt(pendingDue), pendingDue > 0 ? '#b45309' : '#111827')}
        {kpi('Settled', fmt(settledDue), '#6b7280')}
      </div>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        {orders.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No orders with this vendor in the selected window.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 780 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Order', 'Date', 'Status', 'Total', 'Vendor cost', 'Your margin', 'Amount due', 'Payout', 'Settled'].map((h, i) => (
                  <th key={h} scope="col" style={{ textAlign: i < 3 ? 'left' : 'right', padding: '10px', color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map(o => {
                const s = settleByOrder.get(o.id);
                return (
                  <tr key={o.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 10px', fontSize: '0.8125rem' }}>
                      <Link href={`/admin/orders/${o.id}`} style={{ color: '#C5286A', fontWeight: 600, textDecoration: 'none' }}>{o.order_number}</Link>
                    </td>
                    <td style={{ padding: '9px 10px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{o.created_at ? fmtDatePK(o.created_at) : '—'}</td>
                    <td style={{ padding: '9px 10px' }}><OrderStatusBadge status={(o.status ?? 'pending') as OrderStatus} /></td>
                    <td style={{ ...num, fontWeight: 700 }}>{fmt(Number(o.total) || 0)}</td>
                    <td style={num}>{s ? fmt(Number(s.vendor_cost)) : '—'}</td>
                    <td style={{ ...num, color: '#15803d' }}>{s ? fmt(Number(s.our_margin)) : '—'}</td>
                    <td style={num}>{s ? fmt(Number(s.amount_due)) : '—'}</td>
                    <td style={{ ...num, fontWeight: 600, color: s ? (s.status === 'settled' ? '#15803d' : '#b45309') : '#9ca3af' }}>
                      {s ? s.status : 'none'}
                    </td>
                    <td style={{ ...num, color: '#6b7280' }}>{s?.settled_at ? fmtDatePK(s.settled_at) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pending payouts (all time, ignores the window on purpose) ────── */}
      {pendingAll.length > 0 && (
        <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginTop: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
              Pending payouts · {fmt(pendingAll.reduce((t, s) => t + Number(s.amount_due), 0))}{' '}
              <span style={{ fontWeight: 500, color: '#6b7280' }}>
                {pendingAll[0].due_to === 'us' ? 'owed to you' : 'you owe'}
              </span>
            </h2>
            <form action={settleVendorPending}>
              <input type="hidden" name="vendor_id" value={id} />
              <input type="hidden" name="return_to" value={selfPath} />
              <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#15803d', color: 'white', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                Settle all pending
              </button>
            </form>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingAll.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 8, background: '#fffbeb', border: '1px solid #fde68a', fontSize: '0.8125rem' }}>
                <Link href={`/admin/orders/${s.order_id}`} style={{ color: '#C5286A', fontWeight: 600, textDecoration: 'none' }}>
                  {pendingOrderNumbers.get(s.order_id) ?? 'Order'}
                </Link>
                <span style={{ color: '#6b7280' }}>{s.created_at ? fmtDatePK(s.created_at) : ''}</span>
                <span style={{ fontWeight: 700, marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{fmt(Number(s.amount_due))}</span>
                <form action={markSettlementSettled}>
                  <input type="hidden" name="id" value={s.id} />
                  <input type="hidden" name="return_to" value={selfPath} />
                  <button type="submit" style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    Mark settled
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Vendor settings ──────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginTop: 24 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Settings</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Commission and the free-delivery threshold drive live storefront pricing and the payout engine; changes apply to future orders only.
        </p>
        <form action={updateVendor} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="return_to" value={selfPath} />
          <div>
            <label htmlFor="vd-name" style={lbl}>Name</label>
            <input id="vd-name" name="name" defaultValue={vendor.name} required style={{ ...inp, width: 180 }} />
          </div>
          <div>
            <label htmlFor="vd-phone" style={lbl}>WhatsApp number</label>
            <input id="vd-phone" name="phone" defaultValue={vendor.phone} required style={{ ...inp, width: 170 }} />
          </div>
          <div>
            <label htmlFor="vd-commission" style={lbl}>Commission % we keep</label>
            <input id="vd-commission" name="commission_pct" type="number" min={0} max={100} step="0.01" defaultValue={vendor.commission_pct ?? ''} style={{ ...inp, width: 120 }} />
          </div>
          <div>
            <label htmlFor="vd-direction" style={lbl}>Who collects payment</label>
            <select id="vd-direction" name="settlement_direction" defaultValue={vendor.settlement_direction} style={{ ...inp, width: 200 }}>
              <option value="we_collect">We collect, we pay the vendor</option>
              <option value="vendor_collects">Vendor collects, they pay us</option>
            </select>
          </div>
          <div>
            <label htmlFor="vd-fee" style={lbl}>Delivery fee they charge us</label>
            <input id="vd-fee" name="delivery_fee" type="number" min={0} step="1" defaultValue={vendor.delivery_fee ?? 0} style={{ ...inp, width: 140 }} />
          </div>
          <div>
            <label htmlFor="vd-threshold" style={lbl}>Customer free delivery from (PKR)</label>
            <input id="vd-threshold" name="free_shipping_threshold" type="number" min={0} step="1" defaultValue={vendor.free_shipping_threshold ?? ''} style={{ ...inp, width: 160 }} />
          </div>
          <label style={{ ...lbl, display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', paddingBottom: 8, marginBottom: 0 }}>
            <input type="checkbox" name="self_delivers" defaultChecked={!!vendor.self_delivers} style={{ width: 16, height: 16 }} />
            Vendor delivers to customer
          </label>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label htmlFor="vd-notes" style={lbl}>Notes</label>
            <input id="vd-notes" name="notes" defaultValue={vendor.notes ?? ''} placeholder="What they supply" style={{ ...inp, width: '100%' }} />
          </div>
          <button type="submit" style={{ padding: '9px 20px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
            Save settings
          </button>
        </form>
      </div>

      {/* ── Products & per-product vendor pricing ────────────────────────── */}
      {/* The cost engine prices a dispatched item as: per-product vendor
          price (below) → the vendor's blanket commission % → the product's
          own cost price. This table is where a supplier's per-product quotes
          get recorded, so acquisition costs land right automatically. */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginTop: 24, marginBottom: 32, overflowX: 'auto' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Products &amp; vendor pricing · {products.length}
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Set what this vendor charges you per product when their quote differs from the blanket commission
          {vendor.commission_pct != null ? ` (${vendor.commission_pct}% kept)` : ''}. Blank = commission rate applies. Changes price future dispatches; use &ldquo;Recalculate from vendor rate&rdquo; on an order to reprice it.
        </p>
        {products.length === 0 ? (
          <p style={{ margin: 0, color: '#9ca3af', fontSize: '0.8125rem' }}>
            No products are assigned to this vendor yet. Set the vendor on a product&apos;s admin page and its dispatches will settle here automatically.
          </p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Product', 'Retail price', 'Vendor price', 'Your margin', ''].map((h, i) => (
                  <th key={h || 'action'} scope="col" style={{ textAlign: i === 0 ? 'left' : 'right', padding: '8px 10px', color: '#6b7280', fontWeight: 600, fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map(p => {
                const retail = Number(p.price) || 0;
                // Mirror the cost engine's precedence so the margin shown is
                // the margin a dispatch would actually record.
                const commissionCost = vendor.commission_pct != null ? retail * (1 - Number(vendor.commission_pct) / 100) : null;
                const effective = p.vendor_cost ?? commissionCost ?? p.cost_price;
                const source = p.vendor_cost != null ? 'set price' : commissionCost != null ? 'commission' : p.cost_price != null ? 'cost price' : null;
                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px 10px', fontSize: '0.8125rem' }}>
                      <Link href={`/admin/products/${p.id}`} style={{ color: p.status === 'published' ? '#C5286A' : '#9ca3af', fontWeight: 600, textDecoration: 'none' }}>
                        {p.name}
                      </Link>
                      {p.status !== 'published' && <span style={{ marginLeft: 6, fontSize: '0.6875rem', color: '#9ca3af' }}>({p.status})</span>}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmt(retail)}</td>
                    <td style={{ padding: '9px 10px', textAlign: 'right' }}>
                      <form action={setProductVendorCost} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <input type="hidden" name="product_id" value={p.id} />
                        <input type="hidden" name="return_to" value={selfPath} />
                        <input
                          name="vendor_cost"
                          type="number"
                          min={0}
                          step="0.01"
                          defaultValue={p.vendor_cost ?? ''}
                          placeholder={commissionCost != null ? String(Math.round(commissionCost)) : '—'}
                          aria-label={`Vendor price for ${p.name}`}
                          style={{ ...inp, width: 96, textAlign: 'right' }}
                        />
                        <button type="submit" style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                          Save
                        </button>
                      </form>
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.8125rem', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {effective != null && retail > 0 ? (
                        <span style={{ color: retail - Number(effective) > 0 ? '#15803d' : '#dc2626', fontWeight: 700 }}>
                          {fmt(retail - Number(effective))}
                          <span style={{ color: '#9ca3af', fontWeight: 500 }}> · {Math.round(((retail - Number(effective)) / retail) * 100)}%</span>
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '9px 10px', textAlign: 'right', fontSize: '0.6875rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {source ? `via ${source}` : 'no cost basis'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
