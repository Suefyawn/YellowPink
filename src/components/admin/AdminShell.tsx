'use client';
import { useEffect, useRef, useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { NotificationsBell } from './NotificationsBell';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
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
  const drawerRef = useRef<HTMLDivElement | null>(null);

  // Drawer behaves as a modal sheet on mobile only — body scroll lock +
  // focus trap kick in alongside the slide-in. Desktop ignores them.
  useBodyScrollLock(open);
  useEscapeKey(open, () => setOpen(false));
  useFocusTrap(open, drawerRef);

  // Auto-close the drawer when crossing to desktop so a stuck-open drawer
  // doesn't leave the body scroll-locked when the viewport widens.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = (e: MediaQueryListEvent) => { if (e.matches) setOpen(false); };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return (
    <>
      <style>{`
        .adm-sidebar { position: fixed; left: 0; top: 0; bottom: 0; z-index: 50; transition: transform 0.25s ease; }
        .adm-main { margin-left: 240px; min-height: 100vh; background: #f3f4f6; }
        .adm-topbar { display: flex; align-items: center; gap: 12px; padding: 10px 16px; background: white; border-bottom: 1px solid #e5e7eb; position: sticky; top: 0; z-index: 30; }
        .adm-topbar .menu-btn { display: none; }
        .adm-overlay { display: none; }
        .adm-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }

        /* ─ Responsive table → card-stack utility ─
         * Put .adm-table-cards on a <table>, add data-label="…" on each <td>,
         * and below 768 px the table reflows into one stacked card per row
         * with the label inline. Avoids horizontal scroll on phones. */
        @media (max-width: 767px) {
          .adm-table-cards thead { display: none; }
          .adm-table-cards, .adm-table-cards tbody { display: block; width: 100%; }
          .adm-table-cards tr {
            display: block; background: white; border-radius: 10px;
            padding: 12px 14px; margin-bottom: 10px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.06);
            border: 1px solid #f3f4f6;
          }
          .adm-table-cards td {
            display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
            padding: 8px 0 !important;
            border: none !important;
            font-size: 0.8125rem !important;
            text-align: right;
          }
          .adm-table-cards td + td {
            border-top: 1px dashed #f3f4f6 !important;
          }
          .adm-table-cards td::before {
            content: attr(data-label);
            font-weight: 600; color: #6b7280; font-size: 0.6875rem;
            text-transform: uppercase; letter-spacing: 0.05em;
            text-align: left; flex-shrink: 0; padding-top: 2px;
          }
          /* Cells without a data-label (usually the actions column) stay full-width. */
          .adm-table-cards td:not([data-label]) {
            justify-content: flex-end;
          }
          .adm-table-cards td:not([data-label])::before {
            content: none;
          }
        }

        @media (max-width: 1023px) {
          .adm-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .adm-analytics-grid { grid-template-columns: 1fr !important; }
        }

        @media (max-width: 767px) {
          .adm-sidebar { transform: translateX(-100%); width: min(280px, 86vw) !important; }
          .adm-sidebar.open { transform: translateX(0); box-shadow: 8px 0 32px rgba(0,0,0,0.18); }
          /* !important defends against any stray desktop rule that tried to
           * pin margin-left at the (now-hidden) sidebar's width. */
          .adm-main { margin-left: 0 !important; }
          .adm-topbar { background: white; padding: 10px 14px; }
          .adm-topbar .menu-btn { display: inline-flex; }
          .adm-overlay {
            display: block; position: fixed; inset: 0;
            background: rgba(0,0,0,0.5); z-index: 49;
            opacity: 0; pointer-events: none;
            transition: opacity 220ms ease-out;
          }
          .adm-overlay.open { opacity: 1; pointer-events: auto; }
          .adm-page { padding: 14px 12px !important; }
          .adm-stat-grid { gap: 10px !important; }
          .adm-form-2col { grid-template-columns: 1fr !important; }
          .adm-form-3col { grid-template-columns: 1fr 1fr !important; }
          .adm-form-4col { grid-template-columns: 1fr 1fr !important; }
          .adm-form-brand { grid-template-columns: 1fr !important; }

          /* Variant rows on the PDP/admin product edit page were 6 columns wide
           * — they overflowed on phones. Collapse to a card stack: option +
           * SKU on top, price/stock/status flow underneath, Edit/Delete pinned
           * to the right side. */
          .adm-variant-row {
            grid-template-columns: 1fr auto !important;
            grid-template-areas: "summary actions" "price actions" "stock actions" "enabled actions" !important;
            row-gap: 6px !important;
          }
          .adm-variant-row > :nth-child(1) { grid-area: summary; }
          .adm-variant-row > :nth-child(2) { grid-area: price; font-weight: 600; }
          .adm-variant-row > :nth-child(3) { grid-area: stock; }
          .adm-variant-row > :nth-child(4) { grid-area: enabled; }
          .adm-variant-row > :nth-child(5),
          .adm-variant-row > :nth-child(6) { grid-area: actions; align-self: start; }

          /* Modals (team/edit-staff, etc.) on phones */
          .adm-modal { max-width: calc(100vw - 16px) !important; max-height: calc(100vh - 32px); overflow-y: auto; padding: 16px !important; }
          .adm-modal-grid { grid-template-columns: 1fr !important; }

          /* Header brand on a phone should keep "Pink" visible without
           * spilling under the bell. */
          .adm-topbar h1, .adm-topbar > span { font-size: 0.875rem !important; }

          /* Per-page header rows (h1 + side action button) often use
           * justifyContent space-between on desktop — let them stack on phones. */
          .adm-page-header { flex-wrap: wrap !important; gap: 12px !important; }
          .adm-page-header > * { flex: 1 1 auto; }

          /* Sticky bulk-action bars need to hug the screen edge on phones,
           * not the (now-zero) page padding. */
          .adm-bulk-bar { margin: 12px -12px 0 !important; border-radius: 0 !important; flex-direction: column; align-items: stretch !important; gap: 8px !important; }
        }
      `}</style>

      <div
        className={`adm-overlay${open ? ' open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      <div
        ref={drawerRef}
        className={`adm-sidebar${open ? ' open' : ''}`}
        role={open ? 'dialog' : undefined}
        aria-modal={open ? 'true' : undefined}
        aria-label="Admin navigation"
        aria-hidden={typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches && !open ? 'true' : undefined}
      >
        <AdminSidebar session={session} onClose={() => setOpen(false)} pendingOrderCount={pendingOrderCount} />
      </div>

      <div className="adm-main">
        <div className="adm-topbar">
          <button
            className="menu-btn"
            onClick={() => setOpen(true)}
            aria-label="Open admin menu"
            aria-expanded={open}
            aria-controls="admin-sidebar"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              width: 40, height: 40, borderRadius: 8, padding: 0,
              alignItems: 'center', justifyContent: 'center',
              color: '#111827',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <line x1="3" y1="6"  x2="21" y2="6"  />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
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
