// Admin Web Push sender. VAPID keys + the DB-webhook shared secret are
// generated on first use and stored in the service-role-only push_config
// table (no env vars, no dashboard setup). Deliberately NOT a 'use server'
// file — only reachable through the permission-checked actions and the
// secret-checked fan-out route.

import webpush from 'web-push';
import { randomBytes } from 'node:crypto';
import { supabaseAdmin } from './supabase';
import { log } from './logger';

export interface PushConfig {
  vapid_public_key: string;
  vapid_private_key: string;
  webhook_secret: string;
}

/** Load the push config, generating keys + webhook secret on first call. */
export async function getPushConfig(): Promise<PushConfig> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('push_config')
    .select('vapid_public_key, vapid_private_key, webhook_secret')
    .maybeSingle();
  if (data) return data as PushConfig;

  const keys = webpush.generateVAPIDKeys();
  const row: PushConfig = {
    vapid_public_key: keys.publicKey,
    vapid_private_key: keys.privateKey,
    webhook_secret: randomBytes(24).toString('base64url'),
  };
  const { error } = await admin.from('push_config').insert({ id: true, ...row });
  if (error) {
    // Two first-calls raced; the other one won — read theirs.
    const { data: again } = await admin
      .from('push_config')
      .select('vapid_public_key, vapid_private_key, webhook_secret')
      .maybeSingle();
    if (again) return again as PushConfig;
    throw new Error(`push_config init failed: ${error.message}`);
  }
  return row;
}

/** Send a notification to every subscribed admin device. Dead subscriptions
 *  (endpoint gone: 404/410) are pruned as they're discovered. */
export async function sendAdminPush(payload: {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}): Promise<{ sent: number; pruned: number }> {
  const admin = supabaseAdmin();
  const cfg = await getPushConfig();
  const { data: subs } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth');
  const list = (subs ?? []) as { endpoint: string; p256dh: string; auth: string }[];
  if (list.length === 0) return { sent: 0, pruned: 0 };

  webpush.setVapidDetails('mailto:jetnine.inc@gmail.com', cfg.vapid_public_key, cfg.vapid_private_key);
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body ?? '',
    url: payload.url ?? '/admin/dashboard',
    tag: payload.tag ?? 'yp-admin',
  });

  let sent = 0;
  let pruned = 0;
  await Promise.all(list.map(async s => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body,
        { TTL: 3600 },
      );
      sent += 1;
    } catch (e: unknown) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        pruned += 1;
      } else {
        log.warn('push.send_failed', { statusCode: code });
      }
    }
  }));
  if (sent > 0) {
    await admin
      .from('push_subscriptions')
      .update({ last_used_at: new Date().toISOString() })
      .in('endpoint', list.map(s => s.endpoint));
  }
  return { sent, pruned };
}
