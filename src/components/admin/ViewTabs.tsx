import Link from 'next/link';

// Server-rendered saved-view tabs — the same underline grammar as the
// ListToolbar/Orders tabs (2026-07 filter-grammar convergence), for list pages
// whose views are plain links (no client state needed). Pages precompute each
// tab's href so existing query params (search, sort) survive a view switch.
export function ViewTabs({ tabs, active }: {
  tabs: { value: string; label: string; count?: number; href: string }[];
  active: string;
}) {
  return (
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e5e7eb', marginBottom: 16 }}>
      {tabs.map(t => {
        const isActive = active === t.value;
        return (
          <Link key={t.value} href={t.href} style={{
            padding: '9px 14px', textDecoration: 'none',
            fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500,
            color: isActive ? '#111827' : '#6b7280',
            borderBottom: `2px solid ${isActive ? '#C5286A' : 'transparent'}`,
            marginBottom: -1, whiteSpace: 'nowrap',
          }}>
            {t.label}{t.count != null ? ` (${t.count.toLocaleString()})` : ''}
          </Link>
        );
      })}
    </div>
  );
}
