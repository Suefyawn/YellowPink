// ============================================================================
// Where a consent prompt is actually required.
//
// The banner used to be shown to everyone. Measured over the 90 days to 15 Sep
// 2026, only 28.2% of sessions ever answered it: 2,073 of 2,887 never did.
// Google Analytics, Microsoft Clarity and the Meta Pixel are each gated on an
// answer (see their components), so for those 72% none of the three ever
// loaded. That is not a friction problem, it is a measurement blackout: the
// Pixel could not attribute or retarget most visitors, and Clarity was only
// ever recording the minority who clicked a button.
//
// Meanwhile the traffic that genuinely needs the prompt is small. Same window,
// by visitor region: Pakistan 2,367 sessions, rest of world 389, and
// EEA / UK / Switzerland 87 — 3.1%.
//
// So the prompt is shown where consent is required and skipped where it is
// not, rather than shown to everyone and answered by almost nobody.
//
// ── Why timezone rather than an IP lookup ──────────────────────────────────
// A country header would be more precise, but there is no durable source for
// one here. There is no middleware, nothing reads a country header today, and
// Vercel’s `x-vercel-ip-country` does not exist on
// Cloudflare Workers (cf-ipcountry is available there), so a timezone
// read from the browser works identically on both, needs no request header, no
// GeoIP database and no third-party lookup.
//
// It is coarser than IP: a European traveller in Karachi reads as Pakistan, and
// a Pakistani visitor whose device is set to a European timezone reads as
// Europe. The error in the second direction is harmless (they see a prompt they
// did not need). The first is the reason the rule below is deliberately wide,
// covering all of Europe/* rather than only the EEA member states, plus the
// EU's outermost regions, so the prompt appears for more people than strictly
// owe one rather than fewer.
//
// ── Failing safe ───────────────────────────────────────────────────────────
// Every uncertain case resolves to "required": no timezone, an unreadable one,
// an Intl implementation that throws. Showing a prompt to someone who did not
// need it costs a tap. Not showing one to someone who did is the failure that
// matters, so ambiguity always resolves that way.
// ============================================================================

/**
 * Timezones outside the Europe/* prefix that still sit in the EEA, or in EU
 * territory where GDPR applies. Without these, a shopper in Réunion or the
 * Canaries would be treated as needing no prompt.
 */
const NON_EUROPE_PREFIX_ZONES = new Set([
  'Atlantic/Canary',      // Spain
  'Atlantic/Madeira',     // Portugal
  'Atlantic/Azores',      // Portugal
  'Atlantic/Reykjavik',   // Iceland (EEA)
  'Atlantic/Faroe',       // Denmark
  'Indian/Reunion',       // France
  'Indian/Mayotte',       // France
  'America/Martinique',   // France
  'America/Guadeloupe',   // France
  'America/Cayenne',      // French Guiana
  'America/Miquelon',     // France
  'Arctic/Longyearbyen',  // Norway (EEA)
]);

/**
 * Does a visitor in this timezone need to be asked before analytics and
 * marketing scripts load?
 *
 * Returns true for anything it cannot place, which is the safe direction.
 */
export function consentRequiredForTimezone(timezone: string | null | undefined): boolean {
  if (!timezone || typeof timezone !== 'string') return true;
  const tz = timezone.trim();
  if (!tz) return true;

  // Matched case-insensitively on purpose. Browsers emit canonical IANA casing
  // ('Europe/Berlin'), so anything else is input we did not expect — and a
  // case-sensitive check would have read 'europe/berlin' as an unremarkable
  // foreign zone and skipped the prompt. Unexpected input must not be the one
  // path that fails open.
  const lower = tz.toLowerCase();
  if (lower.startsWith('europe/')) return true;
  for (const zone of NON_EUROPE_PREFIX_ZONES) {
    if (zone.toLowerCase() === lower) return true;
  }
  // A recognisable zone somewhere else in the world: Asia/Karachi, America/
  // New_York, Australia/Sydney. Contains a region separator, so it parsed as a
  // real IANA name rather than something malformed.
  if (lower.includes('/')) return false;
  // 'UTC', 'GMT', or anything without a region. Could be anyone, anywhere.
  return true;
}

/** The browser's IANA timezone, or null when it cannot be read. */
export function readTimezone(): string | null {
  if (typeof Intl === 'undefined') return null;
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}

/**
 * Whether this visitor must be asked. Reads the browser timezone; on the
 * server, or anywhere the timezone cannot be read, the answer is yes.
 */
export function consentRequiredHere(): boolean {
  if (typeof window === 'undefined') return true;
  return consentRequiredForTimezone(readTimezone());
}
