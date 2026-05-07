'use server';

import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';

async function assertOwner() {
  const session = await getStaffSession();
  if (!session?.isOwner) throw new Error('Unauthorized');
}

export async function saveSettings(formData: FormData): Promise<void> {
  await assertOwner();

  const pairs: { key: string; value: string }[] = [];
  for (const [key, val] of formData.entries()) {
    if (typeof val === 'string') {
      pairs.push({ key, value: val });
    }
  }

  if (pairs.length) {
    await supabase.from('site_settings').upsert(pairs);
  }

  revalidatePath('/', 'layout');
  revalidatePath('/admin/settings');
}
