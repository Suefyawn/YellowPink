'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { bulkUpdateOrderStatus } from '@/app/admin/actions';
import { useToast } from '@/components/admin/Toast';
import { OrderStatusBadge, ORDER_STATUS_COLORS } from '@/components/admin/OrderStatusBadge';
import { ORDER_STATUS_LABELS, PAY_METHOD_LABELS } from '@/types';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

// Per-status age thresholds (days). The two waiting-on-us-to-confirm statuses
// have different SLAs:
//   • payment_pending, gateway should confirm in seconds; >24h means the
//     callback never came back and the payment likely failed silently.
//     This matches the dashboard "Needs attention" 24h cutoff.
//   • pending, waiting on us to confirm with the customer. Amber after
//     two days, red after five (matches the prior orders-table behaviour).
//   • processing, actively being prepared. Same thresholds as pending.
// Any status not in this map gets no pill (delivered / cancelled / shipped
// already moved past us; flagging their age would be noise).
const AGE_THRESHOLDS: Record<string, { amber: number; red: number; verb: string }> = {
  payment_pending: { amber: 1, red: 3, verb: 'Payment pending' },
  pending:         { amber: 2, red: 5, verb: 'Unconfirmed' },
  processing:      { amber: 2, red: 5, verb: 'Unfulfilled' },
};

// Whole days between then and now. Reads the clock at call time; the table is a
// client component re-rendered on navigation, so this stays roughly current.
function ageDays(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// Amber → red pill for orders aging past the per-status threshold. Returns
// null when there's nothing to flag so fulfilled / fresh orders stay clean.
function AgeFlag({ status, createdAt }: { status: string; createdAt: string | null | undefined }) {
  if (!createdAt) return null;
  const t = AGE_THRESHOLDS[status];
  if (!t) return null;
  const d = ageDays(createdAt);
  if (d < t.amber) return null;
  const urgent = d >= t.red;
  return (
    <span
      title={`${t.verb} for ${d} day${d === 1 ? '' : 's'}`}
      style={{
        marginLeft: 6, padding: '1px 7px', borderRadius: 10, fontSize: '0.6875rem', fontWeight: 700,
        background: urgent ? '#fef2f2' : '#fffbeb',
        color: urgent ? '#b91c1c' : '#b45309',
        whiteSpace: 'nowrap',
      }}
    >
      {d}d
    </span>
  );
}

const payBadge: Record<string, { bg: string; color: string; label: string }> = {
  cod:  { bg: '#fef3c7', color: '#92400e', label: 'COD' },
  card: { bg: '#ede9fe', color: '#5b21b6', label: 'Card' },
  bank: { bg: '#dbeafe', color: '#1e40af', label: 'Bank' },
};

// Labels come from ORDER_STATUS_LABELS and colours from ORDER_STATUS_COLORS
// so the bulk-action and swipe buttons stay in lock-step with every other
// status surface (header badge, timeline, filter pills, invoice). Defining
// a label or colour here would let the surfaces drift.
const BULK_STATUSES: { value: OrderStatus; color: string }[] = [
  { value: 'processing', color: ORDER_STATUS_COLORS.processing },
  { value: 'shipped',    color: ORDER_STATUS_COLORS.shipped },
  { value: 'delivered',  color: ORDER_STATUS_COLORS.delivered },
  { value: 'cancelled',  color: ORDER_STATUS_COLORS.cancelled },
];

// Statuses offered in the per-card swipe panel, the forward fulfilment
// progression. Cancellation stays on the order detail page (destructive).
const QUICK_STATUSES: { value: OrderStatus; color: string }[] =
  BULK_STATUSES.filter(s => s.value !== 'cancelled');

function PayBadge({ method }: { method: string }) {
  // Methods without a bespoke badge colour (JazzCash, Easypaisa, …) fall back
  // to the shared label map rather than showing the raw enum value.
  const badge = payBadge[method] ?? { bg: '#f3f4f6', color: '#374151', label: PAY_METHOD_LABELS[method] ?? method };
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', background: badge.bg, color: badge.color, borderRadius: 20, fontSize: '0.75rem', fontWeight: 600 }}>
      {badge.label}
    </span>
  );
}

