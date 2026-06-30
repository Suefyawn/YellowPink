'use client';

import { useState } from 'react';

// A compact, always-visible header row with a collapsible body. Used on the
// admin Medical Review Board so each reviewer reads as a tidy one-line card
// (avatar, name, status, quick actions) and the big edit form only opens when
// you click Edit, which keeps the page scannable with many doctors.
export function AdminCollapsible({
  header,
  children,
  defaultOpen = false,
  openLabel = 'Edit',
  closeLabel = 'Close',
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  openLabel?: string;
  closeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, background: '#fff', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>{header}</div>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          aria-expanded={open}
          style={{
            flexShrink: 0, padding: '7px 15px', fontSize: '0.8125rem', fontWeight: 600, borderRadius: 7,
            border: '1px solid ' + (open ? '#111827' : '#e5e7eb'), background: open ? '#111827' : '#fff',
            color: open ? '#fff' : '#374151', cursor: 'pointer',
          }}
        >
          {open ? closeLabel : openLabel}
        </button>
      </div>
      {open && (
        <div style={{ padding: '6px 16px 18px', borderTop: '1px solid #f3f4f6' }}>
          {children}
        </div>
      )}
    </div>
  );
}
