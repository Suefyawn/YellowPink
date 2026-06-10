'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { log } from '@/lib/logger';

async function assertAnyStaff() {
  const session = await getStaffSession();
  if (!session) throw new Error('Unauthorized');
  return session;
}

// The bell dropdown has no error surface; a failed mark-read just leaves the
// badge as-is on the next render. Log it so the failure is visible (#191).
export async function markNotificationRead(id: string): Promise<void> {
  await assertAnyStaff();
  const { error } = await supabaseAdmin().from('admin_notifications').update({ read: true }).eq('id', id);
  if (error) log.error('notification.mark_read_failed', { id, error: error.message });
  revalidatePath('/admin', 'layout');
}

export async function markAllNotificationsRead(): Promise<void> {
  await assertAnyStaff();
  const { error } = await supabaseAdmin().from('admin_notifications').update({ read: true }).eq('read', false);
  if (error) log.error('notification.mark_all_read_failed', { error: error.message });
  revalidatePath('/admin', 'layout');
}
