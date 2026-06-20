'use client';

import { useState } from 'react';

// Small copy-to-clipboard control. Staff forward order numbers to couriers and
// vendors constantly; a one-tap copy beats select-drag-copy every time.
export function CopyButton({ value, label = 'Copy', title }: { value: string; label?: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — no-op */
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
        borderRadius: 6, padding: '4px 9px', fontSize: '0.75rem', fontWeight: 600,
        cursor: 'pointer', lineHeight: 1, transition: 'all 120ms',
      }}
    >
      {copied ? '✓ Copied' : label}
    </button>
  );
}
