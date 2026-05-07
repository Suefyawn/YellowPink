'use client';
import { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import type { StaffSession } from '@/lib/permissions';

export function AdminShell({ children, session }: { children: React.ReactNode; session: StaffSession }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <style>{`
        .adm-sidebar { position: fixed; left: 0; top: 0; z-index: 50; transition: transform 0.25s ease; }
        .adm-main { margin-left: 240px; min-height: 100vh; background: #f3f4f6; }
        .adm-topbar { display: none; }
        .adm-overlay { display: none; }

        @media (max-width: 767px) {
          .adm-sidebar { transform: translateX(-240px); }
          .adm-sidebar.open { transform: translateX(0); }
          .adm-main { margin-left: 0; }
          .adm-topbar {
            display: flex; align-items: center; gap: 12px;
            padding: 12px 16px; background: #111827;
            position: sticky; top: 0; z-index: 30;
          }
          .adm-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.5); z-index: 49;
          }
        }
      `}</style>

      {open && <div className="adm-overlay" onClick={() => setOpen(false)} />}

      <div className={`adm-sidebar${open ? ' open' : ''}`}>
        <AdminSidebar session={session} onClose={() => setOpen(false)} />
      </div>

      <div className="adm-main">
        <div className="adm-topbar">
          <button
            onClick={() => setOpen(true)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white', fontSize: '1.25rem', lineHeight: 1, padding: 4 }}
          >
            ☰
          </button>
          <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>
            <span style={{ color: '#f9a8d4' }}>Yellow</span>
            <span style={{ color: 'white' }}>Pink</span>
            <span style={{ color: '#6b7280', fontWeight: 400, fontSize: '0.75rem', marginLeft: 8 }}>Admin</span>
          </span>
        </div>
        {children}
      </div>
    </>
  );
}
