import { describe, it, expect } from 'vitest';
import { resolveConsent, IMPLIED_CONSENT, type Consent } from './consent';

// The rule that decides what the site acts on. The cases that matter are the
// ones where a stored choice and the region rule disagree: a stored choice
// must always win, in both directions.

const explicit = (analytics: boolean, marketing: boolean): Consent => ({
  essential: true, analytics, marketing, ts: 1_757_000_000_000, v: 1, source: 'explicit',
});

describe('resolveConsent', () => {
  it('asks a visitor in a prompt region who has not chosen', () => {
    // null means exactly one thing: show the banner, load nothing yet.
    expect(resolveConsent(null, true)).toBeNull();
  });

  it('implies full consent where no prompt is required', () => {
    // This is the change: the ~97% who were never going to answer a banner now
    // get GA, Clarity and the Meta Pixel instead of silence.
    expect(resolveConsent(null, false)).toEqual(IMPLIED_CONSENT);
    expect(resolveConsent(null, false)?.source).toBe('implied');
  });

  it('honours an explicit rejection where no prompt was required', () => {
    // Someone who opted out in Europe and travelled home stays opted out. The
    // region rule must never resurrect tracking a person turned off.
    const out = resolveConsent(explicit(false, false), false);
    expect(out?.analytics).toBe(false);
    expect(out?.marketing).toBe(false);
    expect(out?.source).toBe('explicit');
  });

  it('honours an explicit acceptance inside a prompt region', () => {
    const out = resolveConsent(explicit(true, true), true);
    expect(out?.analytics).toBe(true);
    expect(out?.source).toBe('explicit');
  });

  it('keeps a partial choice partial', () => {
    // Analytics on, marketing off is a real combination the banner offers.
    // Implied consent must not quietly fill in the half they declined.
    const out = resolveConsent(explicit(true, false), false);
    expect(out?.analytics).toBe(true);
    expect(out?.marketing).toBe(false);
  });

  it('returns the stored object itself, not a merge', () => {
    const stored = explicit(false, true);
    expect(resolveConsent(stored, true)).toBe(stored);
    expect(resolveConsent(stored, false)).toBe(stored);
  });

  it('implied consent carries no timestamp, because nobody chose anything', () => {
    expect(IMPLIED_CONSENT.ts).toBe(0);
    expect(IMPLIED_CONSENT.source).toBe('implied');
  });
});
