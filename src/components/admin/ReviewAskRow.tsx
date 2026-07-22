'use client';

// One review-ask row: opens the personalised WhatsApp review request in a
// new tab AND records the ask on the order, so nobody gets nudged twice.

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { markReviewAskSent, unmarkReviewAskSent } from '@/app/admin/review-asks/actions';

export interface ReviewAskOrder {
  id: string;
  orderNumber: string;
  name: string;
  phone: string;
  itemsSummary: string;
  deliveredAt: string;     // pre-formatted for display
  emailAsked: boolean;     // automated review-request email already sent
  waSentAt: string | null; // pre-formatted, null = not yet asked
  /** Fully-resolved wa.me URL with the personalised message. */
  waHref: string;
}

export function ReviewAskRow({ c }: { c: ReviewAskOrder }) {
  const [pending, startTransition] = useTransition();
  // Optimistic local state so the row flips instantly; the server row is the
  // source of truth on next render.
  const [sent, setSent] = useState(Boolean(c.waSentAt));

  const send = () => {
    window.open(c.waHref, '_blank', 'noopener');
    setSent(true);
    startTransition(() => { void markReviewAskSent(c.id); });
  };
  const undo = () => {
    setSent(false);
    startTransition(() => { void unmarkReviewAskSent(c.id); });
  };

  return (
    <tr style={{ opacity: sent ? 0.55 : 1 }}>
      {/* data-label: feeds the .adm-table-cards stacked-card mode on phones. */}
      <td data-label="Customer">
        <div style={{ fontWeight: 600, color: '#111827' }}>{c.name}</div>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{c.phone}</div>
      </td>
      <td data-label="Order">
        <Link href={`/admin/orders/${c.id}`} style={{ fontWeight: 600, color: '#111827', textDecoration: 'underline', textUnderlineOffset: 2 }}>
          {c.orderNumber}
        </Link>
        <div style={{ fontSize: '0.75rem', color: '#9ca3af', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {c.itemsSummary}
        </div>
      </td>
      <td data-label="Delivered" style={{ whiteSpace: 'nowrap' }}>{c.deliveredAt}</td>
      <td data-label="Email">
        <span style={{ fontSize: '0.75rem', color: c.emailAsked ? '#374151' : '#9ca3af' }}>
          {c.emailAsked ? 'emailed' : 'not emailed'}
        </span>
      </td>
      <td data-label="Outreach" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {sent ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>
              Asked{c.waSentAt ? ` · ${c.waSentAt}` : ''}
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
