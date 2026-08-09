// ============================================================================
// TCS Courier (Pakistan), COD-API adapter.
//
// Spec: envio.tcscourier.com COD API User Guide (copy in
// .audit/tcs-cod-api-spec.txt). Verified live against production, 2026-07.
//
// TWO-STEP AUTH (both required for the transactional ecom endpoints):
//   1. A gateway "Bearer" JWT — sent as the `Authorization: Bearer <jwt>`
//      HEADER on every call. Pre-issued by TCS, or minted from client
//      id+secret via /auth/api/auth. Alone it only unlocks read-only setup
//      APIs; transactional calls also need step 2.
//   2. An ecom "access token" — minted from a username+password at
//      /ecom/api/authentication/token (short-lived, cached). This goes in the
//      request BODY (`accesstoken`) for POSTs, or the query string for the
//      label GET. Booking/cancel/label/payment all reject the request with
//      "Invalid access token" without it.
//   Tracking needs only the header JWT.
//
// Production:  https://ociconnect.tcscourier.com
// Sandbox/UAT: https://devconnect.tcscourier.com  (needs UAT-issued creds;
//   a production token/login is rejected on UAT as "Mismatch configuration".)
//
// Required env vars (set in Vercel + .env.local):
//   TCS_BASE_URL         , pick prod or dev
//
// Header JWT — one of these two modes:
//   A) Pre-issued bearer token (recommended; TCS's "Bearer Token for API
//      Access" email — a long-lived JWT):
//        TCS_BEARER_TOKEN
//   B) Client id + secret (adapter exchanges via /auth/api/auth, caches):
//        TCS_CLIENT_ID
//        TCS_CLIENT_SECRET
//
// Ecom access token (required — minted per session):
//   TCS_USERNAME          , TCS Envio API username
//   TCS_PASSWORD          , TCS Envio API password
//
//   TCS_TCS_ACCOUNT      , your TCS account (the "tcsaccount"; alphanumeric,
//                           e.g. 'LGEC21048')
//   TCS_COST_CENTER_CODE , your cost-centre code (e.g. '001'); look it up via
//                           the Cost Center Inquiry API if unsure
//   TCS_SHIPPER_NAME     , your company name (printed on the label)
//   TCS_SHIPPER_ADDRESS  , pickup address line 1
//   TCS_SHIPPER_CITY_CODE, TCS city code (e.g. 'LHE' for Lahore, 'KHI' for
//                           Karachi — NOT the airport IATA code). Use the City
//                           List / area-code APIs to confirm.
//   TCS_SHIPPER_CITY_NAME, human-readable city name (printed on the label)
//   TCS_SHIPPER_MOBILE   , your contact phone (03xxxxxxxxx)
//   TCS_SERVICE_CODE     , e.g. 'O' for Overnight. Optional, defaults to 'O'.
//
// If any required var is missing, `isConfigured()` returns false and the
// booking UI falls back to manual tracking-number entry. We never throw,
// `book` / `cancel` / `track` always resolve with `Result<…>`.
// ============================================================================

import type {
  CourierAdapter,
  BookingInput,
  BookingResult,
  CancelResult,
  TrackEvent,
  TrackResult,
  LabelResult,
  LabelPdfResult,
  PaymentRecord,
  PaymentResult,
  Result,
} from './types';
import { normaliseCourierStatus } from './status-mapper';
import { log } from '@/lib/logger';

// Non-auth fields required regardless of which auth mode is in use.
const REQUIRED_NON_AUTH_VARS = [
  'TCS_BASE_URL',
  'TCS_TCS_ACCOUNT',
  'TCS_COST_CENTER_CODE',
  'TCS_SHIPPER_NAME',
  'TCS_SHIPPER_ADDRESS',
  'TCS_SHIPPER_CITY_CODE',
  'TCS_SHIPPER_CITY_NAME',
  'TCS_SHIPPER_MOBILE',
] as const;

function env(key: string): string | undefined {
  return process.env[key];
}

function hasPreIssuedToken(): boolean {
  return Boolean(env('TCS_BEARER_TOKEN'));
}

function hasOauthCredentials(): boolean {
  return Boolean(env('TCS_CLIENT_ID') && env('TCS_CLIENT_SECRET'));
}

