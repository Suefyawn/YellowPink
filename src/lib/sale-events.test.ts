import { describe, it, expect } from 'vitest';
import {
  saleEventToSeasonalSettings, seasonOffSettings, exclusiveEnd,
  eventActivationState, pickAutoEvent, autoSnoozed, autoSnoozeValue,
  explicitLookConfigured, type SaleEvent,
} from './sale-events';
import { activeSeasonalTheme } from './seasonal-theme';

const event = (over: Partial<SaleEvent> = {}): SaleEvent => ({
  id: '00000000-0000-0000-0000-000000000001',
  key: 'azadi',
  name: 'Azadi Sale',
  theme: 'independence',
  starts_on: '2026-08-01',
  ends_on: '2026-08-14',
  bar_message: 'Azadi Sale: up to 25% off till 14 August',
  bar_coupon: 'AZADI',
  hero_overline: '14 August',
  hero_headline: 'Azadi Sale',
  hero_subline: 'Freedom-week prices.',
  hero_cta1_text: 'Shop the sale',
  hero_cta1_url: '/shop',
  hero_image_url: null,
  notes: null,
  auto_schedule: true,
  sort_order: 80,
  ...over,
});

describe('exclusiveEnd', () => {
  it('returns the day after the inclusive end date', () => {
    expect(exclusiveEnd('2026-08-14')).toBe('2026-08-15T00:00');
  });
  it('rolls over month ends', () => {
    expect(exclusiveEnd('2026-11-30')).toBe('2026-12-01T00:00');
  });
});

describe('saleEventToSeasonalSettings', () => {
  it('"now" flips the manual switch and clears any schedule', () => {
    const { settings, error } = saleEventToSeasonalSettings(event(), 'now');
    expect(error).toBeNull();
    expect(settings.season_active).toBe('true');
    expect(settings.active_theme).toBe('independence');
    expect(settings.seasonal_theme).toBe('');
    expect(settings.seasonal_theme_message).toBe('Azadi Sale: up to 25% off till 14 August');
    expect(settings.seasonal_theme_coupon).toBe('AZADI');
    expect(settings.season_hero_headline).toBe('Azadi Sale');
    // …and the storefront resolver actually turns the look on.
    expect(activeSeasonalTheme(settings)?.key).toBe('independence');
  });

  it('"schedule" arms the window and the resolver opens it on time', () => {
    const { settings, error } = saleEventToSeasonalSettings(event(), 'schedule');
    expect(error).toBeNull();
    expect(settings.season_active).toBe('false');
    expect(settings.seasonal_theme).toBe('independence');
    expect(settings.seasonal_theme_start).toBe('2026-08-01T00:00');
    expect(settings.seasonal_theme_end).toBe('2026-08-15T00:00');
    // Before the window: off. Inside: on. On the day after the inclusive end: off.
    expect(activeSeasonalTheme(settings, new Date('2026-07-31T18:59:00Z'))).toBeNull();
    expect(activeSeasonalTheme(settings, new Date('2026-08-14T12:00:00Z'))?.key).toBe('independence');
    expect(activeSeasonalTheme(settings, new Date('2026-08-14T19:01:00Z'))).toBeNull(); // 15 Aug 00:01 PKT
  });

  it('"schedule" without dates returns an actionable error', () => {
    const { settings, error } = saleEventToSeasonalSettings(event({ starts_on: null, ends_on: null }), 'schedule');
    expect(error).toMatch(/dates/);
    expect(Object.keys(settings)).toHaveLength(0);
  });

  it('rejects an end date before the start date', () => {
    const { error } = saleEventToSeasonalSettings(event({ starts_on: '2026-08-14', ends_on: '2026-08-01' }), 'schedule');
    expect(error).toMatch(/end date/);
  });

  it('a quiet event (no bar, no coupon) clears the message keys', () => {
    const { settings } = saleEventToSeasonalSettings(
      event({ bar_message: null, bar_coupon: null, hero_headline: null }), 'now');
    expect(settings.seasonal_theme_message).toBe('');
    expect(settings.seasonal_theme_coupon).toBe('');
    const live = activeSeasonalTheme(settings);
    expect(live?.message).toBeNull();
    expect(live?.coupon).toBeNull();
  });
});

