'use client';

import { useActionState, useEffect, useMemo, useState } from 'react';
import { refundOrder } from '@/app/admin/orders/refund-actions';
import { useToast } from '@/components/admin/Toast';

// Shopify-style refund dialog: the order's lines with quantity steppers, a
// computed subtotal from the selection, an editable refund amount (flat /
// goodwill refunds override the computed figure), restock + notify choices
// and a reason. The actual refund runs through the refundOrder action.

export interface RefundableLine {
  index: number;
  name: string;
  brand: string | null;
  variantLabel: string | null;
  price: number;
  qty: number;
}

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

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

const stepBtn: React.CSSProperties = {
  width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  border: '1px solid #d1d5db', borderRadius: 6, background: 'white', color: '#374151',
  fontSize: '0.9375rem', fontWeight: 700, cursor: 'pointer', lineHeight: 1, padding: 0,
};

function RefundDialog({ orderId, orderNumber, hasEmail, maxRefundable, lines, onClose }: {
  orderId: string;
  orderNumber: string;
  hasEmail: boolean;
  maxRefundable: number;
  lines: RefundableLine[];
  onClose: () => void;
}) {
  const bound = refundOrder.bind(null, orderId);
  const [state, action, pending] = useActionState(bound, null);
  const toast = useToast();

  // qty selected per line index.
  const [picked, setPicked] = useState<Record<number, number>>({});
  // The amount field auto-follows the selection subtotal until the operator
  // types their own figure (flat / goodwill refunds).
  const [amountTouched, setAmountTouched] = useState(false);
  const [amount, setAmount] = useState('');

  const selected = useMemo(
    () => Object.entries(picked)
      .map(([index, qty]) => ({ index: Number(index), qty }))
      .filter(s => s.qty > 0),
    [picked],
  );
  const subtotal = useMemo(
    () => selected.reduce((s, sel) => {
      const line = lines.find(l => l.index === sel.index);
      return s + (line ? line.price * sel.qty : 0);
    }, 0),
    [selected, lines],
  );

  useEffect(() => {
    if (!amountTouched) setAmount(subtotal > 0 ? String(Math.min(subtotal, maxRefundable)) : '');
  }, [subtotal, amountTouched, maxRefundable]);

  useEffect(() => {
    if (state?.success) {
      toast('Refund recorded');
      onClose();
    }
    if (state?.error) toast(state.error, 'error');
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const setQty = (index: number, max: number, next: number) => {
    const qty = Math.max(0, Math.min(max, next));
    setPicked(prev => {
      const copy = { ...prev };
      if (qty === 0) delete copy[index]; else copy[index] = qty;
      return copy;
    });
  };

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0 && amountNum <= maxRefundable + 0.005;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="refund-order-title"
      style={{
        position: 'fixed', inset: 0, zIndex: 60,
        background: 'rgba(17,24,39,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      }}
      onClick={e => { if (e.target === e.currentTarget && !pending) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: 12, width: '100%', maxWidth: 520,
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 50px rgba(0,0,0,0.25)', padding: '20px 22px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
          <h3 id="refund-order-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
            Refund order <span style={{ fontFamily: 'monospace' }}>{orderNumber}</span>
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
        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Select the items being refunded, or enter a flat amount below. Up to {fmt(maxRefundable)} can
          still be refunded on this order. Refunding the full remaining amount marks the order Refunded.
        </p>

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input type="hidden" name="selected" value={JSON.stringify(selected)} />

          {/* Line items with quantity steppers, Shopify's refund line list. */}
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden' }}>
            {lines.map((l, i) => {
              const qty = picked[l.index] ?? 0;
              return (
                <div key={l.index} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
                  borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {l.brand ? `${l.brand} ` : ''}{l.name}{l.variantLabel ? ` (${l.variantLabel})` : ''}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{fmt(l.price)} × {l.qty} ordered</div>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <button type="button" onClick={() => setQty(l.index, l.qty, qty - 1)} disabled={qty === 0} aria-label="Fewer" style={{ ...stepBtn, opacity: qty === 0 ? 0.4 : 1 }}>−</button>
                    <span style={{ minWidth: 42, textAlign: 'center', fontSize: '0.8125rem', color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
                      {qty} / {l.qty}
                    </span>
                    <button type="button" onClick={() => setQty(l.index, l.qty, qty + 1)} disabled={qty >= l.qty} aria-label="More" style={{ ...stepBtn, opacity: qty >= l.qty ? 0.4 : 1 }}>+</button>
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 12px', borderTop: '1px solid #f3f4f6', background: '#f9fafb', fontSize: '0.8125rem' }}>
              <span style={{ color: '#6b7280', fontWeight: 600 }}>Refund subtotal (selected items)</span>
              <span style={{ fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>{fmt(subtotal)}</span>
            </div>
          </div>

          <div>
            <label htmlFor="refund-amount" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Refund amount (PKR)
            </label>
            <input
              id="refund-amount"
              name="amount"
              type="number"
              min={1}
              max={maxRefundable}
              step="any"
              required
              value={amount}
              onChange={e => { setAmountTouched(true); setAmount(e.target.value); }}
              style={inp}
            />
            <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: amount !== '' && !amountValid ? '#b91c1c' : '#6b7280' }}>
              {amount !== '' && !amountValid
                ? `Enter an amount between PKR 1 and ${fmt(maxRefundable)}.`
                : 'Prefilled from the selected items. Change it for a flat or goodwill refund.'}
            </span>
          </div>

          {selected.length > 0 && (
            <label style={checkRow}>
              <input type="checkbox" name="restock" defaultChecked style={{ marginTop: 2, accentColor: '#C5286A' }} />
              <span>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151' }}>Restock items</span>
                <span style={{ display: 'block', fontSize: '0.75rem', color: '#6b7280', marginTop: 2 }}>
                  Return the refunded quantities to stock through the inventory ledger. Untick when the goods stay with the customer.
                </span>
              </span>
            </label>
          )}

          <div>
            <label htmlFor="refund-reason" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Reason for refund
            </label>
            <input
              id="refund-reason"
              name="reason"
              type="text"
              maxLength={500}
              placeholder="e.g. Item arrived damaged"
              style={inp}
            />
            <span style={{ display: 'block', marginTop: 4, fontSize: '0.75rem', color: '#6b7280' }}>
              Only you and other staff can see this reason.
            </span>
          </div>

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
                  ? 'Emails a branded refund notice with the order number, the amount and the refunded items.'
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
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending || !amountValid}
              style={{
                padding: '9px 16px', background: pending || !amountValid ? '#9ca3af' : '#C5286A',
                color: 'white', border: 'none', borderRadius: 7,
                fontSize: '0.8125rem', fontWeight: 600, cursor: pending || !amountValid ? 'not-allowed' : 'pointer',
              }}
            >
              {pending ? 'Refunding…' : amountValid ? `Refund ${fmt(amountNum)}` : 'Refund'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** The Refund button on the order page top bar; opens the dialog above. */
export function OrderRefundButton(props: {
  orderId: string;
  orderNumber: string;
  hasEmail: boolean;
  maxRefundable: number;
  lines: RefundableLine[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '6px 12px', background: 'white', color: '#b91c1c',
          border: '1px solid #fca5a5', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
        Refund
      </button>
      {open && <RefundDialog {...props} onClose={() => setOpen(false)} />}
    </>
  );
}
