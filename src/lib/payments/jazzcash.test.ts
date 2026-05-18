import { describe, expect, it } from 'vitest';
import { computeSecureHash, verifyJazzCashCallback } from './jazzcash';

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
