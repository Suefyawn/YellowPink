import { describe, it, expect } from 'vitest';
import { activeSeasonalTheme, parsePktDate } from './seasonal-theme';

// The window logic is what turns the Azadi theme on at the start date and off
// at the end date with no human involved — the edges are the load-bearing part.

const BASE = {
  seasonal_theme: 'independence',
  seasonal_theme_start: '2026-08-10T00:00',
  seasonal_theme_end: '2026-08-16T00:00',
  seasonal_theme_coupon: 'AZADI14',
};

describe('parsePktDate', () => {
  it('parses datetime-local values as PKT (UTC+5)', () => {
    expect(parsePktDate('2026-08-10T00:00')!.toISOString()).toBe('2026-08-09T19:00:00.000Z');
  });
  it('parses date-only values as PKT midnight', () => {
    expect(parsePktDate('2026-08-14')!.toISOString()).toBe('2026-08-13T19:00:00.000Z');
  });
  it('returns null for blank or junk', () => {
    expect(parsePktDate('')).toBeNull();
    expect(parsePktDate(undefined)).toBeNull();
    expect(parsePktDate('not-a-date')).toBeNull();
  });
});

describe('activeSeasonalTheme', () => {
  it('inactive before the window opens', () => {
    expect(activeSeasonalTheme(BASE, new Date('2026-08-09T18:59:00Z'))).toBeNull();
  });

  it('active from the first PKT minute of the window', () => {
    const t = activeSeasonalTheme(BASE, new Date('2026-08-09T19:00:00Z'));
    expect(t?.key).toBe('independence');
    expect(t?.coupon).toBe('AZADI14');
  });

  it('active on Independence Day itself', () => {
    expect(activeSeasonalTheme(BASE, new Date('2026-08-14T07:00:00Z'))?.key).toBe('independence');
  });

  it('inactive from the end instant onward — takes itself off', () => {
    expect(activeSeasonalTheme(BASE, new Date('2026-08-15T19:00:00Z'))).toBeNull();
  });

  it('off when no theme is selected, whatever the dates say', () => {
    expect(activeSeasonalTheme({ ...BASE, seasonal_theme: '' }, new Date('2026-08-14T07:00:00Z'))).toBeNull();
  });

  it('no dates set → always on while the theme is selected (manual mode)', () => {
    const t = activeSeasonalTheme({ seasonal_theme: 'independence' }, new Date('2026-03-01T00:00:00Z'));
    expect(t?.key).toBe('independence');
  });

  it('default message mentions the sale; custom message wins', () => {
    const def = activeSeasonalTheme(BASE, new Date('2026-08-14T07:00:00Z'));
    expect(def?.message).toContain('AZADI14');
    const custom = activeSeasonalTheme(
      { ...BASE, seasonal_theme_message: 'Jashn e Azadi Mubarak' },
      new Date('2026-08-14T07:00:00Z'),
    );
    expect(custom?.message).toBe('Jashn e Azadi Mubarak');
  });
});
