'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

// Broken-link triage rides the `settings` permission, it manages site-wide
// redirects, the same surface as other store-config work.
async function assertSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

// A redirect target must be an on-site absolute path ("/product/x"). We don't
// allow off-site destinations, the redirects table preserves internal SEO
// equity, not open redirects.
function normalizeTarget(raw: string): string | null {
  const t = (raw ?? '').trim();
  if (!t.startsWith('/') || t.startsWith('//')) return null; // must be a same-site path, not protocol-relative
  if (t.length > 1024) return null;
  return t;
}

/** Turn a logged 404 into a live 301 by inserting into the `redirects` table
 *  (which src/proxy.ts already consults), then mark the miss resolved. The
 *  redirect is live within the proxy's 60s cache TTL, no deploy. */
export async function addRedirect(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const from = ((formData.get('from_path') as string) ?? '').trim();
  const to = normalizeTarget((formData.get('to_path') as string) ?? '');
  if (!from || !from.startsWith('/') || !to || to === from) return;

  const admin = supabaseAdmin();
  const { error } = await admin
    .from('redirects')
    .upsert({ from_path: from, to_path: to, status_code: 301, source: 'admin' }, { onConflict: 'from_path' });
  if (error) { log.error('broken_links.add_redirect_failed', { from, to, error: error.message }); return; }

  // The path now 301s, so it's no longer a live 404, close it out.
  await admin.from('not_found_log').update({ resolved: true }).eq('path', from);
  await logAudit(session, { action: 'redirect.create', entity: 'redirect', diff: { from, to } });
  revalidatePath('/admin/broken-links');
}

/** Dismiss a 404 without redirecting, the correct choice for genuinely dead
 *  content (a 404 is a valid signal). Keeps it out of the digest and the open
 *  list, but the row stays so a fresh hit is still counted. */
export async function ignoreNotFound(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const path = ((formData.get('path') as string) ?? '').trim();
  if (!path) return;
  await supabaseAdmin().from('not_found_log').update({ resolved: true }).eq('path', path);
  await logAudit(session, { action: 'not_found.ignore', entity: 'not_found_log', diff: { path } });
  revalidatePath('/admin/broken-links');
}

/** Re-open a previously ignored/redirected miss (undo). */
export async function reopenNotFound(formData: FormData): Promise<void> {
  const session = await assertSettings();
  const path = ((formData.get('path') as string) ?? '').trim();
  if (!path) return;
  await supabaseAdmin().from('not_found_log').update({ resolved: false, alerted_at: null }).eq('path', path);
  await logAudit(session, { action: 'not_found.reopen', entity: 'not_found_log', diff: { path } });
  revalidatePath('/admin/broken-links');
}
