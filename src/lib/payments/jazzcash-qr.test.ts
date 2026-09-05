import { describe, it, expect } from 'vitest';
import { serialiseEmv, parseEmv } from './emv-qr';
import { parseJazzCashQr, qrPayloadForOrder } from './jazzcash-qr';

const VALID = serialiseEmv([
  { tag: '00', value: '01' },
  { tag: '01', value: '11' },
  { tag: '28', value: '', nested: [{ tag: '01', value: 'WMBLPKKA' }] },
  { tag: '52', value: '5942' },
  { tag: '58', value: 'PK' },
  { tag: '59', value: 'TEST MERCHANT' },
  { tag: '60', value: 'Islamabad' },
  { tag: '53', value: '586' },
]);

describe('parseJazzCashQr', () => {
  it('reads the settings a configured shop has', () => {
    const config = parseJazzCashQr({
      pay_jazzcash_qr: VALID,
      pay_jazzcash_qr_dynamic: '1',
      pay_jazzcash_qr_notes: 'Send the receipt on WhatsApp.',
    })!;
    expect(config.payload).toBe(VALID);
    expect(config.title).toBe('TEST MERCHANT');
    expect(config.dynamic).toBe(true);
    expect(config.notes).toBe('Send the receipt on WhatsApp.');
  });

  it('prefers an explicit title over the name inside the code', () => {
    expect(parseJazzCashQr({ pay_jazzcash_qr: VALID, pay_jazzcash_qr_title: 'Yellow Pink' })!.title)
      .toBe('Yellow Pink');
  });

  it('defaults to the static code: the amount is opt-in', () => {
    expect(parseJazzCashQr({ pay_jazzcash_qr: VALID })!.dynamic).toBe(false);
    expect(parseJazzCashQr({ pay_jazzcash_qr: VALID, pay_jazzcash_qr_dynamic: 'true' })!.dynamic).toBe(false);
  });

  it('returns null for a missing or corrupted code, which hides the method', () => {
    expect(parseJazzCashQr({})).toBeNull();
    expect(parseJazzCashQr({ pay_jazzcash_qr: '   ' })).toBeNull();
    expect(parseJazzCashQr({ pay_jazzcash_qr: `${VALID.slice(0, -1)}0` })).toBeNull();
    expect(parseJazzCashQr({ pay_jazzcash_qr: 'https://example.com/my-qr.png' })).toBeNull();
  });
});

describe('qrPayloadForOrder', () => {
  const staticConfig = parseJazzCashQr({ pay_jazzcash_qr: VALID })!;
  const dynamicConfig = parseJazzCashQr({ pay_jazzcash_qr: VALID, pay_jazzcash_qr_dynamic: '1' })!;

  it('hands back the shop code untouched when the amount is off', () => {
    const out = qrPayloadForOrder(staticConfig, 2499, 'YP-1');
    expect(out.payload).toBe(VALID);
    expect(out.carriesAmount).toBe(false);
  });

  it('writes the total and the order number when the amount is on', () => {
    const out = qrPayloadForOrder(dynamicConfig, 2499, 'YP-1042');
    expect(out.carriesAmount).toBe(true);
    const fields = parseEmv(out.payload);
    expect(fields.find(f => f.tag === '54')?.value).toBe('2499');
    expect(fields.find(f => f.tag === '62')?.nested?.find(f => f.tag === '05')?.value).toBe('YP-1042');
  });

  it('falls back to the shop code rather than showing nothing when the total is unknown', () => {
    expect(qrPayloadForOrder(dynamicConfig, null).payload).toBe(VALID);
    expect(qrPayloadForOrder(dynamicConfig, null).carriesAmount).toBe(false);
    // A zero or negative total cannot go on a QR; the shopper types it instead.
    expect(qrPayloadForOrder(dynamicConfig, 0).payload).toBe(VALID);
    expect(qrPayloadForOrder(dynamicConfig, 0).carriesAmount).toBe(false);
  });
});
