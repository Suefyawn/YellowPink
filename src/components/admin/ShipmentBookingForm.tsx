'use client';

import { useActionState, useState } from 'react';
import { bookShipment, createShipment, cancelShipment, syncShipmentNow, replaceTracking } from '@/app/admin/shipment-actions';
import { COURIER_LIST, courierTrackingUrl } from '@/lib/couriers/profiles';

interface Props {
  orderId: string;
  /** Start on the Manual tab even when API couriers exist — set for vendor
   *  self-delivered orders, where the only sensible action is recording the
   *  tracking number the vendor sent (booking from our account would ship a
   *  parcel the vendor is already shipping). */
  preferManual?: boolean;
  /** Couriers we have a configured API adapter for, server passes this in
   *  via the page so the UI can show "Book pickup" vs "Enter manually". */
  apiAdapters: string[];
  /** Set when a courier is credentialed but deliberately withheld from API
   *  booking (e.g. pointed at its UAT host in production). Rendered as a
   *  warning so staff know why only manual entry is offered. */
  blockedReason?: string | null;
  /** Existing shipment (if any), render-cancellation + tracking link. */
  shipment?: {
    id: string;
    courier: string;
    tracking_number: string;
    status: string;
    /** Printable label/AWB PDF captured at booking (courier API), if any. */
    labelUrl?: string | null;
  } | null;
  /** orders.delivery_cost — when already recorded the booking forms show it
   *  instead of the optional "Courier charge" input (never clobbered). */
  deliveryCost?: number | null;
  /** Owner's "typical delivery cost" baseline (Settings → Shipping); prefills
   *  the optional courier-charge field so the actual cost gets captured on most
   *  orders (feeds the shipping-margin view). */
  suggestedCharge?: number;
  /** True while the order is still 'pending' (customer not confirmed).
   *  Booking then requires the explicit "book anyway" override — July's
   *  COD returns were overwhelmingly unconfirmed shipments. */
  unconfirmed?: boolean;
}

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600,
  color: '#374151', marginBottom: 4,
};

