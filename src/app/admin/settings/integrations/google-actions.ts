'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStaffSession } from '@/lib/staff-auth';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';
import {
  getGoogleConnection, disconnectGoogle, submitSitemap, setGscSite, setGa4Property, inspectUrl,
} from '@/lib/google';

const PATH = '/admin/settings/integrations';
const str = (fd: FormData, k: string) => ((fd.get(k) as string | null) ?? '').trim();

async function assertSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) throw new Error('Unauthorized');
}

function done(params: string): never {
  revalidatePath(PATH);
  redirect(`${PATH}?${params}`);
}

export async function disconnectGoogleAction(): Promise<void> {
  await assertSettings();
  await disconnectGoogle();
  done('google=disconnected');
}

export async function submitSitemapAction(): Promise<void> {
  await assertSettings();
  const conn = await getGoogleConnection();
  if (!conn?.gsc_site_url) done(`error=${encodeURIComponent('Link a Search Console site first.')}`);
  try {
    await submitSitemap(conn!.gsc_site_url!, `${SITE_URL}/sitemap.xml`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error('google.submit_sitemap_failed', { error: detail });
    done(`error=${encodeURIComponent(`Sitemap submit failed — ${detail.slice(0, 180)}`)}`);
  }
  done('google=sitemap_submitted');
}

export async function setGscSiteAction(formData: FormData): Promise<void> {
  await assertSettings();
  const site = str(formData, 'gsc_site_url');
  if (site) await setGscSite(site);
  done('google=saved');
}

/** Check a single URL's Google index status via the URL Inspection API.
 *  Accepts a full URL or a path ("/blog/x"). Called imperatively from the
 *  client checker. */
export async function checkUrlIndexStatus(rawUrl: string): Promise<{
  ok: boolean; url?: string; verdict?: string; coverage?: string; lastCrawl?: string | null; error?: string;
}> {
  await assertSettings();
  const conn = await getGoogleConnection();
  if (!conn?.gsc_site_url) return { ok: false, error: 'Connect a Search Console site first.' };
  let url = (rawUrl ?? '').trim();
  if (!url) return { ok: false, error: 'Enter a URL or path.' };
  if (url.startsWith('/')) url = `${SITE_URL}${url}`;
  else if (!/^https?:\/\//i.test(url)) url = `${SITE_URL}/${url}`;
  try {
    const r = await inspectUrl(conn.gsc_site_url, url);
    return { ok: true, url, verdict: r.verdict, coverage: r.coverageState, lastCrawl: r.lastCrawlTime };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log.error('google.inspect_url_failed', { error: detail });
    return { ok: false, error: detail.slice(0, 180) };
  }
}

export async function setGa4PropertyAction(formData: FormData): Promise<void> {
  await assertSettings();
  // Dropdown values are "propertyId::Display Name"; a manual entry is just the id.
  const raw = str(formData, 'ga4_property_id');
  if (raw) {
    const [id, ...rest] = raw.split('::');
    if (id) await setGa4Property(id, rest.join('::') || null);
  }
  done('google=saved');
}
