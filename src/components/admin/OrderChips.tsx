import { ORDER_STATUS_COLORS } from '@/components/admin/OrderStatusBadge';
import type { Order } from '@/types';

// ── Shopify-style split status chips ─────────────────────────────────────────
// One conflated "status" hid the two questions an operator actually asks:
// "am I paid?" and "has it shipped?". Payment state derives from
// payment_received_at (reconciliation) + the payment-ish statuses;
// fulfilment state derives from the lifecycle status. Soft-tinted dot chips
// (Shopify's visual grammar) instead of saturated pills. Shared by the
// orders list and the dashboard's recent-orders table; server-safe.

export function paymentState(o: Order): { label: string; color: string; solid?: boolean } {
  const st = o.status ?? 'pending';
  if (st === 'refunded') return { label: 'Refunded', color: '#6b7280' };
  if (st === 'payment_failed') return { label: 'Failed', color: '#b91c1c' };
  if (o.payment_received_at) return { label: 'Paid', color: '#15803d' };
  if (st === 'payment_pending') return { label: 'Awaiting gateway', color: '#b45309' };
  if (o.pay_method === 'cod') return { label: 'COD — on delivery', color: '#b45309' };
  return { label: 'Payment pending', color: '#b45309' };
}

export function fulfilmentState(o: Order): { label: string; color: string } {
  const st = o.status ?? 'pending';
  if (st === 'shipped') return { label: 'Shipped', color: ORDER_STATUS_COLORS.shipped ?? '#2563eb' };
  if (st === 'delivered') return { label: 'Delivered', color: ORDER_STATUS_COLORS.delivered ?? '#15803d' };
  if (st === 'cancelled') return { label: 'Cancelled', color: ORDER_STATUS_COLORS.cancelled ?? '#6b7280' };
  if (st === 'returned') return { label: 'Returned', color: '#6b7280' };
  if (st === 'refunded') return { label: 'Refunded', color: '#6b7280' };
  return { label: 'Unfulfilled', color: '#b45309' };
}

export function DotChip({ label, color, title }: { label: string; color: string; title?: string }) {
  return (
    <span title={title} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap',
      background: color + '14', color,
      fontSize: '0.75rem', fontWeight: 600,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />
      {label}
    </span>
  );
}

export const itemCount = (o: Order): number =>
  Array.isArray(o.items) ? o.items.reduce((s, it) => s + (Number((it as { qty?: number }).qty) || 0), 0) : 0;
