// ============================================================================
// Search-engine indexing submission, IndexNow + Google Indexing API.
//
// Two independent, best-effort channels. Neither ever throws to the caller:
// indexing is a nice-to-have, so a failure here must never break a publish or
// an admin save. Each call returns a structured result the admin UI can show.
//
//  • IndexNow , instant ping to Bing / Yandex / Naver / Seznam (one POST
//    covers them all). Officially supported, no credentials: it only needs a
//    public key file at https://<host>/<key>.txt whose contents equal the key.
//    Works out of the box with the committed default key.
//
//  • Google Indexing API, notifies Google directly. Google officially scopes
//    this to JobPosting/BroadcastEvent pages, but it is widely used to nudge
//    crawling of any URL. It needs a Google Cloud service-account key (added
//    as an Owner of the property in Search Console). Until that's configured
//    via GOOGLE_INDEXING_CREDENTIALS, this channel is skipped silently.
//
// Server-only, imports node:crypto and reads secrets. Never import from a
// Client Component.
// ============================================================================

import crypto from 'node:crypto';
import { after } from 'next/server';
import { SITE_URL, absoluteUrl } from '@/lib/seo';
import { supabaseAdmin } from '@/lib/supabase';
import { getGoogleConnection, submitSitemap } from '@/lib/google';

// Public-by-design IndexNow key. A matching file lives at /public/<key>.txt.
// Override with INDEXNOW_KEY only if you also host a matching <key>.txt.
export const INDEXNOW_KEY = process.env.INDEXNOW_KEY || '64328ac823511a95cebb5695cd688f5b';

export interface ChannelResult {
  channel: 'indexnow' | 'google';
  ok: boolean;
  /** true when the channel isn't configured and was skipped (not an error). */
  skipped?: boolean;
  detail: string;
}

export interface IndexingResult {
  submitted: string[];
  results: ChannelResult[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

/** Turn a mix of paths ("/blog/x") and absolute URLs into absolute, same-host
 *  URLs, de-duplicated. Anything pointing at another host is dropped, both
 *  APIs reject cross-host URLs. */
export function toAbsoluteUrls(paths: string[]): string[] {
  const host = new URL(SITE_URL).host;
  const out = new Set<string>();
  for (const p of paths) {
    if (!p) continue;
    const url = /^https?:\/\//i.test(p) ? p : absoluteUrl(p);
    try {
      if (new URL(url).host === host) out.add(url);
    } catch {
      /* skip malformed */
    }
  }
  return [...out];
}

// ─── IndexNow ───────────────────────────────────────────────────────────────

async function submitIndexNow(urls: string[]): Promise<ChannelResult> {
  if (urls.length === 0) return { channel: 'indexnow', ok: true, detail: 'No URLs.' };
  const host = new URL(SITE_URL).host;
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host,
        key: INDEXNOW_KEY,
        keyLocation: absoluteUrl(`/${INDEXNOW_KEY}.txt`),
        urlList: urls,
      }),
    });
    // IndexNow returns 200 or 202 on success; 4xx on key/format problems.
    if (res.ok) {
      return { channel: 'indexnow', ok: true, detail: `Accepted ${urls.length} URL(s) (HTTP ${res.status}).` };
    }
    return { channel: 'indexnow', ok: false, detail: `IndexNow HTTP ${res.status}.` };
  } catch (err) {
    return { channel: 'indexnow', ok: false, detail: `IndexNow request failed: ${(err as Error).message}` };
  }
}

// ─── Google Indexing API ─────────────────────────────────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
}

function loadServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_INDEXING_CREDENTIALS;
  if (!raw) return null;
  try {
    const json = JSON.parse(raw) as Partial<ServiceAccount>;
    if (!json.client_email || !json.private_key) return null;
    // Allow the private key to be stored with literal "\n" sequences (common
    // when pasting JSON into a single-line env var).
    return { client_email: json.client_email, private_key: json.private_key.replace(/\\n/g, '\n') };
  } catch {
    return null;
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Mint a Google OAuth2 access token from a service account via a signed JWT
 *  (RS256). Avoids pulling in google-auth-library, node:crypto does the sign. */
async function getGoogleAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claims = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signingInput = `${header}.${claims}`;
  const signature = base64url(crypto.createSign('RSA-SHA256').update(signingInput).sign(sa.private_key));
  const assertion = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) throw new Error(`token exchange HTTP ${res.status}`);
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error('no access_token in response');
  return json.access_token;
}