export function OrdersTable({ orders }: { orders: Order[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) { next.delete(id); } else { next.add(id); }
    return next;
  });

  const toggleAll = () => setSelected(
    selected.size === orders.length ? new Set() : new Set(orders.map(o => o.id!))
  );

  const bulk = (status: OrderStatus) => {
    if (selected.size === 0) return;
    const count = selected.size;
    // Cancellation is destructive (emails nothing here, but it restocks the
    // items and drops the orders from revenue) — confirm it like delete does.
    if (status === 'cancelled' && !window.confirm(
      `Cancel ${count} selected order${count !== 1 ? 's' : ''}? Their items will be returned to stock.`
    )) return;
    startTransition(async () => {
      const result = await bulkUpdateOrderStatus(Array.from(selected), status);
      if (result.error) {
        toast(`Couldn't update orders: ${result.error}`, 'error');
        return;
      }
      setSelected(new Set());
      toast(`${count} order${count !== 1 ? 's' : ''} marked as ${ORDER_STATUS_LABELS[status]}`, 'success');
    });
  };

  // Per-card quick status change from the swipe panel. Closes the revealed
  // panel by scrolling its card back to the start.
  const quickStatus = (e: React.MouseEvent<HTMLButtonElement>, id: string, status: OrderStatus) => {
    const card = e.currentTarget.closest('.ord-swipe');
    card?.scrollTo({ left: 0, behavior: 'smooth' });
    startTransition(async () => {
      const result = await bulkUpdateOrderStatus([id], status);
      if (result.error) {
        toast(`Couldn't update order: ${result.error}`, 'error');
        return;
      }
      toast(`Order marked as ${ORDER_STATUS_LABELS[status]}`, 'success');
    });
  };

  if (orders.length === 0) {
    return (
      <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
        No orders found
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* ── Desktop: table ── */}
      <table className="adm-orders-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <th scope="col" style={{ padding: '11px 12px', width: 40, textAlign: 'center' }}>
              <input
                type="checkbox"
                checked={selected.size === orders.length && orders.length > 0}
                onChange={toggleAll}
                title="Select all"
                style={{ cursor: 'pointer', accentColor: '#C5286A' }}
              />
            </th>
            {['Order #', 'Customer', 'Total', 'Status', 'Payment', 'Date'].map(h => (
              <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {orders.map((o, i) => {
            const st = o.status ?? 'pending';
            const isSelected = selected.has(o.id!);
            return (
              <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', background: isSelected ? '#fdf2f8' : 'transparent' }}>
                <td style={{ padding: '12px 12px', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(o.id!)}
                    aria-label={`Select order ${o.order_number}`}
                    style={{ cursor: 'pointer', accentColor: '#C5286A' }}
                  />
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#C5286A', textDecoration: 'none', fontFamily: 'monospace' }}>
                    {o.order_number}
                  </Link>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                  {o.first_name} {o.last_name}
                </td>
                <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '0.875rem', color: '#111827', whiteSpace: 'nowrap' }}>
                  {fmt(o.total)}
                </td>
                <td style={{ padding: '12px 16px' }}><OrderStatusBadge status={st} /></td>
                <td style={{ padding: '12px 16px' }}><PayBadge method={o.pay_method} /></td>
                <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                  {o.created_at ? fmtDate(o.created_at) : '—'}
                  <AgeFlag status={st} createdAt={o.created_at} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* ── Mobile: swipe cards. Swipe a card left to reveal quick status
           actions; the card itself still links to the order detail. ── */}
      <div className="adm-orders-cards">
        {orders.map(o => {
          const st = o.status ?? 'pending';
          const isSelected = selected.has(o.id!);
          return (
            <div key={o.id} className="ord-swipe">
              <div className="ord-swipe-face" style={{ background: isSelected ? '#fdf2f8' : 'white' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggle(o.id!)}
                    aria-label={`Select order ${o.order_number}`}
                    style={{ cursor: 'pointer', accentColor: '#C5286A', width: 18, height: 18, flexShrink: 0 }}
                  />
                  <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '1rem', color: '#C5286A', textDecoration: 'none', fontFamily: 'monospace' }}>
                    {o.order_number}
                  </Link>
                  <span style={{ marginLeft: 'auto' }}><OrderStatusBadge status={st} /></span>
                </div>
                <div style={{ fontSize: '0.875rem', color: '#374151', marginBottom: 6 }}>
                  {o.first_name} {o.last_name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>{fmt(o.total)}</span>
                  <PayBadge method={o.pay_method} />
                  <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
                    {o.created_at ? fmtDate(o.created_at) : '—'}
                    <AgeFlag status={st} createdAt={o.created_at} />
                  </span>
                </div>
              </div>
              <div className="ord-swipe-actions" aria-label="Quick status update">
                {QUICK_STATUSES.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={e => quickStatus(e, o.id!, s.value)}
                    disabled={pending || st === s.value}
                    style={{
                      flex: 1, border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
                      background: s.color, color: '#fff',
                      fontSize: '0.75rem', fontWeight: 700, lineHeight: 1.1,
                      opacity: st === s.value ? 0.45 : 1,
                    }}
                  >
                    {ORDER_STATUS_LABELS[s.value]}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="adm-bulk-bar" style={{
          position: 'sticky', bottom: 16, zIndex: 20,
          background: '#111827', borderRadius: 10,
          padding: '12px 20px', margin: '12px 0 0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>
            {selected.size} selected
          </span>
          <span style={{ color: '#6b7280', fontSize: '0.8125rem' }}>Mark as:</span>
          {BULK_STATUSES.map(s => (
            <button key={s.value} onClick={() => bulk(s.value)} disabled={pending} style={{
              padding: '5px 14px', borderRadius: 20, border: 'none', cursor: pending ? 'not-allowed' : 'pointer',
              background: s.color + '30', color: s.color,
              fontSize: '0.8125rem', fontWeight: 600, opacity: pending ? 0.6 : 1,
            }}>
              {pending ? '…' : ORDER_STATUS_LABELS[s.value]}
            </button>
          ))}
          <button onClick={() => setSelected(new Set())} style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
            border: '1px solid #374151', background: 'transparent', color: '#9ca3af',
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
