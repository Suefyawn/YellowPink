'use client';

import { useState } from 'react';
import Link from 'next/link';

interface Candidate { name: string; slug: string; logoUrl: string; productCount: number }

interface Props {
  /** Form field name the generic saveSettings action reads (e.g. "hero_brands"). */
  name: string;
  /** Current comma-separated value from site_settings. */
  value: string;
  /** Selectable brands, already filtered to published + has a logo, ranked by
   *  product count (see getBrandLogoCandidates). */
  candidates: Candidate[];
}

/** Admin picker for the homepage hero's "trusted brand logos" row. Replaces a
 *  free-text comma list (which silently rendered nothing for a misspelled
 *  brand name, and only ever showed plain uppercase TEXT, never an actual
 *  logo) with a visual grid: click a brand's real logo to add/remove it from
 *  the row, see the exact order it'll render in, right below. Emits a single
 *  hidden input so it plugs into the existing generic settings-save action
 *  unchanged. */
export function BrandLogoPicker({ name, value, candidates }: Props) {
  const byName = new Map(candidates.map(c => [c.name, c]));
  const [selected, setSelected] = useState<string[]>(() =>
    value.split(',').map(s => s.trim()).filter(Boolean),
  );

  const toggle = (brandName: string) => {
    setSelected(sel => sel.includes(brandName) ? sel.filter(n => n !== brandName) : [...sel, brandName]);
  };
  const remove = (brandName: string) => setSelected(sel => sel.filter(n => n !== brandName));

  return (
    <div>
      <input type="hidden" name={name} value={selected.join(',')} />

      {/* Live preview: exactly what ships in the hero, in the chosen order. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', minHeight: 40,
        padding: '10px 14px', background: '#fafafa', border: '1px dashed #e5e7eb', borderRadius: 8, marginBottom: 12,
      }}>
        {selected.length === 0 ? (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>No logos selected, pick from the grid below.</span>
        ) : selected.map(n => {
          const c = byName.get(n);
          return (
            <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'white', border: '1px solid #e5e7eb', borderRadius: 999 }}>
              {c ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.logoUrl} alt="" style={{ height: 16, width: 'auto', maxWidth: 60, objectFit: 'contain' }} />
              ) : (
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#b45309' }}>{n} (no logo on file)</span>
              )}
              <button type="button" onClick={() => remove(n)} aria-label={`Remove ${n}`}
                style={{ border: 'none', background: 'none', color: '#9ca3af', cursor: 'pointer', fontSize: '0.875rem', lineHeight: 1, padding: 0 }}>
                ×
              </button>
            </span>
          );
        })}
      </div>

      {/* Picker grid: click a logo to add/remove. Ranked by catalogue
          prominence (product count) so the most "famous" brands in the store
          sort to the top already. */}
      {candidates.length === 0 ? (
        <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>
          No brands have a logo uploaded yet. Add one on the{' '}
          <Link href="/admin/brands" style={{ color: '#C5286A', fontWeight: 600 }}>Brands</Link> page, it&apos;ll show up here.
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8, maxHeight: 260, overflowY: 'auto', padding: 2 }}>
          {candidates.map(c => {
            const active = selected.includes(c.name);
            return (
              <button
                key={c.slug}
                type="button"
                onClick={() => toggle(c.name)}
                title={`${c.name} · ${c.productCount} product${c.productCount === 1 ? '' : 's'}`}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                  padding: '12px 8px', height: 76,
                  border: '1.5px solid ' + (active ? '#C5286A' : '#e5e7eb'),
                  background: active ? '#fdf2f8' : 'white',
                  borderRadius: 8, cursor: 'pointer', transition: 'all 120ms ease-out', position: 'relative',
                }}
              >
                {active && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4, width: 14, height: 14, borderRadius: '50%',
                    background: '#C5286A', color: 'white', fontSize: '0.5625rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  }}>✓</span>
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={c.logoUrl} alt={c.name} style={{ height: 22, maxWidth: '90%', objectFit: 'contain', filter: active ? 'none' : 'grayscale(1)', opacity: active ? 1 : 0.75 }} />
                <span style={{ fontSize: '0.625rem', color: '#6b7280', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
        Click logos to add or remove them. They appear on the homepage in the order you pick them, shown in the preview above.
      </p>
    </div>
  );
}
