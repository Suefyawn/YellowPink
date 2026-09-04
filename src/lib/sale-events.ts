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
  /** Autopilot: run this look every cycle over its stored window without the
   *  owner arming anything (owner ask, 1 Sep 2026). Dates still need their
   *  yearly refresh — the resolver only trusts the stored window. */
  auto_schedule: boolean;
  sort_order: number;
  /** The discount behind bar_coupon (migration 1330). Optional in the type so
   *  older fixtures and rows read before the migration still type-check; the
   *  mapper below applies the column defaults. */
  coupon_type?: SaleEventCouponType | null;
  coupon_value?: number | string | null;
  coupon_min_order?: number | string | null;
  coupon_max_uses?: number | null;
  coupon_per_user?: number | null;
  coupon_exclude_sale_items?: boolean | null;
}

export type SaleEventCouponType = 'percent' | 'fixed' | 'free_shipping';

/** Marker written into coupons.description so the retire step only ever
 *  touches codes this page created or adopted. */
export const SALE_EVENT_COUPON_MARK = 'Sales & occasions:';

/** The public.coupons row an activation writes for the event's bar code.
 *  Pure, so the action, the autopilot cron and the tests share one truth. */
export interface SaleEventCouponRow {
  code: string;
  trigger_kind: 'code';
  type: 'percent' | 'fixed';
  discount_type: 'percent' | 'fixed';
  value: number;
  free_shipping: boolean;
  min_order: number;
  max_uses: number | null;
  usage_limit_per_user: number | null;
  exclude_sale_items: boolean;
  active: true;
  starts_at: string | null;
  expires_at: string | null;
  description: string;
}

const pktIso = (dayT00: string) => new Date(`${dayT00}:00+05:00`).toISOString();

/**
 * Build the coupon row for an event, or null when the event carries no
 * usable discount (no code, or a percent/fixed coupon with a zero value).
 *
 * Window: a manual "Turn on now" makes the code usable immediately and still
 * expires it with the occasion's end date when there is one; a schedule (and
 * the autopilot calendar) binds it to the window exactly as the storefront
 * bar shows it, so a code can't be redeemed before the sale opens.
 */
export function saleEventCouponRow(event: SaleEvent, mode: ActivationMode): SaleEventCouponRow | null {
  const code = (event.bar_coupon ?? '').trim().toUpperCase();
  if (!code || !/^[A-Z0-9_-]+$/.test(code)) return null;
  const kind: SaleEventCouponType = event.coupon_type ?? 'percent';
  const value = Math.max(0, Number(event.coupon_value ?? 10) || 0);
  if (kind !== 'free_shipping' && value <= 0) return null;
  if (kind === 'percent' && value > 100) return null;
  const startsAt = mode === 'schedule' && event.starts_on ? pktIso(`${event.starts_on}T00:00`) : null;
  const expiresAt = event.ends_on ? pktIso(exclusiveEnd(event.ends_on)) : null;
  return {
    code,
    trigger_kind: 'code',
    type: kind === 'fixed' ? 'fixed' : 'percent',
    discount_type: kind === 'fixed' ? 'fixed' : 'percent',
    value: kind === 'free_shipping' ? 0 : value,
    free_shipping: kind === 'free_shipping',
    min_order: Math.max(0, Number(event.coupon_min_order ?? 0) || 0),
    max_uses: event.coupon_max_uses ?? null,
    usage_limit_per_user: event.coupon_per_user ?? null,
    exclude_sale_items: Boolean(event.coupon_exclude_sale_items),
    active: true,
    starts_at: startsAt,
    expires_at: expiresAt,
    description: `${SALE_EVENT_COUPON_MARK} ${event.name}. Created and kept in step by the occasion; edit its discount on the occasion card.`,
  };
}

/** One-line human summary of the discount an occasion carries, for the card. */
export function describeSaleEventCoupon(event: SaleEvent): string | null {
  const row = saleEventCouponRow(event, 'now');
  if (!row) return null;
  const what = row.free_shipping
    ? 'free delivery'
    : row.type === 'percent' ? `${row.value}% off` : `PKR ${row.value.toLocaleString('en-PK')} off`;
  const parts = [what];
  if (row.min_order > 0) parts.push(`orders over PKR ${row.min_order.toLocaleString('en-PK')}`);
  if (row.usage_limit_per_user) parts.push(`${row.usage_limit_per_user} per customer`);
  if (row.max_uses) parts.push(`${row.max_uses} uses total`);
  return parts.join(', ');
}

/** The settings keys an activation writes. Kept in one place so the admin
 *  action, the tests and seasonal-theme.ts can never drift apart. */
export const SEASONAL_SETTING_KEYS = [
  'season_active', 'active_theme', 'seasonal_theme',
  'seasonal_theme_start', 'seasonal_theme_end',
  'seasonal_theme_message', 'seasonal_theme_coupon',
  'season_hero_overline', 'season_hero_headline', 'season_hero_subline',
  'season_hero_cta1_text', 'season_hero_cta1_url', 'season_hero_image_url',
  'seasonal_source_event', 'season_auto_snooze',
] as const;

export type ActivationMode = 'now' | 'schedule';

/** Per-theme swatches for the admin's storefront mock-ups, mirroring the
 *  `:root[data-theme=…]` palette blocks in globals.css (paper = page ground,
 *  accent = the dark CTA/text tone, yellow = the theme's gold). Keep in sync
 *  with the CSS — the mock exists so the owner sees the real look before
 *  clicking "Turn on now". */
