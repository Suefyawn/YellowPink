// Shared sortable column header for admin tables (Orders, Products). Renders
// the label with a stacked chevron pair; the active direction is full-ink,
// the other stays faint, so the current sort is readable at a glance. The
// parent owns the cycle (what a click means) — this stays a dumb control.
export function SortHeader({
  label,
  dir,
  onClick,
  align = 'left',
}: {
  label: string;
  dir: 'asc' | 'desc' | null;
  onClick: () => void;
  align?: 'left' | 'right';
}) {
  const active = dir != null;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${dir ? ` (${dir === 'asc' ? 'ascending' : 'descending'})` : ''}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
        cursor: 'pointer', padding: 0, font: 'inherit', textTransform: 'uppercase', letterSpacing: '0.05em',
        fontSize: '0.75rem', fontWeight: 600, color: active ? '#111827' : '#6b7280',
        flexDirection: align === 'right' ? 'row-reverse' : 'row',
      }}
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
        <path d="m7 9.5 5-5 5 5" opacity={dir === 'asc' ? 1 : 0.25} />
        <path d="m7 14.5 5 5 5-5" opacity={dir === 'desc' ? 1 : 0.25} />
      </svg>
    </button>
  );
}
