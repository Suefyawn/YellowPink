// ============================================================================
// Scraper exclusion for analytics queries.
//
// Between 1 Jul and 15 Sep 2026 a crawler put 421 pageviews through the
// storefront that PostHog's own bot detection scores as `$virt_is_bot = false`,
// `$virt_traffic_type = 'Regular'`. It drives a real headless Chrome, so the
// user agent is genuine and the built-in heuristics never fire.
//
// It is identifiable by a fingerprint no real visitor here matches:
//
//     $os = 'Linux', $device_type = 'Desktop', $referring_domain = 'www.google.com'
//
// The evidence that this bucket is pure automation, measured over 90 days:
//
//   * 421 pageviews across 421 sessions, exactly 1.000 per session. Real
//     traffic never does this. The worst genuinely-performing article on the
//     site still averages 1.25 pageviews per session, and a single session
//     with two pageviews anywhere in the bucket would disprove it.
//   * One distinct IP per pageview (rotating proxies), arriving in bursts:
//     27 hits on 26 Jul on one article, 22 more the same day on another.
//   * Top countries United States, United Kingdom, Japan. The storefront
//     sells in Pakistan and is 89% mobile.
//   * 13 URLs only, all of them the men's fertility and testosterone pages
//     (/product/repro-m, /product/x-fit, /product/fol-chew and the articles
//     around them). It reads as a competitor watching this store's supplement
//     SKUs rather than a general-purpose crawler.
//
// Why it is worth filtering: those 13 pages carry little real traffic, so the
// crawler owned their numbers outright. /blog/trimo-m-... reported 173
// sessions at a 0% product-page rate when its real readership was one
// session, and /blog/best-prenatal-vitamins-... had 24 of its 80 sessions
// faked, dragging a real 10.7% down to a reported 7.5%. Left in, it both
// invents traffic that can never buy and hides which articles genuinely
// underperform.
//
// The filter is deliberately narrow: it matches the full three-property
// fingerprint and nothing less. A Linux desktop visitor arriving any other
// way is untouched, which is why the `Linux / Desktop / $direct` bucket (168
// pageviews over 114 sessions, spread across 51 URLs, with Pakistan among its
// top countries) still reads as human and stays in the numbers.
//
// If the crawler changes shape, the fix is to widen this in one place rather
// than to re-derive it per panel.
// ============================================================================

/** The subset of PostHog event properties the scraper check looks at. */
export interface TrafficFingerprint {
  os?: string | null;
  deviceType?: string | null;
  referringDomain?: string | null;
}

export const SCRAPER_OS = 'Linux';
export const SCRAPER_DEVICE_TYPE = 'Desktop';
export const SCRAPER_REFERRING_DOMAIN = 'www.google.com';

/**
 * True when a hit carries the known scraper's full fingerprint.
 *
 * All three properties must match. Missing properties count as a non-match,
 * so an event that never carried `$os` is kept rather than dropped: the only
 * safe direction to fail is towards counting a visitor we are unsure about.
 */
export function isKnownScraper(fingerprint: TrafficFingerprint): boolean {
  return (
    (fingerprint.os ?? '') === SCRAPER_OS &&
    (fingerprint.deviceType ?? '') === SCRAPER_DEVICE_TYPE &&
    (fingerprint.referringDomain ?? '') === SCRAPER_REFERRING_DOMAIN
  );
}

/**
 * HogQL predicate that is true for every hit the scraper filter KEEPS.
 *
 * Parenthesised so it can be dropped into an `AND` chain without changing the
 * precedence of whatever surrounds it.
 */
export const NOT_SCRAPER_SQL =
  '(NOT (' +
  `coalesce(properties.\`$os\`, '') = '${SCRAPER_OS}'` +
  ` AND coalesce(properties.\`$device_type\`, '') = '${SCRAPER_DEVICE_TYPE}'` +
  ` AND coalesce(properties.\`$referring_domain\`, '') = '${SCRAPER_REFERRING_DOMAIN}'` +
  '))';

/**
 * HogQL predicate for "a real person on the storefront": not staff working in
 * /admin, and not the known scraper.
 *
 * Every analytics panel should filter on this rather than on either half
 * alone, so a new panel cannot quietly reintroduce the traffic the others
 * exclude.
 */
export const HUMAN_TRAFFIC_SQL =
  `(NOT startsWith(coalesce(properties.\`$pathname\`, ''), '/admin') AND ${NOT_SCRAPER_SQL})`;
