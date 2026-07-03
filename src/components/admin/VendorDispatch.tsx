'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { assignOrderVendor, dispatchOrderToVendor } from '@/app/admin/vendor-actions';
import { useToast } from '@/components/admin/Toast';

interface VendorLite {
  id: string;
  name: string;
  phone: string;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// Assign a fulfilment vendor to the order — the SELECTION applies the
// economics (vendor rate → settlement + auto acquisition cost, via
// assignOrderVendor) and the page refreshes so the Order costs card shows
// the new figure immediately. "Send on WhatsApp" is just the messaging step
// on top: it opens the prefilled chat and records the sent timestamp.
// The select deliberately has an explicit "No vendor" state — it must never
// default to the first vendor while the order has none assigned, which made
// a single-vendor store look permanently dispatched.
export function VendorDispatch({
  orderId,
  vendors,
  currentVendorId,
  vendorSentAt,
  message,
  suggestedVendorId = null,
  suggestedItemCount = 0,
  itemCount = 0,
}: {
  orderId: string;
  vendors: VendorLite[];
  currentVendorId: string | null;
  vendorSentAt: string | null;
  message: string;
  /** Products' sourcing vendor (product form → "default supplier") when the
   *  order's items agree on one — offered as a one-click suggestion. */
  suggestedVendorId?: string | null;
  suggestedItemCount?: number;
  itemCount?: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  // Mirrors the server value; optimistic while the assign action runs.
  const [selected, setSelected] = useState(currentVendorId ?? '');

  if (vendors.length === 0) {
    return (
      <div>
        <div style={lbl}>Vendor</div>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '4px 0 0' }}>
          No vendors yet.{' '}
          <Link href="/admin/vendors" style={{ color: '#C5286A', fontWeight: 600 }}>
            Add a vendor
          </Link>{' '}
          to forward orders.
        </p>
      </div>
    );
  }

  const assign = (vendorId: string) => {
    const prev = selected;
    setSelected(vendorId);
    startTransition(async () => {
      const res = await assignOrderVendor(orderId, vendorId || null);
      if (!res.ok) {
        setSelected(prev);
        toast(res.error ?? 'Could not update the vendor.', 'error');
        return;
      }
      if (res.cleared) {
        toast('Vendor removed — settlement and auto acquisition cost cleared.', 'success');
      } else if (res.costApplied && res.cost != null) {
        toast(`Fulfilled by ${res.vendorName} — acquisition cost auto-filled: PKR ${Math.round(res.cost).toLocaleString()}.`, 'success');
      } else if (res.cost != null) {
        toast(`Fulfilled by ${res.vendorName} — your manually entered acquisition cost was kept (use "Recalculate from vendor rate" to apply PKR ${Math.round(res.cost).toLocaleString()}).`, 'success');
      } else {
        toast(`Fulfilled by ${res.vendorName}.`, 'success');
      }
      router.refresh();
    });
  };

  const assignedVendor = currentVendorId ? vendors.find(v => v.id === currentVendorId) ?? null : null;
  const selectedVendor = selected ? vendors.find(v => v.id === selected) ?? null : null;
  const waHref = selectedVendor ? whatsappUrlForCustomer(selectedVendor.phone, message) : null;

  return (
    <div>
      <div style={lbl}>Fulfilled by vendor</div>
      <select
        value={selected}
        onChange={e => assign(e.target.value)}
        disabled={pending}
        aria-label="Vendor"
        style={{
          width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
          borderRadius: 7, fontSize: '0.875rem', background: 'white', marginBottom: 10,
          opacity: pending ? 0.6 : 1,
        }}
      >
        <option value="">— No vendor (own stock) —</option>
        {vendors.map(v => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </select>
      <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '-4px 0 10px' }}>
        {pending
          ? 'Applying the vendor rate…'
          : 'Picking a vendor applies their rate: settlement + acquisition cost are recorded immediately.'}
      </p>

      {!currentVendorId && !pending && suggestedVendorId && vendors.some(v => v.id === suggestedVendorId) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '8px 12px', borderRadius: 8, marginBottom: 10,
          background: '#fffbeb', border: '1px solid #fde68a',
        }}>
          <span style={{ fontSize: '0.75rem', color: '#92400e' }}>
            {vendors.find(v => v.id === suggestedVendorId)!.name} is the default supplier for{' '}
            {suggestedItemCount === itemCount && itemCount > 0 ? 'all' : `${suggestedItemCount} of ${itemCount}`} item(s) here.
          </span>
          <button
            type="button"
            onClick={() => assign(suggestedVendorId)}
            style={{
              padding: '5px 10px', borderRadius: 6, border: '1px solid #d97706',
              background: 'white', color: '#92400e', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}
          >
            Set as fulfilment vendor
          </button>
        </div>
      )}

      {waHref && selected === (currentVendorId ?? '') && selectedVendor ? (
        <a
          href={waHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            void dispatchOrderToVendor(orderId, selectedVendor.id).then(() => router.refresh());
          }}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: '#25D366', color: '#fff', textDecoration: 'none',
            padding: '9px 16px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Send on WhatsApp
        </a>
      ) : null}

      {assignedVendor && !vendorSentAt && (
        <p style={{ fontSize: '0.75rem', color: '#92400e', margin: '8px 0 0', fontWeight: 600 }}>
          Assigned to {assignedVendor.name} — not sent on WhatsApp yet.
        </p>
      )}
      {vendorSentAt && assignedVendor && (
        <p style={{ fontSize: '0.75rem', color: '#16a34a', margin: '8px 0 0', fontWeight: 600 }}>
          ✓ Sent to {assignedVendor.name} on {fmtDate(vendorSentAt)}
        </p>
      )}
    </div>
  );
}

const lbl: React.CSSProperties = {
  fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6,
};
