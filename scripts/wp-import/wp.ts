// WordPress / WooCommerce REST client with auto-pagination.
//
// Two auth schemes:
//   • /wc/v3/*  → Basic auth with WooCommerce consumer key:secret
//   • /wp/v2/*  → Basic auth with WP username:application-password
//
// Both go through the same Authorization header — wc() vs wp() decides which.

import { CONFIG } from './config';

const WC_BASE = `${CONFIG.wp.siteUrl}/wp-json/wc/v3`;
const WP_BASE = `${CONFIG.wp.siteUrl}/wp-json/wp/v2`;

function basic(user: string, pass: string): string {
  return `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;
}

const wcAuth = basic(CONFIG.wp.wcKey, CONFIG.wp.wcSecret);
const wpAuth = basic(CONFIG.wp.wpUser, CONFIG.wp.wpAppPw);

interface FetchOpts {
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}

function buildUrl(base: string, path: string, query?: FetchOpts['query']): string {
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

// Cloudflare-fronted WP hosts (which yellowpink.pk is) will challenge bare
// Node fetch with a 503 / "Just a moment..." page if no User-Agent header
// is sent. A real-looking UA + Accept-Language gets past that. Keep the
// string conservative — we're not pretending to be Chrome, just identifying
// as a script. Cloudflare's bot-protect allowlist is keyed on the *presence*
// of headers, not their exact value.
const UA = 'YellowPink-WP-Importer/1.0 (+https://yellowpink.pk)';

async function get<T>(base: string, auth: string, path: string, opts: FetchOpts = {}): Promise<{ data: T; totalPages: number; total: number }> {
  const url = buildUrl(base, path, opts.query);
  const res = await fetch(url, {
    headers: {
      Authorization:     auth,
      Accept:            'application/json',
      'User-Agent':      UA,
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: opts.signal,
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText} on GET ${url}\n${body.slice(0, 300)}`);
  }
  const data = (await res.json()) as T;
  return {
    data,
    totalPages: Number(res.headers.get('X-WP-TotalPages') ?? '1'),
    total:      Number(res.headers.get('X-WP-Total') ?? '0'),
  };
}

// Auto-paginate any endpoint that returns a list. Yields rows as they arrive
// so memory stays flat even on giant catalogues.
async function* paginate<T>(base: string, auth: string, path: string, query: Record<string, string | number | undefined> = {}): AsyncGenerator<T> {
  const per = Number(query.per_page ?? 100);
  let page = 1;
  // First request to know total pages.
  // (The first page is the only one where we trust the header; subsequent
  // pages may not return it.)
  while (true) {
    const { data, totalPages } = await get<T[]>(base, auth, path, {
      query: { ...query, per_page: per, page },
    });
    for (const row of data) yield row;
    if (data.length < per) return;
    if (page >= totalPages) return;
    page++;
  }
}

// ─── Public wrappers ────────────────────────────────────────────────────────
export const wc = {
  get:      <T>(path: string, query?: FetchOpts['query']) => get<T>(WC_BASE, wcAuth, path, { query }),
  paginate: <T>(path: string, query?: Record<string, string | number | undefined>) => paginate<T>(WC_BASE, wcAuth, path, query),
};

export const wp = {
  get:      <T>(path: string, query?: FetchOpts['query']) => get<T>(WP_BASE, wpAuth, path, { query }),
  paginate: <T>(path: string, query?: Record<string, string | number | undefined>) => paginate<T>(WP_BASE, wpAuth, path, query),
};

// ─── Quick connectivity probe (used by `run.ts validate`) ──────────────────
export async function probe(): Promise<{ ok: true; wc: string; wp: string } | { ok: false; error: string }> {
  try {
    const wcInfo = await wc.get<{ environment?: { version?: string } }>('/system_status');
    const wpInfo = await wp.get<{ name: string }>('/');
    return { ok: true, wc: wcInfo.data.environment?.version ?? '?', wp: wpInfo.data.name ?? '?' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
