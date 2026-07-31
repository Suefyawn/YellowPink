'use client';

// Vendor settlement terms: readable at rest, editable on demand. The old
// row crammed a five-control form into every vendor's Settlement column;
// now the terms read as a sentence of chips and the form only appears
// behind Edit.

import { useState } from 'react';
import { updateVendor } from '@/app/admin/vendor-actions';
import type { Vendor } from '@/types';

const inp: React.CSSProperties = {
  padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none',
};

export function VendorTermsEditor({ vendor }: { vendor: Vendor }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    const parts: string[] = [];
    parts.push(vendor.commission_pct != null ? `${Number(vendor.commission_pct)}% kept` : 'no commission set');
    parts.push(vendor.settlement_direction === 'vendor_collects' ? 'vendor collects' : 'we collect');
    if (vendor.self_delivers) parts.push('delivers to customer');
    if (vendor.delivery_fee) parts.push(`PKR ${Number(vendor.delivery_fee).toLocaleString()} delivery`);
    if (vendor.free_shipping_threshold) parts.push(`customers ship free from PKR ${Number(vendor.free_shipping_threshold).toLocaleString()}`);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.8125rem', color: '#374151' }}>{parts.join(' · ')}</span>
        <button type="button" className="adm-btn adm-btn-secondary" style={{ padding: '3px 10px', fontSize: '0.75rem' }} onClick={() => setEditing(true)}>
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      action={async (fd: FormData) => {
        // updateVendor redirects (?saved=…), which surfaces here as a thrown
        // NEXT_REDIRECT — collapse the editor either way.
        try { await updateVendor(fd); } finally { setEditing(false); }
      }}
      style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}
    >
      <input type="hidden" name="id" value={vendor.id} />
      <input
        name="commission_pct" type="number" min={0} max={100} step="0.01"
        defaultValue={vendor.commission_pct ?? ''} placeholder="—"
        aria-label={`${vendor.name} commission %`}
        style={{ ...inp, width: 72 }}
      />
      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>% kept</span>
      <select
        name="settlement_direction" defaultValue={vendor.settlement_direction ?? 'we_collect'}
        aria-label={`${vendor.name} settlement direction`}
        style={inp}
      >
        <option value="we_collect">We collect</option>
        <option value="vendor_collects">Vendor collects</option>
      </select>
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
        <input type="checkbox" name="self_delivers" defaultChecked={vendor.self_delivers ?? false} aria-label={`${vendor.name} delivers directly`} />
        delivers
      </label>
      <input
        name="delivery_fee" type="number" min={0} step="1"
        defaultValue={vendor.delivery_fee ? Number(vendor.delivery_fee) : ''} placeholder="fee"
        aria-label={`${vendor.name} delivery fee`}
        style={{ ...inp, width: 64 }}
      />
      {/* Customer-facing rule: baskets with this vendor's items totalling at
          least this amount ship free (blank = no rule). Quoted at checkout
          and enforced by place_order; the PDP promise line reads it too. */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
        free ship ≥
        <input
          name="free_shipping_threshold" type="number" min={0} step="1"
          defaultValue={vendor.free_shipping_threshold ? Number(vendor.free_shipping_threshold) : ''} placeholder="none"
          aria-label={`${vendor.name} customer free-delivery threshold (PKR)`}
          style={{ ...inp, width: 76 }}
        />
      </label>
      <button type="submit" className="adm-btn adm-btn-primary" style={{ padding: '4px 12px', fontSize: '0.75rem' }}>Save</button>
      <button type="button" className="adm-btn adm-btn-secondary" style={{ padding: '4px 12px', fontSize: '0.75rem' }} onClick={() => setEditing(false)}>Cancel</button>
    </form>
  );
}
