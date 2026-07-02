// ============================================================================
// Referral-code capture.
//
// When a visitor arrives on a referral link (e.g. ?ref=ABCD1234) we stash the
// code in a cookie so it survives navigation and is still available at
// checkout, where CheckoutPage passes it to place_order as `referred_by_code`.
// place_order (migration 031) stamps it onto the signed-in customer's profile,
// and award_referral_for_user (migration 030) then pays the referrer out when
// that customer's first order is delivered.
//
// Mirrors the first-touch semantics of lib/attribution.ts: the first referral
// code we see in the window wins and is not overwritten by a later ?ref=.
// ============================================================================

const COOKIE = 'yp_ref';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days, same window as attribution
const PARAM = 'ref';

// Referral codes are generated as upper-hex, 8 chars (migration 030). Accept a
// slightly wider alnum shape (future-proofing) but cap the length so a crafted
// URL can't stuff an oversized value into the cookie / the profile column.
const CODE_RE = /^[A-Za-z0-9]{4,32}$/;

/** Normalise a raw code: trim, uppercase, validate shape. Returns null if it
 *  doesn't look like a referral code. */
function normalise(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const code = raw.trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** The captured referral code, or null. Safe to call on the server (returns
 *  null when there's no document). */
export function readReferral(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)yp_ref=([^;]+)/);
  if (!m) return null;
  return normalise(decodeURIComponent(m[1]));
}

/**
 * Read a `?ref=<code>` off the current URL and persist it (first-touch: an
 * existing code is never overwritten). Safe to call on every navigation.
 */
export function captureReferral(): void {
  if (typeof window === 'undefined') return;
  if (readReferral()) return; // first-touch: keep the original referrer
  const code = normalise(new URLSearchParams(window.location.search).get(PARAM));
  if (!code) return;
  document.cookie = `${COOKIE}=${encodeURIComponent(code)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
}
