// ============================================================================
// The discount promised in a cart-recovery message, checked before it is
// promised.
//
// Why this exists. The abandoned-cart WhatsApp template and the tier-3
// reminder email both ended their message with "Use code COMEBACK10 for a
// discount if you order today", from a hardcoded default in two separate
// files. No coupon called COMEBACK10 has ever existed. The coupon that does
// exist, created 14 July 2026 for exactly this job, is COMEBACK15, and after
// two months its used_count was still 0.
//
// So every shopper who followed one of those messages typed a code that was
// rejected at checkout, on the one screen where they had already hesitated
// once. Over the 30 days to 15 September that was four phone-only carts worth
// PKR 24,049, every one of them messaged by staff, none recovered.
//
// The rule this file enforces: never promise a code without checking it
// resolves. A recovery message with no discount still works. A recovery
// message whose discount fails at checkout is worse than sending nothing,
// because it spends the shopper's second visit proving the shop is broken.
//
// The check is deliberately a pure function over a coupon row so both callers
// (the admin queue and the cron) share one answer, and so the failure modes
// can be tested without a database.
// ============================================================================

/** The fields of a coupon row this check needs. Mirrors public.coupons. */
export interface RecoveryCoupon {
  code: string;
  active?: boolean | null;
  value?: number | string | null;
  /** Minimum cart value the coupon applies to, in PKR. */
  min_order?: number | string | null;
  expires_at?: string | null;
  starts_at?: string | null;
  max_uses?: number | null;
  used_count?: number | null;
}

export type CouponRejection =
  | 'missing'        // no coupon configured, or no row with that code
  | 'inactive'       // switched off in admin
  | 'expired'
  | 'not-started'    // scheduled for a future date
  | 'exhausted'      // max_uses reached
  | 'no-value'       // a 0% coupon promises a discount it will not give
  | 'below-min';     // this cart is under the coupon's minimum order

export interface CouponVerdict {
  /** The code to put in the message, or null when nothing should be promised. */
  code: string | null;
  /** Why it was dropped, for the admin warning. Null when usable. */
  reason: CouponRejection | null;
  /** Percentage off, when usable. */
  percent: number | null;
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Decide whether a recovery message may promise this coupon.
 *
 * `cartSubtotal` is optional: the cron's tier-3 email is composed per cart and
 * can pass it, while the admin page checks the coupon once for the queue. When
 * it is omitted the minimum-order rule is not applied, since there is no cart
 * to judge it against.
 */
export function checkRecoveryCoupon(
  coupon: RecoveryCoupon | null | undefined,
  cartSubtotal?: number | null,
  now: Date = new Date(),
): CouponVerdict {
  if (!coupon || !coupon.code) return { code: null, reason: 'missing', percent: null };

  const reject = (reason: CouponRejection): CouponVerdict => ({ code: null, reason, percent: null });

  if (coupon.active === false) return reject('inactive');

  const expires = coupon.expires_at ? new Date(coupon.expires_at) : null;
  if (expires && !Number.isNaN(expires.getTime()) && expires.getTime() <= now.getTime()) {
    return reject('expired');
  }

  const starts = coupon.starts_at ? new Date(coupon.starts_at) : null;
  if (starts && !Number.isNaN(starts.getTime()) && starts.getTime() > now.getTime()) {
    return reject('not-started');
  }

  const maxUses = num(coupon.max_uses);
  const usedCount = num(coupon.used_count) ?? 0;
  if (maxUses !== null && usedCount >= maxUses) return reject('exhausted');

  const percent = num(coupon.value);
  if (percent === null || percent <= 0) return reject('no-value');

  const minOrder = num(coupon.min_order);
  if (minOrder !== null && minOrder > 0 && cartSubtotal !== undefined && cartSubtotal !== null) {
    if (cartSubtotal < minOrder) return reject('below-min');
  }

  return { code: coupon.code, reason: null, percent };
}

/** One plain sentence for the admin queue, explaining a dropped coupon. */
export function explainRejection(reason: CouponRejection, code: string): string {
  switch (reason) {
    case 'missing':
      return `No discount code is configured, so the messages below go out without one.`;
    case 'inactive':
      return `"${code}" is switched off, so it is being left out of the messages below.`;
    case 'expired':
      return `"${code}" has expired, so it is being left out of the messages below.`;
    case 'not-started':
      return `"${code}" has a start date in the future, so it is being left out of the messages below.`;
    case 'exhausted':
      return `"${code}" has reached its usage limit, so it is being left out of the messages below.`;
    case 'no-value':
      return `"${code}" gives 0% off, so it is being left out of the messages below.`;
    case 'below-min':
      return `"${code}" has a minimum order value this cart does not reach, so it is being left out.`;
  }
}

/**
 * Remove the sentence promising a coupon from a rendered message.
 *
 * The template is staff-editable, so the coupon sentence cannot be located by
 * position. It is found by the {coupon} placeholder having been filled: any
 * sentence still containing the code is dropped whole, which keeps the rest of
 * the message (the cart link, the COD line) intact.
 */
export function stripCouponSentence(message: string, code: string): string {
  if (!code) return message;
  return message
    .split(/(?<=[.!?])\s+/)
    .filter(sentence => !sentence.includes(code))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
