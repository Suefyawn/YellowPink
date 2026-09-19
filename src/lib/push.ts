// Admin Web Push sender. VAPID keys + the DB-webhook shared secret are
// generated on first use and stored in the service-role-only push_config
// table (no env vars, no dashboard setup). Deliberately NOT a 'use server'
// file — only reachable through the permission-checked actions and the
// secret-checked fan-out route.
//
// Web Crypto only (@block65/webcrypto-web-push, RFC 8291 aes128gcm + RFC 8292
// vapid): the `web-push` package needs Node's crypto internals and does not
// run on Cloudflare Workers. Keys keep the same base64url raw format
// web-push used, so the rows in push_config carry over unchanged.

import { buildPushPayload } from '@block65/webcrypto-web-push';
import { supabaseAdmin } from './supabase';
import { log } from './logger';

export interface PushConfig {
  vapid_public_key: string;
  vapid_private_key: string;
  webhook_secret: string;
}

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** P-256 pair in the format push services and web-push expect: raw
 *  uncompressed public point (65 bytes) and the raw private scalar (32 bytes). */
async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = await crypto.subtle.exportKey('raw', pair.publicKey);
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: b64url(pub), privateKey: jwk.d! };
}

/** Load the push config, generating keys + webhook secret on first call. */
export async function getPushConfig(): Promise<PushConfig> {
  const admin = supabaseAdmin();
  const { data } = await admin
    .from('push_config')
    .select('vapid_public_key, vapid_private_key, webhook_secret')
    .maybeSingle();
  if (data) return data as PushConfig;

  const keys = await generateVapidKeys();
  const row: PushConfig = {
    vapid_public_key: keys.publicKey,
    vapid_private_key: keys.privateKey,
    webhook_secret: b64url(crypto.getRandomValues(new Uint8Array(24))),
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

  const vapid = { subject: 'mailto:jetnine.inc@gmail.com', publicKey: cfg.vapid_public_key, privateKey: cfg.vapid_private_key };
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
      const subscription = { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } };
      const init = await buildPushPayload({ data: body, options: { ttl: 3600 } }, subscription, vapid);
      const res = await fetch(s.endpoint, init);
      if (res.status === 404 || res.status === 410) {
        await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint);
        pruned += 1;
      } else if (!res.ok) {
        log.warn('push.send_failed', { statusCode: res.status });
      } else {
        sent += 1;
      }
    } catch (e: unknown) {
      log.warn('push.send_failed', { error: (e as Error).message });
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
