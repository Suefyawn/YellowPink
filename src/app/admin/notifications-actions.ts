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
  const session = await assertAnyStaff();
  // Only clear kinds the clicker can actually see: read state is store-wide,
  // so an unscoped update would let a staffer with one permission silently
  // mark the owner's order/payment/error alerts read without anyone having
  // looked at them.
  const { visibleNotificationKinds } = await import('@/lib/notification-kinds');
  const kinds = visibleNotificationKinds(session);
  let query = supabaseAdmin().from('admin_notifications').update({ read: true }).eq('read', false);
  if (kinds) query = query.in('kind', kinds);
  const { error } = await query;
  if (error) log.error('notification.mark_all_read_failed', { error: error.message });
  revalidatePath('/admin', 'layout');
}
