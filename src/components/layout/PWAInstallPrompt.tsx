'use client';

import { useEffect, useState } from 'react';

// Listens for the browser's `beforeinstallprompt` event and surfaces a
// dismissable banner — but only for REPEAT visitors, and only ONCE ever:
// whether they install or dismiss, the prompt never comes back. First-time
// visitors are never interrupted (they haven't decided if they like the
// store yet), and nobody gets nagged twice.
//
// Only fires on browsers that support installable PWAs (Chrome / Edge /
// some Android browsers). Safari users get nothing here, we'd need to
// build a "tap the share icon" hint specifically for iOS.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Legacy snooze key (pre once-ever policy) — still honoured if set far
// in the future by an accepted install.
const LEGACY_KEY = 'yp_pwa_install_dismissed_until';
const DONE_KEY = 'yp_pwa_prompt_done';
const VISITS_KEY = 'yp_visit_count';
const SESSION_KEY = 'yp_visit_counted';

export function PWAInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Count one visit per browser session; the prompt is for people who
    // came back, not first-timers.
    let visits = 0;
    try {
      visits = Number(localStorage.getItem(VISITS_KEY) ?? '0');
      if (!sessionStorage.getItem(SESSION_KEY)) {
        visits += 1;
        localStorage.setItem(VISITS_KEY, String(visits));
        sessionStorage.setItem(SESSION_KEY, '1');
      }
    } catch { return; /* storage blocked (private mode): never prompt */ }

    // Once-ever: any prior outcome (installed, dismissed, legacy snooze)
    // means we stay quiet forever.
    if (localStorage.getItem(DONE_KEY)) return;
    if (Date.now() < Number(localStorage.getItem(LEGACY_KEY) ?? '0')) return;
    if (visits < 2) return;

    const handler = (e: Event) => {
      e.preventDefault();
      const bip = e as BeforeInstallPromptEvent;
      setEvent(bip);
      // Give the user a moment to engage with the page first.
      setTimeout(() => setVisible(true), 4_000);
    };
    window.addEventListener('beforeinstallprompt', handler as EventListener);

    const onInstalled = () => {
      localStorage.setItem(DONE_KEY, '1');
      setVisible(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as EventListener);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!visible || !event) return null;

  // Both paths end the same way: this browser never sees the prompt again.
  const done = () => {
    localStorage.setItem(DONE_KEY, '1');
    setVisible(false);
  };

  const install = async () => {
    try {
      await event.prompt();
      await event.userChoice;
    } finally {
      done();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Yellow Pink"
      style={{
        // Sit above body content but BELOW any open modal (search z=300,
        // mini-cart z=201, newsletter z=351, consent z=400, mobile menu z=960).
        position: 'fixed', bottom: 16, right: 16, zIndex: 180,
        background: 'var(--ink-900)', color: 'var(--paper)',
        borderRadius: 12, padding: '14px 16px', maxWidth: 320,
        boxShadow: '0 6px 24px rgba(0,0,0,0.25)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
        fontFamily: 'var(--font-ui)',
      }}
    >
      <div style={{
        flexShrink: 0, width: 36, height: 36, borderRadius: 8,
        background: 'linear-gradient(135deg, var(--brand-yellow), var(--brand-pink))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, color: 'var(--ink-900)',
      }}>YP</div>
      <div style={{ flex: 1, fontSize: '0.8125rem', lineHeight: 1.4 }}>
        <strong style={{ display: 'block', marginBottom: 2 }}>Install Yellow Pink</strong>
        <span style={{ color: 'rgba(250,246,238,0.7)' }}>Skip the browser. Tap to add to your home screen.</span>
        <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
          <button
            onClick={install}
            style={{
              padding: '6px 12px', background: 'var(--brand-pink-cta)', color: 'white',
              border: 'none', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            }}
          >Install</button>
          <button
            onClick={done}
            style={{
              padding: '6px 10px', background: 'transparent', color: 'rgba(250,246,238,0.6)',
              border: 'none', borderRadius: 6, fontSize: '0.75rem', cursor: 'pointer',
            }}
          >Not now</button>
        </div>
      </div>
    </div>
  );
}
