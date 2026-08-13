'use client';

// One broadcast audience row: opens the personalised WhatsApp message in a
// new tab AND records the send in the shared campaign ledger, so no customer
// is messaged twice regardless of which device does the sending. Mirrors
// WinbackRow, with the campaign key passed in rather than baked.

import { useState, useTransition } from 'react';
import { markBroadcastSent, unmarkBroadcastSent } from '@/app/admin/broadcast/actions';

export interface BroadcastCustomer {
  custKey: string;
  name: string;
  phone: string;
  orders: number;
  lastOrderAt: string;   // pre-formatted for display
  sentAt: string | null; // pre-formatted, null = not yet messaged
  /** Fully-resolved wa.me URL with the personalised message. */
  waHref: string;
}

export function BroadcastRow({ c, campaign }: { c: BroadcastCustomer; campaign: string }) {
  const [pending, startTransition] = useTransition();
  const [sent, setSent] = useState(Boolean(c.sentAt));

  const send = () => {
    window.open(c.waHref, '_blank', 'noopener');
    setSent(true);
    startTransition(() => { void markBroadcastSent(campaign, c.custKey); });
  };
  const undo = () => {
    setSent(false);
    startTransition(() => { void unmarkBroadcastSent(campaign, c.custKey); });
  };

  return (
    <tr style={{ borderTop: '1px solid #f3f4f6', opacity: sent ? 0.55 : 1 }}>
      <td data-label="Customer" style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>{c.name}</div>
        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontFamily: 'monospace' }}>{c.phone}</div>
      </td>
      <td data-label="Orders" style={{ padding: '10px 14px', fontSize: '0.8125rem', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{c.orders}</td>
      <td data-label="Last order" style={{ padding: '10px 14px', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>{c.lastOrderAt}</td>
      <td style={{ padding: '10px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
        {sent ? (
          <span style={{ fontSize: '0.75rem', color: '#065f46' }}>
            Messaged{c.sentAt ? ` · ${c.sentAt}` : ''}
            <button onClick={undo} disabled={pending} style={{ marginLeft: 8, background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '0.6875rem', cursor: 'pointer', textDecoration: 'underline' }}>
              undo
            </button>
          </span>
        ) : (
          <button onClick={send} disabled={pending} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#25D366', color: '#fff', border: 'none',
            padding: '7px 14px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Open in WhatsApp
          </button>
        )}
      </td>
    </tr>
  );
}
