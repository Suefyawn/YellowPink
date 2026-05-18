// ============================================================================
// Easypaisa "Easypay" hosted-redirect integration. Phase 1.1.
//
// Easypaisa accepts a form POST with merchant id, order id, amount, return
// URL and an HMAC-SHA256 signature over a sorted-key concat using HashKey.
//
// ⚠ The Easypaisa onboarding pack varies by merchant tier (Account vs
// Storefront vs Direct). This module covers the most common merchant-portal
// "Easypay Web Checkout" flow; verify field names against the spec PDF
// shipped with the merchant credentials.
// ============================================================================

import { createHmac } from 'crypto';

interface InitiateInput {
  amountPkr: number;
  orderNumber: string;
}

export interface InitiateResult {
  endpoint: string;
  fields: Record<string, string>;
  txnRef: string;
}

function env(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Easypaisa env var ${key} is not set`);
  return v;
}

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}

function epExpiry(d: Date): string {
  // YYYYMMDD HHMMSS — space-separated per spec.
  return [
    d.getFullYear(),
    pad(d.getMonth() + 1, 2),
    pad(d.getDate(), 2),
  ].join('') + ' ' + [
    pad(d.getHours(), 2),
    pad(d.getMinutes(), 2),
    pad(d.getSeconds(), 2),
  ].join('');
}

export function computeEasypaisaHash(fields: Record<string, string>, hashKey: string): string {
  const sortedKeys = Object.keys(fields).filter(k => fields[k] !== '' && fields[k] != null).sort();
  const concat = sortedKeys.map(k => `${k}=${fields[k]}`).join('&');
  return createHmac('sha256', hashKey).update(concat).digest('hex').toUpperCase();
}

export function initiateEasypaisaCheckout(input: InitiateInput): InitiateResult {
  const storeId = env('EASYPAISA_STORE_ID');
  const hashKey = env('EASYPAISA_HASH_KEY');
  const returnUrl = env('EASYPAISA_RETURN_URL');
  const base = process.env.EASYPAISA_API_BASE ?? 'https://easypay.easypaisa.com.pk';
  const endpoint = `${base}/easypay/Index.jsf`;

  const expiry = new Date(Date.now() + 60 * 60_000);
  const txnRef = `EP${Date.now()}`;

  // Amount in PKR with two decimals per Easypay spec.
  const fields: Record<string, string> = {
    storeId,
    amount: input.amountPkr.toFixed(2),
    orderRefNum: input.orderNumber,
    postBackURL: returnUrl,
    expiryDate: epExpiry(expiry),
    merchantPaymentMethod: '', // 'CC_PA' for cards, blank for mobile wallet
    autoRedirect: '1',
    paymentMethod: 'MA_PAYMENT_METHOD', // mobile account; switch to OTC if needed
    emailAddr: '',
    mobileNum: '',
  };

  fields.merchantHashedReq = computeEasypaisaHash(fields, hashKey);
  return { endpoint, fields, txnRef };
}

export interface CallbackVerification {
  ok: boolean;
  status: 'succeeded' | 'failed';
  orderNumber: string;
  amountPkr: number;
  responseCode: string;
  responseMessage: string;
}

export function verifyEasypaisaCallback(raw: Record<string, string>): CallbackVerification {
  const hashKey = env('EASYPAISA_HASH_KEY');
  const incoming = raw.merchantHashedReq ?? '';
  const without = Object.fromEntries(Object.entries(raw).filter(([k]) => k !== 'merchantHashedReq'));
  const expected = computeEasypaisaHash(without, hashKey);
  const signatureOk = incoming.toUpperCase() === expected;

  const responseCode = raw.status ?? raw.responseCode ?? '';
  const success = signatureOk && (responseCode === '0000' || responseCode === '0');

  return {
    ok: signatureOk,
    status: success ? 'succeeded' : 'failed',
    orderNumber: raw.orderRefNum ?? '',
    amountPkr: Number(raw.amount ?? 0),
    responseCode,
    responseMessage: raw.desc ?? raw.responseDesc ?? '',
  };
}
