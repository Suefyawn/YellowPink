'use client';

import { useState } from 'react';
import { createReturnForOrder } from '@/app/admin/orders/return-actions';

// Staff files a return on the customer's behalf (phoned-in / WhatsApp
// returns; most buyers are guests with no account to self-serve from).
// Collapsed to a button until needed; the form lists the order's lines with
// a quantity each, plus the reason the customer gave.

export interface ReturnableLine {
  index: number;
  name: string;
  qty: number;
}

const inp: React.CSSProperties = {
  padding: '7px 9px', border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: '0.8125rem', background: 'white', boxSizing: 'border-box',
};

export function OrderCreateReturn({ orderId, lines }: { orderId: string; lines: ReturnableLine[] }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{
        padding: '7px 14px', background: 'white', color: '#C5286A',
        border: '1px solid #C5286A', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
      }}>
        Create return
      </button>
    );
  }

  return (
    <form action={createReturnForOrder.bind(null, orderId)} style={{ marginTop: 10, padding: '12px 14px', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 8 }}>
      <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#6b7280' }}>
        Files the request in the Returns queue on the customer&apos;s behalf, same lifecycle as a
        self-service return (approve, receive &amp; restock, refund).
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
        {lines.map(l => {
          const on = picked[l.index] != null;
          return (
            <label key={l.index} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#111827' }}>
              <input
                type="checkbox"
                checked={on}
                onChange={e => {
                  setPicked(prev => {
                    const next = { ...prev };
                    if (e.target.checked) next[l.index] = l.qty; else delete next[l.index];
                    return next;
                  });
                }}
              />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
              {on && l.qty > 1 && (
                <select
                  value={picked[l.index]}
                  onChange={e => setPicked(prev => ({ ...prev, [l.index]: Number(e.target.value) }))}
                  style={{ ...inp, padding: '4px 6px' }}
                >
                  {Array.from({ length: l.qty }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>{n} of {l.qty}</option>
                  ))}
                </select>
              )}
              {on && <input type="hidden" name={`ret__${l.index}__qty`} value={picked[l.index]} />}
            </label>
          );
        })}
      </div>
      <input
        name="reason" required minLength={5} maxLength={1000}
        placeholder="Why is it coming back? e.g. Wrong shade, customer wants to exchange"
        style={{ ...inp, width: '100%', marginBottom: 10 }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="submit" style={{ padding: '7px 16px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
          File return
        </button>
        <button type="button" onClick={() => setOpen(false)} style={{ padding: '7px 12px', background: 'transparent', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer' }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
