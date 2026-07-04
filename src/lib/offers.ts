// Server-side resolver for the newsletter welcome offer. Reads the live figures
// off the WELCOME10 coupon so the storefront modal and the welcome email always
// reflect what the coupon is actually set to, change the coupon's percentage
// (or min order) in admin and the customer-facing copy follows, no deploy. The
// actual discount applied at checkout has always come from the coupon row; this
// just keeps the *advertised* number in sync with it.
import { cache } from 'react';
import { supabase } from './supabase';
import { WELCOME_CODE, WELCOME_DISCOUNT_PCT, WELCOME_MIN_ORDER } from './commerce';

export interface WelcomeOffer {
  code: string;
  /** Percentage off, e.g. 10. */
  pct: number;
  /** Minimum order for the coupon, in PKR (0 = no minimum). */
  minOrder: number;
}

const FALLBACK: WelcomeOffer = {
  code: WELCOME_CODE,
  pct: WELCOME_DISCOUNT_PCT,
  minOrder: WELCOME_MIN_ORDER,
};

// `cache` dedupes within a request (e.g. layout render).
//
// Returns null when the coupon row is missing or deactivated — the popup,
// footer signup and welcome email then drop the discount promise instead of
// advertising a code checkout will reject (which is exactly what happened
// when the WELCOME10 row was deleted from admin). Only a *read error*
// (transient DB hiccup, demo mode) falls back to the seeded defaults, since
// in that state the deliberate-deactivation signal can't be read either.
//
// Read through the lookup_coupon RPC (SECURITY DEFINER), NOT the table:
// coupons RLS bars anon SELECT (migration 070), so a direct anon select
// returns empty-without-error — indistinguishable from "deliberately
// deleted", which made this resolver advertise nothing while WELCOME10 was
// active (caught by the 2026-07-04 regression sweep). The RPC is the same
// anon-safe path cart/checkout use to validate codes.
export const getWelcomeOffer = cache(async (): Promise<WelcomeOffer | null> => {
  try {
    const { data, error } = await supabase.rpc('lookup_coupon' as never, { p_code: WELCOME_CODE } as never);
    if (error) return FALLBACK;
    const row = (data as Array<{ code: string; type: string; value: number; min_order: number; active: boolean }> | null)?.[0];
    if (row && row.active && row.type === 'percent') {
      return {
        code: row.code ?? WELCOME_CODE,
        pct: Number(row.value) || WELCOME_DISCOUNT_PCT,
        minOrder: Number(row.min_order) || 0,
      };
    }
    return null; // deliberately absent/inactive → don't advertise
  } catch {
    return FALLBACK;
  }
});
