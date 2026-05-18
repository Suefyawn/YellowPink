// ============================================================================
// JazzCash HTTP-Post v2.0 (DDM "Direct Debit Mobile" / card redirect). Phase 1.1.
//
// Hash recipe (per JazzCash merchant docs):
//   1. Take all pp_ fields whose value is non-empty.
//   2. Sort them alphabetically by key.
//   3. Build "<integritySalt>&<v1>&<v2>&..." (values only, in sorted-key order).
//   4. HMAC-SHA256 with the integrity salt as the key. Uppercase hex.
//
// The route handler in src/app/api/payments/jazzcash/route.ts builds the
// form, POSTs the user to the gateway, and accepts the callback at
// /api/payments/jazzcash/callback.
//
// SANDBOX vs LIVE: switch JAZZCASH_API_BASE in env.
//
// ⚠ This implementation follows the public docs but the exact field set
// occasionally changes per merchant. After enabling, run a real sandbox
// transaction end-to-end before flipping to production keys.
// ============================================================================

import { createHmac } from 'crypto';

interface InitiateInput {
  amountPkr: number;
  orderNumber: string;
  description: string;
  customerPhone?: string;
  customerEmail?: string;
}

export interface InitiateResult {
  endpoint: string;
  fields: Record<string, string>;
  txnRef: string;
}

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`JazzCash env var ${key} is not set`);
  return v;
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

// JazzCash wants TxnDateTime as YYYYMMDDHHMMSS, ExpiryDateTime same format +1h.
function jzcDateTime(d: Date): string {
  return [
    d.getUTCFullYear(),
    pad(d.getUTCMonth() + 1, 2),
    pad(d.getUTCDate(), 2),
    pad(d.getUTCHours(), 2),
    pad(d.getUTCMinutes(), 2),
    pad(d.getUTCSeconds(), 2),
  ].join('');
}

export function computeSecureHash(fields: Record<string, string>, integritySalt: string): string {
  const sortedKeys = Object.keys(fields)
    .filter(k => k.startsWith('pp_') && fields[k] !== '' && fields[k] != null)
    .sort();
  const concat = [integritySalt, ...sortedKeys.map(k => fields[k])].join('&');
  return createHmac('sha256', integritySalt).update(concat).digest('hex').toUpperCase();
}

export function initiateJazzCashHostedRedirect(input: InitiateInput): InitiateResult {
  const merchantId = env('JAZZCASH_MERCHANT_ID');
  const password = env('JAZZCASH_PASSWORD');
  const salt = env('JAZZCASH_INTEGRITY_SALT');
  const returnUrl = env('JAZZCASH_RETURN_URL');
  const base = process.env.JAZZCASH_API_BASE ?? 'https://payments.jazzcash.com.pk';
  const endpoint = `${base}/CustomerPortal/transactionmanagement/merchantform/`;

  const now = new Date();
  const expiry = new Date(now.getTime() + 60 * 60_000); // +1h
  const txnRef = `T${jzcDateTime(now)}`;
  const amountPaisa = Math.round(input.amountPkr * 100);

  // Amount must be in paisa (integer) per spec.
  const fields: Record<string, string> = {
    pp_Version: '1.1',
    pp_TxnType: '',                // empty for HostedCheckout per current docs
    pp_Language: 'EN',
    pp_MerchantID: merchantId,
    pp_SubMerchantID: '',
    pp_Password: password,
    pp_BankID: '',
    pp_ProductID: '',
    pp_TxnRefNo: txnRef,
    pp_Amount: String(amountPaisa),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: jzcDateTime(now),
    pp_BillReference: input.orderNumber,
    pp_Description: input.description.slice(0, 60),
    pp_TxnExpiryDateTime: jzcDateTime(expiry),
    pp_ReturnURL: returnUrl,
    pp_MobileNumber: input.customerPhone ?? '',
    pp_CNIC: '',
    ppmpf_1: input.orderNumber,
    ppmpf_2: input.customerEmail ?? '',
    ppmpf_3: '',
    ppmpf_4: '',
    ppmpf_5: '',
  };

  fields.pp_SecureHash = computeSecureHash(fields, salt);
  return { endpoint, fields, txnRef };
}

export interface CallbackVerification {
  ok: boolean;
  status: 'succeeded' | 'failed';
  txnRef: string;
  orderNumber: string;
  amountPkr: number;
  responseCode: string;
  responseMessage: string;
}

// Verifies the callback POST payload. Returns whether the signature matches
// and whether the responseCode means success ('000' on JazzCash).
export function verifyJazzCashCallback(raw: Record<string, string>): CallbackVerification {
  const salt = env('JAZZCASH_INTEGRITY_SALT');
  const incomingHash = raw.pp_SecureHash ?? '';
  const withoutHash = Object.fromEntries(
    Object.entries(raw).filter(([k]) => k !== 'pp_SecureHash')
  );
  const expected = computeSecureHash(withoutHash, salt);
  const signatureOk = incomingHash.toUpperCase() === expected;

  const responseCode = raw.pp_ResponseCode ?? '';
  const success = signatureOk && responseCode === '000';

  return {
    ok: signatureOk,
    status: success ? 'succeeded' : 'failed',
    txnRef: raw.pp_TxnRefNo ?? '',
    orderNumber: raw.pp_BillReference ?? raw.ppmpf_1 ?? '',
    amountPkr: Number(raw.pp_Amount ?? 0) / 100,
    responseCode,
    responseMessage: raw.pp_ResponseMessage ?? '',
  };
}
