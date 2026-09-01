// ── Sale events (the occasions library) ─────────────────────────────────────
// Owner directive, 1 Sep 2026: every sale occasion the store runs during the
// year (Eid, Azadi, 11.11, Blessed Friday…) keeps a saved "version" of the
// storefront — theme, hero copy, announcement bar, coupon — so next year the
// sale is one click, not an evening of retyping into Branding.
//
// A sale event does NOT add a second theming pipeline. Activating one simply
// copies its saved fields into the existing seasonal-theme settings keys
// (src/lib/seasonal-theme.ts resolves those exactly as before), so the
// storefront code path is unchanged and Branding remains the manual escape
// hatch. The rows live in public.sale_events (service-role only, managed
// from Admin → Marketing → Sales & occasions).

export interface SaleEvent {
  id: string;
  key: string;
  name: string;
  /** STORE_THEMES key that skins the storefront while this event runs. */
  theme: string;
  /** Inclusive first / last day of this year's window (PKT), null = the
   *  owner hasn't set this year's dates yet ("Turn on now" still works). */
  starts_on: string | null;
  ends_on: string | null;
  bar_message: string | null;
  bar_coupon: string | null;
  hero_overline: string | null;
  hero_headline: string | null;
  hero_subline: string | null;
  hero_cta1_text: string | null;
  hero_cta1_url: string | null;
  hero_image_url: string | null;
  /** Owner-facing guidance ("no discounts on this day", date rules…). */
  notes: string | null;
  sort_order: number;
}

/** The settings keys an activation writes. Kept in one place so the admin
 *  action, the tests and seasonal-theme.ts can never drift apart. */
export const SEASONAL_SETTING_KEYS = [
  'season_active', 'active_theme', 'seasonal_theme',
  'seasonal_theme_start', 'seasonal_theme_end',
  'seasonal_theme_message', 'seasonal_theme_coupon',
  'season_hero_overline', 'season_hero_headline', 'season_hero_subline',
  'season_hero_cta1_text', 'season_hero_cta1_url', 'season_hero_image_url',
] as const;

export type ActivationMode = 'now' | 'schedule';

/** Day AFTER an inclusive end date, as a PKT datetime-local string — the
 *  seasonal window treats `end` as exclusive (see scheduledWindowOpen). */
export function exclusiveEnd(endsOn: string): string {
  const d = new Date(`${endsOn}T00:00:00+05:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  // Render back as a PKT wall-clock date (the +5h offset restores the date
  // component that toISOString's UTC rendering would otherwise shift).
  const pkt = new Date(d.getTime() + 5 * 60 * 60 * 1000);
  return `${pkt.toISOString().slice(0, 10)}T00:00`;
}

/**
 * The settings writes that turn a sale event on. Pure so it's unit-testable;
 * the server action feeds the result to the same site_settings upsert the
 * Branding card uses.
 *
 * mode 'now'      → manual switch on, any schedule cleared.
 * mode 'schedule' → armed for the event's window (both dates required).
 */
export function saleEventToSeasonalSettings(
  event: SaleEvent,
  mode: ActivationMode,
): { settings: Record<string, string>; error: string | null } {
  const base: Record<string, string> = {
    active_theme: event.theme,
    seasonal_theme_message: event.bar_message ?? '',
    seasonal_theme_coupon: event.bar_coupon ?? '',
    season_hero_overline: event.hero_overline ?? '',
    season_hero_headline: event.hero_headline ?? '',
    season_hero_subline: event.hero_subline ?? '',
    season_hero_cta1_text: event.hero_cta1_text ?? '',
    season_hero_cta1_url: event.hero_cta1_url ?? '',
    season_hero_image_url: event.hero_image_url ?? '',
  };
  if (mode === 'now') {
    return {
      settings: { ...base, season_active: 'true', seasonal_theme: '', seasonal_theme_start: '', seasonal_theme_end: '' },
      error: null,
    };
  }
  if (!event.starts_on || !event.ends_on) {
    return { settings: {}, error: 'Set this year’s start and end dates first, then schedule it.' };
  }
  if (event.ends_on < event.starts_on) {
    return { settings: {}, error: 'The end date must be on or after the start date.' };
  }
  return {
    settings: {
      ...base,
      season_active: 'false',
      seasonal_theme: event.theme,
      seasonal_theme_start: `${event.starts_on}T00:00`,
      seasonal_theme_end: exclusiveEnd(event.ends_on),
    },
    error: null,
  };
}

/** Settings writes that turn every seasonal look off (the one "Turn off"
 *  button on the Sales page — same effect as Branding's Off mode). */
export function seasonOffSettings(): Record<string, string> {
  return { season_active: 'false', seasonal_theme: '', seasonal_theme_start: '', seasonal_theme_end: '' };
}