// The ecom access token (step 2) is minted from a username+password. Booking,
// cancel, label and payment all require it, so it's part of "configured".
function hasEcomCredentials(): boolean {
  return Boolean(env('TCS_USERNAME') && env('TCS_PASSWORD'));
}

function isConfigured(): boolean {
  if (!REQUIRED_NON_AUTH_VARS.every(k => Boolean(env(k)))) return false;
  if (!(hasPreIssuedToken() || hasOauthCredentials())) return false;
  return hasEcomCredentials();
}

// ─── Step 1: gateway JWT (Authorization header) ─────────────────────────────
// TCS auth tokens expire (the response includes an `expiry` timestamp). Cache
// per process so we don't auth on every booking. Lambda cold-starts get a
// fresh token; warm invocations reuse until ~60s before expiry.
let cachedToken: { value: string; expiresAt: number } | null = null;
const TOKEN_GRACE_SEC = 60;

async function getHeaderToken(): Promise<Result<string>> {
  // Mode A, pre-issued token. Skip the auth round-trip; TCS gives us
  // a JWT good for ~3 years on the account's services list. We don't
  // try to decode the `exp` claim here, if TCS rejects an expired
  // token, the per-call endpoints surface the 401 in their own
  // Result<…> error path.
  const preIssued = env('TCS_BEARER_TOKEN');
  if (preIssued) return preIssued.trim();

  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_GRACE_SEC) {
    return cachedToken.value;
  }

  const baseUrl = env('TCS_BASE_URL')!;
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/auth/api/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientid: env('TCS_CLIENT_ID'),
        clientsecret: env('TCS_CLIENT_SECRET'),
      }),
    });
    const body = await r.json().catch(() => null) as null | {
      result?: { accessToken?: string; expiry?: string };
      status?: boolean;
      code?: string;
    };
    if (!r.ok || !body?.result?.accessToken) {
      return {
        ok: false,
        message: `TCS auth failed (HTTP ${r.status})`,
        code: body?.code ?? r.status,
        raw: body,
      };
    }
    // expiry comes back as ISO like "2027-01-04T05:08:47Z", convert to epoch.
    const expiresAt = body.result.expiry
      ? Math.floor(new Date(body.result.expiry).getTime() / 1000)
      : now + 60 * 60; // fallback: trust for 1 hour
    cachedToken = { value: body.result.accessToken, expiresAt };
    return body.result.accessToken;
  } catch (err) {
    return {
      ok: false,
      message: 'TCS auth network error, check TCS_BASE_URL + connectivity',
      code: 'network',
      raw: (err as Error).message,
    };
  }
}

// ─── Step 2: ecom access token (request body / query) ───────────────────────
// Minted from username+password at /ecom/api/authentication/token (a GET with
// the query params, authorised by the header JWT). Short-lived; cached until
// ~60s before its `expiry`. Required by booking/cancel/label/payment.
let cachedEcomToken: { value: string; expiresAt: number } | null = null;

async function getEcomToken(headerToken: string): Promise<Result<string>> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedEcomToken && cachedEcomToken.expiresAt > now + TOKEN_GRACE_SEC) {
    return cachedEcomToken.value;
  }
  const baseUrl = env('TCS_BASE_URL')!;
  const u = encodeURIComponent(env('TCS_USERNAME') ?? '');
  const p = encodeURIComponent(env('TCS_PASSWORD') ?? '');
  try {
    const r = await fetch(
      `${baseUrl.replace(/\/$/, '')}/ecom/api/authentication/token?username=${u}&password=${p}`,
      { method: 'GET', headers: { Authorization: `Bearer ${headerToken}` } },
    );
    const body = await r.json().catch(() => null) as null | {
      accesstoken?: string; expiry?: string; message?: string;
    };
    if (!r.ok || !body?.accesstoken) {
      return {
        ok: false,
        message: `TCS ecom login failed (HTTP ${r.status}) — check TCS_USERNAME / TCS_PASSWORD`,
        code: r.status,
        raw: body,
      };
    }
    const expiresAt = body.expiry
      ? Math.floor(new Date(body.expiry).getTime() / 1000)
      : now + 60 * 60;
    cachedEcomToken = { value: body.accesstoken, expiresAt };
    return body.accesstoken;
  } catch (err) {
    return { ok: false, message: 'TCS ecom login network error', code: 'network', raw: (err as Error).message };
  }
}

