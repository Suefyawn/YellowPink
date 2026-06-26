'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { StaffSession, Permission } from '@/lib/permissions';

// Admin command palette, opens with Cmd/Ctrl+K from anywhere in /admin.
// Lets the operator fuzzy-search any nav destination + a few jump-to-pages
// without leaving the keyboard. Ranks matches by where in the label they
// appear; case-insensitive, accent-insensitive enough for this set.
//
// A second overlay (toggled with `?`) lists the keyboard shortcuts available
// in admin so operators don't have to remember them.

type Cmd = {
  label: string;
  hint?: string;
  href: string;
  group: string;
  permission?: Permission;
  permissionsAny?: Permission[];
  ownerOnly?: boolean;
};

const COMMANDS: Cmd[] = [
  { label: 'Dashboard',      group: 'Insights', href: '/admin/dashboard', permissionsAny: ['analytics','analytics_traffic','analytics_errors'] },
  { label: 'Analytics',      group: 'Insights', href: '/admin/analytics', permission: 'analytics' },
  { label: 'Finance',        group: 'Insights', href: '/admin/finance', permission: 'analytics' },
  { label: 'COD reconciliation', hint: 'cash on delivery', group: 'Insights', href: '/admin/finance/cod', permission: 'analytics' },

  { label: 'Orders',         group: 'Sell', href: '/admin/orders', permission: 'orders.view' },
  { label: 'New order',      hint: 'create manually', group: 'Sell', href: '/admin/orders/new', permission: 'orders.edit' },
  { label: 'Products',       group: 'Sell', href: '/admin/products', permission: 'products.view' },
  { label: 'New product',    group: 'Sell', href: '/admin/products/new', permission: 'products.edit' },
  { label: 'Tags',           group: 'Sell', href: '/admin/tags', permission: 'products.view' },
  { label: 'Collections',    group: 'Sell', href: '/admin/collections', permission: 'products.view' },
  { label: 'Brands',         group: 'Sell', href: '/admin/brands', permission: 'products.view' },
  { label: 'Inventory',      group: 'Sell', href: '/admin/inventory', permission: 'products.view' },
  { label: 'Vendors',        group: 'Sell', href: '/admin/vendors', permission: 'orders.view' },
  { label: 'Returns',        group: 'Sell', href: '/admin/returns', permission: 'returns' },

  { label: 'Customers',      group: 'People', href: '/admin/users', permission: 'customers.view' },
  { label: 'Segments',       group: 'People', href: '/admin/segments', permission: 'customers.view' },
  { label: 'Coupons',        group: 'People', href: '/admin/coupons', permission: 'coupons' },

  { label: 'Promos',         group: 'Marketing', href: '/admin/promos', permission: 'promos' },
  { label: 'Blog',           group: 'Marketing', href: '/admin/blog', permission: 'blog' },
  { label: 'Reviews',        group: 'Marketing', href: '/admin/reviews', permission: 'reviews' },
  { label: 'Newsletter',     group: 'Marketing', href: '/admin/newsletter', permission: 'newsletter' },
  { label: 'Email log',      group: 'Marketing', href: '/admin/emails', permission: 'settings' },

  { label: 'Activity log',   group: 'Store', href: '/admin/audit', ownerOnly: true },
  { label: 'Team',           group: 'Store', href: '/admin/team', ownerOnly: true },
  { label: 'Settings',       group: 'Store', href: '/admin/settings', permission: 'settings' },
];

function canSee(c: Cmd, s: StaffSession): boolean {
  if (c.ownerOnly) return s.isOwner;
  if (s.isOwner) return true;
  if (c.permission)     return s.permissions.includes(c.permission);
  if (c.permissionsAny) return c.permissionsAny.some(p => s.permissions.includes(p));
  return true;
}

// Tiny ranker: lower score = better match. -1 = no match.
function score(label: string, hint: string | undefined, q: string): number {
  if (!q) return 0;
  const needle = q.toLowerCase();
  const hay = (label + ' ' + (hint ?? '')).toLowerCase();
  const i = hay.indexOf(needle);
  if (i === -1) return -1;
  // Prefer matches at a word boundary, prefer shorter labels.
  const boundaryBonus = i === 0 || /\s/.test(hay[i - 1] ?? '') ? 0 : 10;
  return i + boundaryBonus + label.length * 0.01;
}

