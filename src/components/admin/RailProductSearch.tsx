'use client';

// Search box for "Today's homepage": find any published product and flag it
// as Featured or pin it as a Best Seller without leaving the rails view.
// Debounced 350ms; results act through the same server actions as the
// per-tile buttons, then the page refreshes to show the recomposed rails.

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchCatalogForRail, setRailFlag, type RailSearchHit } from '@/app/admin/homepage-preview/actions';
import { ProductImage } from '@/components/ui/ProductImage';

export function RailProductSearch() {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<RailSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (q.trim().length < 2) { setHits([]); setSearching(false); return; }
      setSearching(true);
      try {
        setHits(await searchCatalogForRail(q));
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  const flip = (id: string, flag: 'featured' | 'bestseller', on: boolean) => {
    const fd = new FormData();
    fd.set('id', id);
    fd.set('flag', flag);
    fd.set('on', on ? '1' : '0');
    startTransition(async () => {
      await setRailFlag(fd);
      setHits(prev => prev.map(h => h.id === id
        ? { ...h, [flag === 'featured' ? 'is_featured' : 'is_bestseller']: on }
        : h));
      router.refresh();
    });
  };

  const chip: React.CSSProperties = {
    fontSize: '0.71875rem', fontWeight: 600, padding: '4px 9px', borderRadius: 99,
    border: '1px solid #d1d5db', background: 'white', cursor: 'pointer', color: '#374151',
  };
  const chipOn: React.CSSProperties = { ...chip, background: '#C5286A', borderColor: '#C5286A', color: 'white' };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14, marginBottom: 24 }}>
      <label htmlFor="rail-search" style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', display: 'block', marginBottom: 8 }}>
        Add a product to a rail
      </label>
      <input
        id="rail-search"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search the catalogue by name or brand…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }}
      />
      {(searching || hits.length > 0) && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {searching && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Searching…</span>}
          {hits.map(h => (
            <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, background: '#fafaf9' }}>
              <div style={{ width: 36, height: 36, borderRadius: 6, overflow: 'hidden', flexShrink: 0, background: '#faf6ee' }}>
                <ProductImage src={h.image_url} alt={h.name} width={36} height={36} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
                <div style={{ fontSize: '0.71875rem', color: '#6b7280' }}>{h.brand} · PKR {h.price.toLocaleString()}</div>
              </div>
              <button type="button" disabled={pending} style={h.is_featured ? chipOn : chip}
                onClick={() => flip(h.id, 'featured', !h.is_featured)}>
                {h.is_featured ? 'Featured ✓' : 'Feature'}
              </button>
              <button type="button" disabled={pending} style={h.is_bestseller ? chipOn : chip}
                onClick={() => flip(h.id, 'bestseller', !h.is_bestseller)}>
                {h.is_bestseller ? 'Pinned ✓' : 'Pin seller'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
