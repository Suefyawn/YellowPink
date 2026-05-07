'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
}

export async function saveSettings(formData: FormData): Promise<void> {
  await assertOwner();

  // Deduplicate: last value wins, so checkbox "true" overrides hidden "false"
  const map = new Map<string, string>();
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') map.set(key, val);
  }

  const pairs = Array.from(map.entries()).map(([key, value]) => ({ key, value }));

  if (pairs.length) {
    const { error } = await supabase.from('site_settings').upsert(pairs, { onConflict: 'key' });
    if (error) {
      redirect(`/admin/settings?error=${encodeURIComponent(error.message)}`);
    }
  }

  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
  redirect('/admin/settings?saved=1');
}
