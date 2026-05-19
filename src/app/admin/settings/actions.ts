'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
  return session;
}

export async function saveSettings(formData: FormData): Promise<void> {
  const session = await assertOwner();

  // Deduplicate: last value wins, so checkbox "true" overrides hidden "false".
  // Also drop any key starting with '$' — those are Next.js server-action
  // binding inputs ($ACTION_ID_…, $ACTION_REF_…, etc.) that should never
  // end up in the site_settings table (audit SEV-2). The DB now also has
  // a CHECK constraint refusing these keys; this is belt-and-braces.
  const map = new Map<string, string>();
  for (const [key, val] of formData.entries()) {
    if (typeof val !== 'string') continue;
    if (key.startsWith('$')) continue;
    map.set(key, val);
  }

  const pairs = Array.from(map.entries()).map(([key, value]) => ({ key, value }));

  if (pairs.length) {
    const { error } = await supabase.from('site_settings').upsert(pairs, { onConflict: 'key' });
    if (error) {
      redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
    }
  }

  void logAudit(session, {
    action: 'settings.save',
    entity: 'site_settings',
    diff: { keys_updated: pairs.map(p => p.key) },
  });

  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  redirect('/admin/settings?saved=1');
}
