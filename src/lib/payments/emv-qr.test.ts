import { describe, it, expect } from 'vitest';
import {
  parseEmv, serialiseEmv, isValidEmv, crc16, withAmount, merchantName, isStatic,
} from './emv-qr';

// A stand-in for the shop's own Raast code: same field shape (static, no
// amount, a nested account template and a nested additional-data template),
// with the real merchant identifiers replaced. serialiseEmv computes the CRC,
// so the fixture is valid by construction.
const STATIC_QR = serialiseEmv([
  { tag: '00', value: '01' },
  { tag: '01', value: '11' },
  { tag: '26', value: '', nested: [{ tag: '00', value: '05' }] },
  { tag: '28', value: '', nested: [
    { tag: '00', value: '0'.repeat(32) },
    { tag: '01', value: 'WMBLPKKA' },
    { tag: '02', value: '9'.repeat(24) },
  ] },
  { tag: '52', value: '5942' },
  { tag: '58', value: 'PK' },
  { tag: '59', value: 'TEST MERCHANT NAME' },
  { tag: '60', value: 'Islamabad' },
  { tag: '53', value: '586' },
  { tag: '62', value: '', nested: [
    { tag: '02', value: '12345678901234' },
    { tag: '06', value: '01234567890' },
    { tag: '07', value: '012345678' },
  ] },
]);

describe('crc16', () => {
  it('matches the CCITT-FALSE reference vector', () => {
    // "123456789" -> 0x29B1 is the published check value for CRC-16/CCITT-FALSE.
    expect(crc16('123456789')).toBe('29B1');
  });
});

describe('parseEmv / serialiseEmv', () => {
  it('round-trips a payload unchanged', () => {
    expect(serialiseEmv(parseEmv(STATIC_QR))).toBe(STATIC_QR);
  });

  it('reads nested templates', () => {
    const account = parseEmv(STATIC_QR).find(f => f.tag === '28');
    expect(account?.nested?.map(f => f.tag)).toEqual(['00', '01', '02']);
    expect(account?.nested?.find(f => f.tag === '01')?.value).toBe('WMBLPKKA');
  });

  it('rejects truncated or non-TLV input rather than half-reading it', () => {
    expect(parseEmv(STATIC_QR.slice(0, 40))).toEqual([]);
    expect(parseEmv('hello world')).toEqual([]);
    expect(parseEmv('0099XX')).toEqual([]);
  });

  it('derives the CRC instead of carrying a stale one', () => {
    const fields = parseEmv(STATIC_QR);
    fields.find(f => f.tag === '59')!.value = 'RENAMED';
    const out = serialiseEmv(fields);
    expect(isValidEmv(out)).toBe(true);
    expect(out.slice(-4)).not.toBe(STATIC_QR.slice(-4));
  });
});

describe('isValidEmv', () => {
  it('accepts the merchant payload and rejects a corrupted one', () => {
    expect(isValidEmv(STATIC_QR)).toBe(true);
    expect(isValidEmv(`${STATIC_QR.slice(0, -1)}0`)).toBe(false);
    expect(isValidEmv(STATIC_QR.slice(0, -8))).toBe(false);
    expect(isValidEmv('')).toBe(false);
    expect(isValidEmv('not a qr payload at all')).toBe(false);
  });

  it('accepts a lowercase CRC (some issuers print it that way)', () => {
    expect(isValidEmv(STATIC_QR.slice(0, -4) + STATIC_QR.slice(-4).toLowerCase())).toBe(true);
  });
});

describe('withAmount', () => {
  it('adds the amount, flips the code to dynamic, and stays valid', () => {
    const out = withAmount(STATIC_QR, 2499)!;
    expect(out).not.toBeNull();
    expect(isValidEmv(out)).toBe(true);
    const fields = parseEmv(out);
    expect(fields.find(f => f.tag === '01')?.value).toBe('12');
    expect(fields.find(f => f.tag === '54')?.value).toBe('2499');
    expect(isStatic(out)).toBe(false);
    expect(isStatic(STATIC_QR)).toBe(true);
  });

  it('keeps every merchant field byte-for-byte', () => {
    const before = parseEmv(STATIC_QR);
    const after = parseEmv(withAmount(STATIC_QR, 1000)!);
    for (const tag of ['00', '26', '28', '52', '58', '59', '60', '53']) {
      const b = before.find(f => f.tag === tag)!;
      const a = after.find(f => f.tag === tag)!;
      expect(a.value).toBe(b.value);
    }
  });

  it('puts the order reference in 62/05 without dropping the bank sub-fields', () => {
    const out = withAmount(STATIC_QR, 1500, 'YP-1042')!;
    const additional = parseEmv(out).find(f => f.tag === '62')!;
    const subs = additional.nested!;
    expect(subs.find(f => f.tag === '05')?.value).toBe('YP-1042');
    expect(subs.find(f => f.tag === '02')?.value).toBe('12345678901234');
    expect(subs.find(f => f.tag === '06')?.value).toBe('01234567890');
    expect(subs.find(f => f.tag === '07')?.value).toBe('012345678');
    expect(subs.map(f => f.tag)).toEqual(['02', '05', '06', '07']);
  });

  it('places the amount directly after the currency, whatever order the issuer used', () => {
    // The real code emits 52, 58, 59, 60, 53, 62: sorting by tag number would
    // put 54 nowhere near the currency it is denominated in.
    const tags = parseEmv(withAmount(STATIC_QR, 999)!).map(f => f.tag);
    expect(tags.indexOf('54')).toBe(tags.indexOf('53') + 1);
  });

  it('writes paisa only when the total actually has them', () => {
    expect(parseEmv(withAmount(STATIC_QR, 1250)!).find(f => f.tag === '54')?.value).toBe('1250');
    expect(parseEmv(withAmount(STATIC_QR, 1250.5)!).find(f => f.tag === '54')?.value).toBe('1250.50');
  });

  it('replaces an amount rather than adding a second one', () => {
    const once = withAmount(STATIC_QR, 100)!;
    const twice = withAmount(once, 200)!;
    expect(parseEmv(twice).filter(f => f.tag === '54')).toHaveLength(1);
    expect(parseEmv(twice).find(f => f.tag === '54')?.value).toBe('200');
    expect(isValidEmv(twice)).toBe(true);
  });

  it('returns null instead of a QR nobody can scan', () => {
    expect(withAmount('rubbish', 100)).toBeNull();
    expect(withAmount(STATIC_QR, 0)).toBeNull();
    expect(withAmount(STATIC_QR, -50)).toBeNull();
    expect(withAmount(STATIC_QR, Number.NaN)).toBeNull();
    expect(withAmount(STATIC_QR, 10 ** 13)).toBeNull();
  });

  it('truncates an over-long reference to the field limit', () => {
    const out = withAmount(STATIC_QR, 100, 'X'.repeat(60))!;
    const ref = parseEmv(out).find(f => f.tag === '62')!.nested!.find(f => f.tag === '05')!;
    expect(ref.value).toHaveLength(25);
    expect(isValidEmv(out)).toBe(true);
  });
});

describe('merchantName', () => {
  it('reads the name the payer app will show', () => {
    expect(merchantName(STATIC_QR)).toBe('TEST MERCHANT NAME');
    expect(merchantName('rubbish')).toBe('');
  });
});
