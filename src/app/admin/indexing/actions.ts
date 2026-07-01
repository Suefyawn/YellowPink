'use server';

import { revalidatePath } from 'next/cache';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { refreshIndexingStatus, trackUrl, reportManualQuotaHit, clearManualQuotaHit } from '@/lib/indexing-status';

async function assertSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// A tracked path must be an on-site absolute path ("/product/x"), same rule
// as the broken-links redirect target, this isn't a place to paste an
// external URL.
function normalizePath(raw: string): string | null {
  const p = (raw ?? '').trim();
  if (!p.startsWith('/') || p.startsWith('//')) return null;
  if (p.length > 1024) return null;
  return p;
}

/** Manual "Check now" button, runs a bigger batch than the daily cron since
 *  it's a one-off human click rather than an unattended nightly job. */
export async function checkIndexingNow(): Promise<void> {
  const session = await assertSettings();
  const result = await refreshIndexingStatus(60);
  await logAudit(session, { action: 'indexing.check_now', entity: 'gsc_url_index_status', diff: result });
  revalidatePath('/admin/indexing');
}

/** Add a path to the watch list, for products/CMS pages that don't have the
 *  reliable "just published" signal blog_posts.date gives automatically. */
export async function addTrackedUrl(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const path = normalizePath((formData.get('path') as string) ?? '');
  if (!path) return;
  await trackUrl(path);
  await logAudit(session, { action: 'indexing.track_url', entity: 'gsc_url_index_status', diff: { path } });
  revalidatePath('/admin/indexing');
}

/** Self-report: staff clicked "Request Indexing" in the GSC website itself
 *  and got blocked by Google's own (undocumented, unqueryable) daily limit on
 *  that button. There is no API to detect this automatically, this is the
 *  only way it ever gets recorded, so the reminder shows up here instead of
 *  everyone rediscovering the limit by hitting it again. */
export async function reportManualQuota(): Promise<void> {
  const session = await assertSettings();
  await reportManualQuotaHit();
  await logAudit(session, { action: 'indexing.report_manual_quota', entity: 'gsc_url_index_status' });
  revalidatePath('/admin/indexing');
}

/** Dismiss the manual-quota reminder once it's no longer relevant (Google's
 *  own reset time isn't published, so this is a manual "I can tell it reset"
 *  action rather than something we can time automatically). */
export async function clearManualQuota(): Promise<void> {
  const session = await assertSettings();
  await clearManualQuotaHit();
  await logAudit(session, { action: 'indexing.clear_manual_quota', entity: 'gsc_url_index_status' });
  revalidatePath('/admin/indexing');
}
