'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { approveReturn, rejectReturn, markReturnReceived, markReturnRefunded } from '@/app/account/orders/returns/actions';
import { useToast } from '@/components/admin/Toast';
import { DotChip } from '@/components/admin/OrderChips';
import { PK_TZ } from '@/lib/dates';

interface ReturnRow {
  id: string;
  order_id: string;
  user_id: string | null;
  email: string | null;
  reason: string;
  items: { product_id: string; qty: number; name: string; price: number }[];
  status: 'pending' | 'approved' | 'rejected' | 'received' | 'refunded' | 'cancelled';
  refund_amount: number | null;
  refund_method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct' | null;
  admin_note: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  pending: '#b45309', approved: '#15803d', rejected: '#b91c1c',
  received: '#2563eb', refunded: '#15803d', cancelled: '#6b7280',
};

// Human labels for refund_method, used in the refund confirmation prompt.
const REFUND_METHOD_LABELS: Record<string, string> = {
  store_credit: 'store credit', coupon: 'a coupon code',
  original: 'the original payment method', cod_deduct: 'a COD deduction',
};

export function ReturnsQueue({ rows, orderMap, canManage }: {
  rows: ReturnRow[];
  orderMap: Record<string, { order_number: string; first_name: string; last_name: string; total: number }>;
  /** Whether the viewer can act on returns (owner / returns / orders.edit).
   *  A read-only viewer (e.g. orders.view) sees the queue without the
   *  decision controls, so they never hit an action that would 500. */
  canManage: boolean;
}) {
  const [acting, startTransition] = useTransition();
  const toast = useToast();
  const [decisionFor, setDecisionFor] = useState<string | null>(null);
  const [rejectingFor, setRejectingFor] = useState<string | null>(null);

  if (rows.length === 0) {
    return (
      <div style={{ padding: 48, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', textAlign: 'center', color: '#9ca3af' }}>
        No return requests yet.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {rows.map(r => {
        const order = orderMap[r.order_id];
        const requestedAmount = r.items.reduce((s, i) => s + i.price * i.qty, 0);
        const isOpen = decisionFor === r.id;
        const isRejecting = rejectingFor === r.id;
        return (
          <div key={r.id} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <Link href={`/admin/orders/${r.order_id}`} style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9375rem', color: '#111827', textDecoration: 'none' }}>
                  {order?.order_number ?? r.order_id.slice(0, 8)}
                </Link>
                <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                  {order ? `${order.first_name} ${order.last_name}` : '—'} · {new Date(r.created_at).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ })}
                  {r.email && <> · {r.email}</>}
                </div>
              </div>
              <DotChip
                label={r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                color={STATUS_COLOR[r.status] ?? '#6b7280'}
              />
            </div>

            <div style={{ marginTop: 12, fontSize: '0.875rem', color: '#374151' }}>
              <strong>Reason:</strong> {r.reason}
            </div>

            {/* No .adm-table-scroll wrapper: globals gives scrolled tables a
                480px floor which clipped the amounts on phones. This 3-column
                table fits any viewport, item names simply wrap. */}
            <table style={{ width: '100%', marginTop: 10, borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <th scope="col" style={{ padding: '6px 0', textAlign: 'left', color: '#6b7280', fontWeight: 600 }}>Item</th>
                  <th scope="col" style={{ padding: '6px 0', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Qty</th>
                  <th scope="col" style={{ padding: '6px 0', textAlign: 'right', color: '#6b7280', fontWeight: 600 }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {r.items.map((it, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '6px 0' }}>{it.name}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>{it.qty}</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>PKR {(it.qty * it.price).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* The requested total lives outside the item table so it wraps
                on narrow screens instead of being clipped in the scroller. */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 12px',
              borderTop: '1px solid #e5e7eb', marginTop: 2, padding: '8px 0',
              fontSize: '0.8125rem', fontWeight: 700,
            }}>
              <span>Requested refund</span>
              <span>PKR {requestedAmount.toLocaleString()}</span>
            </div>

            {r.admin_note && (
              <div style={{ marginTop: 10, padding: '8px 12px', background: '#f9fafb', borderRadius: 6, fontSize: '0.75rem', color: '#374151' }}>
                <strong>Admin note:</strong> {r.admin_note}
              </div>
            )}

            {canManage && r.status === 'approved' && (
              <div className="adm-return-actions" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {/* "Mark as received" restocks the items via the inventory
                    ledger (record_stock_change reason='return'). This is the
                    bridge that closes the place_order → return loop. */}
                <button
                  onClick={() => {
                    if (!window.confirm('Mark this return as received and restock the items?')) return;
                    startTransition(async () => {
                      const res = await markReturnReceived(r.id);
                      if ('success' in res && res.success) toast('Return marked received, stock restored', 'success');
                      else toast(('error' in res && res.error) ? res.error : 'Failed', 'error');
                    });
                  }}
                  disabled={acting}
                  style={{ padding: '6px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark as received & restock
                </button>
              </div>
            )}

            {canManage && r.status === 'received' && (
              <div className="adm-return-actions" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {/* Final lifecycle step: the refund has actually been paid
                    out. Moves the request to `refunded` and the linked order
                    to `refunded` so its revenue drops out of Finance. */}
                <button
                  onClick={() => {
                    const amount = r.refund_amount != null ? `PKR ${Number(r.refund_amount).toLocaleString()}` : 'the agreed amount';
                    const method = r.refund_method ? (REFUND_METHOD_LABELS[r.refund_method] ?? r.refund_method) : 'the agreed method';
                    if (!window.confirm(`Mark this return as refunded? Confirms ${amount} was refunded via ${method}, and marks the order refunded.`)) return;
                    startTransition(async () => {
                      const res = await markReturnRefunded(r.id);
                      if ('success' in res && res.success) toast('Return marked refunded', 'success');
                      else toast(('error' in res && res.error) ? res.error : 'Failed', 'error');
                    });
                  }}
                  disabled={acting}
                  style={{ padding: '6px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  Mark as refunded
                </button>
              </div>
            )}

            {canManage && r.status === 'pending' && (
              <div className="adm-return-actions" style={{ marginTop: 14, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {isOpen ? (
                  <ApproveForm
                    requestedAmount={requestedAmount}
                    onCancel={() => setDecisionFor(null)}
                    onApprove={(amt, method, note) => {
                      startTransition(async () => {
                        const res = await approveReturn({ id: r.id, refund_amount: amt, refund_method: method, admin_note: note || undefined });
                        if ('success' in res && res.success) {
                          toast('Return approved', 'success');
                          setDecisionFor(null);
                        } else {
                          toast(('error' in res && res.error) ? res.error : 'Failed', 'error');
                        }
                      });
                    }}
                  />
                ) : isRejecting ? (
                  <RejectForm
                    busy={acting}
                    onCancel={() => setRejectingFor(null)}
                    onReject={note => {
                      startTransition(async () => {
                        const res = await rejectReturn(r.id, note);
                        if ('success' in res && res.success) {
                          toast('Return rejected', 'success');
                          setRejectingFor(null);
                        } else {
                          toast(('error' in res && res.error) ? res.error : 'Failed', 'error');
                        }
                      });
                    }}
                  />
                ) : (
                  <>
                    <button
                      onClick={() => { setRejectingFor(null); setDecisionFor(r.id); }}
                      style={{ padding: '6px 14px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Approve…
                    </button>
                    <button
                      onClick={() => { setDecisionFor(null); setRejectingFor(r.id); }}
                      disabled={acting}
                      style={{ padding: '6px 14px', background: 'transparent', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Reject…
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ApproveForm({
  requestedAmount, onCancel, onApprove,
}: {
  requestedAmount: number;
  onCancel: () => void;
  onApprove: (amt: number, method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct', note: string) => void;
}) {
  const [amount, setAmount] = useState<number>(requestedAmount);
  const [method, setMethod] = useState<'store_credit' | 'coupon' | 'original' | 'cod_deduct'>('store_credit');
  const [note, setNote]     = useState('');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: '#f9fafb', padding: 10, borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <label style={{ fontSize: '0.75rem', color: '#374151' }}>Refund (PKR)</label>
      <input
        type="number" min={0}
        value={amount}
        onChange={e => setAmount(Math.max(0, Number(e.target.value)))}
        style={{ width: 90, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem' }}
      />
      <select
        value={method}
        onChange={e => setMethod(e.target.value as typeof method)}
        style={{ padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem' }}
      >
        <option value="store_credit">Store credit (loyalty)</option>
        <option value="coupon">Coupon code</option>
        <option value="original">Refund original method</option>
        <option value="cod_deduct">Deduct from COD</option>
      </select>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        placeholder="Note (optional)"
        style={{ flex: 1, minWidth: 120, padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.8125rem' }}
      />
      <button onClick={() => onApprove(amount, method, note)}
        style={{ padding: '5px 12px', background: '#16a34a', color: 'white', border: 'none', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
        Confirm
      </button>
      <button onClick={onCancel}
        style={{ padding: '5px 10px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  );
}

// Inline reject panel, replaces the bare window.prompt with an on-brand
// textarea (optional reason) so the reason is visible while typing and the
// flow matches the approve panel.
function RejectForm({
  busy, onCancel, onReject,
}: {
  busy: boolean;
  onCancel: () => void;
  onReject: (note: string) => void;
}) {
  const [note, setNote] = useState('');
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', background: '#fef2f2', padding: 10, borderRadius: 6, border: '1px solid #fecaca' }}>
      <input
        value={note}
        onChange={e => setNote(e.target.value)}
        maxLength={500}
        placeholder="Reason for rejection (optional, shared with the customer)"
        autoFocus
        style={{ flex: 1, minWidth: 160, padding: '5px 8px', border: '1px solid #fca5a5', borderRadius: 4, fontSize: '0.8125rem' }}
      />
      <button onClick={() => onReject(note)} disabled={busy}
        style={{ padding: '5px 12px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, cursor: busy ? 'not-allowed' : 'pointer' }}>
        Confirm reject
      </button>
      <button onClick={onCancel}
        style={{ padding: '5px 10px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.75rem', cursor: 'pointer' }}>
        Cancel
      </button>
    </div>
  );
}
