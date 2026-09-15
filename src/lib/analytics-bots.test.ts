import { describe, it, expect } from 'vitest';
import {
  isKnownScraper,
  NOT_SCRAPER_SQL,
  HUMAN_TRAFFIC_SQL,
} from './analytics-bots';

// Every fingerprint below is a real row from the 90-day PostHog breakdown run
// on 15 Sep 2026, not an invented one. The rule this file follows is the one
// the Clarity fixture learned the hard way: a fixture asserts what the source
// actually sends, never what the parser hopes for.

describe('isKnownScraper', () => {
  it('matches the crawler hitting the men’s-health pages', () => {
    // 421 pageviews / 421 sessions, US + UK + Japan, 13 URLs.
    expect(isKnownScraper({
      os: 'Linux',
      deviceType: 'Desktop',
      referringDomain: 'www.google.com',
    })).toBe(true);
  });

  it('keeps the Linux desktop visitors who arrive direct', () => {
    // 168 pageviews over 114 sessions across 51 URLs, Pakistan in the top
    // three countries. Same OS and device as the scraper, different referrer,
    // and it behaves like a person.
    expect(isKnownScraper({
      os: 'Linux',
      deviceType: 'Desktop',
      referringDomain: '$direct',
    })).toBe(false);
  });

  it('keeps the Android and iOS traffic that is the actual storefront', () => {
    expect(isKnownScraper({
      os: 'Android', deviceType: 'Mobile', referringDomain: 'www.google.com',
    })).toBe(false);
    expect(isKnownScraper({
      os: 'iOS', deviceType: 'Mobile', referringDomain: 'www.google.com',
    })).toBe(false);
  });

  it('keeps Windows desktop searchers', () => {
    expect(isKnownScraper({
      os: 'Windows', deviceType: 'Desktop', referringDomain: 'www.google.com',
    })).toBe(false);
  });

  it('keeps a Linux desktop visitor referred from anywhere else', () => {
    for (const ref of ['chatgpt.com', 'www.bing.com', 'l.instagram.com', 'www.yellowpink.pk']) {
      expect(isKnownScraper({ os: 'Linux', deviceType: 'Desktop', referringDomain: ref })).toBe(false);
    }
  });

  it('needs all three properties, not two of them', () => {
    expect(isKnownScraper({ os: 'Linux', deviceType: 'Mobile', referringDomain: 'www.google.com' })).toBe(false);
    expect(isKnownScraper({ os: 'Chrome OS', deviceType: 'Desktop', referringDomain: 'www.google.com' })).toBe(false);
  });

  it('keeps a hit whose properties are missing rather than dropping it', () => {
    // Failing towards counting an uncertain visitor is the safe direction.
    expect(isKnownScraper({})).toBe(false);
    expect(isKnownScraper({ os: null, deviceType: null, referringDomain: null })).toBe(false);
    expect(isKnownScraper({ os: 'Linux', deviceType: 'Desktop' })).toBe(false);
  });

  it('does not match on a referrer that merely contains google', () => {
    // google.com and com.google.android.googlequicksearchbox are real, distinct
    // referrers in this project; only the exact host is the scraper's.
    for (const ref of ['google.com', 'com.google.android.googlequicksearchbox', 'news.google.com']) {
      expect(isKnownScraper({ os: 'Linux', deviceType: 'Desktop', referringDomain: ref })).toBe(false);
    }
  });
});

describe('the HogQL fragments', () => {
  it('parenthesises so an AND chain keeps its precedence', () => {
    for (const sql of [NOT_SCRAPER_SQL, HUMAN_TRAFFIC_SQL]) {
      expect(sql.startsWith('(')).toBe(true);
      expect(sql.endsWith(')')).toBe(true);
      let depth = 0;
      for (const ch of sql) {
        if (ch === '(') depth++;
        if (ch === ')') depth--;
        expect(depth).toBeGreaterThanOrEqual(0);
      }
      expect(depth).toBe(0);
    }
  });

  it('names the three properties it filters on', () => {
    expect(NOT_SCRAPER_SQL).toContain('`$os`');
    expect(NOT_SCRAPER_SQL).toContain('`$device_type`');
    expect(NOT_SCRAPER_SQL).toContain('`$referring_domain`');
  });

  it('coalesces every property so a NULL never swallows the row', () => {
    // In ClickHouse, `NULL = 'Linux'` is NULL and `NOT NULL` is NULL, which a
    // WHERE clause treats as false — so an uncoalesced comparison would drop
    // every event missing the property instead of keeping it.
    expect(NOT_SCRAPER_SQL.match(/coalesce/g) ?? []).toHaveLength(3);
  });

  it('excludes /admin as well as the scraper in the combined predicate', () => {
    expect(HUMAN_TRAFFIC_SQL).toContain("'/admin'");
    expect(HUMAN_TRAFFIC_SQL).toContain('`$referring_domain`');
  });

  it('agrees with isKnownScraper on which constants it tests for', () => {
    expect(NOT_SCRAPER_SQL).toContain("'Linux'");
    expect(NOT_SCRAPER_SQL).toContain("'Desktop'");
    expect(NOT_SCRAPER_SQL).toContain("'www.google.com'");
  });
});
