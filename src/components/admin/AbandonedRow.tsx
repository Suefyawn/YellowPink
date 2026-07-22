'use client';

// One abandoned-checkout row: opens the personalised WhatsApp message in a
// new tab AND records the nudge on the cart row, so nobody gets messaged
// twice whichever staff member or device does the sending.

import { useState, useTransition } from 'react';
import { markWaSent, unmarkWaSent, dismissCart } from '@/app/admin/abandoned/actions';

export interface AbandonedCartRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  itemsSummary: string;
  itemCount: number;
  subtotal: number;
  abandonedAt: string;      // pre-formatted for display
  emailTier: number;        // 0-3 automated reminder emails already sent
  waSentAt: string | null;  // pre-formatted, null = not yet nudged
  /** Fully-resolved wa.me URL with the personalised message. */
  waHref: string;
}

const fmt = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

export function AbandonedRow({ c }: { c: AbandonedCartRow }) {
  const [pending, startTransition] = useTransition();
  // Optimistic local state so the row flips instantly; the server row is the
  // source of truth on next render.
  const [sent, setSent] = useState(Boolean(c.waSentAt));
  const [dismissed, setDismissed] = useState(false);

  const send = () => {
    window.open(c.waHref, '_blank', 'noopener');
    setSent(true);
    startTransition(() => { void markWaSent(c.id); });
  };
  const undo = () => {
    setSent(false);
    startTransition(() => { void unmarkWaSent(c.id); });
  };
  const dismiss = () => {
    setDismissed(true);
    startTransition(() => { void dismissCart(c.id); });
  };

  if (dismissed) return null;

  return (
    <tr style={{ opacity: sent ? 0.55 : 1 }}>
      {/* data-label: feeds the .adm-table-cards stacked-card mode on phones. */}
      <td data-label="Shopper">
        <div style={{ fontWeight: 600, color: '#111827' }}>{c.name}</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{c.phone}{c.email ? ` · ${c.email}` : ''}</div>
      </td>
      <td data-label="Cart">
        <div style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.itemsSummary}</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{c.itemCount} item{c.itemCount === 1 ? '' : 's'} · {fmt(c.subtotal)}</div>
      </td>
      <td data-label="Abandoned" style={{ whiteSpace: 'nowrap' }}>{c.abandonedAt}</td>
      <td data-label="Emails">
        <span style={{ fontSize: '0.75rem', color: c.emailTier > 0 ? '#374151' : '#9ca3af' }}>
          {c.email === null ? 'no email' : c.emailTier === 0 ? 'none yet' : `${c.emailTier} of 3 sent`}
        </span>
      </td>
      <td data-label="Outreach" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {sent ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
              Messaged{c.waSentAt ? ` · ${c.waSentAt}` : ''}
            </span>
            <button type="button" className="adm-btn adm-btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }} onClick={undo} disabled={pending}>
              Undo
            </button>
          </span>
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <button
              type="button"
              className="adm-btn adm-btn-primary"
              style={{ padding: '5px 14px', fontSize: '0.8125rem' }}
              onClick={send}
              disabled={pending}
            >
              Open in WhatsApp
            </button>
            <button
              type="button"
              className="adm-btn adm-btn-secondary"
              title="Remove from this queue without messaging"
              style={{ padding: '5px 10px', fontSize: '0.75rem' }}
              onClick={dismiss}
              disabled={pending}
            >
              Dismiss
            </button>
          </span>
        )}
      </td>
    </tr>
  );
}
