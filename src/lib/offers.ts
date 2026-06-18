// Server-side resolver for the newsletter welcome offer. Reads the live figures
// off the WELCOME10 coupon so the storefront modal and the welcome email always
// reflect what the coupon is actually set to — change the coupon's percentage
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

// `cache` dedupes within a request (e.g. layout render). Falls back to the
// seeded defaults if the row is missing, inactive, not a percentage coupon, or
// unreadable — so the modal/email never advertise a wrong or empty number.
export const getWelcomeOffer = cache(async (): Promise<WelcomeOffer> => {
  try {
    const { data } = await supabase
      .from('coupons')
      .select('code, type, value, min_order, active')
      .ilike('code', WELCOME_CODE)
      .maybeSingle();
    if (data && data.active && data.type === 'percent') {
      return {
        code: data.code ?? WELCOME_CODE,
        pct: Number(data.value) || WELCOME_DISCOUNT_PCT,
        minOrder: Number(data.min_order) || 0,
      };
    }
  } catch {
    // fall through to defaults
  }
  return FALLBACK;
});
