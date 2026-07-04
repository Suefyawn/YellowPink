'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { captureError } from '@/lib/monitoring';

// A failed dynamic-chunk / module load almost always means the tab (or an
// installed admin PWA) is running an old build whose hashed chunks 404 after a
// deploy — "white screen no matter where I click". A one-time hard reload
// pulls the current HTML + chunk manifest and self-heals it; the sessionStorage
// guard stops a reload loop if the failure is something else.
function isStaleBuildError(error: Error): boolean {
  const s = `${error.name} ${error.message}`.toLowerCase();
  return s.includes('chunkloaderror')
    || s.includes('loading chunk')
    || s.includes('loading css chunk')
    || s.includes('dynamically imported module')
    || s.includes('failed to fetch dynamically imported module');
}

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (isStaleBuildError(error)) {
      // Timestamp guard (not a boolean): only suppress the reload if we ALREADY
      // reloaded seconds ago — that's a loop (the fresh build errors too, so
      // it's not really a stale cache). A stale-build error minutes/hours later,
      // after another deploy, still auto-heals.
      const KEY = 'yp_admin_stale_reload_at';
      let last = 0;
      try { last = Number(sessionStorage.getItem(KEY)) || 0; } catch { /* private mode */ }
      const now = Date.now();
      if (now - last > 15_000) {
        try { sessionStorage.setItem(KEY, String(now)); } catch { /* ignore */ }
        window.location.reload();   // re-fetch the current build + chunk manifest
        return;
      }
      // Reloaded moments ago and still failing → not a stale cache; show the
      // error instead of looping.
    }
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
