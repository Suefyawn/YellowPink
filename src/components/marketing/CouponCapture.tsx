'use client';

// Auto-applies a discount code arriving in the URL — e.g. an ad or landing-page
// link like /product/x?utm_source=facebook&coupon=EID20. The code is validated
// against the live coupons table (via the lookup_coupon RPC) and, if active,
// applied to the cart. Because the applied coupon is persisted in the cart
// context, it survives the whole journey to checkout, so campaign links carry
// their discount automatically — and the funnel-by-source widget already
// measures each campaign by its utm_source/referrer.
//
// Accepts ?coupon=, ?discount= or ?code=. Never overrides a coupon the shopper
// applied manually. Final eligibility (min order, per-user caps) is still
// enforced at checkout and server-side in place_order; this is best-effort UX.

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Coupon } from '@/types';

function Capture() {
  const sp = useSearchParams();
  const { appliedCoupon, setAppliedCoupon } = useCart();
  const done = useRef(false);

  useEffect(() => {
    if (done.current || appliedCoupon) return;
    const code = (sp.get('coupon') ?? sp.get('discount') ?? sp.get('code') ?? '').trim();
    if (!code) return;
    done.current = true;
    (async () => {
      try {
        const sb = getBrowserClient();
        const { data } = await sb.rpc('lookup_coupon' as never, { p_code: code } as never);
        const rows = (data ?? []) as Coupon[];
        if (rows.length > 0) setAppliedCoupon(rows[0]);
      } catch {
        /* ignore — a bad code in a link just means no auto-discount */
      }
    })();
  }, [sp, appliedCoupon, setAppliedCoupon]);

  return null;
}

export function CouponCapture() {
  // useSearchParams() needs a Suspense boundary in the App Router.
  return (
    <Suspense fallback={null}>
      <Capture />
    </Suspense>
  );
}
