'use client';

// Product gallery manager: drag (or use the arrow buttons) to reorder the
// images shown on the product page, mark any one as the cover (the first /
// preview image seen on the card and at the top of the PDP), add more, or
// delete. Reordering is staged locally and persisted with Save; add and delete
// persist immediately. Mirrors the self-contained pattern of VariantsSection.

import { useRef, useState, useTransition } from 'react';
import { saveGalleryOrder, addGalleryImage, deleteGalleryImage } from '@/app/admin/gallery-actions';

interface GalleryImage { id: string; url: string; alt: string | null }

const btn: React.CSSProperties = {
  padding: '4px 8px', background: '#fff', border: '1px solid #d1d5db',
  borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, color: '#374151',
  cursor: 'pointer', lineHeight: 1,
};

export function ProductGallerySection({
  productId, initialImages,
}: {
  productId: string;
  initialImages: GalleryImage[];
}) {
  const [items, setItems] = useState<GalleryImage[]>(initialImages);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const dragIndex = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDirty(true);
    setSaved(false);
  };

  const onDrop = (to: number) => {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null) return;
    move(from, to);
  };

  const persistOrder = () => {
    setError('');
    startTransition(async () => {
      const res = await saveGalleryOrder(productId, items.map(i => i.id));
      if (res.error) { setError(res.error); return; }
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    });
  };

  const remove = (id: string) => {
    setError('');
    startTransition(async () => {
      const res = await deleteGalleryImage(id, productId);
      if (res.error) { setError(res.error); return; }
      setItems(prev => prev.filter(i => i.id !== id));
      setDirty(false);
    });
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please choose an image file.'); return; }
    if (file.size > 5 * 1024 * 1024) { setError('Max file size is 5 MB.'); return; }
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const up = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await up.json();
      if (!up.ok) { setError(data.error ?? 'Upload failed.'); return; }
      const res = await addGalleryImage(productId, data.url as string);
      if (res.error || !res.id) { setError(res.error ?? 'Could not add image.'); return; }
      setItems(prev => [...prev, { id: res.id!, url: data.url as string, alt: null }]);
    } catch {
      setError('Upload failed, check your connection.');
    } finally {
      setUploading(false);
    }
  };

  const busy = pending || uploading;

  return (
    <section style={{ marginTop: 28 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#111827', margin: 0 }}>Gallery &amp; image order</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Saved ✓</span>}
          {dirty && (
            <button type="button" onClick={persistOrder} disabled={busy} style={{
              padding: '7px 16px', background: '#111827', color: '#fff', border: 'none',
              borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: busy ? 'wait' : 'pointer',
            }}>
              {pending ? 'Saving…' : 'Save order'}
            </button>
          )}
        </div>
      </div>
      <p style={{ fontSize: '0.8125rem', color: '#6b7280', margin: '0 0 14px' }}>
        Drag a tile (or use ← →) to reorder. The <strong>first image is the cover</strong> — it shows on
        the product card, search results and at the top of the product page. Changes to the order take
        effect after you press <em>Save order</em>.
      </p>

      {error && (
        <div role="status" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.8125rem' }}>
          {error}
        </div>
      )}

      {items.length === 0 && (
        <p style={{ fontSize: '0.8125rem', color: '#9ca3af', margin: '0 0 12px' }}>
          No gallery images yet. Add some below — the first one becomes the cover.
        </p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 12 }}>
        {items.map((img, i) => (
          <div
            key={img.id}
            draggable={!busy}
            onDragStart={() => { dragIndex.current = i; }}
            onDragOver={e => e.preventDefault()}
            onDrop={() => onDrop(i)}
            style={{
              border: i === 0 ? '2px solid #111827' : '1px solid #e5e7eb',
              borderRadius: 8, overflow: 'hidden', background: '#fff',
              cursor: busy ? 'default' : 'grab', position: 'relative',
            }}
          >
            <div style={{ position: 'relative', aspectRatio: '1 / 1', background: '#f9fafb' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.alt ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
              {i === 0 && (
                <span style={{
                  position: 'absolute', top: 6, left: 6, background: '#111827', color: '#fff',
                  fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.03em',
                  padding: '2px 6px', borderRadius: 4,
                }}>COVER</span>
              )}
              <span style={{
                position: 'absolute', top: 6, right: 6, background: 'rgba(255,255,255,0.9)',
                color: '#374151', fontSize: '0.625rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4,
              }}>{i + 1}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4, padding: 6 }}>
              <div style={{ display: 'flex', gap: 4 }}>
                <button type="button" title="Move left" aria-label="Move left" disabled={busy || i === 0} onClick={() => move(i, i - 1)} style={{ ...btn, opacity: i === 0 ? 0.4 : 1 }}>←</button>
                <button type="button" title="Move right" aria-label="Move right" disabled={busy || i === items.length - 1} onClick={() => move(i, i + 1)} style={{ ...btn, opacity: i === items.length - 1 ? 0.4 : 1 }}>→</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {i !== 0 && (
                  <button type="button" title="Make cover" aria-label="Make cover" disabled={busy} onClick={() => move(i, 0)} style={btn}>★</button>
                )}
                <button type="button" title="Delete image" aria-label="Delete image" disabled={busy} onClick={() => remove(img.id)}
                  style={{ ...btn, color: '#dc2626', borderColor: '#fecaca' }}>✕</button>
              </div>
            </div>
          </div>
        ))}

        {/* Add tile */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          style={{
            border: '2px dashed #d1d5db', borderRadius: 8, background: '#fafafa',
            aspectRatio: '1 / 1', display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', gap: 6, cursor: busy ? 'wait' : 'pointer', color: '#6b7280',
            fontSize: '0.8125rem', fontWeight: 600, minHeight: 120,
          }}
        >
          <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>＋</span>
          {uploading ? 'Uploading…' : 'Add image'}
        </button>
      </div>

      <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />
    </section>
  );
}
