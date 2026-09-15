import { describe, it, expect } from 'vitest';
import { consentRequiredForTimezone } from './consent-region';

// The rule decides whether a visitor is asked before GA, Clarity and the Meta
// Pixel load. Getting it wrong in one direction shows a prompt to someone who
// did not need one; in the other it runs third-party tracking on someone who
// was owed a choice. Every ambiguous case below must resolve to "required".

describe('consentRequiredForTimezone', () => {
  it('requires consent across the EEA, the UK and Switzerland', () => {
    for (const tz of [
      'Europe/London', 'Europe/Dublin', 'Europe/Berlin', 'Europe/Paris',
      'Europe/Madrid', 'Europe/Rome', 'Europe/Amsterdam', 'Europe/Stockholm',
      'Europe/Warsaw', 'Europe/Lisbon', 'Europe/Athens', 'Europe/Zurich',
      'Europe/Oslo', 'Europe/Vienna', 'Europe/Brussels', 'Europe/Copenhagen',
    ]) {
      expect(consentRequiredForTimezone(tz), tz).toBe(true);
    }
  });

  it('requires consent in EU territory outside the Europe/ prefix', () => {
    // A shopper in the Canaries or Réunion is in Spain and France. Matching
    // only on 'Europe/' would have quietly skipped their prompt.
    for (const tz of [
      'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores',
      'Atlantic/Reykjavik', 'Atlantic/Faroe', 'Indian/Reunion', 'Indian/Mayotte',
      'America/Martinique', 'America/Guadeloupe', 'America/Cayenne',
      'America/Miquelon', 'Arctic/Longyearbyen',
    ]) {
      expect(consentRequiredForTimezone(tz), tz).toBe(true);
    }
  });

  it('errs wide: non-EEA European timezones are prompted too', () => {
    // Moscow, Istanbul and Kyiv are not EEA, but the cost of asking anyway is
    // one tap, and the prefix rule is easier to reason about than a member
    // list that goes stale.
    for (const tz of ['Europe/Moscow', 'Europe/Istanbul', 'Europe/Kyiv', 'Europe/Belgrade']) {
      expect(consentRequiredForTimezone(tz), tz).toBe(true);
    }
  });

  it('does not prompt the traffic this store actually serves', () => {
    // Pakistan is 83% of sessions; the rest of the world outside the EEA is
    // another 13.6%. These are the visitors the banner was costing.
    for (const tz of [
      'Asia/Karachi', 'Asia/Dubai', 'Asia/Riyadh', 'Asia/Kolkata',
      'America/New_York', 'America/Los_Angeles', 'America/Toronto',
      'Australia/Sydney', 'Asia/Tokyo', 'Africa/Lagos', 'Asia/Singapore',
    ]) {
      expect(consentRequiredForTimezone(tz), tz).toBe(false);
    }
  });

  it('fails safe when the timezone is missing or unreadable', () => {
    // No timezone, a blank one, or an Intl that gave us nothing. Showing a
    // prompt nobody needed costs a tap; skipping one that was owed does not.
    for (const tz of [null, undefined, '', '   ']) {
      expect(consentRequiredForTimezone(tz)).toBe(true);
    }
  });

  it('fails safe on a region-less zone', () => {
    // 'UTC' and 'GMT' place nobody. A VPN user in Berlin reads as UTC just as
    // easily as one in Karachi, so this resolves to asking.
    for (const tz of ['UTC', 'GMT', 'Z', 'localtime']) {
      expect(consentRequiredForTimezone(tz), tz).toBe(true);
    }
  });

  it('fails safe on a non-string value', () => {
    // Intl is permissive and this is browser input; a number or an object
    // must not fall through to "no prompt needed".
    for (const bad of [0, 1, {}, [], true, false, NaN]) {
      expect(consentRequiredForTimezone(bad as unknown as string), String(bad)).toBe(true);
    }
  });

  it('tolerates surrounding whitespace rather than failing open', () => {
    expect(consentRequiredForTimezone('  Europe/Berlin  ')).toBe(true);
    expect(consentRequiredForTimezone('  Asia/Karachi  ')).toBe(false);
  });

  it('matches a European zone whatever its casing', () => {
    // Browsers emit canonical casing, so odd casing is unexpected input. A
    // case-sensitive check read 'europe/berlin' as an ordinary foreign zone
    // and skipped the prompt, which was the one path that failed open.
    expect(consentRequiredForTimezone('europe/berlin')).toBe(true);
    expect(consentRequiredForTimezone('EUROPE/BERLIN')).toBe(true);
    expect(consentRequiredForTimezone('atlantic/canary')).toBe(true);
    // The safe direction only: a genuine foreign zone still resolves to false.
    expect(consentRequiredForTimezone('asia/karachi')).toBe(false);
  });

  it('does not match a zone that merely contains Europe', () => {
    // 'Atlantic/Europa' is not in Europe. The rule anchors on the prefix.
    expect(consentRequiredForTimezone('Indian/Europa')).toBe(false);
  });
});
