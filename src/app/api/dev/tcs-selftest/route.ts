// ============================================================================
// TEMPORARY TCS self-test / diagnostic route. Exercises the live TCS adapter
// and probes token-transport variants against the deployment's credentials.
//
// Safety:
//   - Gated by a one-time token (?token=…); 403 without it.
//   - Booking is UAT-only: refuses unless TCS_BASE_URL points at devconnect.
//   - Never leaks the bearer token; only decodes/reports its (non-secret) claims.
//
// DELETE THIS FILE once TCS is verified. Not referenced anywhere else.
// ============================================================================
import { NextResponse } from 'next/server';
import { tcs } from '@/lib/couriers/tcs';
import { configuredAdapterIds } from '@/lib/couriers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TOKEN = '81a15cb993efc8d40d6f64fd2a7e39ba';

// Decode a JWT payload WITHOUT verifying the signature — just to inspect claims.
function decodeJwt(raw: string | undefined): Record<string, unknown> | { note: string } {
  if (!raw) return { note: 'no token' };
  const t = raw.trim();
  const parts = t.split('.');
  if (parts.length !== 3) return { note: `not a JWT (has ${parts.length} segments)`, startsWith: t.slice(0, 8) };
  try {
    const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch (e) {
    return { note: 'payload decode failed', error: (e as Error).message };
  }
}

// Build the same booking body the adapter builds, so header/body experiments
// stay faithful to production behaviour.
function buildBookingBody(accesstoken: string) {
  const now = new Date();
  const dd = String(now.getDate()).padStart(2, '0');
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const yyyy = String(now.getFullYear());
  return {
    accesstoken,
    consignmentno: '',
    shipperinfo: {
      tcsaccount: process.env.TCS_TCS_ACCOUNT,
      shippername: process.env.TCS_SHIPPER_NAME,
      address1: process.env.TCS_SHIPPER_ADDRESS,
      countrycode: 'PK',
      countryname: 'Pakistan',
      citycode: process.env.TCS_SHIPPER_CITY_CODE,
      cityname: process.env.TCS_SHIPPER_CITY_NAME,
      mobile: process.env.TCS_SHIPPER_MOBILE,
    },
    consigneeinfo: {
      firstname: 'Selftest', middlename: '', lastname: 'Customer',
      address1: 'House 1, Test Street, Gulshan-e-Iqbal', address2: '', zip: '',
      countrycode: 'PK', countryname: 'Pakistan', cityname: 'Karachi',
      email: 'selftest@example.com', mobile: '03001234567',
    },
    shipmentinfo: {
      costcentercode: process.env.TCS_COST_CENTER_CODE,
      referenceno: `SELFTEST-${yyyy}${mm}${dd}`,
      contentdesc: 'Self-test', servicecode: process.env.TCS_SERVICE_CODE || 'O',
      shipmentdate: `${dd}-${mm}-${yyyy}`, currency: 'PKR', codamount: 1000,
      weightinkg: 0.5, pieces: 1, fragile: false, remarks: 'Automated self-test — ignore',
      skus: [{ description: 'Self-test item', quantity: 1, weight: 0.5, uom: 'KG', unitprice: 1000 }],
    },
  };
}

async function tryBook(base: string, token: string, variant: string, useHeader: boolean, bodyToken: string) {
  const body = buildBookingBody(bodyToken);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useHeader) headers.Authorization = `Bearer ${token}`;
  try {
    const r = await fetch(`${base.replace(/\/$/, '')}/ecom/api/booking/create`, {
      method: 'POST', headers, body: JSON.stringify(body),
    });
    const out = await r.json().catch(() => null);
    return { variant, http: r.status, ok: r.ok && out?.status !== false && Boolean(out?.consignmentNo), consignmentNo: out?.consignmentNo ?? null, response: out };
  } catch (e) {
    return { variant, ok: false, error: (e as Error).message };
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const baseUrl = process.env.TCS_BASE_URL ?? '(unset)';
  const isUat = /devconnect/i.test(baseUrl);
  const rawToken = process.env.TCS_BEARER_TOKEN;
  const steps: Array<Record<string, unknown>> = [];

  const claims = decodeJwt(rawToken);
  const nowSec = Math.floor(Date.now() / 1000);
  const exp = typeof (claims as Record<string, unknown>).exp === 'number' ? (claims as { exp: number }).exp : null;

  steps.push({
    step: 'config',
    baseUrl, isUat,
    isConfigured: tcs.isConfigured(),
    adapterIds: configuredAdapterIds(),
    authMode: rawToken ? 'bearer-token' : (process.env.TCS_CLIENT_ID ? 'client-id-secret' : 'none'),
    token: {
      present: Boolean(rawToken),
      length: rawToken?.length ?? 0,
      hasWhitespace: rawToken ? rawToken !== rawToken.trim() : false,
      startsWithBearer: rawToken ? /^bearer /i.test(rawToken) : false,
      startsWithEyJ: rawToken ? rawToken.trim().startsWith('eyJ') : false,
    },
    tokenClaims: claims,
    tokenExpired: exp ? exp < nowSec : 'unknown',
    tokenExpiresAt: exp ? new Date(exp * 1000).toISOString() : 'unknown',
    shipper: {
      tcsAccount: process.env.TCS_TCS_ACCOUNT ?? null,
      costCenter: process.env.TCS_COST_CENTER_CODE ?? null,
      cityCode: process.env.TCS_SHIPPER_CITY_CODE ?? null,
      shipperName: process.env.TCS_SHIPPER_NAME ?? null,
      mobile: process.env.TCS_SHIPPER_MOBILE ?? null,
    },
    hasCustomerNo: Boolean(process.env.TCS_CUSTOMER_NO),
  });

  if (!tcs.isConfigured() || !isUat || !rawToken) {
    return NextResponse.json({ ok: false, summary: 'Not configured / not UAT — see config step.', steps }, { status: 200 });
  }

  const token = rawToken.trim();

  // Probe: isolate token-validity from account/cost-centre config.
  if (url.searchParams.get('probe') === '1') {
    const b = baseUrl.replace(/\/$/, '');
    const acct = process.env.TCS_TCS_ACCOUNT ?? '';

    // (a) setup/areacode — needs the bearer token but NO account/cost-centre.
    //     If this works, the token is valid at the gateway and the booking
    //     failure is purely an account/cost-centre config mismatch.
    async function hit(label: string, path: string, method: string, body: unknown, useHeader: boolean, query?: string) {
      const headers: Record<string, string> = {};
      if (method !== 'GET' || body) headers['Content-Type'] = 'application/json';
      if (useHeader) headers.Authorization = `Bearer ${token}`;
      try {
        const r = await fetch(`${b}${path}${query ?? ''}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        const out = await r.json().catch(() => null);
        return { label, http: r.status, response: out };
      } catch (e) { return { label, error: (e as Error).message }; }
    }

    steps.push({ step: 'probe:areacode(header)', ...(await hit('areacode', '/ecom/api/setup/areacode', 'POST', { citycode: 'KHI', area: '' }, true)) });
    steps.push({ step: 'probe:areacode(body-token)', ...(await hit('areacode', '/ecom/api/setup/areacode', 'POST', { citycode: 'KHI', area: '', accesstoken: token }, false)) });
    // (b) cost-centre inquiry — lists the REAL cost centres for the account.
    steps.push({ step: 'probe:costcenter(acct-as-customerno)', ...(await hit('cci', '/ecom/inquiry/costcenterinquiry', 'POST', { accesstoken: token, customerno: acct }, true)) });
    steps.push({ step: 'probe:costcenter(get)', ...(await hit('cci', '/ecom/inquiry/costcenterinquiry', 'GET', null, true, `?customerno=${encodeURIComponent(acct)}`)) });
    // (c) tracking with a dummy CN — same token via Authorization header.
    steps.push({ step: 'probe:track(dummy)', ...(await hit('track', '/tracking/api/Tracking/GetDynamicTrackDetail', 'POST', { consignee: ['0000000000'] }, true)) });

    return NextResponse.json({ ok: true, summary: 'Token-validity + config probes — see steps.', steps }, { status: 200 });
  }

  // Probe token transport variants against the booking endpoint.
  if (url.searchParams.get('book') === '1') {
    const v1 = await tryBook(baseUrl, token, 'body-accesstoken-only (current adapter)', false, token);
    steps.push({ step: 'book:v1', ...v1 });
    const v2 = await tryBook(baseUrl, token, 'Authorization header + body accesstoken', true, token);
    steps.push({ step: 'book:v2', ...v2 });
    const v3 = await tryBook(baseUrl, token, 'Authorization header + empty body accesstoken', true, '');
    steps.push({ step: 'book:v3', ...v3 });

    // If any variant produced a consignment, cancel it to clean up.
    for (const v of [v1, v2, v3]) {
      if (v.ok && v.consignmentNo) {
        const c = await tcs.cancel(String(v.consignmentNo));
        steps.push({ step: `cleanup-cancel ${v.consignmentNo}`, result: c });
      }
    }
    const anyOk = [v1, v2, v3].some(v => v.ok);
    return NextResponse.json({ ok: anyOk, summary: anyOk ? 'A booking variant succeeded — see which.' : 'All booking variants rejected — token/account mismatch.', steps }, { status: 200 });
  }

  return NextResponse.json({ ok: true, summary: 'Diagnostics only. Add &book=1 to probe booking variants.', steps }, { status: 200 });
}
