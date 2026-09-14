'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { confirmOrderAction, type ConfirmResult } from './actions';

/** The confirm button and the three states it can land in. Kept client-side so
 *  the confirmation happens on an explicit press (see the note in page.tsx
 *  about email scanners following links). */
export function ConfirmPanel({ orderNumber, token }: { orderNumber: string; token: string }) {
  const [result, setResult] = useState<ConfirmResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) {
    return (
      <>
        <div aria-hidden="true" style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>
          <CheckMark />
        </div>
        <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
          {result.already ? 'Already confirmed' : 'Order confirmed'}
        </h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 24px' }}>
          {result.already
            ? <>Order <strong>{orderNumber}</strong> was already confirmed. Nothing else is needed from you.</>
            : <>Thank you. Order <strong>{orderNumber}</strong> is confirmed and goes into dispatch. You will get an email when it ships.</>}
        </p>
        <Link href={`/track?order=${encodeURIComponent(orderNumber)}`} className="btn-primary" style={{ textDecoration: 'none' }}>
          Track your order
        </Link>
      </>
    );
  }

  const failed = result && !result.ok;

  return (
    <>
      <h1 className="display-l" style={{ fontSize: '2rem', margin: '0 0 12px' }}>
        Confirm order {orderNumber}
      </h1>
      <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 24px' }}>
        Press the button and we will pack and dispatch your order. Cash on delivery, so you
        pay the rider when it arrives. Nothing is charged now.
      </p>

      {failed && (
        <p
          role="alert"
          className="body-text"
          style={{ color: 'var(--ink-700)', margin: '0 0 16px', fontSize: 14 }}
        >
          {result.reason === 'not_found'
            ? 'We could not find that order. Please message us and we will sort it out.'
            : 'That did not go through. Please try again, or message us on WhatsApp.'}
        </p>
      )}

      <button
        type="button"
        className="btn-primary"
        disabled={pending}
        onClick={() => startTransition(async () => {
          setResult(await confirmOrderAction(orderNumber, token));
        })}
      >
        {pending ? 'Confirming…' : 'Yes, confirm my order'}
      </button>

      <p style={{ margin: '20px 0 0', fontSize: 14 }}>
        <a href={`/go/whatsapp?src=confirm-page&p=${encodeURIComponent(orderNumber)}`} className="underline">
          Something is wrong with this order
        </a>
      </p>
    </>
  );
}

function CheckMark() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#16a34a' }}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
