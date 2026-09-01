import { describe, it, expect } from 'vitest';
import { activeSeasonalTheme, applySeasonalModeMapping, parsePktDate } from './seasonal-theme';

// One resolver decides the storefront's seasonal look; one mapping turns the
// Branding form into backing keys. The window edges and the mode mapping are
// the load-bearing parts — they run the Azadi sale with no human involved.

const SCHEDULED = {
  seasonal_theme: 'independence',
  seasonal_theme_start: '2026-08-10T00:00',
  seasonal_theme_end: '2026-08-16T00:00',
  seasonal_theme_message: 'Azadi Sale is live: 14% off storewide with code AZADI14',
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

describe('activeSeasonalTheme — scheduled window', () => {
  it('inactive before the window opens', () => {
    expect(activeSeasonalTheme(SCHEDULED, new Date('2026-08-09T18:59:00Z'))).toBeNull();
  });
  it('active from the first PKT minute, with source scheduled', () => {
    const t = activeSeasonalTheme(SCHEDULED, new Date('2026-08-09T19:00:00Z'));
    expect(t?.key).toBe('independence');
    expect(t?.source).toBe('scheduled');
    expect(t?.coupon).toBe('AZADI14');
    expect(t?.barColor).toBe('#01411C');
  });
  it('inactive from the end instant — takes itself off', () => {
    expect(activeSeasonalTheme(SCHEDULED, new Date('2026-08-15T19:00:00Z'))).toBeNull();
  });
  it('any store theme can be scheduled, not just independence', () => {
    const t = activeSeasonalTheme({ ...SCHEDULED, seasonal_theme: 'eid' }, new Date('2026-08-14T07:00:00Z'));
    expect(t?.key).toBe('eid');
    expect(t?.barColor).toBe('#AE2766');
  });
  it('an unknown scheduled key is ignored', () => {
    expect(activeSeasonalTheme({ ...SCHEDULED, seasonal_theme: 'halloween' }, new Date('2026-08-14T07:00:00Z'))).toBeNull();
  });
  it('no message → no bar content, theme still active', () => {
    const t = activeSeasonalTheme({ ...SCHEDULED, seasonal_theme_message: '' }, new Date('2026-08-14T07:00:00Z'));
    expect(t?.key).toBe('independence');
    expect(t?.message).toBeNull();
  });
});

describe('activeSeasonalTheme — manual switch', () => {
  it('season_active + a real theme → active with source manual', () => {
    const t = activeSeasonalTheme({ season_active: 'true', active_theme: 'christmas' });
    expect(t?.key).toBe('christmas');
    expect(t?.source).toBe('manual');
  });
  it('season_active with the default theme is NOT seasonal (the 2 Aug leak trap)', () => {
    expect(activeSeasonalTheme({ season_active: 'true', active_theme: 'default' })).toBeNull();
    expect(activeSeasonalTheme({ season_active: 'true' })).toBeNull();
  });
  it('an open scheduled window wins over the manual switch', () => {
    const t = activeSeasonalTheme(
      { ...SCHEDULED, season_active: 'true', active_theme: 'eid' },
      new Date('2026-08-14T07:00:00Z'),
    );
    expect(t?.key).toBe('independence');
    expect(t?.source).toBe('scheduled');
  });
});

describe('applySeasonalModeMapping', () => {
  const form = (over: Record<string, string>) => new Map(Object.entries({
    seasonal_mode: 'off', seasonal_theme_pick: 'independence',
    seasonal_theme_start: '2026-08-10T00:00', seasonal_theme_end: '2026-08-16T00:00',
    ...over,
  }));

  it('off clears both switches and keeps the dates for next time', () => {
    const m = form({ seasonal_mode: 'off' });
    expect(applySeasonalModeMapping(m)).toBeNull();
    expect(m.get('season_active')).toBe('false');
    expect(m.get('seasonal_theme')).toBe('');
    expect(m.get('seasonal_theme_start')).toBe('2026-08-10T00:00');
    expect(m.has('seasonal_mode')).toBe(false);
    expect(m.has('seasonal_theme_pick')).toBe(false);
  });

  it('on-now sets the manual switch and clears the schedule', () => {
    const m = form({ seasonal_mode: 'now', seasonal_theme_pick: 'eid' });
    expect(applySeasonalModeMapping(m)).toBeNull();
    expect(m.get('season_active')).toBe('true');
    expect(m.get('active_theme')).toBe('eid');
    expect(m.get('seasonal_theme')).toBe('');
  });

  it('schedule sets the window theme and turns the manual switch off', () => {
    const m = form({ seasonal_mode: 'schedule' });
    expect(applySeasonalModeMapping(m)).toBeNull();
    expect(m.get('season_active')).toBe('false');
    expect(m.get('seasonal_theme')).toBe('independence');
    expect(m.get('active_theme')).toBe('independence');
  });

  it('schedule without both dates is rejected', () => {
    expect(applySeasonalModeMapping(form({ seasonal_mode: 'schedule', seasonal_theme_end: '' })))
      .toMatch(/start and an end/);
  });

  it('schedule with end before start is rejected', () => {
    expect(applySeasonalModeMapping(form({
      seasonal_mode: 'schedule', seasonal_theme_start: '2026-08-16T00:00', seasonal_theme_end: '2026-08-10T00:00',
    }))).toMatch(/after the start/);
  });

  it('a non-off mode without a valid theme is rejected', () => {
    expect(applySeasonalModeMapping(form({ seasonal_mode: 'now', seasonal_theme_pick: 'default' })))
      .toMatch(/Pick a theme/);
    expect(applySeasonalModeMapping(form({ seasonal_mode: 'now', seasonal_theme_pick: 'bogus' })))
      .toMatch(/Pick a theme/);
  });
});
