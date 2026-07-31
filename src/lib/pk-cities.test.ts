// City → province inference for checkout's automatic province fill. The
// July 25 four-field form left province empty on every order (zone pricing
// fell back to the cheapest zone); provinceForCity restores zone accuracy
// without re-adding a required field.
import { describe, it, expect } from 'vitest';
import { normalizeCity, provinceForCity } from './pk-cities';

describe('provinceForCity', () => {
  it('maps major cities to their provinces', () => {
    expect(provinceForCity('Karachi')).toBe('Sindh');
    expect(provinceForCity('Lahore')).toBe('Punjab');
    expect(provinceForCity('Islamabad')).toBe('Islamabad');
    expect(provinceForCity('Peshawar')).toBe('KPK');
    expect(provinceForCity('Quetta')).toBe('Balochistan');
    expect(provinceForCity('Gilgit')).toBe('Gilgit-Baltistan');
    expect(provinceForCity('Muzaffarabad')).toBe('AJK');
  });

  it('normalises input before matching (case, whitespace, aliases)', () => {
    expect(provinceForCity('  karachi ')).toBe('Sindh');
    expect(provinceForCity('pindi')).toBe('Punjab');
    expect(provinceForCity('isb')).toBe('Islamabad');
    // The order that exposed the regression: city "Dgkhan", province NULL.
    expect(provinceForCity('Dgkhan')).toBe('Punjab');
    expect(provinceForCity('DG Khan')).toBe('Punjab');
    expect(provinceForCity('Mirpur Khas')).toBe('Sindh');
    expect(provinceForCity('mirpur azad kashmir')).toBe('AJK');
  });

  it('returns null for unknown towns so the shopper can still pick by hand', () => {
    expect(provinceForCity('Some Small Town')).toBeNull();
    expect(provinceForCity('')).toBeNull();
  });

  it('every canonical alias target resolves to a province', () => {
    // Guard: an alias pointing at a city missing from CITY_PROVINCE would
    // silently break inference for that spelling.
    for (const raw of ['karchi', 'rwp', 'd.g. khan', 'azad kashmir']) {
      expect(provinceForCity(raw)).not.toBeNull();
    }
  });

  it('normalizeCity still title-cases unknown towns', () => {
    expect(normalizeCity('some   small  town')).toBe('Some Small Town');
  });
});
