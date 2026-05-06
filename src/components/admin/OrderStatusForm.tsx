'use client';
import { useActionState, useEffect } from 'react';
import { updateOrderStatus } from '@/app/admin/actions';
import { useToast } from '@/components/admin/Toast';
import type { OrderStatus } from '@/types';

const STATUSES: { value: OrderStatus; label: string }[] = [
  { value: 'pending',    label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped',    label: 'Shipped' },
  { value: 'delivered',  label: 'Delivered' },
  { value: 'cancelled',  label: 'Cancelled' },
];

const statusColors: Record<OrderStatus, string> = {
  pending:    '#f59e0b',
  processing: '#3b82f6',
  shipped:    '#8b5cf6',
  delivered:  '#10b981',
  cancelled:  '#ef4444',
};

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};

export function OrderStatusForm({ orderId, currentStatus, currentTracking }: {
  orderId: string;
  currentStatus: OrderStatus;
  currentTracking: string | null;
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
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
          Order Status
        </label>
        <select name="status" defaultValue={currentStatus} style={{ ...inp }}>
          {STATUSES.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
          Tracking Number
        </label>
        <input
          name="tracking_number"
          defaultValue={currentTracking ?? ''}
          placeholder="e.g. TCS-1234567"
          style={inp}
        />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '9px 20px',
            background: pending ? '#9ca3af' : '#ec4899',
            color: 'white', border: 'none', borderRadius: 7,
            fontSize: '0.875rem', fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : 'Update Order'}
        </button>
        {state?.success && (
          <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: 500 }}>✓ Saved</span>
        )}
        {state?.error && (
          <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>{state.error}</span>
        )}
      </div>
      <div style={{ marginTop: 4 }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>Current: </span>
        <span style={{
          fontSize: '0.75rem', fontWeight: 600,
          color: statusColors[currentStatus] ?? '#374151',
          textTransform: 'capitalize',
        }}>
          {currentStatus}
        </span>
      </div>
    </form>
  );
}
