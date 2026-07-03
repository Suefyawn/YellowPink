'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';

// URL-synced date-range pills shared by the insight surfaces, so "last 30
// days" looks and behaves identically on Dashboard, Analytics and Finance.
// Preserves every other query param (tab, filters) and clears pagination.
export function RangePicker({
  options,
  value,
  param = 'days',
}: {
  options: { value: string; label: string }[];
  value: string;
  param?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const setRange = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(param, v);
    next.delete('page');
    startTransition(() => router.push(`${pathname}?${next.toString()}`));
  };

  return (
    <div role="group" aria-label="Date range" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(o => {
        const active = value === o.value;
        return (
          <button key={o.value} onClick={() => setRange(o.value)} aria-pressed={active} style={{
            padding: '6px 13px', borderRadius: 16, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
            border: 'none', background: active ? '#111827' : '#f3f4f6', color: active ? '#fff' : '#6b7280',
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
