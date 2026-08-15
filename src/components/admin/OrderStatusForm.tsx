'use client';
import { useActionState, useEffect, useState } from 'react';
import { updateOrderStatus, cancelOrder } from '@/app/admin/actions';
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

// Shopify's cancellation reasons, trimmed to what fits this store. Keys must
// stay in sync with ORDER_CANCEL_REASONS in app/admin/actions.ts.
const CANCEL_REASONS: { value: string; label: string }[] = [
  { value: 'customer',  label: 'Customer changed their mind' },
  { value: 'declined',  label: 'Payment declined' },
  { value: 'fraud',     label: 'Fraudulent order' },
  { value: 'inventory', label: 'Items unavailable' },
  { value: 'staff',     label: 'Staff error' },
  { value: 'other',     label: 'Other' },
];

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};

const checkRow: React.CSSProperties = {
  display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer',
  padding: '10px 12px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f9fafb',
};

/** Shopify-style cancel-order dialog: reason, restock toggle, notify toggle.
 *  Opened when the status select is submitted as Cancelled; the actual
 *  cancellation runs through the dedicated cancelOrder action, never the
 *  plain status update. */
function CancelOrderDialog({ orderId, hasEmail, onClose }: {
  orderId: string;
  hasEmail: boolean;
  onClose: () => void;
}) {
  const bound = cancelOrder.bind(null, orderId);
  const [state, action, pending] = useActionState(bound, null);
  const toast = useToast();

  useEffect(() => {
    if (state?.success) {
      toast('Order cancelled');
      onClose();
    }
    if (state?.error) toast(state.error, 'error');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cancel-order-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(17,24,39,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget && !pending) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: 460,
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 id="cancel-order-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
            Cancel order
          </h3>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280', padding: 4, display: 'flex' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Cancelling drops this order from revenue. This can&apos;t be undone from here.
        </p>

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label htmlFor="cancel-reason" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Reason for cancellation
            </label>
            <select id="cancel-reason" name="reason" defaultValue="customer" style={inp}>
              {CANCEL_REASONS.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <label style={checkRow}>
            <input type="checkbox" name="restock" defaultChecked style={{ marginTop: 2, accentColor: '#C5286A' }} />
            <span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Restock items</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                Return the cancelled quantities to stock through the inventory ledger.
              </span>
            </span>
          </label>

          <label style={{ ...checkRow, opacity: hasEmail ? 1 : 0.6, cursor: hasEmail ? 'pointer' : 'not-allowed' }}>
            <input
              type="checkbox"
              name="notify"
              defaultChecked={hasEmail}
              disabled={!hasEmail}
              style={{ marginTop: 2, accentColor: '#C5286A' }}
            />
            <span>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Send a notification to the customer</span>
              <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                {hasEmail
                  ? 'Emails a branded cancellation notice with the order number.'
                  : 'This order has no email address, so no email can be sent. Tell the customer on WhatsApp instead.'}
              </span>
            </span>
          </label>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              style={{
                padding: '9px 16px', background: 'white', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              Keep order
            </button>
            <button
              type="submit"
              disabled={pending}
              style={{
                padding: '9px 16px', background: pending ? '#9ca3af' : '#C5286A',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Cancelling…' : 'Cancel order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function OrderStatusForm({ orderId, currentStatus, hasEmail = false }: {
  orderId: string;
  currentStatus: OrderStatus;
  /** Whether the order has a customer email — drives the cancel dialog's
   *  "Send a notification to the customer" default. */
  hasEmail?: boolean;
}) {
  const bound = updateOrderStatus.bind(null, orderId);
  const [state, action, pending] = useActionState(bound, null);
  const toast = useToast();
  const [showCancel, setShowCancel] = useState(false);

  useEffect(() => {
    if (state?.success) toast('Order updated successfully');
    if (state?.error) toast(state.error, 'error');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cancelling is not a bare status change: it opens the Shopify-style
  // cancel dialog (reason / restock / notify) instead of submitting, and the
  // dialog's own form runs the dedicated cancelOrder action.
  const interceptCancel = (e: React.FormEvent<HTMLFormElement>) => {
    const sel = (e.currentTarget.elements.namedItem('status') as HTMLSelectElement | null)?.value;
    if (sel === 'cancelled' && currentStatus !== 'cancelled') {
      e.preventDefault();
      setShowCancel(true);
    }
  };

  return (
    <>
    {/* Rendered outside the status <form>: the dialog carries its own form
        and nested forms are invalid HTML (the browser drops the inner one). */}
    {showCancel && (
      <CancelOrderDialog orderId={orderId} hasEmail={hasEmail} onClose={() => setShowCancel(false)} />
    )}
    <form action={action} onSubmit={interceptCancel} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
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
        Choosing Cancelled opens the cancel dialog (reason, restock, customer email).
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
    </>
  );
}
