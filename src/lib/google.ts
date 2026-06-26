import 'server-only';
import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { SITE_URL } from '@/lib/seo';
import { STAFF_SESSION_SECRET } from '@/lib/session-secret';
import { log } from '@/lib/logger';

// ============================================================================
// Google account connection (owner-level) — OAuth + Search Console / GA4 reads.
//
// Custom server-side OAuth (not Supabase's provider) because we need an OFFLINE
// refresh token and read scopes to call the Search Console + GA4 APIs on the
// server later. The refresh token is encrypted at rest (AES-256-GCM, key
// derived from STAFF_SESSION_SECRET) in the RLS-locked google_integration row.
//
// Cloud Console prerequisite (owner): a Web OAuth client whose authorized
// redirect URI is exactly REDIRECT_URI below, with the Search Console API,
// Analytics Data API and Analytics Admin API enabled, and the owner added as a
// test user on the consent screen. Env: GOOGLE_OAUTH_CLIENT_ID / _SECRET.
// ============================================================================

export const REDIRECT_URI = `${SITE_URL}/api/google/oauth/callback`;

export const GOOGLE_SCOPES = [
  'openid',
  'email',
  // Full webmasters (not .readonly) so we can SUBMIT the sitemap + inspect URLs,
  // not just read search analytics.
  'https://www.googleapis.com/auth/webmasters',
  'https://www.googleapis.com/auth/analytics.readonly',   // GA4 (data + admin list)
];

function clientId(): string { return process.env.GOOGLE_OAUTH_CLIENT_ID ?? ''; }
function clientSecret(): string { return process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? ''; }
export function isGoogleOAuthConfigured(): boolean { return Boolean(clientId() && clientSecret()); }

// ─── token encryption ───────────────────────────────────────────────────────
function key(): Buffer { return createHash('sha256').update(STAFF_SESSION_SECRET()).digest(); }

function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(b64: string | null): string | null {
  if (!b64) return null;
  try {
    const raw = Buffer.from(b64, 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const enc = raw.subarray(28);
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
  } catch {
    return null; // wrong key / corrupt — treat as disconnected
  }
}

// ─── connection row ──────────────────────────────────────────────────────────
export interface GoogleConnection {
  email: string | null;
  scopes: string[];
  gsc_site_url: string | null;
  ga4_property_id: string | null;
  ga4_property_name: string | null;
  connected_at: string;
}

interface ConnectionRow extends GoogleConnection {
  refresh_token: string | null;
  access_token: string | null;
  token_expiry: string | null;
}

/** Public-facing connection status (never includes tokens). Null = not connected. */
export async function getGoogleConnection(): Promise<GoogleConnection | null> {
  const { data } = await supabaseAdmin()
    .from('google_integration')
    .select('email, scopes, gsc_site_url, ga4_property_id, ga4_property_name, connected_at, refresh_token')
    .eq('id', true).maybeSingle();
  const row = data as (ConnectionRow | null);
  if (!row || !row.refresh_token) return null;
  return {
    email: row.email, scopes: row.scopes ?? [],
    gsc_site_url: row.gsc_site_url, ga4_property_id: row.ga4_property_id,
    ga4_property_name: row.ga4_property_name, connected_at: row.connected_at,
  };
}

export async function disconnectGoogle(): Promise<void> {
  await supabaseAdmin().from('google_integration').delete().eq('id', true);
}

// ─── OAuth flow ──────────────────────────────────────────────────────────────
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: clientId(),
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_SCOPES.join(' '),
    access_type: 'offline',       // get a refresh token
    prompt: 'consent',            // force refresh-token issuance on re-connect
    include_granted_scopes: 'true',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

interface TokenResponse {
  access_token: string; expires_in: number; refresh_token?: string;
  scope?: string; id_token?: string;
}

/** Exchange the authorization code, persist the (encrypted) refresh token, and
 *  return the email of the connected account. */
export async function exchangeCodeAndStore(code: string): Promise<{ email: string | null }> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: clientId(), client_secret: clientSecret(),
      redirect_uri: REDIRECT_URI, grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) throw new Error(`token exchange failed: ${res.status} ${await res.text()}`);
  const tok = (await res.json()) as TokenResponse;
  if (!tok.refresh_token) {
    // Google omits the refresh token if the user previously granted access and
    // we didn't force prompt=consent. We do force it, so this is rare.
    throw new Error('no_refresh_token');
  }
  const email = emailFromIdToken(tok.id_token);
  const expiry = new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString();
  await supabaseAdmin().from('google_integration').upsert({
    id: true,
    email,
    refresh_token: encrypt(tok.refresh_token),
    access_token: encrypt(tok.access_token),
    token_expiry: expiry,
    scopes: (tok.scope ?? '').split(' ').filter(Boolean),
    connected_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  return { email };
}

function emailFromIdToken(idToken?: string): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64').toString('utf8'));
    return typeof payload.email === 'string' ? payload.email : null;
  } catch { return null; }
}

