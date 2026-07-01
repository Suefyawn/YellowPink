import 'server-only';
import { supabaseAdmin } from '@/lib/supabase';
import { getGoogleConnection, inspectUrl, GoogleQuotaError } from '@/lib/google';
import { SITE_URL } from '@/lib/seo';

// ============================================================================
// Per-URL Search Console indexing status for newly-published pages.
//
// Google's Indexing API only covers JobPosting/BroadcastEvent content, using
// it for a blog/product page breaches Google's terms and risks the property's
// Search Console API access, so there is no legitimate way to *force*-submit
// an arbitrary page here. inspectUrl() (src/lib/google.ts) is the one
// per-URL endpoint Google does allow, read-only status, not a submit action.
//
// So instead of guessing which of dozens of new URLs still need a manual
// "Request Indexing" click, this module tracks status for them automatically:
// new blog posts are auto-discovered from `blog_posts.date`; anything else
// (a product, a CMS page) can be added to watch from the admin Indexing page.
// A daily cron (see /api/cron/indexing-check) works through a capped batch
// each run so it never blows the URL Inspection API's daily quota or the
// shared /api/cron/daily function-timeout budget.
// ============================================================================

const BLOG_LOOKBACK_DAYS = 45;
const DEFAULT_BATCH = 25;

function pathToUrl(path: string): string {
  return `${SITE_URL.replace(/\/$/, '')}${path}`;
}

/** Auto-discover recently-dated blog posts and start tracking any that
 *  aren't already in the table. Idempotent: `onConflict: 'path'` with
 *  `ignoreDuplicates` means an already-tracked (possibly already-indexed)
 *  post is left alone rather than having its history reset. */
async function seedRecentBlogPosts(): Promise<void> {
  const admin = supabaseAdmin();
  const cutoff = new Date(Date.now() - BLOG_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10);
  const { data } = await admin.from('blog_posts').select('slug').gte('date', cutoff);
  const paths = ((data ?? []) as { slug: string }[]).map(r => `/blog/${r.slug}`);
  if (paths.length === 0) return;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('gsc_url_index_status') as any).upsert(
    paths.map(path => ({ path })),
    { onConflict: 'path', ignoreDuplicates: true },
  );
}

/** Add an arbitrary on-site path to the watch list (used by the admin "Track
 *  a URL" form for products/CMS pages, which don't have a reliable "when was
 *  this actually published" signal the way blog_posts.date does). */
export async function trackUrl(path: string): Promise<void> {
  const admin = supabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (admin.from('gsc_url_index_status') as any)
    .upsert({ path }, { onConflict: 'path', ignoreDuplicates: true });
}

interface CandidateRow { path: string; last_checked_at: string | null; checks: number }

/** Pick the next batch to actually query this run: never-checked rows first
 *  (newest content, most useful to learn about), then already-checked but
 *  still-not-indexed rows ordered by staleness. Rows Google has confirmed
 *  indexed are left alone (their status won't flip back), keeping quota
 *  spent on the pages that still need attention. */
async function pickBatch(limit: number): Promise<CandidateRow[]> {
  const admin = supabaseAdmin();
  const { data: unchecked } = await admin
    .from('gsc_url_index_status').select('path, last_checked_at, checks')
    .is('last_checked_at', null).limit(limit);
  const rows = [...((unchecked ?? []) as CandidateRow[])];
  if (rows.length < limit) {
    const { data: stale } = await admin
      .from('gsc_url_index_status').select('path, last_checked_at, checks')
      .eq('is_indexed', false).not('last_checked_at', 'is', null)
      .order('last_checked_at', { ascending: true }).limit(limit - rows.length);
    rows.push(...((stale ?? []) as CandidateRow[]));
  }
  return rows;
}

