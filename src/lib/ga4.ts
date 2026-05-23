// Google Analytics 4 — Data API client. Server-side only.
//
// Used by the analytics-refresh action to populate the GA4 widgets on the
// admin analytics page. The auth flow is OAuth 2.0 with a service account:
// we sign a short-lived JWT with the account's private key, exchange it for
// an access token, and call the Data API. The token is cached in-memory for
// its full lifetime (≤ 1 hour) so we mint at most one per warm function.
//
// Required env:
//   GA4_PROPERTY_ID            — the numeric property ID, e.g. 312345678
//                                (NOT the G-XXXX measurement ID).
//                                Find in GA4 Admin → Property → Property
//                                details → Property ID.
//   GA4_SERVICE_ACCOUNT_JSON   — the entire downloaded service-account JSON
//                                key, pasted as a single env var. The
//                                service account needs Viewer access to the
//                                GA4 property (GA4 Admin → Property →
//                                Property access management).

import 'server-only';
import { createSign } from 'crypto';

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

interface CachedToken {
  token: string;
  expiresAt: number;
}
let cachedToken: CachedToken | null = null;

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GA4_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!parsed.client_email || !parsed.private_key) return null;
    // When a multi-line PEM gets stored in a single-line env var, the real
    // newlines often arrive as the literal 2-char sequence `\n`. Restore
    // them or the RSA signer will reject the key.
    const private_key = parsed.private_key.includes('\\n')
      ? parsed.private_key.replace(/\\n/g, '\n')
      : parsed.private_key;
    return { client_email: parsed.client_email, private_key };
  } catch {
    return null;
  }
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  if (cachedToken && cachedToken.expiresAt - 60_000 > Date.now()) {
    return cachedToken.token;
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/analytics.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const enc = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const unsigned = `${enc(header)}.${enc(claims)}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsigned);
  signer.end();
  const sig = signer.sign(sa.private_key).toString('base64url');
  const assertion = `${unsigned}.${sig}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`GA4 token endpoint: ${res.status} ${await res.text()}`);
  }
  const { access_token, expires_in } = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = { token: access_token, expiresAt: Date.now() + expires_in * 1000 };
  return access_token;
}

export interface GA4ReportRequest {
  dimensions?: { name: string }[];
  metrics?: { name: string }[];
  dateRanges?: { startDate: string; endDate: string }[];
  limit?: number | string;
  orderBys?: Array<{
    desc?: boolean;
    metric?: { metricName: string };
    dimension?: { dimensionName: string };
  }>;
  dimensionFilter?: unknown;
}

export interface GA4Row {
  dimensionValues: Array<{ value: string }>;
  metricValues: Array<{ value: string }>;
}

export interface GA4Response {
  rows?: GA4Row[];
  rowCount?: number;
}

export function isGA4Configured(): boolean {
  return Boolean(loadServiceAccount() && process.env.GA4_PROPERTY_ID);
}

// Runs a single GA4 Data-API report. Returns null when GA4 isn't configured —
// callers that loop over multiple reports should bail on null rather than
// hammer a half-configured property.
export async function ga4Query(request: GA4ReportRequest): Promise<GA4Response | null> {
  const sa = loadServiceAccount();
  const propertyId = process.env.GA4_PROPERTY_ID;
  if (!sa || !propertyId) return null;

  const token = await getAccessToken(sa);
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      cache: 'no-store',
    },
  );
  if (!res.ok) {
    throw new Error(`GA4 Data API: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as GA4Response;
}
