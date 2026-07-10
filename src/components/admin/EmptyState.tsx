// Designed empty state for admin lists and disconnected integrations.
// Replaces the bare centered-gray-sentence pattern: an icon in a soft disc,
// a short headline, an optional explainer, and (when there's an obvious next
// step) one CTA. Server-component friendly — no state, no handlers.

import Link from 'next/link';

const ICONS = {
  // lucide outlines, 24×24, stroke=currentColor (house icon rules)
  inbox: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" /></>,
  plug: <><path d="M12 22v-5" /><path d="M9 8V2" /><path d="M15 8V2" /><path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" /></>,
  search: <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>,
  file: <><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /></>,
  users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  layers: <><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" /><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" /><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" /></>,
  wallet: <><path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" /><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" /></>,
  bell: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></>,
} as const;

export function EmptyState({
  icon = 'inbox',
  title,
  children,
  ctaHref,
  ctaLabel,
  compact = false,
}: {
  icon?: keyof typeof ICONS;
  title: string;
  /** Optional one-or-two-sentence explainer under the headline. */
  children?: React.ReactNode;
  ctaHref?: string;
  ctaLabel?: string;
  /** Tighter vertical padding for empty states inside small cards. */
  compact?: boolean;
}) {
  return (
    <div style={{ padding: compact ? '28px 20px' : '48px 20px', textAlign: 'center' }}>
      <div style={{
        width: 44, height: 44, borderRadius: '50%', background: '#fdf2f8',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: '#C5286A', marginBottom: 12,
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {ICONS[icon]}
        </svg>
      </div>
      <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', marginBottom: children ? 4 : 0 }}>
        {title}
      </div>
      {children && (
        <p style={{ margin: '0 auto', maxWidth: 420, fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.55 }}>
          {children}
        </p>
      )}
      {ctaHref && ctaLabel && (
        <div style={{ marginTop: 14 }}>
          <Link href={ctaHref} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 16px', background: '#C5286A', color: 'white',
            borderRadius: 8, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600,
          }}>
            {ctaLabel}
          </Link>
        </div>
      )}
    </div>
  );
}
