import { describe, expect, it } from 'vitest';
import { toE164Digits, parseButtonPayload } from './whatsapp-cloud';

// Meta rejects anything that isn't E.164 digits, and a wrong number means a
// silent non-delivery — the exact failure this feature exists to prevent.
describe('toE164Digits', () => {
  it('normalises every common Pakistani format to 92XXXXXXXXXX', () => {
    expect(toE164Digits('03001234567')).toBe('923001234567');
    expect(toE164Digits('0300 123 4567')).toBe('923001234567');
    expect(toE164Digits('+92 300 1234567')).toBe('923001234567');
    expect(toE164Digits('923001234567')).toBe('923001234567');
    expect(toE164Digits('00923001234567')).toBe('923001234567');
    expect(toE164Digits('3001234567')).toBe('923001234567');
  });

  it('returns null for unusable input rather than a malformed number', () => {
    expect(toE164Digits('')).toBeNull();
    expect(toE164Digits(null)).toBeNull();
    expect(toE164Digits('12345')).toBeNull();
  });
});

describe('parseButtonPayload', () => {
  it('parses our own confirm/cancel payloads', () => {
    expect(parseButtonPayload('CONFIRM:YP-4EZ30H965'))
      .toEqual({ action: 'confirm', orderNumber: 'YP-4EZ30H965' });
    expect(parseButtonPayload('CANCEL:YP-ABC123'))
      .toEqual({ action: 'cancel', orderNumber: 'YP-ABC123' });
  });

  it('ignores anything we did not send (free-form replies, junk)', () => {
    expect(parseButtonPayload('hello')).toBeNull();
    expect(parseButtonPayload('CONFIRM')).toBeNull();
    expect(parseButtonPayload('DELETE:YP-1')).toBeNull();
    expect(parseButtonPayload(undefined)).toBeNull();
    expect(parseButtonPayload('CONFIRM:YP 123')).toBeNull();
  });
});
