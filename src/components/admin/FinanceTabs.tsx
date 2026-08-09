import Link from 'next/link';

// Finance section tabs — COD reconciliation is a view of Finance, not a
// separate destination, so it lives here instead of the sidebar (2026-07
// admin UX audit sidebar re-organisation).
//
// Both pages pass their current filter params so switching tabs keeps the
// selected range + payment method (they used to reset to the 30d default on
// every tab tap). ONLY the filter params travel — one-shot flash params
// (?ok / ?err) and pagination must not replay across tabs, which is why this
// takes an explicit allowlist instead of the whole query string.
const TABS = [
  { key: 'overview', href: '/admin/finance', label: 'Overview' },
  { key: 'cod', href: '/admin/finance/cod', label: 'COD reconciliation' },
] as const;

export function FinanceTabs({ active, params, codBadge }: {
  active: (typeof TABS)[number]['key'];
  /** Current filter state to preserve across tab switches. */
  params?: { range?: string | null; method?: string | null };
  /** Delivered store-COD orders still awaiting payment confirmation — shown
   *  as a count chip on the COD tab so uncollected cash is visible from
   *  either tab instead of hiding behind an "all caught up" empty state. */
  codBadge?: number;
}) {
  const qs = new URLSearchParams();
  if (params?.range) qs.set('range', params.range);
  if (params?.method) qs.set('method', params.method);
  const suffix = qs.size > 0 ? `?${qs.toString()}` : '';
  return (
    <div role="tablist" aria-label="Finance sections" style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #e5e7eb' }}>
      {TABS.map(t => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={`${t.href}${suffix}`}
            role="tab"
            aria-selected={on}
            style={{
              padding: '9px 14px', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none',
              color: on ? '#C5286A' : '#6b7280',
              borderBottom: `2px solid ${on ? '#C5286A' : 'transparent'}`,
              marginBottom: -1,
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            {t.label}
            {t.key === 'cod' && (codBadge ?? 0) > 0 && (
              <span style={{ padding: '1px 7px', borderRadius: 999, background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', fontSize: '0.6875rem', fontWeight: 700 }}>
                {codBadge}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}
