'use client';

import { useMemo, useState } from 'react';

export interface SelectableProduct { id: string; label: string }

// Form-embedded product multi-picker: search to add, × to remove, selection
// submitted through a hidden input (comma-separated ids) under `name`.
// Unlike CollectionProductPicker it has no save action of its own, so it can
// sit inside any form (first use: coupon product scoping).
export function ProductMultiSelect({
  name,
  products,
  initialIds = [],
  placeholder = 'Search products…',
}: {
  name: string;
  products: SelectableProduct[];
  initialIds?: string[];
  placeholder?: string;
}) {
  const byId = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const [selected, setSelected] = useState<string[]>(initialIds.filter(id => byId.has(id)));
  const [search, setSearch] = useState('');

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(selected);
    return products.filter(p => !chosen.has(p.id) && p.label.toLowerCase().includes(q)).slice(0, 6);
  }, [search, selected, products]);

  return (
    <div>
      <input type="hidden" name={name} value={selected.join(',')} />
      <div style={{ position: 'relative' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
            fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box',
          }}
        />
        {results.length > 0 && (
          <div style={{
            position: 'absolute', zIndex: 10, top: '100%', left: 0, right: 0, marginTop: 4,
            background: 'white', border: '1px solid #e5e7eb', borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden',
          }}>
            {results.map(p => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setSelected(prev => [...prev, p.id]); setSearch(''); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '8px 12px',
                  background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6',
                  cursor: 'pointer', fontSize: '0.8125rem', color: '#111827',
                }}
              >
                + {p.label}
              </button>
            ))}
          </div>
        )}
      </div>
      {selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {selected.map(id => (
            <span key={id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 8px',
              background: '#f3f4f6', borderRadius: 6, fontSize: '0.75rem', color: '#374151',
            }}>
              {byId.get(id)?.label ?? id}
              <button
                type="button"
                aria-label={`Remove ${byId.get(id)?.label ?? id}`}
                onClick={() => setSelected(prev => prev.filter(x => x !== id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 0, fontSize: '0.875rem', lineHeight: 1 }}
              >×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
