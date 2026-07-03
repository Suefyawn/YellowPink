'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { getPushConfig, sendAdminPush } from '@/lib/push';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';

// Push-device management for the admin PWA (Settings → Notifications).
// Gated like the rest of the settings surface.
async function requireSettings() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('settings'))) {
    throw new Error('Not authorized');
  }
  return session;
}

/** VAPID public key for PushManager.subscribe (creates keys on first call). */
export async function getPushPublicKey(): Promise<{ publicKey: string }> {
  await requireSettings();
  const cfg = await getPushConfig();
  return { publicKey: cfg.vapid_public_key };
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}, label: string): Promise<{ ok: boolean; error?: string }> {
  const session = await requireSettings();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
    return { ok: false, error: 'Invalid subscription' };
  }
  const { error } = await supabaseAdmin().from('push_subscriptions').upsert({
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    staff_name: session.name ?? 'Owner',
    label: label.slice(0, 120),
  }, { onConflict: 'endpoint' });
  if (error) {
    log.error('push.subscribe_failed', { error: error.message });
    return { ok: false, error: error.message };
  }
  void logAudit(session, { action: 'push.device_subscribed', entity: 'push_subscriptions' });
  revalidatePath('/admin/settings/notifications');
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const session = await requireSettings();
  await supabaseAdmin().from('push_subscriptions').delete().eq('endpoint', endpoint);
  void logAudit(session, { action: 'push.device_removed', entity: 'push_subscriptions' });
  revalidatePath('/admin/settings/notifications');
  return { ok: true };
}

/** Fire a real notification at every subscribed device — the "is it working?"
 *  button. */
export async function sendTestPush(): Promise<{ ok: boolean; sent: number }> {
  await requireSettings();
  const { sent } = await sendAdminPush({
    title: 'Test notification',
    body: 'Push is working — new orders will arrive like this.',
    url: '/admin/dashboard',
    tag: 'test',
  });
  return { ok: true, sent };
}