// ─── quota tracking ──────────────────────────────────────────────────────────
// This only tracks OUR OWN urlInspection API calls (Google enforces ~2000/day,
// 600/min per property on that API and returns 429/403 when exceeded, which
// GoogleQuotaError surfaces). It cannot see the SEPARATE, undocumented daily
// limit Google puts on manual "Request Indexing" clicks inside the Search
// Console website itself, that limit lives entirely in Google's own UI with
// no API to query it, so hitting it while clicking through by hand won't show
// up here. The admin page explains this distinction so staff don't assume the
// two are the same counter.
export interface GscQuotaState { exceeded: boolean; at: string | null; message: string | null }

async function setQuotaState(state: GscQuotaState): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin().from('analytics_cache') as any)
    .upsert({ key: 'gsc_quota', data: state, updated_at: new Date().toISOString() });
}

export async function getQuotaState(): Promise<GscQuotaState | null> {
  const { data } = await supabaseAdmin().from('analytics_cache').select('data').eq('key', 'gsc_quota').maybeSingle();
  return (data as { data: GscQuotaState } | null)?.data ?? null;
}

// The daily limit on manual "Request Indexing" clicks inside the Search
// Console website is Google's own, undocumented, and has no API, there is no
// way for this app to detect it was hit. Self-reporting is the only option:
// staff mark it here when Google blocks them in the GSC UI, so the reminder
// at least shows up somewhere instead of everyone re-discovering it by
// getting blocked again.
export interface ManualQuotaState { reportedAt: string }

export async function reportManualQuotaHit(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin().from('analytics_cache') as any)
    .upsert({ key: 'gsc_manual_quota', data: { reportedAt: new Date().toISOString() }, updated_at: new Date().toISOString() });
}

export async function clearManualQuotaHit(): Promise<void> {
  await supabaseAdmin().from('analytics_cache').delete().eq('key', 'gsc_manual_quota');
}

export async function getManualQuotaState(): Promise<ManualQuotaState | null> {
  const { data } = await supabaseAdmin().from('analytics_cache').select('data').eq('key', 'gsc_manual_quota').maybeSingle();
  return (data as { data: ManualQuotaState } | null)?.data ?? null;
}

/** Refresh indexing status for a capped batch of tracked URLs. Best-effort:
 *  a missing Google connection or a single failed inspection never throws,
 *  since this runs unattended from a cron. Stops the batch immediately on a
 *  quota error instead of burning the rest of it on calls that will also
 *  fail. Returns how many it checked and whether quota was hit this run. */
export async function refreshIndexingStatus(batch = DEFAULT_BATCH): Promise<{ checked: number; quotaExceeded: boolean }> {
  const conn = await getGoogleConnection();
  if (!conn?.gsc_site_url) return { checked: 0, quotaExceeded: false };

  await seedRecentBlogPosts().catch(() => {});

  const rows = await pickBatch(batch);
  if (rows.length === 0) return { checked: 0, quotaExceeded: false };

  const admin = supabaseAdmin();
  let checked = 0;
  let quotaExceeded = false;
  for (const row of rows) {
    try {
      const status = await inspectUrl(conn.gsc_site_url, pathToUrl(row.path));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (admin.from('gsc_url_index_status') as any)
        .update({
          coverage_state: status.coverageState,
          verdict: status.verdict,
          google_canonical: status.googleCanonical,
          last_crawl_time: status.lastCrawlTime,
          inspection_link: status.inspectionResultLink,
          last_checked_at: new Date().toISOString(),
          checks: (row.checks ?? 0) + 1,
        })
        .eq('path', row.path);
      checked++;
    } catch (err) {
      if (err instanceof GoogleQuotaError) {
        quotaExceeded = true;
        await setQuotaState({ exceeded: true, at: new Date().toISOString(), message: err.message }).catch(() => {});
        break; // further calls will also 429, stop spending the batch
      }
      /* best-effort: one failed (non-quota) inspection shouldn't stop the batch */
    }
  }
  if (checked > 0 && !quotaExceeded) {
    await setQuotaState({ exceeded: false, at: new Date().toISOString(), message: null }).catch(() => {});
  }
  return { checked, quotaExceeded };
}
