'use client';

import { useState } from 'react';
import { exportVendorCsv } from '@/app/admin/vendor-actions';

// Same server-built-CSV pattern as ExportCSVButton (orders): RLS bars the
// browser's anon client from orders/settlements, so the action queries with
// the service role behind the vendors permission and this component only
// triggers the download.
export function ExportVendorCsvButton({ vendorId, vendorName, days }: { vendorId: string; vendorName: string; days?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExport = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await exportVendorCsv({ vendorId, days });
      if (result.error) { setError(result.error); return; }
      if (!result.csv || result.count === 0) { setError('No orders in this window.'); return; }
      const blob = new Blob([result.csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const slug = vendorName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      a.download = `${slug}-record-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  };

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      {error && <span role="alert" style={{ fontSize: '0.75rem', color: '#b91c1c' }}>{error}</span>}
      <button
        type="button"
        onClick={handleExport}
        disabled={loading}
        style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white',
          color: '#374151', fontSize: '0.8125rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading ? 'Preparing…' : 'Download CSV'}
      </button>
    </span>
  );
}
