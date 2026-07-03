import { ORDER_STATUS_LABELS } from '@/types';
import type { OrderStatus } from '@/types';

// Single source of truth for order-status colours across the admin. Covers
// EVERY OrderStatus (typed as Record<OrderStatus, string> so a new status
// fails the build until it gets a colour). Palette based on the dashboard's
// map, which was the only one that covered the full lifecycle; the old
// per-page copies (orders table, order detail, customer detail) each carried
// a divergent five-status subset and fell back to grey for the rest.
export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  payment_pending: '#9ca3af',
  payment_failed:  '#e11d48',
  pending:         '#f59e0b',
  processing:      '#3b82f6',
  shipped:         '#8b5cf6',
  delivered:       '#10b981',
  cancelled:       '#ef4444',
  returned:        '#64748b',
  refunded:        '#a855f7',
};

/** Colour for a status, grey fallback for unknown/legacy values. */
export function orderStatusColor(status: string): string {
  return ORDER_STATUS_COLORS[status as OrderStatus] ?? '#6b7280';
}

/** The one order-status pill. Labels come from ORDER_STATUS_LABELS so this
 *  can never drift from the other status surfaces. No 'use client': it's a
 *  plain presentational component usable from server and client components. */
export function OrderStatusBadge({ status }: { status: string }) {
  const color = orderStatusColor(status);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 20,
      fontSize: '0.75rem', fontWeight: 600,
      background: color + '20',
      color,
    }}>
      {ORDER_STATUS_LABELS[status as OrderStatus] ?? status}
    </span>
  );
}
