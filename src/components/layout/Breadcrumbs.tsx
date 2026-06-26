import Link from 'next/link';

export interface Crumb {
  name: string;
  /** Storefront path, e.g. "/shop?category=Skincare". */
  path: string;
}

/**
 * Visible breadcrumb trail. Pair with `breadcrumbLd(items)` from lib/seo so the
 * on-page trail and the BreadcrumbList JSON-LD stay in lockstep (same array).
 * The last crumb is the current page, rendered as plain text with
 * aria-current, not a link. Renders nothing for a single-item trail.
 */
export function Breadcrumbs({ items, className }: { items: Crumb[]; className?: string }) {
  if (!items || items.length < 2) return null;
  return (
    <nav aria-label="Breadcrumb" className={className}>
      <div className="container" style={{ paddingTop: 16, paddingBottom: 4 }}>
        <ol
          style={{
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7,
            listStyle: 'none', margin: 0, padding: 0,
            fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
            color: 'var(--ink-500, #6b7280)',
          }}
        >
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <li key={`${c.path}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                {last ? (
                  <span
                    aria-current="page"
                    style={{
                      color: 'var(--ink-700, #374151)', fontWeight: 500,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60vw',
                    }}
                  >
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.path} style={{ color: 'inherit', textDecoration: 'none' }}>
                    {c.name}
                  </Link>
                )}
                {!last && <span aria-hidden="true" style={{ opacity: 0.55 }}>/</span>}
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}
