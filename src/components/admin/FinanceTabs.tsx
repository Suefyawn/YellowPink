import Link from 'next/link';

// Finance section tabs — COD reconciliation is a view of Finance, not a
// separate destination, so it lives here instead of the sidebar (2026-07
// admin UX audit sidebar re-organisation).
const TABS = [
  { key: 'overview', href: '/admin/finance', label: 'Overview' },
  { key: 'cod', href: '/admin/finance/cod', label: 'COD reconciliation' },
] as const;

export function FinanceTabs({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <div role="tablist" aria-label="Finance sections" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
      {TABS.map(t => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            role="tab"
            aria-selected={on}
            style={{
              padding: '9px 14px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
              color: on ? '#C5286A' : '#6b7280',
              borderBottom: `2px solid ${on ? '#C5286A' : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