export const THEME_PREVIEW: Record<string, { paper: string; accent: string; yellow: string }> = {
  default:      { paper: '#FAF6EE', accent: '#C5286A', yellow: '#F7C948' },
  eid:          { paper: '#FBF6EA', accent: '#AE2766', yellow: '#D4A431' },
  sale:         { paper: '#FFFFFF', accent: '#D11148', yellow: '#FFC400' },
  christmas:    { paper: '#FBF4EF', accent: '#9E1528', yellow: '#C99A3C' },
  easter:       { paper: '#FBF7F4', accent: '#A33D6E', yellow: '#EFC65C' },
  independence: { paper: '#F8FBF8', accent: '#0E5A2F', yellow: '#E5B93C' },
  ramadan:      { paper: '#F7F9FC', accent: '#1B3A5C', yellow: '#C9A227' },
  women:        { paper: '#FCF7FB', accent: '#6E2670', yellow: '#E7B23C' },
  blackfriday:  { paper: '#F4F8F7', accent: '#0B4F43', yellow: '#D4A72C' },
  mourning:     { paper: '#F5F5F4', accent: '#18181B', yellow: '#A8A29E' },
};

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
    // Which library card is wearing the crown. Lets the admin show an exact
    // LIVE/SCHEDULED badge and propagate edits of the live event; cleared by
    // "turn off". Purely informational for the storefront resolver.
    seasonal_source_event: event.key,
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
      settings: {
        ...base, season_active: 'true', seasonal_theme: '',
        seasonal_theme_start: '', seasonal_theme_end: '', season_auto_snooze: '',
      },
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
      season_auto_snooze: '',
    },
    error: null,
  };
}

// ── Autopilot ───────────────────────────────────────────────────────────────
// "Schedule them according to their dates on annual cycles" (owner,
// 1 Sep 2026): occasions with auto_schedule run BY THEMSELVES over their
// stored windows. The storefront resolver overlays the picked event as an
// armed schedule (same settings shape as clicking Schedule), so the client
// clock still opens and closes the window to the minute. Explicit choices
// always win: a manual "Turn on now" or an owner-armed schedule suppresses
// the calendar entirely.

/** How early the overlay is applied ahead of a window opening. The overlay
 *  is window-gated, so arming early changes nothing visually — it just lets
 *  the (≤1h-cached) page shell carry the window before midnight, and the
 *  client clock flips the look exactly on time. */
const AUTO_ARM_AHEAD_MS = 24 * 60 * 60 * 1000;

const pktStartMs = (day: string) => new Date(`${day}T00:00:00+05:00`).getTime();

/** The occasion the calendar wants right now (or armed for the next day):
 *  smallest window wins an overlap (the more specific occasion, e.g. Eid
 *  Milad inside Azadi week), an already-open window beats a pre-armed one. */
export function pickAutoEvent(events: SaleEvent[], now: Date = new Date()): SaleEvent | null {
  const t = now.getTime();
  const scored = events
    .filter(e =>
      e.auto_schedule !== false && e.starts_on && e.ends_on &&
      e.theme && e.theme !== 'default' &&
      e.ends_on >= e.starts_on)
    .map(e => {
      const start = pktStartMs(e.starts_on!);
      const endEx = pktStartMs(e.ends_on!) + 24 * 60 * 60 * 1000;
      return { e, start, endEx, open: t >= start && t < endEx };
    })
    .filter(c => t >= c.start - AUTO_ARM_AHEAD_MS && t < c.endEx);
  if (scored.length === 0) return null;
  scored.sort((a, b) =>
    Number(b.open) - Number(a.open) ||
    (a.endEx - a.start) - (b.endEx - b.start) ||
    a.e.sort_order - b.e.sort_order);
  return scored[0].e;
}

/** True while "Turn seasonal look off" has snoozed THIS event's current
 *  window (stored as "<key>@<PKT datetime>"). A different occasion's window
 *  still runs — turning one sale off doesn't kill the whole year. */
export function autoSnoozed(
  event: Pick<SaleEvent, 'key'>,
  settings: Record<string, string>,
  now: Date = new Date(),
): boolean {
  const raw = (settings.season_auto_snooze ?? '').trim();
  const at = raw.indexOf('@');
  if (at < 1) return false;
  const key = raw.slice(0, at);
  if (key !== event.key) return false;
  const until = new Date(`${raw.slice(at + 1)}:00+05:00`);
  return !Number.isNaN(until.getTime()) && now < until;
}

/** The snooze value turnOffSeason stores while an autopilot window is open. */
export function autoSnoozeValue(event: SaleEvent): string {
  return `${event.key}@${exclusiveEnd(event.ends_on!)}`;
}

/** True when the stored settings carry an explicit owner choice (manual
 *  switch or an armed schedule) — the calendar must stand down. */
export function explicitLookConfigured(settings: Record<string, string>): boolean {
  if ((settings.seasonal_theme ?? '').trim()) return true;
  return settings.season_active === 'true';
}

/** Settings writes that turn every seasonal look off (the one "Turn off"
 *  button on the Sales page — same effect as Branding's Off mode). */
export function seasonOffSettings(): Record<string, string> {
  return {
    season_active: 'false', seasonal_theme: '',
    seasonal_theme_start: '', seasonal_theme_end: '',
    seasonal_source_event: '',
  };
}

/** How the current settings relate to one library event: is this card the
 *  one that's live (or armed), and in which mode? Pure, for the admin page. */
export function eventActivationState(
  event: Pick<SaleEvent, 'key'>,
  settings: Record<string, string>,
): 'live' | 'scheduled' | null {
  if ((settings.seasonal_source_event ?? '') !== event.key) return null;
  if (settings.season_active === 'true') return 'live';
  if ((settings.seasonal_theme ?? '').trim()) return 'scheduled';
  return null;
}
