'use client';

// One win-back audience row: opens the personalised WhatsApp message in a new
// tab AND records the send in the shared outreach ledger, so no customer is
// messaged twice regardless of which staff member or device does the sending.

import { useState, useTransition } from 'react';
import { markSent, unmarkSent } from '@/app/admin/winback/actions';

export interface WinbackCustomer {
  custKey: string;
  name: string;
  phone: string;
  orders: number;
  revenue: number;
  lastOrderAt: string;      // pre-formatted for display
  lastProduct: string | null;
  segment: string;
  sentAt: string | null;    // pre-formatted, null = not yet messaged
  /** Fully-resolved wa.me URL with the personalised message. */
  waHref: string;
}

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

export function WinbackRow({ c }: { c: WinbackCustomer }) {
  const [pending, startTransition] = useTransition();
  // Optimistic local state so the row flips instantly; the server ledger is
  // the source of truth on next render.
  const [sent, setSent] = useState(Boolean(c.sentAt));

  const send = () => {
    window.open(c.waHref, '_blank', 'noopener');
    setSent(true);
    startTransition(() => { void markSent(c.custKey); });
  };
  const undo = () => {
    setSent(false);
    startTransition(() => { void unmarkSent(c.custKey); });
  };

  return (
    <tr style={{ opacity: sent ? 0.55 : 1 }}>
      {/* data-label: feeds the .adm-table-cards stacked-card mode on phones,
          which prints the column name beside each value. */}
      <td data-label="Customer">
        <div style={{ fontWeight: 600, color: '#111827' }}>{c.name}</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{c.phone}</div>
      </td>
      <td data-label="Segment" style={{ whiteSpace: 'nowrap' }}>{c.segment}</td>
      <td data-label="Orders · Spent" style={{ whiteSpace: 'nowrap' }}>{c.orders} · {fmt(c.revenue)}</td>
      <td data-label="Last order">
        <div style={{ whiteSpace: 'nowrap' }}>{c.lastOrderAt}</div>
        {c.lastProduct && (
          <div style={{ fontSize: '0.75rem', color: '#9ca3af', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.lastProduct}
          </div>
        )}
      </td>
      <td data-label="Outreach" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {sent ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
              Messaged{c.sentAt ? ` · ${c.sentAt}` : ''}
            </span>
            <button type="button" className="adm-btn adm-btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }} onClick={undo} disabled={pending}>
              Undo
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="adm-btn adm-btn-primary"
            style={{ padding: '5px 14px', fontSize: '0.8125rem' }}
            onClick={send}
            disabled={pending}
          >
            Open in WhatsApp
          </button>
        )}
      </td>
    </tr>
  );
}
