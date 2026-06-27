// Internal-traffic flagging. The owner/staff browsing the *storefront* (not
// just /admin) was polluting the PostHog funnel and Web Vitals: long
// dev/testing sessions show up as "direct" visits with sky-high home→product
// rates and near-zero conversion, which made real customer behaviour
// impossible to read.
//
// When a staff member loads any /admin page we set a durable flag on that
// browser; from then on the storefront analytics layers (PostHog capture, the
// Web Vitals beacon) drop that browser's events. This is the pragmatic choice
// for an owner-operated store: the operator's own device is the dominant
// source of noise, and excluding it gives a clean storefront funnel without
// per-query filtering. Clears on staff logout.

const KEY = 'yp_internal';

/** Mark this browser as staff/internal. Called from the admin shell. */
export function markInternalTraffic(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, '1');
  } catch {
    /* private mode / storage disabled — nothing to do */
  }
}

/** Clear the flag (e.g. on staff logout) so the device counts as a normal
 *  visitor again. */
export function clearInternalTraffic(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** True when this browser has been flagged as internal. Read on the hot path
 *  (every capture / beacon), so it must never throw. */
export function isInternalTraffic(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}