async function submitGoogle(urls: string[]): Promise<ChannelResult> {
  const sa = loadServiceAccount();
  if (!sa) {
    return {
      channel: 'google',
      ok: true,
      skipped: true,
      detail: 'Google Indexing API not configured (set GOOGLE_INDEXING_CREDENTIALS).',
    };
  }
  if (urls.length === 0) return { channel: 'google', ok: true, detail: 'No URLs.' };
  try {
    const token = await getGoogleAccessToken(sa);
    // The publish endpoint takes one URL per call. Cap concurrency by awaiting
    // sequentially in small batches to stay well under quota.
    let okCount = 0;
    const errors: string[] = [];
    for (const url of urls) {
      try {
        const res = await fetch('https://indexing.googleapis.com/v3/urlNotifications:publish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url, type: 'URL_UPDATED' }),
        });
        if (res.ok) okCount++;
        else errors.push(`HTTP ${res.status}`);
      } catch (e) {
        errors.push((e as Error).message);
      }
    }
    if (okCount === urls.length) {
      return { channel: 'google', ok: true, detail: `Notified Google of ${okCount} URL(s).` };
    }
    return {
      channel: 'google',
      ok: okCount > 0,
      detail: `Google: ${okCount}/${urls.length} ok${errors.length ? ` (${[...new Set(errors)].join(', ')})` : ''}.`,
    };
  } catch (err) {
    return { channel: 'google', ok: false, detail: `Google auth/request failed: ${(err as Error).message}` };
  }
}

// ─── public API ───────────────────────────────────────────────────────────────

/** Submit one or more paths/URLs to every configured search-engine channel.
 *  Best-effort: never throws. Returns a per-channel summary for the UI.
 *  Pass { google: false } for bulk jobs, Google's publish quota is small
 *  (~200/day), so a "resubmit everything" run should go to IndexNow only. */
export async function submitToSearchEngines(
  paths: string[],
  opts: { google?: boolean } = {},
): Promise<IndexingResult> {
  const { google = true } = opts;
  const urls = toAbsoluteUrls(paths);
  if (urls.length === 0) {
    return { submitted: [], results: [{ channel: 'indexnow', ok: true, detail: 'No valid URLs.' }] };
  }
  const results = await Promise.all([
    submitIndexNow(urls),
    ...(google ? [submitGoogle(urls)] : []),
  ]);
  return { submitted: urls, results };
}

// ─── Google sitemap nudge (auto, debounced) ──────────────────────────────────
// IndexNow tells Bing/Yandex about a specific new URL instantly, but Google
// ignores IndexNow. The one supported, ToS-safe way to nudge Google toward a
// newly-published page is to (re)submit the sitemap so it re-crawls it — Google
// still decides what/when to index. We do that automatically on publish, but
// DEBOUNCED: Google asks publishers not to resubmit a sitemap repeatedly, and
// a burst of edits/publishes in one session should cost exactly one submit.
// The sitemap.xml is always current, so one resubmit picks up everything added
// since the last one. Best-effort throughout: a missing Google connection or a
// failing API call must never affect the publish that triggered it.

const SITEMAP_NUDGE_MIN_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6h

async function lastSitemapNudgeAt(): Promise<number> {
  try {
    const { data } = await supabaseAdmin()
      .from('analytics_cache').select('data').eq('key', 'sitemap_last_nudge').maybeSingle();
    const at = (data as { data?: { at?: string } } | null)?.data?.at;
    return at ? new Date(at).getTime() : 0;
  } catch {
    return 0; // unknown → allow the submit
  }
}

/** (Re)submit the sitemap to Google, at most once per SITEMAP_NUDGE_MIN_INTERVAL.
 *  Never throws. No-op when Google isn't connected. */
export async function nudgeGoogleSitemap(): Promise<void> {
  try {
    if (Date.now() - (await lastSitemapNudgeAt()) < SITEMAP_NUDGE_MIN_INTERVAL_MS) return;
    const conn = await getGoogleConnection();
    if (!conn?.gsc_site_url) return; // not connected → nothing to nudge
    await submitSitemap(conn.gsc_site_url, `${SITE_URL.replace(/\/$/, '')}/sitemap.xml`);
    // Record success only after it lands, so a failed submit is retried next publish.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin().from('analytics_cache') as any).upsert({
      key: 'sitemap_last_nudge',
      data: { at: new Date().toISOString() },
      updated_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn('[indexing] sitemap nudge failed (ignored):', (err as Error).message);
  }
}

/** Fire-and-forget variant for publish hooks: runs the submission but swallows
 *  everything, so a slow or failing index ping can never block or break a save.
 *  Awaited briefly by callers; if it rejects (it won't), we ignore it. Also
 *  nudges Google's sitemap (debounced) so a new page is pushed to every engine,
 *  not just the IndexNow ones. The sitemap call runs in after() so it never adds
 *  latency to the publish response (falls back to inline when there's no request
 *  scope, e.g. a script or cron). */
export async function submitToSearchEnginesQuietly(paths: string[]): Promise<void> {
  try {
    const r = await submitToSearchEngines(paths);
    const failed = r.results.filter(x => !x.ok && !x.skipped);
    if (failed.length) {
      console.warn('[indexing] some channels failed:', failed.map(f => f.detail).join(' | '));
    }
  } catch (err) {
    console.warn('[indexing] submission error (ignored):', (err as Error).message);
  }
  try {
    after(nudgeGoogleSitemap);
  } catch {
    await nudgeGoogleSitemap();
  }
}

/** Which channels are currently configured, for the admin status panel. */
export function indexingConfig(): { indexnow: boolean; google: boolean } {
  return { indexnow: true, google: !!loadServiceAccount() };
}
