'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setCollectionProducts } from '@/app/admin/collection-actions';

export interface PickerProduct { id: string; label: string }

// Hand-pick + order the products in a manual collection. Search the catalogue
// to add; reorder with the arrows; remove with ×; Save persists the ordered
// list.
export function CollectionProductPicker({
  collectionId,
  allProducts,
  initialSelectedIds,
}: {
  collectionId: string;
  allProducts: PickerProduct[];
  initialSelectedIds: string[];
}) {
  const router = useRouter();
  const byId = useMemo(() => new Map(allProducts.map(p => [p.id, p])), [allProducts]);
  const [selected, setSelected] = useState<string[]>(initialSelectedIds.filter(id => byId.has(id)));
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dirty = useMemo(() => {
    if (selected.length !== initialSelectedIds.length) return true;
    return selected.some((id, i) => id !== initialSelectedIds[i]);
  }, [selected, initialSelectedIds]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    const chosen = new Set(selected);
    return allProducts.filter(p => !chosen.has(p.id) && p.label.toLowerCase().includes(q)).slice(0, 8);
  }, [search, selected, allProducts]);

  const add = (id: string) => { setSelected(prev => [...prev, id]); setSearch(''); setSaved(false); };
  const remove = (id: string) => { setSelected(prev => prev.filter(x => x !== id)); setSaved(false); };
  const move = (i: number, dir: -1 | 1) => {
    setSelected(prev => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
    setSaved(false);
  };

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setCollectionProducts(collectionId, selected);
      if (res.error) { setError(res.error); return; }
      setSaved(true);
      router.refresh();
    });
  }

  const btn: React.CSSProperties = {
    width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    border: '1px solid #d1d5db', borderRadius: 6, background: 'white', cursor: 'pointer', fontSize: '0.75rem', color: '#374151',
  };

  return (
    <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Products ({selected.length})</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && !dirty && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
          <button type="button" onClick={save} disabled={!dirty || pending} style={{
            padding: '7px 16px', borderRadius: 6, border: 'none',
            background: !dirty || pending ? '#e5e7eb' : '#C5286A', color: !dirty || pending ? '#9ca3af' : 'white',
            fontSize: '0.8125rem', fontWeight: 600, cursor: !dirty || pending ? 'default' : 'pointer',
          }}>{pending ? 'Saving…' : 'Save products'}</button>
        </div>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>Search to add products, then reorder, the order here is the order shoppers see.</p>

      {error && <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.75rem' }}>{error}</div>}

      {/* Search to add */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products to add…"
          style={{ width: '100%', padding: '9px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none', boxSizing: 'border-box' }}
        />
        {results.length > 0 && (
          <div style={{ position: 'absolute', zIndex: 5, top: '100%', left: 0, right: 0, marginTop: 4, background: 'white', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>
            {results.map(p => (
              <button key={p.id} type="button" onClick={() => add(p.id)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 12px', background: 'white', border: 'none', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', fontSize: '0.8125rem', color: '#111827' }}>
                + {p.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected, ordered */}
      {selected.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.8125rem', border: '1px dashed #e5e7eb', borderRadius: 8 }}>
          No products yet, search above to add some.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {selected.map((id, i) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <span style={{ width: 22, fontSize: '0.75rem', color: '#9ca3af', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
              <span style={{ flex: 1, fontSize: '0.8125rem', color: '#111827' }}>{byId.get(id)?.label ?? id}</span>
              <button type="button" aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} style={{ ...btn, opacity: i === 0 ? 0.4 : 1 }}>↑</button>
              <button type="button" aria-label="Move down" onClick={() => move(i, 1)} disabled={i === selected.length - 1} style={{ ...btn, opacity: i === selected.length - 1 ? 0.4 : 1 }}>↓</button>
              <button type="button" aria-label="Remove" onClick={() => remove(id)} style={{ ...btn, color: '#dc2626', borderColor: '#fecaca' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