export function CommandPalette({ session }: { session: StaffSession }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => COMMANDS.filter(c => canSee(c, session)), [session]);

  const results = useMemo(() => {
    if (!q.trim()) return visible;
    return visible
      .map(c => ({ c, s: score(c.label, c.hint, q.trim()) }))
      .filter(r => r.s !== -1)
      .sort((a, b) => a.s - b.s)
      .map(r => r.c);
  }, [visible, q]);

  // Clamp the cursor against the live result count so a long query that
  // narrows the list down doesn't leave the highlight pointing past the end.
  // Derived inline (no effect) keeps it correct on every render.
  const activeIndex = results.length === 0 ? 0 : Math.min(cursor, results.length - 1);

  // Focus the input when the palette opens, and only then, auto-focus on
  // mount would steal focus from the page on every admin load.
  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  const close = useCallback(() => { setOpen(false); setQ(''); setCursor(0); }, []);

  const go = useCallback((href: string) => {
    close();
    router.push(href);
  }, [close, router]);

  // Global key handlers. Cmd/Ctrl+K toggles the palette; `?` shows shortcuts;
  // Esc closes whichever overlay is open. Skip when the user is typing in
  // another input so we don't intercept their keystrokes, except for the
  // palette toggle, which should work even from search boxes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(v => !v);
        return;
      }
      if (e.key === 'Escape') {
        if (open) { e.preventDefault(); close(); }
        else if (helpOpen) { e.preventDefault(); setHelpOpen(false); }
        return;
      }
      const t = e.target as HTMLElement | null;
      const inField = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
      if (!inField && !open && !helpOpen && e.key === '?') {
        e.preventDefault();
        setHelpOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, helpOpen, close]);

  // List-nav keys (palette only): up/down moves the cursor, enter opens.
  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setCursor(c => Math.min(c + 1, Math.max(0, results.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setCursor(c => Math.max(c - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = results[activeIndex];
      if (pick) go(pick.href);
    }
  };

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Admin command palette"
          onClick={close}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(17, 24, 39, 0.45)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            paddingTop: '10vh',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(560px, calc(100vw - 32px))',
              background: 'white', borderRadius: 12,
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6' }}>
              <input
                ref={inputRef}
                value={q}
                onChange={e => setQ(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Jump to… (orders, products, settings)"
                aria-label="Search admin"
                style={{
                  width: '100%', border: 'none', outline: 'none',
                  fontSize: '1rem', color: '#111827', background: 'transparent',
                }}
              />
            </div>
            <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '6px 0' }}>
              {results.length === 0 ? (
                <div style={{ padding: '24px 16px', color: '#9ca3af', fontSize: '0.875rem', textAlign: 'center' }}>
                  No matches
                </div>
              ) : results.map((c, i) => {
                const active = i === activeIndex;
                return (
                  <button
                    key={c.href}
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => go(c.href)}
                    style={{
                      display: 'flex', width: '100%', alignItems: 'baseline', gap: 10,
                      padding: '9px 16px', border: 'none', cursor: 'pointer',
                      background: active ? '#f9fafb' : 'transparent',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ fontSize: '0.875rem', color: '#111827', fontWeight: active ? 600 : 500 }}>
                      {c.label}
                    </span>
                    {c.hint && (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                        {c.hint}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {c.group}
                    </span>
                  </button>
                );
              })}
            </div>
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 14, fontSize: '0.6875rem', color: '#9ca3af' }}>
              <span><kbd style={kbd}>↑↓</kbd> navigate</span>
              <span><kbd style={kbd}>⏎</kbd> open</span>
              <span><kbd style={kbd}>esc</kbd> close</span>
              <span style={{ marginLeft: 'auto' }}>Press <kbd style={kbd}>?</kbd> for shortcuts</span>
            </div>
          </div>
        </div>
      )}

      {helpOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
          onClick={() => setHelpOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(17, 24, 39, 0.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: 'min(420px, 100%)',
              background: 'white', borderRadius: 12,
              boxShadow: '0 24px 48px rgba(0,0,0,0.25)',
              padding: 20,
            }}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontWeight: 700, color: '#111827' }}>
              Keyboard shortcuts
            </h2>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 16px', fontSize: '0.8125rem', color: '#374151' }}>
              <dt><kbd style={kbd}>⌘/Ctrl</kbd> + <kbd style={kbd}>K</kbd></dt>
              <dd style={{ margin: 0 }}>Jump to any page</dd>
              <dt><kbd style={kbd}>?</kbd></dt>
              <dd style={{ margin: 0 }}>Show this list</dd>
              <dt><kbd style={kbd}>esc</kbd></dt>
              <dd style={{ margin: 0 }}>Close overlay</dd>
            </dl>
            <button
              onClick={() => setHelpOpen(false)}
              style={{
                marginTop: 18, padding: '7px 14px', border: '1px solid #e5e7eb',
                borderRadius: 8, background: 'white', cursor: 'pointer',
                fontSize: '0.8125rem', color: '#374151',
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const kbd: React.CSSProperties = {
  display: 'inline-block', padding: '1px 6px', borderRadius: 4,
  border: '1px solid #e5e7eb', background: '#f9fafb',
  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
  fontSize: '0.6875rem', color: '#374151', lineHeight: 1.4,
};
