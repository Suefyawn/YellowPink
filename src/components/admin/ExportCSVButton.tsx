'use client';

import { useState } from 'react';
import { exportOrdersCsv } from '@/app/admin/actions';

interface Props {
  status?: string;
  q?: string;
  range?: string;
}

// The CSV itself is built server-side by exportOrdersCsv: the browser's
// anon-key Supabase client can't read `orders` (RLS bars anon SELECT since
// migration 070), so an in-browser query silently exported nothing. The
// action queries with the service role behind a staff-permission check and
// returns the CSV text; this component only triggers the download and shows
// the outcome.
export function ExportCSVButton({ status, q, range }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await exportOrdersCsv({ status, q, range });
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!result.csv || result.count === 0) {
        setError('No orders match the current filters.');
        return;
      }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <button
        onClick={handleExport}
        disabled={loading}
        style={{
          padding: '8px 16px', background: loading ? '#f3f4f6' : 'white',
          border: '1px solid #d1d5db', borderRadius: 7,
          fontSize: '0.8125rem', fontWeight: 600, color: loading ? '#9ca3af' : '#374151',
          cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
          whiteSpace: 'nowrap',
        }}
      >
        {loading ? '…' : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Export CSV
          </>
        )}
      </button>
      {error && (
        <span role="alert" style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{error}</span>
      )}
    </span>
  );
}
