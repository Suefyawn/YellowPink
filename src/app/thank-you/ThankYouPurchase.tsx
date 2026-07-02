'use client';

// Canonical client-side `purchase` event for EVERY completed order.
//
// COD orders reach /thank-you via router.push after place_order; gateway
// orders (JazzCash/Easypaisa) send the shopper off-site and the payment
// callback redirects them back here. Both land on /thank-you, so this is the
// one place that fires exactly once for both paths. The checkout page no
// longer fires `purchase` (it only ever ran for the COD path and would have
// double-counted against this one).
//
// Deduped on the order number via localStorage so a reload, a back-navigation,
// or a gateway "return" replay never fires a second `purchase`. The Meta Pixel
// bridge keys its Purchase eventID on the same order number, which Meta
// collapses against the server-side CAPI event (fired by the gateway
// callbacks) — so gateway orders still count once for Meta too.

import { useEffect, useRef } from 'react';
import { track, type TrackProductPayload } from '@/lib/analytics';

interface Props {
  orderNumber: string;
  value: number;
  items: TrackProductPayload[];
  coupon?: string;
}

export function ThankYouPurchase({ orderNumber, value, items, coupon }: Props) {
  // Guards a double-fire inside a single mount (React strict-mode double effect
  // invocation in dev); the localStorage key guards across reloads/returns.
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current || !orderNumber) return;

    const key = `yp_purchase_fired_${orderNumber}`;
    try {
      if (localStorage.getItem(key) === '1') return;
    } catch {
      /* localStorage unavailable (private mode) — fall through and fire once */
    }

    fired.current = true;
    // Set the guard BEFORE firing so a fast reload can't slip a second event in.
    try { localStorage.setItem(key, '1'); } catch { /* ignore */ }

    track({
      name: 'purchase',
      payload: {
        transaction_id: orderNumber,
        value,
        currency: 'PKR',
        items,
        ...(coupon ? { coupon } : {}),
      },
    });
  }, [orderNumber, value, items, coupon]);

  return null;
}
