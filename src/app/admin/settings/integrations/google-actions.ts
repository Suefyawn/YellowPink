'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getStaffSession } from '@/lib/staff-auth';
import { SITE_URL } from '@/lib/seo';
import { log } from '@/lib/logger';
import {
  getGoogleConnection, disconnectGoogle, submitSitemap, setGscSite, setGa4Property,
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
    log.error('google.submit_sitemap_failed', { error: err instanceof Error ? err.message : String(err) });
    done(`error=${encodeURIComponent('Could not submit the sitemap. Re-connect Google and try again.')}`);
  }
  done('google=sitemap_submitted');
}

export async function setGscSiteAction(formData: FormData): Promise<void> {
  await assertSettings();
  const site = str(formData, 'gsc_site_url');
  if (site) await setGscSite(site);
  done('google=saved');
}

export async function setGa4PropertyAction(formData: FormData): Promise<void> {
  await assertSettings();
  const id = str(formData, 'ga4_property_id');
  if (id) await setGa4Property(id, str(formData, 'ga4_property_name') || null);
  done('google=saved');
}
