// ============================================================================
// Marketing attribution capture (UTM + first-touch landing/referrer).
//
// When a visitor arrives from an ad (e.g. ?utm_source=facebook&utm_campaign=…)
// we stash the UTM params in a cookie so they survive navigation and are still
// available at checkout, where CheckoutPage folds them into the order_data sent
// to place_order. UTMs are LAST-touch (the most recent campaign that brought
// them back wins); landing_page + referrer are FIRST-touch (their original
// entry point). No PII, purely campaign metadata.
// ============================================================================

export interface Attribution {
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_page?: string;
  referrer?: string;
}

const COOKIE = 'yp_attr';
const MAX_AGE = 60 * 60 * 24 * 90; // 90 days
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export function readAttribution(): Attribution | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)yp_attr=([^;]+)/);
  if (!m) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(m[1]));
    return parsed && typeof parsed === 'object' ? (parsed as Attribution) : null;
  } catch {
    return null;
  }
}

/**
 * Read UTM params off the current URL and persist them. Safe to call on every
 * navigation: it only writes when something new is present, and only stamps the
 * first-touch landing/referrer once.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  const sp = new URLSearchParams(window.location.search);
  const prev = readAttribution();
  const next: Attribution = prev ? { ...prev } : {};
  let changed = false;

  for (const k of UTM_KEYS) {
    const v = sp.get(k);
    if (v) { next[k] = v.slice(0, 200); changed = true; }
  }

  if (!prev) {
    // First touch in this 90-day window: record where they landed and who
    // referred them (external referrers only).
    next.landing_page = (window.location.pathname + window.location.search).slice(0, 300);
    const ref = document.referrer;
    if (ref) {
      try {
        if (new URL(ref).host !== window.location.host) next.referrer = ref.slice(0, 300);
      } catch { /* malformed referrer — ignore */ }
    }
    changed = true;
  }

  if (changed) {
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=${MAX_AGE}; samesite=lax`;
  }
}
