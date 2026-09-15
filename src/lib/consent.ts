'use client';

// Cookie / tracking consent. Three buckets, `essential` is always on (we
// need it for cart, login, CSRF), the other two are opt-in. Persisted to
// localStorage and a cookie (the cookie is so server actions and edge
// middleware can also see the preference without round-tripping the client).
//
// Consumer pattern:
//   import { useConsent } from '@/lib/consent';
//   const { consent } = useConsent();
//   if (consent.analytics) loadAnalytics();
//
// Or, for one-shot reads outside React:
//   import { readConsent } from '@/lib/consent';

import { useEffect, useState } from 'react';

import { consentRequiredHere } from './consent-region';

export type ConsentBucket = 'essential' | 'analytics' | 'marketing';

export interface Consent {
  essential: true;            // always on; encoded so types stay clean
  analytics: boolean;
  marketing: boolean;
  ts: number;                 // unix ms when the choice was set
  v: 1;                       // schema version, bump if shape changes
  /** Where this came from. 'explicit' is a choice the visitor made and it is
   *  the only kind ever written to storage. 'implied' is computed per read for
   *  a region that does not require a prompt (see lib/consent-region), so it
   *  leaves no record of a decision nobody made, and it re-evaluates for free
   *  if the rule ever changes. */
  source: 'explicit' | 'implied';
}

const STORAGE_KEY = 'yp_consent_v1';
const COOKIE_NAME = 'yp_consent';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export const DEFAULT_CONSENT: Consent = {
  essential: true,
  analytics: false,
  marketing: false,
  ts: 0,
  v: 1,
  source: 'explicit',
};

/** What a visitor gets where no prompt is required: everything on, computed,
 *  never persisted. */
export const IMPLIED_CONSENT: Consent = {
  essential: true,
  analytics: true,
  marketing: true,
  ts: 0,
  v: 1,
  source: 'implied',
};

export function readConsent(): Consent | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Consent>;
    if (parsed.v !== 1) return null;
    return {
      essential: true,
      analytics: Boolean(parsed.analytics),
      marketing: Boolean(parsed.marketing),
      ts: Number(parsed.ts ?? 0),
      v: 1,
      source: 'explicit',
    };
  } catch {
    return null;
  }
}

export function writeConsent(input: Partial<Consent>): Consent {
  const next: Consent = {
    essential: true,
    analytics: Boolean(input.analytics),
    marketing: Boolean(input.marketing),
    ts: Date.now(),
    v: 1,
    source: 'explicit',
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {}
    // Cookie mirror so SSR + edge middleware can read it.
    // Compact stringly-typed format: `a=1;m=0`.
    const cookieVal = `a=${next.analytics ? 1 : 0};m=${next.marketing ? 1 : 0}`;
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(cookieVal)}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax`;
    // Broadcast so other tabs / components can react.
    window.dispatchEvent(new CustomEvent('yp:consent', { detail: next }));
  }
  return next;
}

/**
 * What the site should actually act on for this visitor, given what is stored
 * and whether the region requires a prompt.
 *
 * An explicit choice always wins, including a rejection, and including in a
 * region that would not have required the prompt — somebody who opted out on a
 * trip to Europe stays opted out at home. Otherwise, a visitor in a region that
 * requires a prompt gets `null` (ask them; load nothing until they answer), and
 * everyone else gets implied consent.
 *
 * `null` therefore means exactly one thing: show the banner.
 */
export function resolveConsent(
  stored: Consent | null,
  regionRequiresPrompt: boolean,
): Consent | null {
  if (stored) return stored;
  if (regionRequiresPrompt) return null;
  return IMPLIED_CONSENT;
}

/** The DOM-reading wrapper around `resolveConsent`. The decision itself lives
 *  in that pure function so it can be tested without a browser. */
export function effectiveConsent(): Consent | null {
  return resolveConsent(readConsent(), consentRequiredHere());
}

/** Whether the banner should be shown: no stored choice, in a region that
 *  requires one. */
export function shouldPromptForConsent(): boolean {
  return effectiveConsent() === null;
}

/** Accept-all helper used by the banner's primary button. */
export function acceptAll(): Consent {
  return writeConsent({ analytics: true, marketing: true });
}

/** Reject-all (essentials still on) helper. */
export function rejectAll(): Consent {
  return writeConsent({ analytics: false, marketing: false });
}

/** React subscriber. Returns the consent to act on, or null when the visitor
 *  still has to be asked — `null` means the banner should be shown. */
export function useConsent(): {
  consent: Consent | null;
  setConsent: (c: Partial<Consent>) => void;
} {
  const [consent, setLocal] = useState<Consent | null>(null);

  useEffect(() => {
    // effectiveConsent rather than readConsent: outside the regions that
    // require a prompt this resolves to implied consent, which is what lets
    // GA / Clarity / the Meta Pixel load for the ~97% of visitors who were
    // never going to answer a banner.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocal(effectiveConsent());
    const onUpdate = (e: Event) => setLocal((e as CustomEvent<Consent>).detail);
    window.addEventListener('yp:consent', onUpdate);
    return () => window.removeEventListener('yp:consent', onUpdate);
  }, []);

  return {
    consent,
    setConsent: (c: Partial<Consent>) => setLocal(writeConsent(c)),
  };
}
