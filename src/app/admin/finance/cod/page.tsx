export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { FinanceTabs } from '@/components/admin/FinanceTabs';
import { fmtPKR as fmt } from '@/lib/money';
import { fmtDatePK } from '@/lib/dates';

// COD reconciliation, the cash side of the business that's hardest to track.
// "Payment received" lives per-order on the order page; this page rolls it up
// so the owner can see, at a glance:
//   • Outstanding, delivered COD orders not yet marked paid (cash to confirm)
//   • Collected  , delivered COD orders reconciled to an account
//   • In transit , COD value still out for delivery (expected to collect)
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

export default async function CodReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; method?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('finance'))) {
    return <NoAccess section="COD reconciliation" />;
  }
  // This page has no range/method filters of its own, but the Overview tab
  // does — carry its filter params through the tab links so switching to COD
  // and back doesn't reset the owner's selection.
  const { range: rangeParam, method: methodParam } = await searchParams;

  const admin = supabaseAdmin();
  // pending/confirmed included so booked-but-not-dispatched COD money has a
  // stage of its own — a pending order's cash was previously in NO bucket.
  const { data } = await admin
    .from('orders')
    .select('id, order_number, first_name, last_name, total, status, payment_received_at, payment_account, created_at, vendor_id')
    .eq('pay_method', 'cod')
    .in('status', ['pending', 'confirmed', 'processing', 'shipped', 'delivered'])
    .is('archived_at', null)
    .order('created_at', { ascending: false });
  // Vendor-collected COD never reaches the store's courier statement — the
  // VENDOR holds that cash and it settles on the Vendors page. Listing those
  // orders here double-tracked the same money and buried the real
  // receivables (owner report: "irrelevant orders in COD reconciliation").
  const allRows = (data ?? []) as (CodOrder & { vendor_id: string | null })[];
  const vendorIds = Array.from(new Set(allRows.map(r => r.vendor_id).filter((v): v is string => Boolean(v))));
  const { data: vendorRows } = vendorIds.length
    ? await admin.from('vendors').select('id, settlement_direction').in('id', vendorIds)
    : { data: [] };
  const vendorCollects = new Set(
    ((vendorRows ?? []) as { id: string; settlement_direction: string | null }[])
      .filter(v => v.settlement_direction === 'vendor_collects').map(v => v.id),
  );
  const excludedVendorCollected = allRows.filter(r => r.vendor_id && vendorCollects.has(r.vendor_id));
  const rows = allRows.filter(r => !r.vendor_id || !vendorCollects.has(r.vendor_id));

  const outstanding = rows.filter(r => r.status === 'delivered' && !r.payment_received_at);
  const collected   = rows.filter(r => r.status === 'delivered' && r.payment_received_at);
  const inTransit   = rows.filter(r => r.status === 'processing' || r.status === 'shipped');
  // Booked but not yet dispatched: nothing is with the courier, so there is
  // no receivable yet — but the money is real pipeline and the owner should
  // see it (esp. during a sale when the confirmation backlog grows).
  const awaitingConfirm = rows.filter(r => r.status === 'pending' || r.status === 'confirmed');
  // Vendor-held cash: delivered vendor-collected COD the vendor is sitting
  // on. It used to be a footnote only — PKR 14k+ of real money rendering as
  // "All caught up" — so it gets its own card. NOT the whole excluded list:
  // processing/shipped vendor orders aren't held cash yet.
  const vendorHeld = excludedVendorCollected.filter(r => r.status === 'delivered' && !r.payment_received_at);
  const sum = (list: CodOrder[]) => list.reduce((s, r) => s + Number(r.total ?? 0), 0);

  // The "Delivered" column needs the actual delivery date so aging is honest —
  // the row's created_at is when the order was PLACED, which can be weeks
  // earlier and made cash look older than it is. Derive it from the earliest
  // status transition into 'delivered' in the order timeline; fall back to the
  // placed date only when no delivered event exists.
  const deliveredAt = new Map<string, string>();
  if (outstanding.length > 0) {
    const { data: evts } = await admin
      .from('order_events')
      .select('order_id, created_at')
      .eq('to_status', 'delivered')
      .in('order_id', outstanding.map(r => r.id))
      .order('created_at', { ascending: true });
    for (const e of (evts ?? []) as Array<{ order_id: string; created_at: string }>) {
      if (!deliveredAt.has(e.order_id)) deliveredAt.set(e.order_id, e.created_at);
    }
  }

  const card: React.CSSProperties = { background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: '24px' };
  const dlIcon = (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
  const dlLink: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8125rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <FinanceTabs active="cod" params={{ range: rangeParam, method: methodParam }} codBadge={outstanding.length} />
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6, gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>COD reconciliation</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <a href="/admin/finance/cod/export" style={dlLink}>Download CSV {dlIcon}</a>
          {outstanding.length > 0 && (
            <a href="/admin/finance/cod/export?outstanding=1" style={dlLink}>To-collect only {dlIcon}</a>
          )}
        </div>
      </div>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Cash-on-delivery money owed and collected. Mark a payment received on each order&apos;s page; it then moves from
        Outstanding to Collected here.
        {excludedVendorCollected.length > 0 && (
          <> {excludedVendorCollected.length} vendor-collected COD order{excludedVendorCollected.length === 1 ? '' : 's'} not shown — that
          cash is held by the vendor and settles on the <Link href="/admin/vendors" style={{ color: '#C5286A', fontWeight: 600 }}>Vendors page</Link>.</>
        )}
      </p>

      {/* Cash pipeline: where every booked COD rupee currently sits, left to
          right in the order it moves. Answers "where is my cash" at a glance
          for a store that is 17-of-18 COD. */}
      <div style={{ ...card, marginBottom: 16, padding: '18px 24px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Where the COD cash is</h2>
        <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {[
            { label: 'Booked · awaiting confirmation', list: awaitingConfirm, color: '#6b7280', note: 'with the customer, not dispatched yet' },
            { label: 'In transit · with the courier', list: inTransit, color: '#2563eb', note: 'being prepared or out for delivery' },
            { label: 'Delivered · cash to confirm', list: outstanding, color: '#b45309', note: 'collected by the rider, not marked received' },
            { label: 'In the bank · reconciled', list: collected, color: '#15803d', note: 'payment recorded on the order' },
          ].map(stage => (
            <div key={stage.label} style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8 }}>
              <div style={{ fontSize: '0.6875rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{stage.label}</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, color: stage.color, fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmt(sum(stage.list))}</div>
              <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>{stage.list.length} order{stage.list.length === 1 ? '' : 's'} · {stage.note}</div>
            </div>
          ))}
        </div>
        {vendorHeld.length > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: '0.8125rem', color: '#6b7280' }}>
            Separately, <strong style={{ color: '#7c3aed' }}>{fmt(sum(vendorHeld))}</strong> across {vendorHeld.length} delivered order{vendorHeld.length === 1 ? '' : 's'} is held by the vendor and settles on the <Link href="/admin/vendors" style={{ color: '#C5286A', fontWeight: 600 }}>Vendors page</Link> — it never passes through the store&apos;s courier account.
          </p>
        )}
      </div>

      <div style={card}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Outstanding, delivered, not yet confirmed</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          These parcels were delivered but the cash hasn&apos;t been marked received. Open each to record payment.
        </p>
        {outstanding.length === 0 ? (
          <div style={{ padding: '28px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            All caught up, every delivered store-collected COD order is reconciled.
            {vendorHeld.length > 0 && (
              <> Note: {fmt(sum(vendorHeld))} across {vendorHeld.length} order{vendorHeld.length === 1 ? '' : 's'} is still held by the vendor (card above), settling via the Vendors page.</>
            )}
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
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
                  <td data-label="Order" style={{ padding: '10px 12px', fontFamily: 'monospace', fontWeight: 600 }}>{r.order_number}</td>
                  <td data-label="Customer" style={{ padding: '10px 12px', color: '#374151' }}>{[r.first_name, r.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td data-label="Delivered" style={{ padding: '10px 12px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {deliveredAt.has(r.id)
                      ? fmtDatePK(deliveredAt.get(r.id)!)
                      : <span title="No delivery date recorded; showing order-placed date">{fmtDatePK(r.created_at)}*</span>}
                  </td>
                  <td data-label="Amount" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt(r.total ?? 0)}</td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <Link href={`/admin/orders/${r.id}`} style={{ color: '#C5286A', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600 }}>Record →</Link>
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