/** A valid access token, refreshing via the stored refresh token when needed. */
async function getAccessToken(): Promise<string> {
  const { data } = await supabaseAdmin()
    .from('google_integration')
    .select('refresh_token, access_token, token_expiry').eq('id', true).maybeSingle();
  const row = data as Pick<ConnectionRow, 'refresh_token' | 'access_token' | 'token_expiry'> | null;
  const refresh = decrypt(row?.refresh_token ?? null);
  if (!refresh) throw new Error('google_not_connected');

  const cached = decrypt(row?.access_token ?? null);
  if (cached && row?.token_expiry && new Date(row.token_expiry).getTime() > Date.now()) {
    return cached;
  }

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId(), client_secret: clientSecret(),
      refresh_token: refresh, grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) throw new Error(`token refresh failed: ${res.status}`);
  const tok = (await res.json()) as TokenResponse;
  await supabaseAdmin().from('google_integration').update({
    access_token: encrypt(tok.access_token),
    token_expiry: new Date(Date.now() + (tok.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', true);
  return tok.access_token;
}

async function gapi<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken();
  // Only set JSON content-type when there's a body — an empty PUT (e.g.
  // sitemaps.submit) with Content-Type: application/json makes Google try to
  // parse the empty body as JSON and 400 with "Unexpected end of input".
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (init?.body) headers['Content-Type'] = 'application/json';
  const res = await fetch(url, {
    ...init,
    headers: { ...headers, ...((init?.headers as Record<string, string>) ?? {}) },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`google api ${res.status}: ${await res.text()}`);
  // Some endpoints (sitemaps.submit) return 204/empty — don't choke on no JSON.
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// ─── Search Console ──────────────────────────────────────────────────────────
export interface GscSite { siteUrl: string; permissionLevel: string }

export async function listGscSites(): Promise<GscSite[]> {
  const data = await gapi<{ siteEntry?: GscSite[] }>('https://www.googleapis.com/webmasters/v3/sites');
  return data.siteEntry ?? [];
}

export interface GscRow { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

export async function gscQuery(args: {
  siteUrl: string; startDate: string; endDate: string;
  dimensions?: string[]; rowLimit?: number;
}): Promise<GscRow[]> {
  const data = await gapi<{ rows?: GscRow[] }>(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(args.siteUrl)}/searchAnalytics/query`,
    { method: 'POST', body: JSON.stringify({
      startDate: args.startDate, endDate: args.endDate,
      dimensions: args.dimensions ?? [], rowLimit: args.rowLimit ?? 10,
    }) },
  );
  return data.rows ?? [];
}

// ─── Search Console: sitemaps + URL inspection (indexing) ────────────────────
export interface SitemapStatus {
  path: string;
  lastSubmitted: string | null;
  lastDownloaded: string | null;
  isPending: boolean;
  warnings: number;
  errors: number;
  submittedUrls: number;
}

export async function listSitemaps(siteUrl: string): Promise<SitemapStatus[]> {
  const data = await gapi<{ sitemap?: Array<{ path: string; lastSubmitted?: string; lastDownloaded?: string; isPending?: boolean; warnings?: string; errors?: string; contents?: Array<{ submitted?: string }> }> }>(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps`,
  );
  return (data.sitemap ?? []).map(s => ({
    path: s.path,
    lastSubmitted: s.lastSubmitted ?? null,
    lastDownloaded: s.lastDownloaded ?? null,
    isPending: Boolean(s.isPending),
    warnings: Number(s.warnings ?? 0),
    errors: Number(s.errors ?? 0),
    submittedUrls: (s.contents ?? []).reduce((n, c) => n + Number(c.submitted ?? 0), 0),
  }));
}

/** Submit (or re-submit) a sitemap so Google re-crawls every listed page. This
 *  is the supported, scalable way to "submit pages for indexing" — Google still
 *  decides what/when to index, but this is the programmatic nudge. */
export async function submitSitemap(siteUrl: string, sitemapUrl: string): Promise<void> {
  await gapi<void>(
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`,
    { method: 'PUT' },
  );
}

export interface UrlIndexStatus {
  verdict: string;            // PASS / NEUTRAL / FAIL
  coverageState: string;      // e.g. "Submitted and indexed", "Crawled - currently not indexed"
  lastCrawlTime: string | null;
  googleCanonical: string | null;
}

/** Check whether a specific URL is indexed (read-only — there is no API to
 *  *force* indexing of an arbitrary page; this reports current status). */
export async function inspectUrl(siteUrl: string, inspectionUrl: string): Promise<UrlIndexStatus> {
  const data = await gapi<{ inspectionResult?: { indexStatusResult?: { verdict?: string; coverageState?: string; lastCrawlTime?: string; googleCanonical?: string } } }>(
    'https://searchconsole.googleapis.com/v1/urlInspection/index:inspect',
    { method: 'POST', body: JSON.stringify({ inspectionUrl, siteUrl }) },
  );
  const r = data.inspectionResult?.indexStatusResult ?? {};
  return {
    verdict: r.verdict ?? 'UNKNOWN',
    coverageState: r.coverageState ?? 'Unknown',
    lastCrawlTime: r.lastCrawlTime ?? null,
    googleCanonical: r.googleCanonical ?? null,
  };
}

// ─── GA4 (Analytics Admin + Data) ────────────────────────────────────────────
export interface Ga4Property { propertyId: string; displayName: string; account: string }

export async function listGa4Properties(): Promise<Ga4Property[]> {
  const data = await gapi<{ accountSummaries?: Array<{ displayName: string; propertySummaries?: Array<{ property: string; displayName: string }> }> }>(
    'https://analyticsadmin.googleapis.com/v1beta/accountSummaries',
  );
  const out: Ga4Property[] = [];
  for (const acc of data.accountSummaries ?? []) {
    for (const p of acc.propertySummaries ?? []) {
      out.push({ propertyId: p.property.replace('properties/', ''), displayName: p.displayName, account: acc.displayName });
    }
  }
  return out;
}

export interface Ga4ReportRow { dimensions: string[]; metrics: number[] }

export async function ga4RunReport(args: {
  propertyId: string; startDate: string; endDate: string;
  dimensions?: string[]; metrics: string[]; limit?: number;
}): Promise<Ga4ReportRow[]> {
  const data = await gapi<{ rows?: Array<{ dimensionValues?: { value: string }[]; metricValues?: { value: string }[] }> }>(
    `https://analyticsdata.googleapis.com/v1beta/properties/${args.propertyId}:runReport`,
    { method: 'POST', body: JSON.stringify({
      dateRanges: [{ startDate: args.startDate, endDate: args.endDate }],
      dimensions: (args.dimensions ?? []).map(name => ({ name })),
      metrics: args.metrics.map(name => ({ name })),
      limit: String(args.limit ?? 10),
    }) },
  );
  return (data.rows ?? []).map(r => ({
    dimensions: (r.dimensionValues ?? []).map(d => d.value),
    metrics: (r.metricValues ?? []).map(m => Number(m.value)),
  }));
}

/** Best-effort auto-link: pick the GSC site that matches our domain and the
 *  first GA4 property. Returns what it set so the caller can report it. */
export async function autoLinkProperties(): Promise<{ gsc: string | null; ga4: string | null; ga4Name: string | null }> {
  let gsc: string | null = null;
  let ga4: string | null = null;
  let ga4Name: string | null = null;
  try {
    const host = new URL(SITE_URL).hostname.replace(/^www\./, '');
    const sites = await listGscSites();
    // Prefer a domain property, else a URL-prefix that contains our host.
    gsc = sites.find(s => s.siteUrl === `sc-domain:${host}`)?.siteUrl
      ?? sites.find(s => s.siteUrl.includes(host))?.siteUrl
      ?? sites[0]?.siteUrl ?? null;
  } catch (err) { log.warn('google.autolink_gsc_failed', { err: err instanceof Error ? err.message : String(err) }); }
  try {
    const props = await listGa4Properties();
    ga4 = props[0]?.propertyId ?? null;
    ga4Name = props[0]?.displayName ?? null;
  } catch (err) { log.warn('google.autolink_ga4_failed', { err: err instanceof Error ? err.message : String(err) }); }

  if (gsc || ga4) {
    await supabaseAdmin().from('google_integration').update({
      gsc_site_url: gsc, ga4_property_id: ga4, ga4_property_name: ga4Name, updated_at: new Date().toISOString(),
    }).eq('id', true);
  }
  return { gsc, ga4, ga4Name };
}

export async function setGscSite(siteUrl: string): Promise<void> {
  await supabaseAdmin().from('google_integration').update({ gsc_site_url: siteUrl, updated_at: new Date().toISOString() }).eq('id', true);
}
export async function setGa4Property(propertyId: string, name: string | null): Promise<void> {
  await supabaseAdmin().from('google_integration').update({ ga4_property_id: propertyId, ga4_property_name: name, updated_at: new Date().toISOString() }).eq('id', true);
}
