'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { getPushPublicKey, savePushSubscription, removePushSubscription, sendTestPush } from '@/app/admin/settings/notifications/push-actions';
import { useToast } from '@/components/admin/Toast';
import { fmtDatePK } from '@/lib/dates';

interface Device {
  endpoint: string;
  staff_name: string | null;
  label: string | null;
  created_at: string;
  last_used_at: string | null;
}

// PushManager.subscribe wants the VAPID key as a Uint8Array.
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? 'iPhone/iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : /Firefox\//.test(ua) ? 'Firefox' : 'Browser';
  return `${os} · ${browser}`;
}

export function PushDeviceManager({ devices }: { devices: Device[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [supported, setSupported] = useState<boolean | null>(null);
  const [needsInstall, setNeedsInstall] = useState(false);
  const [currentEndpoint, setCurrentEndpoint] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // Detection settles from a deferred callback (not the effect body) per
    // the set-state-in-effect rule; the values come from platform APIs that
    // don't exist during SSR, so they can't be initial state.
    queueMicrotask(() => {
      if (cancelled) return;
      const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
      setSupported(ok);
      // iOS only exposes Web Push to INSTALLED PWAs — Safari-in-browser has
      // PushManager missing until the site is added to the Home Screen.
      const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as unknown as { standalone?: boolean }).standalone === true;
      if (isIos && !standalone) setNeedsInstall(true);
      if (ok) {
        navigator.serviceWorker.getRegistration('/admin/').then(reg =>
          reg?.pushManager.getSubscription().then(sub => { if (!cancelled) setCurrentEndpoint(sub?.endpoint ?? null); }),
        );
      }
    });
    return () => { cancelled = true; };
  }, []);

  const enable = () => startTransition(async () => {
    try {
      const reg = await navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' });
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast('Notifications were blocked — allow them in your browser settings to enable push.', 'error');
        return;
      }
      const { publicKey } = await getPushPublicKey();
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh: string; auth: string } };
      if (!json.endpoint || !json.keys) { toast('Could not read the subscription from this browser.', 'error'); return; }
      const res = await savePushSubscription({ endpoint: json.endpoint, keys: json.keys }, deviceLabel());
      if (!res.ok) { toast(res.error ?? 'Could not save this device.', 'error'); return; }
      setCurrentEndpoint(json.endpoint);
      toast('This device will now get admin notifications.', 'success');
      router.refresh();
    } catch (e) {
      toast(`Could not enable push: ${e instanceof Error ? e.message : 'unknown error'}`, 'error');
    }
  });

  const remove = (endpoint: string) => startTransition(async () => {
    if (endpoint === currentEndpoint) {
      const reg = await navigator.serviceWorker.getRegistration('/admin/');
      const sub = await reg?.pushManager.getSubscription();
      if (sub?.endpoint === endpoint) await sub.unsubscribe();
      setCurrentEndpoint(null);
    }
    await removePushSubscription(endpoint);
    toast('Device removed.', 'success');
    router.refresh();
  });

  const test = () => startTransition(async () => {
    const { devices: deviceCount, sent, pruned } = await sendTestPush();
    if (sent > 0) {
      toast(`Test sent to ${sent} device${sent === 1 ? '' : 's'}.${pruned > 0 ? ` Removed ${pruned} stale device${pruned === 1 ? '' : 's'}.` : ''}`, 'success');
    } else if (deviceCount === 0) {
      toast('No devices are subscribed yet — enable notifications on this device first.', 'error');
    } else {
      toast(`Couldn't deliver to ${deviceCount} subscribed device${deviceCount === 1 ? '' : 's'}${pruned > 0 ? ` (${pruned} stale one${pruned === 1 ? '' : 's'} removed)` : ''}. Try re-enabling on the device.`, 'error');
    }
    router.refresh();
  });

  const thisDeviceSubscribed = currentEndpoint != null && devices.some(d => d.endpoint === currentEndpoint);

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: 20, marginBottom: 12 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
        Push notifications on your phone
      </h2>
      <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.6 }}>
        Get new orders, payment failures, low stock, reviews and return requests as instant
        notifications on any device where you enable this — no more waiting on email. Install the
        admin as an app first (browser menu → <strong>Add to Home Screen</strong> / <strong>Install app</strong>)
        for the best experience.
      </p>

      {supported === false && (
        <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 8, background: '#fef2f2', color: '#991b1b', fontSize: '0.8125rem' }}>
          This browser doesn&apos;t support push notifications.
        </p>
      )}
      {needsInstall && (
        <p style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 8, background: '#fffbeb', color: '#92400e', fontSize: '0.8125rem' }}>
          On iPhone/iPad: open this page in Safari, tap <strong>Share → Add to Home Screen</strong>,
          then open the installed app and come back here — iOS only allows notifications for
          installed apps.
        </p>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: devices.length > 0 ? 16 : 0 }}>
        <button type="button" onClick={enable} disabled={pending || supported === false || thisDeviceSubscribed} style={{
          padding: '9px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
          background: thisDeviceSubscribed ? '#f0fdf4' : '#C5286A',
          color: thisDeviceSubscribed ? '#166534' : 'white',
          fontSize: '0.8125rem', fontWeight: 600,
          opacity: pending ? 0.7 : 1,
        }}>
          {thisDeviceSubscribed ? 'Enabled on this device' : 'Enable on this device'}
        </button>
        <button type="button" onClick={test} disabled={pending || devices.length === 0} style={{
          padding: '9px 16px', borderRadius: 8, border: '1px solid #e5e7eb', cursor: 'pointer',
          background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 600,
          opacity: pending || devices.length === 0 ? 0.6 : 1,
        }}>
          Send a test notification
        </button>
      </div>

      {devices.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {devices.map(d => (
            <div key={d.endpoint} style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '10px 12px', borderRadius: 8, background: '#fafafa', border: '1px solid #f3f4f6',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect width="12" height="20" x="6" y="2" rx="2" /><path d="M12 18h.01" />
              </svg>
              <div style={{ flex: 1, minWidth: 140 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827' }}>
                  {d.label ?? 'Device'}
                  {d.endpoint === currentEndpoint && <span style={{ marginLeft: 8, fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a' }}>this device</span>}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#9ca3af' }}>
                  {d.staff_name ? `${d.staff_name} · ` : ''}added {fmtDatePK(d.created_at)}
                  {d.last_used_at ? ` · last notified ${fmtDatePK(d.last_used_at)}` : ''}
                </div>
              </div>
              <button type="button" onClick={() => remove(d.endpoint)} disabled={pending} style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid #e5e7eb', cursor: 'pointer',
                background: 'white', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 600,
              }}>
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
