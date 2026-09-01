import { describe, it, expect } from 'vitest';
import { saleEventToSeasonalSettings, seasonOffSettings, exclusiveEnd, type SaleEvent } from './sale-events';
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
