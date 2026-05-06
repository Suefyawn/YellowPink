'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 24px' }}>
      <div style={{ textAlign: 'center', maxWidth: 480 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '5rem', fontWeight: 500, color: 'var(--brand-pink)', lineHeight: 1, marginBottom: 16 }}>
          Oops
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink-900)', margin: '0 0 12px' }}>
          Something went wrong
        </h1>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 32px', lineHeight: 1.6 }}>
          An unexpected error occurred. Our team has been notified.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={reset} style={{
            padding: '11px 24px', background: 'var(--brand-pink)', color: 'white',
            border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Try again
          </button>
          <Link href="/" style={{
            padding: '11px 24px', background: 'white', color: 'var(--ink-700)',
            border: '1px solid var(--line)', borderRadius: 8, fontSize: '0.9375rem',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center',
          }}>
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
