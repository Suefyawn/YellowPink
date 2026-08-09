'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { can } from '@/lib/permissions';
import { logAudit } from '@/lib/audit';
import { tagForKeyword } from '@/lib/seo-tags';
import { refreshAnalyticsCore } from '@/app/admin/dashboard/actions';

// Tracked-keyword management for the SEO rankings page. The list lives in
// seo_tracked_keywords; the twice-monthly ranking routine reads its keyword
// set from that table, so changes here take effect on the next 1st/15th run.

async function assertAccess() {
  const session = await getStaffSession();
  if (!session || !can(session, 'analytics')) throw new Error('Unauthorized');
  return session;
}

/** Lower-case, collapse whitespace, cap length. Google queries are matched
 *  case-insensitively everywhere else on the page, so store one canon form. */
function normalizeKeyword(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 80);
}

export async function trackKeyword(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await assertAccess();
  const keyword = normalizeKeyword(String(formData.get('keyword') ?? ''));
  if (keyword.length < 2) return { ok: false, error: 'Enter a keyword.' };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin().from('seo_tracked_keywords') as any).upsert(
    { keyword, active: true, tag: tagForKeyword(keyword), added_by: session.email ?? 'staff', updated_at: new Date().toISOString() },
    { onConflict: 'keyword' },
  );
  if (error) return { ok: false, error: error.message };
  void logAudit(session, { action: 'seo.keyword_tracked', entity: 'seo_tracked_keywords', entity_id: keyword });
  revalidatePath('/admin/seo-rankings');
  return { ok: true };
}

/** On-demand Google data refresh for the rankings page — pulls fresh GSC
 *  (and the other analytics caches) instead of waiting for the nightly cron.
 *  Reuses the same core the cron runs; gated on the page's own permission. */
export async function refreshGoogleData(): Promise<{ ok: boolean; error?: string }> {
  await assertAccess();
  const { ok, errors } = await refreshAnalyticsCore();
  revalidatePath('/admin/seo-rankings');
  return ok ? { ok: true } : { ok: false, error: errors.join('; ').slice(0, 200) || 'Refresh failed' };
}

export async function untrackKeyword(keyword: string): Promise<{ ok: boolean }> {
  const session = await assertAccess();
  const { error } = await supabaseAdmin()
    .from('seo_tracked_keywords')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ active: false, updated_at: new Date().toISOString() } as any)
    .eq('keyword', keyword);
  if (error) return { ok: false };
  void logAudit(session, { action: 'seo.keyword_untracked', entity: 'seo_tracked_keywords', entity_id: keyword });
  revalidatePath('/admin/seo-rankings');
  return { ok: true };
}
