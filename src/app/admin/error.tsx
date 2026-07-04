'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/lib/monitoring';
import { isDeploySkewError, reloadOnceForDeploySkew } from '@/lib/stale-action';

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // A chunk/module load failure or stale Server Action means the tab (or an
    // installed admin PWA) is on an old build after a deploy — "white screen no
    // matter where I click". Hard-reload once to pull the current build; the
    // shared guard stops a reload loop if the fresh build also errors.
    if (isDeploySkewError(error) && reloadOnceForDeploySkew()) return;
    void captureError(error, { source: 'app/admin/error.tsx', digest: error.digest });
  }, [error]);

  return (
    <div style={{ padding: '60px 36px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠</div>
      <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Admin error</h1>
      <p style={{ color: '#6b7280', margin: '0 0 24px', fontSize: '0.875rem' }}>
        {error.message || 'Something went wrong in the admin panel.'}
      </p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button onClick={reset} style={{
          padding: '8px 20px', background: '#C5286A', color: 'white',
          border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
        }}>
          Retry
        </button>
        <Link href="/admin/dashboard" style={{
          padding: '8px 20px', background: '#f3f4f6', color: '#374151',
          borderRadius: 7, textDecoration: 'none', fontSize: '0.875rem', fontWeight: 500,
        }}>
          Dashboard
        </Link>
      </div>
    </div>
  );
}
