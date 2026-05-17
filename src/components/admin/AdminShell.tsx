'use client';
import { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { NotificationsBell } from './NotificationsBell';
import type { StaffSession } from '@/lib/permissions';

interface Notification {
  id: string; kind: string; title: string; body: string | null;
  link: string | null; read: boolean; created_at: string;
}

export function AdminShell({
  children, session, pendingOrderCount = 0, notifications = [],
}: {
  children: React.ReactNode;
  session: StaffSession;
  pendingOrderCount?: number;
  notifications?: Notification[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        .adm-sidebar { position: fixed; left: 0; top: 0; z-index: 50; transition: transform 0.25s ease; }
        .adm-main { margin-left: 240px; min-height: 100vh; background: #f3f4f6; }
        .adm-topbar { display: flex; align-items: center; gap: 12px; padding: 10px 24px; background: white; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 30; }
        .adm-topbar .menu-btn { display: none; }
        .adm-overlay { display: none; }
        .adm-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        @media (max-width: 1023px) {
          .adm-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .adm-analytics-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 767px) {
          .adm-sidebar { transform: translateX(-240px); }
          .adm-sidebar.open { transform: translateX(0); }
          .adm-main { margin-left: 0; }
          .adm-topbar { background: #111827; color: white; }
          .adm-topbar .menu-btn { display: inline-flex; color: white; }
          .adm-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.5); z-index: 49;
          }
          .adm-page { padding: 16px 14px !important; }
          .adm-stat-grid { gap: 12px !important; }
          .adm-form-2col { grid-template-columns: 1fr !important; }
          .adm-form-3col { grid-template-columns: 1fr 1fr !important; }
          .adm-form-4col { grid-template-columns: 1fr 1fr !important; }
          .adm-form-brand { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {open && <div className="adm-overlay" onClick={() => setOpen(false)} />}

      <div className={`adm-sidebar${open ? ' open' : ''}`}>
        <AdminSidebar session={session} onClose={() => setOpen(false)} pendingOrderCount={pendingOrderCount} />
      </div>

      <div className="adm-main">
        <div className="adm-topbar">
          <button
            className="menu-btn"
            onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', lineHeight: 1, padding: 4, alignItems: 'center' }}
            aria-label="Open menu"
          >
            ☰
          </button>
          <span style={{ flex: 1, fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>
            <span style={{ color: '#ec4899' }}>Yellow</span>
            <span>Pink</span>
            <span style={{ color: '#9ca3af', fontWeight: 400, fontSize: '0.75rem', marginLeft: 8 }}>Admin</span>
          </span>
          <NotificationsBell notifications={notifications} />
        </div>
        {children}
      </div>
    </>
  );
}