export function ShipmentBookingForm({ orderId, preferManual, apiAdapters, blockedReason, shipment, deliveryCost, suggestedCharge, unconfirmed }: Props) {
  const [courier, setCourier] = useState<string>(apiAdapters[0] ?? 'TCS');
  const [mode, setMode] = useState<'auto' | 'manual'>(preferManual || apiAdapters.length === 0 ? 'manual' : 'auto');
  const [bookState, bookAction, bookPending] = useActionState(bookShipment, null);
  const [manualState, manualAction, manualPending] = useActionState(createShipment, null);
  const [cancelState, cancelAction, cancelPending] = useActionState(cancelShipment, null);
  const [syncState, syncAction, syncPending] = useActionState(syncShipmentNow, null);
  const [replaceState, replaceAction, replacePending] = useActionState(replaceTracking, null);
  const [showReplace, setShowReplace] = useState(false);

  // ─── Already booked/shipped, show tracking + cancel options ─────────────
  if (shipment && shipment.status !== 'cancelled') {
    const trackUrl = courierTrackingUrl(shipment.courier, shipment.tracking_number);
    // Live-tracking sync is only offered for couriers with a configured API
    // adapter; others update via the courier's own tracking page.
    const canSync = apiAdapters.includes(shipment.courier) && shipment.status !== 'delivered';
    // Result of a booking made just now, in this session. revalidatePath
    // swaps this component into the booked view as soon as the action
    // settles, so the confirmation has to render here, not in the form.
    const justBooked: { awaitingPickup?: boolean; markedShipped?: boolean; emailed?: boolean; courierCharge?: number } | null =
      bookState?.success ? bookState : manualState?.success ? manualState : null;
    return (
      <div>
        {justBooked && (
          <div role="status" style={{ marginBottom: 12, padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
            Shipment booked.
            {justBooked.awaitingPickup
              ? ' Awaiting pickup — the order shows Processing, and the customer gets the shipped email automatically at the courier’s first scan.'
              : justBooked.markedShipped
                ? ` Order marked shipped${justBooked.emailed ? ' + customer emailed' : ''}.`
                : ''}
            {justBooked.courierCharge != null
              ? ` Courier charge PKR ${justBooked.courierCharge.toLocaleString()} saved to Order costs.`
              : ''}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <div style={lbl}>Booked with</div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            {shipment.courier} · <span style={{ fontFamily: 'monospace' }}>{shipment.tracking_number}</span>
          </div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 2 }}>
            {trackUrl && (
              <a href={trackUrl} target="_blank" rel="noreferrer noopener"
                 style={{ fontSize: '0.75rem', color: '#C5286A', textDecoration: 'underline' }}>
                Open on {shipment.courier} ↗
              </a>
            )}
            {/* Label: the proxy route fetches the PDF from the courier at
                click time (TCS streams it with no URL, so a stored link was
                never available for most bookings). Offered for any courier
                with an API adapter; manual couriers have no label API. */}
            {apiAdapters.includes(shipment.courier) ? (
              <a href={`/api/admin/shipment-label?shipment_id=${shipment.id}`} target="_blank" rel="noreferrer noopener"
                 style={{ fontSize: '0.75rem', color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>
                Print label (PDF) ↗
              </a>
            ) : shipment.labelUrl && (
              <a href={shipment.labelUrl} target="_blank" rel="noreferrer noopener"
                 style={{ fontSize: '0.75rem', color: '#111827', fontWeight: 600, textDecoration: 'underline' }}>
                Print label (PDF) ↗
              </a>
            )}
            <button
              type="button"
              onClick={() => setShowReplace(v => !v)}
              style={{ fontSize: '0.75rem', color: '#6b7280', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Fix tracking number
            </button>
          </div>
        </div>
        {showReplace && (
          <form action={replaceAction} style={{ marginBottom: 12, padding: '10px 12px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
            <input type="hidden" name="shipment_id" value={shipment.id} />
            <label htmlFor="new-tracking" style={lbl}>
              Correct tracking number (use this when the parcel actually travelled under a different CN)
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input id="new-tracking" name="new_tracking" required placeholder="e.g. 779412326902"
                     style={{ ...inp, fontFamily: 'monospace', flex: 1 }} />
              <button type="submit" disabled={replacePending}
                      style={{ padding: '8px 14px', background: '#111827', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: replacePending ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                {replacePending ? 'Saving…' : 'Replace'}
              </button>
            </div>
            <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: '6px 0 0' }}>
              Old scan history is cleared; the next sync rebuilds it from the new number. The change is audit-logged.
            </p>
            {replaceState?.error && (
              <div role="alert" style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
                {replaceState.error}
              </div>
            )}
            {replaceState?.success && (
              <div role="status" style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
                Tracking number replaced.
              </div>
            )}
          </form>
        )}
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: 8 }}>
          {/* 'created' = consignment booked, parcel not yet collected — say so
              instead of leaking the raw enum. */}
          Status: <strong>{shipment.status === 'created' ? 'booked — awaiting pickup' : shipment.status}</strong>
        </div>
        {canSync && (
          <form action={syncAction} style={{ marginBottom: 8 }}>
            <input type="hidden" name="shipment_id" value={shipment.id} />
            <button
              type="submit"
              disabled={syncPending}
              style={{
                padding: '8px 14px', background: 'transparent',
                border: '1px solid #d1d5db', borderRadius: 6, color: '#374151',
                fontSize: '0.75rem', fontWeight: 600, cursor: syncPending ? 'not-allowed' : 'pointer',
              }}
            >
              {syncPending ? 'Syncing…' : `Sync tracking now`}
            </button>
            {syncState?.error && (
              <div role="alert" style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
                {syncState.error}
              </div>
            )}
            {syncState?.success && syncState.noData && (
              <div role="status" style={{ marginTop: 8, padding: '6px 10px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: '0.75rem', lineHeight: 1.5 }}>
                TCS hasn&rsquo;t published any scan data for this consignment yet
                {syncState.summary ? <> (their reply: &ldquo;{syncState.summary}&rdquo;)</> : null}.
                Scans usually appear a few hours after the parcel is scanned at a TCS facility.
                If it was picked up more than a day ago, confirm the CN number with your TCS
                account rep — the parcel may not have been scanned into their system.
              </div>
            )}
            {syncState?.success && !syncState.noData && (
              <div role="status" style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
                {syncState.updated ? `Updated — now “${syncState.current}”.` : 'Already up to date.'}
              </div>
            )}
          </form>
        )}
        <form action={cancelAction}>
          <input type="hidden" name="shipment_id" value={shipment.id} />
          <button
            type="submit"
            disabled={cancelPending}
            style={{
              padding: '8px 14px', background: 'transparent',
              border: '1px solid #fca5a5', borderRadius: 6, color: '#ef4444',
              fontSize: '0.75rem', fontWeight: 600, cursor: cancelPending ? 'not-allowed' : 'pointer',
            }}
          >
            {cancelPending ? 'Cancelling…' : 'Cancel shipment'}
          </button>
        </form>
        {cancelState?.error && (
          <div role="alert" style={{ marginTop: 8, padding: '6px 10px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
            {cancelState.error}
          </div>
        )}
        {cancelState?.success && (
          <div role="status" style={{ marginTop: 8, padding: '6px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
            Shipment cancelled.
          </div>
        )}
      </div>
    );
  }

  // ─── Not yet shipped, picker + mode-switcher ────────────────────────────
  const hasApi = apiAdapters.includes(courier);
  // Optional courier charge, captured at booking on both paths. Writes
  // orders.delivery_cost (feeds Finance) only when nothing is recorded yet;
  // an existing value is shown read-only and edited via Order costs.
  const courierChargeField = deliveryCost == null ? (
    <div>
      <label htmlFor="courier-charge" style={lbl}>Courier charge (PKR, optional)</label>
      <input
        id="courier-charge" name="courier_charge" type="number" min="0" step="any"
        defaultValue={suggestedCharge ?? ''}
        placeholder="what the courier bills you"
        style={inp}
      />
      {suggestedCharge != null && (
        <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: '4px 0 0' }}>
          Prefilled with your typical cost — adjust to the exact courier charge for this parcel.
        </p>
      )}
    </div>
  ) : (
    <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: 0 }}>
      Courier charge already recorded: PKR {deliveryCost.toLocaleString()} — change it in Order costs.
    </p>
  );
  return (
    <div>
      {/* Courier API disabled because it would book into the courier's test
          environment — a consignment number that never reaches them and a
          parcel nobody collects (see order YP-6WTC3EC7V, 11 Aug). Shown
          before the staff member acts, not after. */}
      {blockedReason && (
        <div role="alert" style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.8125rem', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', lineHeight: 1.5 }}>
          <strong style={{ display: 'block', marginBottom: 2 }}>Courier API booking is switched off</strong>
          {blockedReason}
        </div>
      )}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="courier-picker" style={lbl}>Courier</label>
        <select
          id="courier-picker"
          value={courier}
          onChange={e => {
            const next = e.target.value;
            setCourier(next);
            // When the user picks a non-API courier, force manual mode so they
            // don't click "Book" and see an error.
            if (!apiAdapters.includes(next)) setMode('manual');
          }}
          style={inp}
        >
          {COURIER_LIST.map(c => (
            <option key={c.id} value={c.id}>
              {c.name}{apiAdapters.includes(c.id) ? ' (API)' : ''}
            </option>
          ))}
        </select>
        <p style={{ fontSize: '0.6875rem', color: '#6b7280', margin: '4px 0 0' }}>
          {apiAdapters.length > 0
            ? `API-backed: ${apiAdapters.join(', ')}. Others need a tracking number entered manually.`
            : 'No courier API is configured, pick a courier and enter the tracking number manually.'}
        </p>
      </div>

      {hasApi && (
        <div role="tablist" aria-label="Booking mode" style={{ display: 'flex', gap: 4, marginBottom: 12, padding: 2, background: '#f3f4f6', borderRadius: 6 }}>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'auto'}
            onClick={() => setMode('auto')}
            style={{
              flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer',
              borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
              background: mode === 'auto' ? 'white' : 'transparent',
              boxShadow: mode === 'auto' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: mode === 'auto' ? '#111827' : '#6b7280',
            }}
          >Book via {courier} API</button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'manual'}
            onClick={() => setMode('manual')}
            style={{
              flex: 1, padding: '6px 10px', border: 'none', cursor: 'pointer',
              borderRadius: 4, fontSize: '0.75rem', fontWeight: 600,
              background: mode === 'manual' ? 'white' : 'transparent',
              boxShadow: mode === 'manual' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              color: mode === 'manual' ? '#111827' : '#6b7280',
            }}
          >Manual / third-party</button>
        </div>
      )}

      {mode === 'auto' && hasApi ? (
        <form action={bookAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="order_id" value={orderId} />
          <input type="hidden" name="courier" value={courier} />
          {/* Unconfirmed-dispatch guard: July's COD returns overwhelmingly
              shipped without customer confirmation. The server rejects a
              booking on a 'pending' order unless this box is ticked. */}
          {unconfirmed && (
            <div role="alert" style={{ padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, color: '#92400e', fontSize: '0.75rem', lineHeight: 1.5 }}>
              This order is still <strong>Pending</strong> — the customer hasn&apos;t been confirmed. Confirm on WhatsApp/phone and mark the order <strong>Preparing</strong> first; unconfirmed COD parcels are where the returns come from.
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, fontWeight: 600, cursor: 'pointer' }}>
                <input type="checkbox" name="confirm_unconfirmed" style={{ width: 14, height: 14 }} />
                Book anyway without confirmation
              </label>
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div>
              <label htmlFor="weight-kg" style={lbl}>Weight (kg, optional)</label>
              <input id="weight-kg" name="weight_kg" type="number" step="0.1" min="0.5" placeholder="auto" style={inp} />
            </div>
            <div>
              <label htmlFor="pieces" style={lbl}>Pieces</label>
              <input id="pieces" name="pieces" type="number" min="1" defaultValue="1" style={inp} />
            </div>
          </div>
          {courierChargeField}
          <button
            type="submit"
            disabled={bookPending}
            style={{
              padding: '10px 16px', background: bookPending ? '#f9a8d4' : '#C5286A',
              color: 'white', border: 'none', borderRadius: 6,
              fontSize: '0.875rem', fontWeight: 600,
              cursor: bookPending ? 'not-allowed' : 'pointer',
            }}
          >
            {bookPending ? `Booking with ${courier}…` : `Book pickup via ${courier}`}
          </button>
          {bookState?.error && (
            <div role="alert" style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
              {bookState.error}
            </div>
          )}
          {bookState?.success && (
            <div role="status" style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
              Booked. Tracking: <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{bookState.trackingNumber}</span>
              {bookState.awaitingPickup && (
                <> · Awaiting pickup — the customer is emailed automatically at the courier’s first scan.</>
              )}
              {bookState.courierCharge != null && (
                <> · Courier charge PKR {bookState.courierCharge.toLocaleString()} saved.</>
              )}
              {/* Root cause of the Jul 28 double-booking: staff had no label
                  to hand over, so the rider used a manual CN slip and the
                  parcel travelled under a different number. The label IS the
                  fix — say so at the moment of booking. */}
              <div style={{ marginTop: 6, color: '#92400e' }}>
                Now <strong>print the label</strong> (button above once the panel refreshes) and hand the
                parcel over with it — if the rider fills a manual CN slip instead, the parcel travels
                under a different number and this booking never tracks. If that happens anyway, use
                &ldquo;Fix tracking number&rdquo; to point this shipment at the CN on the slip.
              </div>
            </div>
          )}
        </form>
      ) : (
        <form action={manualAction} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input type="hidden" name="order_id" value={orderId} />
          {/* "Other" unlocks a free-text service name: vendor-fulfilled orders
              arrive with a tracking number from whatever courier the VENDOR
              used (Nazirs' rider, PostEx, …) — storing the literal "Other"
              made the orders list and the customer's track page useless for
              those parcels. createShipment accepts any courier string; known
              names still get tracking deep-links via substring match. */}
          {courier === 'Other' ? (
            <div>
              <label htmlFor="courier-name" style={lbl}>Courier / delivery service name *</label>
              <input
                id="courier-name"
                name="courier"
                required
                placeholder="e.g. PostEx, vendor rider"
                style={inp}
              />
            </div>
          ) : (
            <input type="hidden" name="courier" value={courier} />
          )}
          <div>
            <label htmlFor="tracking-number" style={lbl}>Tracking number *</label>
            <input
              id="tracking-number"
              name="tracking_number"
              required
              placeholder="e.g. 779412326902"
              style={{ ...inp, fontFamily: 'monospace' }}
            />
          </div>
          <div>
            <label htmlFor="weight-grams" style={lbl}>Weight (grams, optional)</label>
            <input id="weight-grams" name="weight_grams" type="number" min="1" placeholder="e.g. 500" style={inp} />
          </div>
          {courierChargeField}
          <button
            type="submit"
            disabled={manualPending}
            style={{
              padding: '10px 16px',
              background: manualPending ? '#9ca3af' : '#111827',
              color: 'white', border: 'none', borderRadius: 6,
              fontSize: '0.875rem', fontWeight: 600,
              cursor: manualPending ? 'not-allowed' : 'pointer',
            }}
          >
            {manualPending ? 'Saving…' : `Save ${courier} tracking number`}
          </button>
          {manualState?.error && (
            <div role="alert" style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, color: '#dc2626', fontSize: '0.75rem' }}>
              {manualState.error}
            </div>
          )}
          {manualState?.success && (
            <div role="status" style={{ padding: '8px 12px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6, color: '#166534', fontSize: '0.75rem' }}>
              Tracking saved.
              {manualState.markedShipped && (
                <> Order marked shipped{manualState.emailed ? ' + customer emailed' : ''}.</>
              )}
              {manualState.courierCharge != null && (
                <> Courier charge PKR {manualState.courierCharge.toLocaleString()} saved.</>
              )}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
