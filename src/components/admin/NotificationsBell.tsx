'use client';

import { useState } from 'react';
import Link from 'next/link';
import { markNotificationRead, markAllNotificationsRead } from '@/app/admin/notifications-actions';
import { AdminIcon, type AdminIconName } from '@/components/ui/AdminIcon';
import { PK_TZ } from '@/lib/dates';

interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
}

// Every notification kind renders through AdminIcon (inline SVG,
// currentColor). The Unicode glyphs that used to cover the store kinds
// (◎ ⚠ ✕ ↩ ★ ⬡) picked up the OS text/emoji font and drifted in colour and
// weight across devices, so they're SVG names now like the widget kinds.
const KIND_SVG: Record<string, AdminIconName> = {
  new_order: 'shopping-bag',
  low_stock: 'alert-triangle',
  payment_failed: 'x-circle',
  return_request: 'undo',
  new_review: 'star',
  staff_added: 'user-plus',
  sentry_issue: 'bug',
  posthog_spike: 'trend-up',
  posthog_drop: 'trend-down',
};

export function NotificationsBell({ notifications }: { notifications: Notification[] }) {
  const [open, setOpen] = useState(false);
  const unread = notifications.filter(n => !n.read);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`Notifications (${unread.length} unread)`}
        style={{
          position: 'relative', background: 'transparent', border: 'none',
          color: '#9ca3af', cursor: 'pointer',
          padding: 6, lineHeight: 0,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
      >
        <AdminIcon name="bell" size={22} />
        {unread.length > 0 && (
          <span style={{
            position: 'absolute', top: 0, right: 0,
            background: '#d73d3d', color: 'white',
            width: 16, height: 16, borderRadius: '50%',
            fontSize: '0.625rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>{unread.length > 9 ? '9+' : unread.length}</span>
        )}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 50 }}
          />
          <div style={{
            position: 'absolute', right: 0, top: '100%', marginTop: 8,
            width: 340, maxHeight: 480, overflowY: 'auto',
            background: 'white', borderRadius: 8, border: '1px solid #e5e7eb',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)', zIndex: 51,
          }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: '#111827' }}>Notifications</span>
              {unread.length > 0 && (
                <form action={markAllNotificationsRead}>
                  <button type="submit" style={{ background: 'none', border: 'none', color: '#C5286A', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}>
                    Mark all read
                  </button>
                </form>
              )}
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem' }}>
                No notifications yet.
              </div>
            ) : (
              <div>
                {notifications.map(n => (
                  <Link
                    key={n.id}
                    href={n.link ?? '#'}
                    onClick={async () => {
                      setOpen(false);
                      if (!n.read) await markNotificationRead(n.id);
                    }}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 10,
                      padding: '10px 14px', borderBottom: '1px solid #f3f4f6',
                      textDecoration: 'none', color: 'inherit',
                      background: n.read ? 'white' : '#fdf2f8',
                    }}
                  >
                    <span style={{ color: '#C5286A', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 18 }}>
                      <AdminIcon name={KIND_SVG[n.kind] ?? 'bell'} size={16} />
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.8125rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</div>
                      {n.body && <div style={{ fontSize: '0.75rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>}
                      <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>
                        {new Date(n.created_at).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ })}
                      </div>
                    </div>
                    {!n.read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C5286A', flexShrink: 0, marginTop: 6 }} />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
