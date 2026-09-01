// ── Seasonal storefront theme ────────────────────────────────────────────────
// ONE resolver decides which seasonal look the storefront wears right now.
// The owner controls it from Admin → Settings → Branding with two choices:
//
//   • Theme — which look (Eid, Sale, Christmas, Easter, Independence Day).
//   • When — Off / On now (manual, until switched off) / Scheduled
//     (turns itself on at a start time and off at an end time, Pakistan time).
//
// Backing settings keys (written by saveSeasonalTheme in admin actions):
//   season_active          'true' while mode is "On now"
//   active_theme           the manual theme key
//   seasonal_theme         the scheduled theme key ('' = no schedule)
//   seasonal_theme_start / seasonal_theme_end   the window, authored in PKT
//   seasonal_theme_message / seasonal_theme_coupon   announcement bar content
//
// A scheduled window that is open takes precedence over the manual switch.
// The decision is made SERVER-side (root layout / homepage) and passed down
// as props, so client components never read the clock and hydration stays
// deterministic. Pages are ISR-cached (≤1h), so flips land within the hour.

import { normalizeTheme } from '@/lib/themes';

export interface SeasonalTheme {
  /** A non-default key from STORE_THEMES (drives the data-theme palette). */
  key: string;
  /** Why it is active: an open scheduled window, or the manual switch. */
  source: 'scheduled' | 'manual';
  /** Announcement-bar message. Null = no seasonal bar (palette + hero only). */
  message: string | null;
  /** Short phone variant of the message. */
  compactMessage: string | null;
  /** Coupon code shown in the bar's pill, null = no code shown. */
  coupon: string | null;
  /** Bar colours — the theme's dark accent with white text. */
  barColor: string;
  textColor: string;
}

// Bar background per theme: the same dark accent tone that carries text in
// each palette block in globals.css, so the bar always matches the skin.
export const BAR_COLORS: Record<string, string> = {
  independence: '#01411C',
  eid: '#AE2766',
  sale: '#D11148',
  christmas: '#9E1528',
  easter: '#A33D6E',
  ramadan: '#1B3A5C',
  women: '#6E2670',
  blackfriday: '#111111',
};

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

/** True when the scheduled window (if any) is open at `now`. Missing dates
 *  are open-ended on that side. */
export function scheduledWindowOpen(settings: Record<string, string>, now: Date): boolean {
  const start = parsePktDate(settings.seasonal_theme_start);
  const end = parsePktDate(settings.seasonal_theme_end);
  if (start && now < start) return false;
  if (end && now >= end) return false;
  return true;
}

function presentation(key: string, source: 'scheduled' | 'manual', settings: Record<string, string>): SeasonalTheme {
  const coupon = (settings.seasonal_theme_coupon ?? '').trim() || null;
  const message = (settings.seasonal_theme_message ?? '').trim() || null;
  return {
    key,
    source,
    message,
    compactMessage: message ? (coupon ? `Use code ${coupon}` : message) : null,
    coupon,
    barColor: BAR_COLORS[key] ?? '#111827',
    textColor: '#ffffff',
  };
}

// ── Admin form mapping ──────────────────────────────────────────────────────
// The Branding page exposes ONE mental model (a theme + when it runs) and this
// mapping turns it into the backing keys. Pure so it can be unit-tested.

export type SeasonalMode = 'off' | 'now' | 'schedule';

/** Rewrites the form's meta fields (seasonal_mode, seasonal_theme_pick) into
 *  the real settings keys, in place. Returns a user-facing error, or null. */
export function applySeasonalModeMapping(map: Map<string, string>): string | null {
  const mode = (map.get('seasonal_mode') ?? 'off') as SeasonalMode;
  const theme = (map.get('seasonal_theme_pick') ?? '').trim();
  map.delete('seasonal_mode');
  map.delete('seasonal_theme_pick');

  if (mode === 'off') {
    map.set('season_active', 'false');
    map.set('seasonal_theme', '');
    return null;
  }
  if (!theme || theme === 'default' || normalizeTheme(theme) !== theme) {
    return 'Pick a theme for the seasonal look.';
  }
  if (mode === 'now') {
    map.set('season_active', 'true');
    map.set('active_theme', theme);
    map.set('seasonal_theme', '');
    return null;
  }
  // schedule
  const start = parsePktDate(map.get('seasonal_theme_start'));
  const end = parsePktDate(map.get('seasonal_theme_end'));
  if (!start || !end) return 'A scheduled theme needs both a start and an end time.';
  if (end <= start) return 'The end time must be after the start time.';
  map.set('season_active', 'false');
  map.set('active_theme', theme); // keeps the picker sticky between mode switches
  map.set('seasonal_theme', theme);
  return null;
}

/** The seasonal theme the storefront should wear right now, or null for the
 *  default look. `now` is injectable for tests; server callers pass nothing. */
export function activeSeasonalTheme(
  settings: Record<string, string>,
  now: Date = new Date(),
): SeasonalTheme | null {
  // Scheduled window first — it runs itself regardless of the manual switch.
  const scheduledKey = (settings.seasonal_theme ?? '').trim();
  if (scheduledKey && normalizeTheme(scheduledKey) === scheduledKey && scheduledKey !== 'default'
      && scheduledWindowOpen(settings, now)) {
    return presentation(scheduledKey, 'scheduled', settings);
  }
  // Manual switch. The default theme is never "seasonal": it must not enable
  // the seasonal hero override or the bar (season_active=true + default was
  // exactly the trap that leaked the Azadi hero early on 2 Aug).
  if (settings.season_active === 'true') {
    const manualKey = normalizeTheme(settings.active_theme);
    if (manualKey !== 'default') return presentation(manualKey, 'manual', settings);
  }
  return null;
}
