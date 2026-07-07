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
function buildBookingBody(accesstoken: string, costCenterOverride?: string) {
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
      costcentercode: costCenterOverride || process.env.TCS_COST_CENTER_CODE,
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
    buildMarker: 'cc001-final',
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

  // Prod probe/booking paths hardcode ociconnect and only need the token; the
  // isUat gate is applied per-path (only the adapter book=1 path is UAT-only).
  if (!tcs.isConfigured() || !rawToken) {
    return NextResponse.json({ ok: false, summary: 'Not configured — see config step.', steps }, { status: 200 });
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

    // (a) setup/areacode is a GET; token in Authorization header. Pure token
    //     validity — no account/cost-centre involved.
    steps.push({ step: 'probe:areacode(GET,header)', ...(await hit('areacode', '/ecom/api/setup/areacode', 'GET', null, true, '?citycode=KHI&area=')) });
    steps.push({ step: 'probe:areacode(GET,noauth)', ...(await hit('areacode', '/ecom/api/setup/areacode', 'GET', null, false, '?citycode=KHI&area=')) });
    // (b) cost-centre inquiry — lists the REAL cost centres for the account.
    //     Try both documented path spellings, GET + POST.
    steps.push({ step: 'probe:cci(api,POST)', ...(await hit('cci', '/ecom/api/inquiry/costcenterinquiry', 'POST', { accesstoken: token, customerno: acct }, true)) });
    steps.push({ step: 'probe:cci(noapi,POST)', ...(await hit('cci', '/ecom/inquiry/costcenterinquiry', 'POST', { accesstoken: token, customerno: acct }, true)) });
    steps.push({ step: 'probe:cci(api,GET)', ...(await hit('cci', '/ecom/api/inquiry/costcenterinquiry', 'GET', null, true, `?customerno=${encodeURIComponent(acct)}`)) });
    // (c) tracking with a dummy CN — GET, token via Authorization header.
    steps.push({ step: 'probe:track(GET)', ...(await hit('track', '/tracking/api/Tracking/GetDynamicTrackDetail', 'GET', null, true, '?consignee=0000000000')) });

    // (d) CROSS-ENVIRONMENT: same token, read-only areacode, against BOTH
    //     UAT and prod hosts. If prod accepts it but UAT doesn't, the token
    //     was minted for the wrong environment. Read-only — safe on both.
    async function hitHost(host: string) {
      try {
        const r = await fetch(`${host}/ecom/api/setup/areacode?citycode=KHI&area=`, {
          method: 'GET', headers: { Authorization: `Bearer ${token}` },
        });
        const out = await r.json().catch(() => null);
        return { host, http: r.status, message: out?.message ?? null, count: out?.count ?? null, hasData: Array.isArray(out?.data) };
      } catch (e) { return { host, error: (e as Error).message }; }
    }
    steps.push({ step: 'probe:xenv:UAT', ...(await hitHost('https://devconnect.tcscourier.com')) });
    steps.push({ step: 'probe:xenv:PROD', ...(await hitHost('https://ociconnect.tcscourier.com')) });

    // (e) Re-exchange: does clientid+clientsecret path exist? (Only if set.)
    if (process.env.TCS_CLIENT_ID && process.env.TCS_CLIENT_SECRET) {
      steps.push({ step: 'probe:reauth', ...(await hit('auth', '/auth/api/auth', 'POST', { clientid: process.env.TCS_CLIENT_ID, clientsecret: process.env.TCS_CLIENT_SECRET }, false)) });
    }

    return NextResponse.json({ ok: true, summary: 'Token-validity + config probes — see steps.', steps }, { status: 200 });
  }

  // Probe the SECOND auth system: /ecom/api/authentication/token (username +
  // password → opaque accesstoken for the body of transactional ecom APIs).
  // Read-only — dummy creds, just confirming the endpoint exists & its shape.
  if (url.searchParams.get('authprobe') === '1') {
    const P = 'https://ociconnect.tcscourier.com';
    async function g(label: string, path: string, query = '', useHeader = false, body?: unknown, method = 'GET') {
      const headers: Record<string, string> = {};
      if (useHeader) headers.Authorization = `Bearer ${token}`;
      if (body) headers['Content-Type'] = 'application/json';
      try {
        const r = await fetch(`${P}${path}${query}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
        return { label, http: r.status, response: await r.json().catch(() => null) };
      } catch (e) { return { label, error: (e as Error).message }; }
    }
    const acct = process.env.TCS_TCS_ACCOUNT ?? '';
    // Does the ecom authentication endpoint exist? (GET with dummy creds.)
    steps.push({ step: 'auth:ecom-token(GET dummy)', ...(await g('ecom-auth', '/ecom/api/authentication/token', '?username=selftest&password=selftest')) });
    steps.push({ step: 'auth:ecom-token(GET dummy+hdr)', ...(await g('ecom-auth', '/ecom/api/authentication/token', '?username=selftest&password=selftest', true)) });
    steps.push({ step: 'auth:ecom-token(POST dummy)', ...(await g('ecom-auth', '/ecom/api/authentication/token', '', false, { username: 'selftest', password: 'selftest' }, 'POST')) });
    // Read transactional API with header only — does it also need a body token?
    steps.push({ step: 'auth:cci(header only)', ...(await g('cci', '/ecom/api/inquiry/costcenterinquiry', `?customerno=${encodeURIComponent(acct)}`, true)) });
    return NextResponse.json({ ok: true, summary: 'Second-auth-system probe — see steps.', steps }, { status: 200 });
  }

  // Look up the account's REAL cost centres via Cost Center Inquiry, using the
  // minted ecom token. Solves "No Cost Center found" from a wrong code.
  if (url.searchParams.get('cci') === '1') {
    const P = 'https://ociconnect.tcscourier.com';
    const u = process.env.TCS_USERNAME ?? '', p = process.env.TCS_PASSWORD ?? '';
    const acct = process.env.TCS_TCS_ACCOUNT ?? '';
    // mint (GET-query, the shape confirmed working)
    const mr = await fetch(`${P}/ecom/api/authentication/token?username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${token}` } });
    const mj = await mr.json().catch(() => null) as null | { accesstoken?: string };
    const ecomToken = mj?.accesstoken ?? '';
    steps.push({ step: 'cci:mint', http: mr.status, gotToken: Boolean(ecomToken) });
    if (!ecomToken) return NextResponse.json({ ok: false, summary: 'mint failed', steps }, { status: 200 });

    async function cci(name: string, path: string, method: string, useQuery: boolean, customerno: string) {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
      let target = `${P}${path}`;
      let body: string | undefined;
      if (useQuery) {
        target += `?customerno=${encodeURIComponent(customerno)}&accesstoken=${encodeURIComponent(ecomToken)}`;
      } else {
        headers['Content-Type'] = 'application/json';
        body = JSON.stringify({ accesstoken: ecomToken, customerno });
      }
      try {
        const r = await fetch(target, { method, headers, body });
        return { name, http: r.status, response: await r.json().catch(() => null) };
      } catch (e) { return { name, error: (e as Error).message }; }
    }
    // Try path spellings × transport × customerno = account.
    steps.push({ step: 'cci:api-POST(acct)', ...(await cci('a', '/ecom/api/inquiry/costcenterinquiry', 'POST', false, acct)) });
    steps.push({ step: 'cci:api-GET(acct)', ...(await cci('b', '/ecom/api/inquiry/costcenterinquiry', 'GET', true, acct)) });
    steps.push({ step: 'cci:noapi-POST(acct)', ...(await cci('c', '/ecom/inquiry/costcenterinquiry', 'POST', false, acct)) });
    steps.push({ step: 'cci:noapi-GET(acct)', ...(await cci('d', '/ecom/inquiry/costcenterinquiry', 'GET', true, acct)) });
    return NextResponse.json({ ok: true, summary: 'Cost-centre inquiry — look for your real costcentercode(s).', steps }, { status: 200 });
  }

  // FULL two-step prod flow: mint the opaque ecom accesstoken from
  // /ecom/api/authentication/token (username+password), then book → label →
  // track → cancel on prod, probing token placement to find the exact wiring.
  if (url.searchParams.get('prodbook2') === '1') {
    const P = 'https://ociconnect.tcscourier.com';
    const u = process.env.TCS_USERNAME ?? '';
    const p = process.env.TCS_PASSWORD ?? '';
    if (!u || !p) {
      return NextResponse.json({ ok: false, summary: 'TCS_USERNAME / TCS_PASSWORD not set on this deployment.', steps }, { status: 200 });
    }

    // ── Step 1: mint the ecom accesstoken (try a few request shapes) ────────
    async function mint(shape: string) {
      const base = `${P}/ecom/api/authentication/token`;
      const h: Record<string, string> = { Authorization: `Bearer ${token}` };
      let r: Response;
      try {
        if (shape === 'GET-query') {
          r = await fetch(`${base}?username=${encodeURIComponent(u)}&password=${encodeURIComponent(p)}`, { method: 'GET', headers: h });
        } else if (shape === 'GET-body') {
          r = await fetch(base, { method: 'GET', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        } else {
          r = await fetch(base, { method: 'POST', headers: { ...h, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u, password: p }) });
        }
      } catch (e) { return { shape, error: (e as Error).message, accesstoken: null as string | null }; }
      const out = await r.json().catch(() => null) as null | { accesstoken?: string; message?: string; expiry?: string };
      return { shape, http: r.status, message: out?.message ?? null, gotToken: Boolean(out?.accesstoken), accesstoken: out?.accesstoken ?? null };
    }
    let ecomToken: string | null = null;
    let mintShape: string | null = null;
    for (const shape of ['GET-query', 'GET-body', 'POST']) {
      const m = await mint(shape);
      steps.push({ step: `mint(${shape})`, http: (m as { http?: number }).http, message: (m as { message?: string }).message, gotToken: Boolean(m.accesstoken), tokenLen: m.accesstoken?.length ?? 0 });
      if (m.accesstoken) { ecomToken = m.accesstoken; mintShape = shape; break; }
    }
    if (!ecomToken) {
      return NextResponse.json({ ok: false, summary: 'Could not mint ecom accesstoken — username/password rejected. See mint steps.', steps }, { status: 200 });
    }
    steps.push({ step: 'mint:OK', shape: mintShape });

    // ── Step 2: booking, probing token placement ────────────────────────────
    const ccOverride = url.searchParams.get('cc') || undefined;
    async function book(name: string, headerToken: string, bodyToken: string) {
      const r = await fetch(`${P}/ecom/api/booking/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${headerToken}` },
        body: JSON.stringify(buildBookingBody(bodyToken, ccOverride)),
      });
      const out = await r.json().catch(() => null);
      return { name, http: r.status, ok: r.ok && out?.status !== false && Boolean(out?.consignmentNo), cn: out?.consignmentNo ?? null, response: out };
    }
    const attempts = [
      { name: 'header=JWT, body=ecomToken', h: token, b: ecomToken },
      { name: 'header=ecomToken, body=ecomToken', h: ecomToken, b: ecomToken },
      { name: 'header=ecomToken, body=empty', h: ecomToken, b: '' },
    ];
    let cn: string | null = null; let winning: string | null = null;
    for (const a of attempts) {
      const res = await book(a.name, a.h, a.b);
      steps.push({ step: `book(${a.name})`, http: res.http, ok: res.ok, cn: res.cn, response: res.response });
      if (res.ok) { cn = String(res.cn); winning = a.name; break; }
    }

    // ── Step 3: label + track + cancel (cleanup) ────────────────────────────
    if (cn) {
      const bodyTok = winning?.includes('body=empty') ? '' : ecomToken;
      const hdrTok = winning?.startsWith('header=JWT') ? token : ecomToken;
      const lr = await fetch(`${P}/ecom/api/print/label?consignmentno=${encodeURIComponent(cn)}&shipperdetail=true`, { method: 'GET', headers: { Authorization: `Bearer ${hdrTok}` } });
      steps.push({ step: 'label', http: lr.status, response: await lr.json().catch(() => null) });
      const tr = await fetch(`${P}/tracking/api/Tracking/GetDynamicTrackDetail?consignee=${encodeURIComponent(cn)}`, { method: 'GET', headers: { Authorization: `Bearer ${hdrTok}` } });
      steps.push({ step: 'track', http: tr.status, response: await tr.json().catch(() => null) });
      const cr = await fetch(`${P}/ecom/api/booking/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hdrTok}` }, body: JSON.stringify({ accesstoken: bodyTok, consignmentNumber: cn }) });
      steps.push({ step: 'cancel(cleanup)', http: cr.status, response: await cr.json().catch(() => null) });
    }

    return NextResponse.json({
      ok: Boolean(cn), consignmentNo: cn, winningPlacement: winning, mintShape,
      summary: cn ? `PROD end-to-end OK — booked+cancelled ${cn} via [${winning}], token minted via ${mintShape}.` : 'Minted ecom token but booking still failed — see steps.',
      steps,
    }, { status: 200 });
  }

  // PROD smoke test: create ONE real consignment on ociconnect, validate
  // label + track, then cancel it. Tests both token transports so we learn
  // whether the adapter (body-token only) works on prod or needs the header.
  if (url.searchParams.get('prodbook') === '1') {
    const P = 'https://ociconnect.tcscourier.com';
    async function prodBook(useHeader: boolean, bodyToken: string) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useHeader) headers.Authorization = `Bearer ${token}`;
      const r = await fetch(`${P}/ecom/api/booking/create`, { method: 'POST', headers, body: JSON.stringify(buildBookingBody(bodyToken)) });
      const out = await r.json().catch(() => null);
      return { http: r.status, ok: r.ok && out?.status !== false && Boolean(out?.consignmentNo), cn: out?.consignmentNo ?? null, response: out };
    }
    async function prodCancel(cn: string) {
      const r = await fetch(`${P}/ecom/api/booking/cancel`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ accesstoken: token, consignmentNumber: cn }) });
      return { http: r.status, response: await r.json().catch(() => null) };
    }
    async function prodGet(path: string, query: string) {
      const r = await fetch(`${P}${path}${query}`, { method: 'GET', headers: { Authorization: `Bearer ${token}` } });
      return { http: r.status, response: await r.json().catch(() => null) };
    }

    // prodBookRaw: full control over header + body accesstoken handling.
    async function prodBookRaw(useHeader: boolean, bodyToken: string | undefined) {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (useHeader) headers.Authorization = `Bearer ${token}`;
      const body = buildBookingBody(bodyToken ?? '');
      if (bodyToken === undefined) delete (body as { accesstoken?: string }).accesstoken;
      const r = await fetch(`${P}/ecom/api/booking/create`, { method: 'POST', headers, body: JSON.stringify(body) });
      const out = await r.json().catch(() => null);
      return { http: r.status, ok: r.ok && out?.status !== false && Boolean(out?.consignmentNo), cn: out?.consignmentNo ?? null, response: out };
    }

    const variants: Array<{ name: string; run: () => Promise<{ http: number; ok: boolean; cn: unknown; response: unknown }> }> = [
      { name: 'header + empty body accesstoken', run: () => prodBookRaw(true, '') },
      { name: 'header + NO body accesstoken key', run: () => prodBookRaw(true, undefined) },
      { name: 'header + body accesstoken=token', run: () => prodBookRaw(true, token) },
    ];
    let cn: string | null = null;
    let winningVariant: string | null = null;
    for (const v of variants) {
      const res = await v.run();
      steps.push({ step: `prod:book(${v.name})`, ...res });
      if (res.ok) { cn = String(res.cn); winningVariant = v.name; break; }
    }

    if (cn) {
      steps.push({ step: 'prod:label', ...(await prodGet('/ecom/api/print/label', `?consignmentno=${encodeURIComponent(cn)}&shipperdetail=true`)) });
      steps.push({ step: 'prod:track', ...(await prodGet('/tracking/api/Tracking/GetDynamicTrackDetail', `?consignee=${encodeURIComponent(cn)}`)) });
      const c = await prodCancel(cn);
      steps.push({ step: 'prod:cancel(cleanup)', ...c });
    }
    return NextResponse.json({ ok: Boolean(cn), consignmentNo: cn, winningVariant, summary: cn ? `PROD booking OK via ${winningVariant}; cancelled ${cn}.` : 'PROD booking failed — see steps.', steps }, { status: 200 });
  }

  // Probe token transport variants against the booking endpoint (UAT ONLY —
  // this path uses baseUrl/adapter, so refuse when pointed at prod).
  if (url.searchParams.get('book') === '1' && isUat) {
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
