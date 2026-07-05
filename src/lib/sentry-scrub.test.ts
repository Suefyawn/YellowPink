import { describe, expect, it } from 'vitest';
import { scrubEvent, isThirdPartyNoise } from './sentry-scrub';

describe('scrubEvent', () => {
  it('redacts emails and PK phone numbers from message and exception values', () => {
    const ev = scrubEvent({
      message: 'failed for ali@example.com',
      exception: { values: [{ value: 'row 03001234567 rejected' }] },
    });
    expect(ev.message).toBe('failed for [email]');
    expect(ev.exception!.values![0].value).toBe('row [phone] rejected');
  });

  it('redacts PII from breadcrumb data and request url', () => {
    const ev = scrubEvent({
      breadcrumbs: [{ message: 'GET ?email=a@b.co', data: { url: 'https://x/?email=a@b.co' } }],
      request: { url: 'https://x/checkout?phone=+923001234567' },
    });
    expect(ev.breadcrumbs![0].message).toBe('GET ?email=[email]');
    expect(ev.breadcrumbs![0].data!.url).toBe('https://x/?email=[email]');
    expect(ev.request!.url).toBe('https://x/checkout?phone=[phone]');
  });
});

describe('isThirdPartyNoise', () => {
  it('drops the Android in-app-browser "Java object is gone" error', () => {
    expect(isThirdPartyNoise({ exception: { values: [{ value: 'Error invoking postMessage: Java object is gone' }] } })).toBe(true);
  });

  it('drops any error with an app:// injected-script frame', () => {
    expect(isThirdPartyNoise({
      exception: { values: [{ value: 'whatever', stacktrace: { frames: [{ filename: 'app://navigation_performance_logger_android' }] } }] },
    })).toBe(true);
  });

  it('drops benign ResizeObserver loop notices', () => {
    expect(isThirdPartyNoise({ message: 'ResizeObserver loop completed with undelivered notifications.' })).toBe(true);
    expect(isThirdPartyNoise({ message: 'ResizeObserver loop limit exceeded' })).toBe(true);
  });

  it('keeps genuine first-party errors', () => {
    expect(isThirdPartyNoise({ exception: { values: [{ value: 'TypeError: cannot read properties of undefined', stacktrace: { frames: [{ filename: 'https://www.yellowpink.pk/_next/static/chunks/x.js' }] } }] } })).toBe(false);
    expect(isThirdPartyNoise({ message: 'Something genuinely broke' })).toBe(false);
  });
});
