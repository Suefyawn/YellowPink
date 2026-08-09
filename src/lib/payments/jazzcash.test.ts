import { describe, expect, it } from 'vitest';
import { createHmac } from 'crypto';
import { computeSecureHash, initiateJazzCashHostedRedirect, verifyJazzCashCallback } from './jazzcash';

describe('JazzCash secure hash', () => {
  it('sorts keys alphabetically and prepends the salt before HMAC', () => {
    // Manually verify against a known-good example.
    const fields = { pp_Amount: '10000', pp_TxnRefNo: 'T1', pp_MerchantID: 'MID', pp_Random: '' };
    const salt = 'TESTSALT';
    // Filter empty + sort: pp_Amount, pp_MerchantID, pp_TxnRefNo
    // Concat: TESTSALT&10000&MID&T1
    const h = computeSecureHash(fields, salt);
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[0-9A-F]{64}$/);
    // Pin the exact recipe (salt&values in sorted-key order, HMAC keyed by
    // salt, uppercase hex) so a refactor can't silently change the wire hash.
    const expected = createHmac('sha256', salt)
      .update('TESTSALT&10000&MID&T1').digest('hex').toUpperCase();
    expect(h).toBe(expected);
  });

  it('verifies a callback when the signature matches', () => {
    process.env.JAZZCASH_INTEGRITY_SALT = 'TESTSALT';
    const fields = { pp_Amount: '10000', pp_BillReference: 'ORD1', pp_TxnRefNo: 'T1', pp_ResponseCode: '000', pp_ResponseMessage: 'ok' };
    const hash = computeSecureHash(fields, 'TESTSALT');
    const res = verifyJazzCashCallback({ ...fields, pp_SecureHash: hash });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('succeeded');
    expect(res.orderNumber).toBe('ORD1');
  });

  it('flags a failed transaction even with a valid signature', () => {
    process.env.JAZZCASH_INTEGRITY_SALT = 'TESTSALT';
    const fields = { pp_Amount: '10000', pp_BillReference: 'ORD1', pp_TxnRefNo: 'T1', pp_ResponseCode: '124', pp_ResponseMessage: 'declined' };
    const hash = computeSecureHash(fields, 'TESTSALT');
    const res = verifyJazzCashCallback({ ...fields, pp_SecureHash: hash });
    expect(res.ok).toBe(true);
    expect(res.status).toBe('failed');
  });

  it('rejects tampered callbacks', () => {
    process.env.JAZZCASH_INTEGRITY_SALT = 'TESTSALT';
    const fields = { pp_Amount: '10000', pp_BillReference: 'ORD1', pp_TxnRefNo: 'T1', pp_ResponseCode: '000' };
    const hash = computeSecureHash(fields, 'TESTSALT');
    // Tamper with the amount AFTER signing.
    const res = verifyJazzCashCallback({ ...fields, pp_Amount: '1', pp_SecureHash: hash });
    expect(res.ok).toBe(false);
    expect(res.status).toBe('failed');
  });
});

describe('JazzCash hosted-redirect initiation', () => {
  function withEnv<T>(fn: () => T): T {
    const saved = { ...process.env };
    process.env.JAZZCASH_MERCHANT_ID = 'MID';
    process.env.JAZZCASH_PASSWORD = 'PW';
    process.env.JAZZCASH_INTEGRITY_SALT = 'TESTSALT';
    delete process.env.JAZZCASH_RETURN_URL;
    try { return fn(); } finally { process.env = saved; }
  }

  it('builds PKT timestamps, a 20-char unique txn ref, and paisa amount', () => {
    withEnv(() => {
      const a = initiateJazzCashHostedRedirect({ amountPkr: 2499, orderNumber: 'YP-TEST1', description: 'Yellow Pink YP-TEST1' });
      const b = initiateJazzCashHostedRedirect({ amountPkr: 2499, orderNumber: 'YP-TEST2', description: 'Yellow Pink YP-TEST2' });
      expect(a.txnRef).toMatch(/^T\d{19}$/);
      expect(a.txnRef).toHaveLength(20);
      expect(a.txnRef).not.toBe(b.txnRef); // random suffix beats same-second collisions
      expect(a.fields.pp_Amount).toBe('249900');
      expect(a.fields.pp_TxnDateTime).toMatch(/^\d{14}$/);
      // TxnDateTime is Pakistan local time (+5h): reparse it as if it were
      // UTC and it should sit within a minute of now+5h.
      const s = a.fields.pp_TxnDateTime;
      const asUtc = Date.UTC(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8), +s.slice(8, 10), +s.slice(10, 12), +s.slice(12, 14));
      expect(Math.abs(asUtc - (Date.now() + 5 * 3600_000))).toBeLessThan(60_000);
      // ReturnURL falls back to the site origin when the env var is unset.
      expect(a.fields.pp_ReturnURL).toContain('/api/payments/jazzcash/callback');
    });
  });

  it('sends every ppmpf field empty so the hash is unambiguous', () => {
    withEnv(() => {
      const r = initiateJazzCashHostedRedirect({ amountPkr: 100, orderNumber: 'YP-X', description: 'd', customerEmail: 'a@b.pk' });
      for (const k of ['ppmpf_1', 'ppmpf_2', 'ppmpf_3', 'ppmpf_4', 'ppmpf_5']) {
        expect(r.fields[k]).toBe('');
      }
      expect(r.fields.pp_BillReference).toBe('YP-X');
      // The hash over pp_* non-empty fields must equal the hash over ALL
      // non-empty fields — the two readings of JazzCash's spec agree.
      const { pp_SecureHash: sent, ...rest } = r.fields;
      const allNonEmpty = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== ''));
      expect(computeSecureHash(allNonEmpty, 'TESTSALT')).toBe(sent);
    });
  });
});
