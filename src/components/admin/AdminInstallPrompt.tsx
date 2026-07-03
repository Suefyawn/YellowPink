'use client';

import { useEffect, useState } from 'react';

// Admin PWA install nudge. Policy (per the owner): the admin prompt is
// PERSISTENT — it returns every session until the app is actually installed
// (dismiss only hides it for the current session). Installed state is
// detected via display-mode: standalone, so once staff run the installed
// app the banner is gone for good. Also registers the admin service worker
// (idempotent) so push subscriptions made in Settings → Notifications have
// a worker on every admin entry point.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const SESSION_DISMISS = 'yp_admin_install_dismissed';

export function AdminInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    // Keep the admin SW registered on every visit (needed for push even
    // when the user never opens the settings page on this device).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/admin/sw.js', { scope: '/admin/' }).catch(() => { /* http dev */ });
    }

    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) return;                                   // installed → never show
    try { if (sessionStorage.getItem(SESSION_DISMISS)) return; } catch { /* private mode */ }

    let cancelled = false;
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    if (ios) {
      // iOS never fires beforeinstallprompt; show the how-to hint instead.
      // Deferred so state settles from a callback, not the effect body.
      queueMicrotask(() => { if (!cancelled) { setIsIos(true); setVisible(true); } });
      return () => { cancelled = true; };
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);
    const onInstalled = () => setVisible(false);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible) return null;

  const dismissForSession = () => {
    try { sessionStorage.setItem(SESSION_DISMISS, '1'); } catch { /* private mode */ }
    setVisible(false);
  };

  const install = async () => {
    if (!event) return;
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === 'accepted') setVisible(false);
      else dismissForSession();
    } catch {
      dismissForSession();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Yellow Pink Admin"
      style={{
        position: 'fixed', bottom: 16, left: 16, zIndex: 60,
        background: '#111827', color: '#f9fafb',
        borderRadius: 12, padding: '13px 15px', maxWidth: 330,
        boxShadow: '0 6px 24px rgba(0,0,0,0.28)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}
    >
      <div style={{
        flexShrink: 0, width: 34, height: 34, borderRadius: 8,
        background: 'linear-gradient(135deg, #C5286A, #E75A8C)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, color: 'white', fontSize: '0.8125rem',
      }}>YP</div>
      <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.45 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Install YP Admin on this device</strong>
        {isIos ? (
          <span style={{ color: 'rgba(249,250,251,0.72)' }}>
            Tap <strong>Share</strong> then <strong>Add to Home Screen</strong> — installed, you can get
            instant order notifications.
          </span>
        ) : (
          <span style={{ color: 'rgba(249,250,251,0.72)' }}>
            One tap, and the admin opens like an app — with instant order notifications once you
            enable push in Settings → Notifications.
          </span>
        )}
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          {!isIos && (
            <button onClick={install} style={{
              padding: '6px 13px', background: '#C5286A', color: 'white',
              border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}>Install</button>
          )}
          <button onClick={dismissForSession} style={{
            padding: '6px 10px', background: 'transparent', color: 'rgba(249,250,251,0.6)',
            border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
          }}>Later</button>
        </div>
      </div>
    </div>
  );
}
