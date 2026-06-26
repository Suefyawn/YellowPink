'use client';
import { useActionState, useEffect } from 'react';
import { updateOrderStatus } from '@/app/admin/actions';
import { useToast } from '@/components/admin/Toast';
import { ORDER_STATUS_LABELS, type OrderStatus } from '@/types';

// Drive the dropdown off the shared label map so it can't drift from the
// timeline / Orders list / Analytics, those showed "Order received" /
// "Preparing" while this select said "Pending" / "Processing".
const STATUSES: { value: OrderStatus; label: string }[] =
  (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[])
    .map(value => ({ value, label: ORDER_STATUS_LABELS[value] }));

const statusColors: Record<OrderStatus, string> = {
  payment_pending: '#9ca3af',
  payment_failed:  '#c43838',
  pending:         '#9a6407',
  processing:      '#1d4ed8',
  shipped:         '#6d28d9',
  delivered:       '#0b7e58',
  cancelled:       '#c43838',
  returned:        '#6b7280',
  refunded:        '#6b7280',
};

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};

export function OrderStatusForm({ orderId, currentStatus }: {
  orderId: string;
  currentStatus: OrderStatus;
}) {
  const bound = updateOrderStatus.bind(null, orderId);
  const [state, action, pending] = useActionState(bound, null);
  const toast = useToast();

  useEffect(() => {
    if (state?.success) toast('Order updated successfully');
    if (state?.error) toast(state.error, 'error');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <label htmlFor="status" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
          Order Status
        </label>
        {/* key on currentStatus so the uncontrolled select re-mounts and
            picks up the new defaultValue after a status change is saved,             otherwise the dropdown drifts out of sync with the order. */}
        <select id="status" key={currentStatus} name="status" defaultValue={currentStatus} style={{ ...inp }}>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
        Tracking number &amp; courier are managed in the Shipment section above.
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '9px 20px',
            background: pending ? '#9ca3af' : '#C5286A',
            color: 'white', border: 'none', borderRadius: 7,
            fontSize: '0.875rem', fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Update Order'}
        </button>
        {state?.success && (
          <span style={{ fontSize: '0.875rem', color: '#0b7e58', fontWeight: 500 }}>✓ Saved</span>
        )}
        {state?.error && (
          <span style={{ fontSize: '0.875rem', color: '#c43838' }}>{state.error}</span>
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Current: </span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600,
          color: statusColors[currentStatus] ?? '#374151',
        }}>
          {ORDER_STATUS_LABELS[currentStatus] ?? currentStatus}
        </span>
      </div>
    </form>
  );
}