describe('seasonOffSettings', () => {
  it('turns everything off for the resolver', () => {
    const { settings } = saleEventToSeasonalSettings(event(), 'now');
    const off = { ...settings, ...seasonOffSettings() };
    expect(activeSeasonalTheme(off)).toBeNull();
  });
});

describe('pickAutoEvent (the occasions autopilot)', () => {
  // 12:00 PKT on 10 Aug 2026 = 07:00 UTC.
  const during = new Date('2026-08-10T07:00:00Z');

  it('picks the occasion whose window is open', () => {
    expect(pickAutoEvent([event()], during)?.key).toBe('azadi');
  });

  it('arms an occasion up to a day before its window (window still gates the look)', () => {
    const dayBefore = new Date('2026-07-31T07:00:00Z');
    const ev = pickAutoEvent([event()], dayBefore);
    expect(ev?.key).toBe('azadi');
    // …but the overlaid settings only open on the client at the start time:
    const { settings } = saleEventToSeasonalSettings(ev!, 'schedule');
    expect(activeSeasonalTheme(settings, dayBefore)).toBeNull();
    expect(activeSeasonalTheme(settings, during)?.key).toBe('independence');
  });

  it('an overlapping shorter window wins (the more specific occasion)', () => {
    const milad = event({ key: 'eid-milad', theme: 'eid', starts_on: '2026-08-09', ends_on: '2026-08-11', sort_order: 200 });
    expect(pickAutoEvent([event(), milad], during)?.key).toBe('eid-milad');
  });

  it('an open window beats a merely pre-armed one', () => {
    const tomorrow = event({ key: 'defence-day', starts_on: '2026-08-11', ends_on: '2026-08-11', sort_order: 1 });
    expect(pickAutoEvent([event(), tomorrow], during)?.key).toBe('azadi');
  });

  it('skips occasions taken off the calendar or without dates', () => {
    expect(pickAutoEvent([event({ auto_schedule: false })], during)).toBeNull();
    expect(pickAutoEvent([event({ starts_on: null, ends_on: null })], during)).toBeNull();
  });

  it('returns null outside every window', () => {
    expect(pickAutoEvent([event()], new Date('2026-09-20T07:00:00Z'))).toBeNull();
  });
});

describe('autoSnoozed + explicitLookConfigured', () => {
  const during = new Date('2026-08-10T07:00:00Z');

  it('turn-off snoozes only THIS window of THIS occasion', () => {
    const settings = { season_auto_snooze: autoSnoozeValue(event()) };
    expect(autoSnoozed(event(), settings, during)).toBe(true);
    // Different occasion: not snoozed.
    expect(autoSnoozed(event({ key: 'eid-milad' }), settings, during)).toBe(false);
    // After the window's exclusive end (15 Aug 00:00 PKT): expired.
    expect(autoSnoozed(event(), settings, new Date('2026-08-14T20:00:00Z'))).toBe(false);
  });

  it('an explicit manual or armed look suppresses the calendar', () => {
    expect(explicitLookConfigured({ season_active: 'true', active_theme: 'eid' })).toBe(true);
    expect(explicitLookConfigured({ seasonal_theme: 'sale' })).toBe(true);
    expect(explicitLookConfigured({ season_active: 'false', seasonal_theme: '' })).toBe(false);
  });
});

