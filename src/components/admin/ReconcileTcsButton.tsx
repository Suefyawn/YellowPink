'use client';

import { useActionState } from 'react';
import { reconcileTcsPayments } from '@/app/admin/shipment-actions';

// Pulls TCS's Payment Detail ledger and writes the real delivery charge onto
// matching orders, so the shipping-margin numbers run on actual courier costs.
// Only rendered when TCS's payment credential is configured AND the viewer can
// write orders (the page decides). The window defaults to 180 days — the
// server clamps to 1-180 — because the whole point is backfilling old
// consignments (return legs included), which a short window can never reach.
export function ReconcileTcsButton() {
  const [state, action, pending] = useActionState(reconcileTcsPayments, null);
  return (
    <form action={action} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      <label style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
        Look back
        <select name="days" defaultValue="180" style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.75rem', color: '#111827', background: 'white' }}>
          <option value="30">30 days</option>
          <option value="90">90 days</option>
          <option value="180">180 days</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        style={{
          padding: '8px 14px', background: 'white', color: '#374151',
          border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.75rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
        }}
      >
        {pending ? 'Syncing from TCS…' : 'Sync actual delivery costs from TCS'}
      </button>
      {state?.error && (
        <span role="alert" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#dc2626' }}>{state.error}</span>
      )}
      {state?.success && (
        <span role="status" style={{ fontSize: '0.8125rem', color: state.matched === 0 ? '#92400e' : '#166534' }}>
          {state.matched === 0
            ? `Scanned ${state.scanned ?? 0} consignment${(state.scanned ?? 0) === 1 ? '' : 's'} — none matched orders in range.`
            : `Updated ${state.updated} of ${state.matched} matched order${state.matched === 1 ? '' : 's'} with TCS’s actual charge.`}
        </span>
      )}
    </form>
  );
}
