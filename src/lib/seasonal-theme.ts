// ── Seasonal storefront theme ────────────────────────────────────────────────
// A settings-driven event skin (first use: Independence Day, 14 August). The
// owner picks the theme and a start/end window in Admin → Settings → Homepage;
// inside the window the storefront dresses up (green announcement bar, hero
// overline), and when the window closes it reverts on its own — no deploy in
// either direction. Dates are authored in Pakistan time (the owner's clock).
//
// Server-side only decision: the active flag is computed where site settings
// are loaded (root layout / homepage) and passed down as props, so client
// components never read the clock and hydration stays deterministic. Pages
// are ISR-cached (≤1h), so the switch-over lands within the hour.

export type SeasonalThemeKey = 'independence';

export interface SeasonalTheme {
  key: SeasonalThemeKey;
  /** Announcement-bar message (full width). */
  message: string;
  /** Short phone variant of the message. */
  compactMessage: string;
  /** Coupon code advertised in the bar and hero, null = no code shown. */
  coupon: string | null;
  /** Bar / accent colours. Pakistan flag green with white text. */
  barColor: string;
  textColor: string;
}

export const INDEPENDENCE_GREEN = '#01411C';

const DEFAULT_MESSAGE = 'Azadi Sale is live: 14% off storewide with code AZADI14';
const DEFAULT_COMPACT = '14% off with code AZADI14';

/** Parse an owner-authored datetime-local value ("2026-08-10T00:00", seconds
 *  optional, date-only allowed) as Pakistan Standard Time (UTC+5, no DST). */
export function parsePktDate(value: string | undefined | null): Date | null {
  const v = (value ?? '').trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return new Date(`${v}T00:00:00+05:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v)) return new Date(`${v}:00+05:00`);
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(v)) return new Date(`${v}+05:00`);
  const d = new Date(v); // full ISO with explicit offset, stored by tools
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The theme to render right now, or null when no theme is active. `now` is
 *  injectable for tests; callers on the server pass nothing. */
export function activeSeasonalTheme(
  settings: Record<string, string>,
  now: Date = new Date(),
): SeasonalTheme | null {
  if ((settings.seasonal_theme ?? '').trim() !== 'independence') return null;
  const start = parsePktDate(settings.seasonal_theme_start);
  const end = parsePktDate(settings.seasonal_theme_end);
  if (start && now < start) return null;
  if (end && now >= end) return null;
  const coupon = (settings.seasonal_theme_coupon ?? '').trim() || null;
  const message = (settings.seasonal_theme_message ?? '').trim() || DEFAULT_MESSAGE;
  return {
    key: 'independence',
    message,
    compactMessage: coupon ? `14 August: use code ${coupon}` : DEFAULT_COMPACT,
    coupon,
    barColor: INDEPENDENCE_GREEN,
    textColor: '#ffffff',
  };
}