describe('eventActivationState (the LIVE/SCHEDULED badge)', () => {
  it('records which event was activated, and in which mode', () => {
    const now = saleEventToSeasonalSettings(event(), 'now').settings;
    expect(now.seasonal_source_event).toBe('azadi');
    expect(eventActivationState(event(), now)).toBe('live');
    expect(eventActivationState(event({ key: 'eid-ul-fitr' }), now)).toBeNull();

    const armed = saleEventToSeasonalSettings(event(), 'schedule').settings;
    expect(eventActivationState(event(), armed)).toBe('scheduled');
  });

  it('turning the season off clears the source event', () => {
    const settings = { ...saleEventToSeasonalSettings(event(), 'now').settings, ...seasonOffSettings() };
    expect(eventActivationState(event(), settings)).toBeNull();
    expect(settings.seasonal_source_event).toBe('');
  });
});

// ── Coupons publish with the look (migration 1330) ──────────────────────────
import { saleEventCouponRow, describeSaleEventCoupon } from './sale-events';

describe('saleEventCouponRow', () => {
  it('maps a percent occasion to an active coupon bounded to the window when scheduled', () => {
    const row = saleEventCouponRow(event({ coupon_type: 'percent', coupon_value: 14, coupon_min_order: 1500, coupon_per_user: 1 }), 'schedule');
    expect(row).toMatchObject({ code: 'AZADI', type: 'percent', value: 14, free_shipping: false, min_order: 1500, usage_limit_per_user: 1, active: true, trigger_kind: 'code' });
    // 1 Aug 00:00 PKT → 31 Jul 19:00 UTC; ends_on 14 Aug inclusive → opens 15 Aug 00:00 PKT.
    expect(row!.starts_at).toBe('2026-07-31T19:00:00.000Z');
    expect(row!.expires_at).toBe('2026-08-14T19:00:00.000Z');
    expect(row!.description.startsWith('Sales & occasions:')).toBe(true);
  });

  it('a manual "turn on now" makes the code usable immediately but still ends with the occasion', () => {
    const row = saleEventCouponRow(event({ coupon_value: 20 }), 'now');
    expect(row!.starts_at).toBeNull();
    expect(row!.expires_at).toBe('2026-08-14T19:00:00.000Z');
  });

  it('applies the column defaults when the row predates the migration', () => {
    const row = saleEventCouponRow(event(), 'now');
    expect(row).toMatchObject({ type: 'percent', value: 10, min_order: 0, max_uses: null, usage_limit_per_user: null, exclude_sale_items: false });
  });

  it('free delivery writes a zero-value free_shipping coupon', () => {
    const row = saleEventCouponRow(event({ coupon_type: 'free_shipping', coupon_value: 0 }), 'now');
    expect(row).toMatchObject({ type: 'percent', value: 0, free_shipping: true });
  });

  it('refuses to create a dead or nonsensical code', () => {
    expect(saleEventCouponRow(event({ bar_coupon: null }), 'now')).toBeNull();
    expect(saleEventCouponRow(event({ bar_coupon: 'bad code!' }), 'now')).toBeNull();
    expect(saleEventCouponRow(event({ coupon_value: 0 }), 'now')).toBeNull();
    expect(saleEventCouponRow(event({ coupon_type: 'percent', coupon_value: 150 }), 'now')).toBeNull();
  });

  it('upper-cases the code and never binds a start when there is no start date', () => {
    const row = saleEventCouponRow(event({ bar_coupon: 'eidi', starts_on: null, ends_on: null }), 'schedule');
    expect(row!.code).toBe('EIDI');
    expect(row!.starts_at).toBeNull();
    expect(row!.expires_at).toBeNull();
  });
});

describe('describeSaleEventCoupon', () => {
  it('summarises the terms for the card', () => {
    expect(describeSaleEventCoupon(event({ coupon_value: 15, coupon_min_order: 2000, coupon_per_user: 1, coupon_max_uses: 100 })))
      .toBe('15% off, orders over PKR 2,000, 1 per customer, 100 uses total');
    expect(describeSaleEventCoupon(event({ coupon_type: 'free_shipping' }))).toBe('free delivery');
    expect(describeSaleEventCoupon(event({ bar_coupon: null }))).toBeNull();
  });
});
