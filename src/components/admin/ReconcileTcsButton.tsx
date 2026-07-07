'use client';

import { useActionState } from 'react';
import { reconcileTcsPayments } from '@/app/admin/shipment-actions';

// Pulls TCS's Payment Detail ledger and writes the real delivery charge onto
// matching orders, so the shipping-margin numbers run on actual courier costs.
// Only rendered when TCS is configured (the page decides).
export function ReconcileTcsButton() {
  const [state, action, pending] = useActionState(reconcileTcsPayments, null);
  return (
    <form action={action} style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <input type="hidden" name="days" value="30" />
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '8px 14px', background: 'white', color: '#374151',
          border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.75rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? 'Syncing from TCS…' : 'Sync actual delivery costs from TCS (30d)'}
      </button>
      {state?.error && (
        <span role="alert" style={{ fontSize: '0.75rem', color: '#dc2626' }}>{state.error}</span>
      )}
      {state?.success && (
        <span role="status" style={{ fontSize: '0.75rem', color: '#166534' }}>
          {state.matched === 0
            ? `Scanned ${state.scanned ?? 0} consignments — none matched orders in range.`
            : `Updated ${state.updated} of ${state.matched} matched order${state.matched === 1 ? '' : 's'} with TCS’s actual charge.`}
        </span>
      )}
    </form>
  );
}
