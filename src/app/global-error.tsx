'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'sans-serif', margin: 0, background: '#faf5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px' }}>
        <div style={{ textAlign: 'center', maxWidth: 400 }}>
          <div style={{ fontSize: '4rem', fontWeight: 700, color: '#E8487F', marginBottom: 16 }}>!</div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', margin: '0 0 12px' }}>Critical error</h1>
          <p style={{ color: '#6b7280', margin: '0 0 28px' }}>The application encountered a critical error.</p>
          <button onClick={reset} style={{
            padding: '11px 24px', background: '#E8487F', color: 'white',
            border: 'none', borderRadius: 8, fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
          }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