// Helper: type-narrow a Result<X>.
function isErr<T>(r: Result<T>): r is Extract<Result<T>, { ok: false }> {
  return typeof r === 'object' && r !== null && (r as { ok?: boolean }).ok === false;
}

// Fetch both tokens in the order the transactional endpoints need them.
async function getTokens(): Promise<Result<{ jwt: string; ecom: string }>> {
  const jwt = await getHeaderToken();
  if (isErr(jwt)) return jwt;
  const ecom = await getEcomToken(jwt);
  if (isErr(ecom)) return ecom;
  return { jwt, ecom };
}

// ─── Booking creation ──────────────────────────────────────────────────────
async function book(input: BookingInput): Promise<Result<BookingResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured, set TCS_* env vars.', code: 'not_configured' };
  }
  const tokensOrErr = await getTokens();
  if (isErr(tokensOrErr)) return tokensOrErr;
  const { jwt, ecom } = tokensOrErr;
  const baseUrl = env('TCS_BASE_URL')!;

  // TCS schema: "shipmentdate" is DD-MM-YYYY (the example in the spec mixes
  // formats but the doc lists DD-MM-YYYY in the constraints column).
  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = String(today.getFullYear());
  const shipmentDate = `${dd}-${mm}-${yyyy}`;

  // TCS requires at least one SKU; build a synthetic one if input.items is empty.
  const skus = (input.items.length ? input.items : [{
    description: `Order ${input.orderNumber}`,
    quantity: 1,
    weightKg: input.weightKg,
    unitPrice: Math.max(1, Math.round(input.codAmount)),
  }]).map(it => ({
    description: it.description.slice(0, 200),
    quantity: Math.max(1, Math.floor(it.quantity)),
    weight: Math.max(0.5, it.weightKg),
    uom: 'KG',
    unitprice: Math.max(0, Math.round(it.unitPrice)),
  }));

  const body = {
    accesstoken: ecom,
    // We let TCS assign the consignment number, pass empty per the spec example.
    consignmentno: '',
    shipperinfo: {
      tcsaccount:  env('TCS_TCS_ACCOUNT'),
      shippername: env('TCS_SHIPPER_NAME'),
      address1:    env('TCS_SHIPPER_ADDRESS'),
      countrycode: 'PK',
      countryname: 'Pakistan',
      citycode:    env('TCS_SHIPPER_CITY_CODE'),
      cityname:    env('TCS_SHIPPER_CITY_NAME'),
      mobile:      env('TCS_SHIPPER_MOBILE'),
    },
    consigneeinfo: {
      firstname: input.consignee.firstName.slice(0, 50) || 'Customer',
      middlename: '',
      lastname:  (input.consignee.lastName ?? '').slice(0, 50),
      address1:  input.consignee.address1.slice(0, 120),
      address2:  (input.consignee.address2 ?? '').slice(0, 120),
      zip:       (input.consignee.zip ?? '').slice(0, 6),
      countrycode: input.consignee.countryCode ?? 'PK',
      countryname: 'Pakistan',
      cityname:  input.consignee.city.slice(0, 50),
      email:     input.consignee.email ?? '',
      mobile:    sanitisePkMobile(input.consignee.phone),
    },
    shipmentinfo: {
      costcentercode: env('TCS_COST_CENTER_CODE'),
      referenceno:    input.orderNumber,
      contentdesc:    `Order ${input.orderNumber}`,
      servicecode:    env('TCS_SERVICE_CODE') || 'O',
      shipmentdate:   shipmentDate,
      currency:       input.currency ?? 'PKR',
      codamount:      Math.max(0, Math.round(input.codAmount)),
      weightinkg:     Math.max(0.5, input.weightKg),
      pieces:         Math.max(1, input.pieces ?? 1),
      fragile:        false,
      remarks:        (input.remarks ?? `YP order ${input.orderNumber}`).slice(0, 500),
      skus,
    },
  };

  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/ecom/api/booking/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null) as null | {
      response?: string;
      consignmentNo?: string;
      status?: boolean;
      code?: string;
      message?: string;
      error?: Array<{ errorname: string }>;
    };
    if (!r.ok || out?.status === false || !out?.consignmentNo) {
      const errSummary = out?.error?.map(e => e.errorname).filter(Boolean).join('; ');
      return {
        ok: false,
        message: errSummary || out?.message || `TCS booking failed (HTTP ${r.status})`,
        code: out?.code ?? r.status,
        raw: out,
      };
    }
    return { ok: true, trackingNumber: String(out.consignmentNo), raw: out };
  } catch (err) {
    return {
      ok: false,
      message: 'TCS booking network error',
      code: 'network',
      raw: (err as Error).message,
    };
  }
}

