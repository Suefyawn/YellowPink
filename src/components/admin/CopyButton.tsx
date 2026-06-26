'use client';

import { useState } from 'react';

// Small copy-to-clipboard control. Staff forward order numbers to couriers and
// vendors constantly; a one-tap copy beats select-drag-copy every time.
// `iconOnly` renders a compact clipboard glyph for dense rows (e.g. the
// coupon table) where a full "Copy" label would crowd the cell.
export function CopyButton({ value, label = 'Copy', title, iconOnly = false }: { value: string; label?: string; title?: string; iconOnly?: boolean }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked, no-op */
    }
  };

  return (
    <button
      type="button"
      onClick={copy}
      title={title ?? `Copy ${value}`}
      aria-label={title ?? `Copy ${value}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: copied ? '#f0fdf4' : 'white',
        border: `1px solid ${copied ? '#86efac' : '#d1d5db'}`,
        color: copied ? '#15803d' : '#6b7280',
        borderRadius: 6, padding: iconOnly ? '3px 6px' : '4px 9px', fontSize: '0.75rem', fontWeight: 600,
        cursor: 'pointer', lineHeight: 1, transition: 'all 120ms',
      }}
    >
      {iconOnly ? (copied ? '✓' : '⧉') : (copied ? '✓ Copied' : label)}
    </button>
  );
}
