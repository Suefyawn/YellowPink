'use client';
import { useState, useTransition } from 'react';
import { resendOrderConfirmation } from '@/app/admin/actions';

// "Customer says they didn't get the email" is one of the most common
// support tickets. One tap re-sends the same order confirmation; the
// resend is logged in the order's audit trail.
export function ResendConfirmationButton({ orderId, hasEmail }: { orderId: string; hasEmail: boolean }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  if (!hasEmail) return null;

  const onClick = () => {
    setMsg(null); setErr(null);
    startTransition(async () => {
      const res = await resendOrderConfirmation(orderId);
      if (res.error) setErr(res.error);
      else setMsg('Sent ✓');
    });
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        style={{
          padding: '6px 12px', background: 'white', border: '1px solid #d1d5db',
          borderRadius: 6, fontSize: '0.8125rem', color: '#374151', cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? 0.6 : 1,
        }}
      >
        {pending ? 'Sending…' : 'Resend confirmation email'}
      </button>
      {msg && <span style={{ fontSize: '0.75rem', color: '#15803d', fontWeight: 600 }}>{msg}</span>}
      {err && <span role="alert" style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{err}</span>}
    </span>
  );
}