// ─── Cancel ────────────────────────────────────────────────────────────────
async function cancel(trackingNumber: string): Promise<Result<CancelResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured.', code: 'not_configured' };
  }
  const tokensOrErr = await getTokens();
  if (isErr(tokensOrErr)) return tokensOrErr;
  const { jwt, ecom } = tokensOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  try {
    const r = await fetch(`${baseUrl.replace(/\/$/, '')}/ecom/api/booking/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ accesstoken: ecom, consignmentNumber: trackingNumber }),
    });
    const out = await r.json().catch(() => null) as null | { message?: string };
    if (!r.ok || !out?.message || /failure/i.test(out.message)) {
      return {
        ok: false,
        message: out?.message ?? `TCS cancel failed (HTTP ${r.status})`,
        code: r.status,
        raw: out,
      };
    }
    return { ok: true, raw: out };
  } catch (err) {
    return { ok: false, message: 'TCS cancel network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Tracking ──────────────────────────────────────────────────────────────
async function track(trackingNumber: string): Promise<Result<TrackResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured.', code: 'not_configured' };
  }
  // Tracking only needs the header JWT (no ecom access token).
  const tokenOrErr = await getHeaderToken();
  if (isErr(tokenOrErr)) return tokenOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  try {
    // Verified live: this is a GET with `consignee` in the query string,
    // authorised by the header JWT. (A POST returns 405.) Try GET first, fall
    // back to POST for resilience against gateway variations.
    const url = `${baseUrl.replace(/\/$/, '')}/tracking/api/Tracking/GetDynamicTrackDetail`;
    let r = await fetch(`${url}?consignee=${encodeURIComponent(trackingNumber)}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenOrErr}` },
    });
    if (r.status === 404 || r.status === 405) {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenOrErr}` },
        body: JSON.stringify({ consignee: [trackingNumber] }),
      });
    }
    const out = await r.json().catch(() => null) as null | {
      deliveryinfo?: Array<{ status?: string; code?: string; datetime?: string }> | null;
      checkpoints?: Array<{ status?: string; datetime?: string }> | null;
      shipmentsummary?: string | null;
      message?: string | null;
    };
    if (!r.ok || !out) {
      return { ok: false, message: `TCS tracking failed (HTTP ${r.status})`, code: r.status, raw: out };
    }
    // TCS answers HTTP 200 with message:"FAIL" and null arrays when its
    // tracking DB has nothing for the CN — either not scanned yet (data
    // appears hours after the first facility scan) or an invalid number.
    // Surface that as an explicit no-data result instead of an empty "all
    // up to date" success.
    if (out.message === 'FAIL' || /no data found/i.test(out.shipmentsummary ?? '')) {
      log.warn('tcs.track_no_data', { tracking: trackingNumber, summary: out.shipmentsummary ?? null });
      return { ok: true, events: [], noData: true, summary: out.shipmentsummary ?? undefined, raw: out };
    }
    // Prefer `checkpoints` — the full scan history ("Arrived at TCS Facility →
    // Out For Delivery → Shipment Delivered") customers expect — and fall back
    // to `deliveryinfo` (delivery-only) when it's absent.
    const source = (out.checkpoints && out.checkpoints.length ? out.checkpoints : out.deliveryinfo) ?? [];
    const events: TrackEvent[] = source.map(e => {
      const label = e.status ?? (e as { code?: string }).code ?? 'In transit';
      return {
        status: normaliseCourierStatus(label),
        description: label,
        occurredAt: parseTcsDate(e.datetime) ?? new Date().toISOString(),
      };
    });
    // Sort newest first so events[0] is the latest.
    events.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1));
    // `current` drives the shipment/order status. Courier feeds often stamp
    // several checkpoints with the SAME timestamp (e.g. TCS logs "Recipient
    // Refused" and "Shipment Returned To Origin" alongside a facility scan at
    // the same minute), so taking events[0] blindly can land on the wrong one
    // and leave a refused/returned parcel looking "in transit". Among the
    // events sharing the newest timestamp, pick the most significant status.
    const rank: Record<string, number> = {
      delivered: 6, returned: 6, cancelled: 6, failed: 5,
      out_for_delivery: 4, in_transit: 3, picked_up: 2, created: 1,
    };
    const newestAt = events[0]?.occurredAt;
    const current = events
      .filter(e => e.occurredAt === newestAt)
      .reduce<string | undefined>(
        (best, e) => (best == null || (rank[e.status] ?? 0) > (rank[best] ?? 0) ? e.status : best),
        undefined,
      );
    // A SUCCESS reply with zero parseable scans (e.g. booked, nothing scanned
    // yet, or a response shape we don't recognise) — log the raw body so the
    // real shape is visible in the logs, and fall back to the summary line's
    // "Current Status: X" for a best-effort status.
    let summaryStatus: string | undefined;
    if (events.length === 0) {
      log.warn('tcs.track_zero_events', {
        tracking: trackingNumber,
        raw: JSON.stringify(out).slice(0, 800),
      });
      const m = /current status:\s*([^\n]+)/i.exec(out.shipmentsummary ?? '');
      if (m) summaryStatus = normaliseCourierStatus(m[1].trim());
    }
    return {
      ok: true,
      events,
      current: current ?? events[0]?.status ?? summaryStatus,
      noData: events.length === 0 && !summaryStatus ? true : undefined,
      summary: out.shipmentsummary ?? undefined,
      raw: out,
    };
  } catch (err) {
    return { ok: false, message: 'TCS tracking network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Label / AWB (CN Print) ────────────────────────────────────────────────
// GET /ecom/api/print/label → the printable consignment label PDF. TCS returns
// a JSON envelope carrying the PDF url (failure returns url:""), so we read the
// `url` field. GET-with-body isn't standard, so POST first, fall back to GET.
async function label(trackingNumber: string): Promise<Result<LabelResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured.', code: 'not_configured' };
  }
  const tokensOrErr = await getTokens();
  if (isErr(tokensOrErr)) return tokensOrErr;
  const { jwt, ecom } = tokensOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  const url = `${baseUrl.replace(/\/$/, '')}/ecom/api/print/label`;
  try {
    // Verified live: GET with consignmentno + shipperdetail + the ecom access
    // token in the query string, authorised by the header JWT. (Omitting
    // accesstoken returns "access token is required".)
    const qs = `?consignmentno=${encodeURIComponent(trackingNumber)}&shipperdetail=true&accesstoken=${encodeURIComponent(ecom)}`;
    let r = await fetch(`${url}${qs}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    if (r.status === 404 || r.status === 405) {
      r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ consignmentno: trackingNumber, shipperdetail: 'true', accesstoken: ecom }),
      });
    }
    // The print endpoint returns a JSON envelope with a `url` on success and on
    // some deployments streams the label PDF directly (Content-Type
    // application/pdf) with no URL. Handle the JSON-url case; otherwise report
    // cleanly (caller treats a label miss as non-fatal, staff can re-print from
    // the TCS portal). Streaming-PDF support is a follow-up (a proxy route).
    const ct = r.headers.get('content-type') ?? '';
    const text = await r.text().catch(() => '');
    let out: { url?: string; message?: string } | null = null;
    if (ct.includes('json') || text.trim().startsWith('{')) {
      try { out = JSON.parse(text) as { url?: string; message?: string }; } catch { out = null; }
    }
    if (!r.ok || !out?.url) {
      const isPdf = ct.includes('pdf') || text.startsWith('%PDF');
      return {
        ok: false,
        message: out?.message
          || (isPdf ? 'TCS returned the label as a direct PDF (no URL); print from the TCS portal.' : `TCS label unavailable (HTTP ${r.status})`),
        code: r.status,
        raw: out ?? { contentType: ct },
      };
    }
    return { ok: true, url: out.url, raw: out };
  } catch (err) {
    return { ok: false, message: 'TCS label network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Label as raw PDF bytes ────────────────────────────────────────────────
// The CN Print endpoint's SUCCESS response on production is the PDF itself
// ("A PDF file will be available for downloading", per the spec) — the
// JSON-with-url envelope only appears on failures. label() above therefore
// never yielded a printable label, which is why every shipment row has a
// NULL raw_label_url and why the Jul 28 booking ended in a manual re-book:
// staff had no label to hand the rider, the parcel travelled under a manual
// CN slip, and the API consignment sat unscanned ("Invalid CN") forever.
// This method returns the streamed bytes so the admin label route can serve
// them for printing.
async function labelPdf(trackingNumber: string): Promise<Result<LabelPdfResult>> {
  if (!isConfigured()) {
    return { ok: false, message: 'TCS adapter is not configured.', code: 'not_configured' };
  }
  const tokensOrErr = await getTokens();
  if (isErr(tokensOrErr)) return tokensOrErr;
  const { jwt, ecom } = tokensOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  const url = `${baseUrl.replace(/\/$/, '')}/ecom/api/print/label`;
  try {
    const qs = `?consignmentno=${encodeURIComponent(trackingNumber)}&shipperdetail=true&accesstoken=${encodeURIComponent(ecom)}`;
    const r = await fetch(`${url}${qs}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${jwt}` },
    });
    const ct = r.headers.get('content-type') ?? '';
    const buf = Buffer.from(await r.arrayBuffer());
    const isPdf = ct.includes('pdf') || buf.subarray(0, 5).toString('latin1').startsWith('%PDF');
    if (r.ok && isPdf) {
      return { ok: true, contentType: 'application/pdf', base64: buf.toString('base64') };
    }
    // Not a PDF: either the JSON envelope carrying a URL (fetch and re-serve
    // those bytes so the caller has one uniform path) or an error body.
    const text = buf.toString('utf8');
    let out: { url?: string; message?: string } | null = null;
    try { out = JSON.parse(text) as { url?: string; message?: string }; } catch { out = null; }
    if (out?.url) {
      const r2 = await fetch(out.url);
      if (r2.ok) {
        const buf2 = Buffer.from(await r2.arrayBuffer());
        return { ok: true, contentType: r2.headers.get('content-type') ?? 'application/pdf', base64: buf2.toString('base64') };
      }
    }
    return {
      ok: false,
      message: out?.message || `TCS label unavailable (HTTP ${r.status})`,
      code: r.status,
      raw: out ?? { contentType: ct },
    };
  } catch (err) {
    return { ok: false, message: 'TCS label network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Payment Detail (actual delivery cost + COD reconciliation) ─────────────
// GET /ecom/api/Payment/detail → the courier's billing ledger for a date range:
// the real delivery charge, GST, COD amount paid and payment status per CN.
// Needs the merchant's TCS customer number (TCS_CUSTOMER_NO), separate from the
// account/cost-centre used for booking. Dates are 'YYYY-MM-DD'.
function paymentConfigured(): boolean {
  return isConfigured() && Boolean(env('TCS_CUSTOMER_NO'));
}

async function payment(fromDate: string, toDate: string): Promise<Result<PaymentResult>> {
  if (!paymentConfigured()) {
    return { ok: false, message: 'TCS payment reconciliation needs TCS_CUSTOMER_NO set.', code: 'not_configured' };
  }
  const tokensOrErr = await getTokens();
  if (isErr(tokensOrErr)) return tokensOrErr;
  const { jwt, ecom } = tokensOrErr;
  const baseUrl = env('TCS_BASE_URL')!;
  const url = `${baseUrl.replace(/\/$/, '')}/ecom/api/Payment/detail`;
  type PaymentEnvelope = { detail?: Array<Record<string, unknown>> | null; message?: string };
  try {
    // The spec declares this endpoint as GET (its own example still shows a
    // JSON body, and TCS's other transactional endpoints POST) — so try GET
    // first, mirroring the live-verified labelPdf() pattern (accesstoken in
    // the query string, Bearer header), and keep POST as the fallback.
    const attempt = async (method: 'GET' | 'POST') => {
      if (method === 'GET') {
        const qs = new URLSearchParams({ customerno: String(env('TCS_CUSTOMER_NO')), fromdate: fromDate, todate: toDate, accesstoken: ecom });
        return fetch(`${url}?${qs}`, { method: 'GET', headers: { Authorization: `Bearer ${jwt}` } });
      }
      return fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ accesstoken: ecom, customerno: env('TCS_CUSTOMER_NO'), fromdate: fromDate, todate: toDate }),
      });
    };
    let r = await attempt('GET');
    let out = await r.json().catch(() => null) as PaymentEnvelope | null;
    // A clean data-shaped 200 whose ledger is simply empty ("No Data Found")
    // is a final answer, not a method mismatch — don't retry those. Retry on
    // any non-2xx AND on 200 error envelopes (TCS gateways return HTTP 200
    // for "method not supported"-style failures).
    const isData = (resp: Response, body: PaymentEnvelope | null) => resp.ok && !!body && Array.isArray(body.detail);
    const isCleanEmpty = (resp: Response, body: PaymentEnvelope | null) =>
      resp.ok && !!body && body.detail == null && typeof body.message === 'string' && /no data|invalid cn|no record/i.test(body.message);
    if (!isData(r, out) && !isCleanEmpty(r, out)) {
      log.warn('tcs.payment GET attempt failed, retrying as POST', { status: r.status, body: out });
      r = await attempt('POST');
      out = await r.json().catch(() => null) as PaymentEnvelope | null;
    }
    if (isCleanEmpty(r, out)) {
      return { ok: true, records: [], raw: out };
    }
    const detail = out && Array.isArray(out.detail) ? out.detail : null;
    if (!r.ok || !detail) {
      log.warn('tcs.payment failed on both methods', { status: r.status, body: out });
      return { ok: false, message: out?.message || `TCS payment detail failed (HTTP ${r.status})`, code: r.status, raw: out };
    }
    const numOrNull = (v: unknown): number | null => {
      const n = Number(v);
      return Number.isFinite(n) ? n : null;
    };
    const records: PaymentRecord[] = detail.map(d => ({
      trackingNumber: String(d['cn by courier'] ?? d['cnsg_no'] ?? ''),
      deliveryCharges: numOrNull(d['delivery charges'] ?? d['courier_charges']),
      gst: numOrNull(d['gst']),
      codAmount: numOrNull(d['codamount']),
      amountPaid: numOrNull(d['amount paid']),
      paid: String(d['payment status'] ?? '').toUpperCase() === 'Y',
      status: (d['cn status'] as string | undefined) ?? (d['status'] as string | undefined) ?? null,
      deliveredAt: parseTcsDate(String(d['delivery date'] ?? '')) ,
    })).filter(rec => rec.trackingNumber);
    return { ok: true, records, raw: out };
  } catch (err) {
    return { ok: false, message: 'TCS payment detail network error', code: 'network', raw: (err as Error).message };
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function sanitisePkMobile(raw: string): string {
  // TCS expects 11 digits starting with 03 (e.g. 03001234567). Strip + and
  // 92 country code variations.
  let n = raw.replace(/\D/g, '');
  if (n.startsWith('92') && n.length === 12) n = '0' + n.slice(2);
  if (n.startsWith('00')) n = n.slice(1);
  return n.slice(0, 11);
}

function parseTcsDate(s: string | undefined | null): string | null {
  if (!s) return null;
  // TCS returns "Thursday Oct 17, 2024 12:58", Date can parse most variants.
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export const tcs: CourierAdapter = {
  id: 'TCS',
  capabilities: { book: true, cancel: true, track: true, label: true, payment: true },
  isConfigured,
  paymentConfigured,
  book,
  cancel,
  track,
  label,
  labelPdf,
  payment,
};
