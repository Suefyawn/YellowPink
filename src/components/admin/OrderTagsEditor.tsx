'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addOrderTag, removeOrderTag } from '@/app/admin/orders/tag-actions';

export interface OrderTagChip {
  id: string;
  name: string;
}

// Shopify-style order tag box (modelled on ProductTagsEditor): type to add a
// tag (creating it if new), pick from existing tags, remove with ×. Unlike
// the product editor there is no Save button — each add/remove persists
// immediately via its own server action, then the route refreshes so the
// chips render from the server's truth.
export function OrderTagsEditor({
  orderId,
  initialTags,
  suggestions,
  canEdit,
}: {
  orderId: string;
  initialTags: OrderTagChip[];
  suggestions: string[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const has = (name: string) => initialTags.some(t => t.name.toLowerCase() === name.toLowerCase());

  function addTag(raw: string) {
    const name = raw.trim();
    setInput('');
    if (!name || has(name)) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('name', name);
      const res = await addOrderTag(orderId, fd);
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }
  function removeTag(tag: OrderTagChip) {
    setError(null);
    startTransition(async () => {
      const res = await removeOrderTag(orderId, tag.id);
      if (res.error) { setError(res.error); return; }
      router.refresh();
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && initialTags.length > 0) {
      removeTag(initialTags[initialTags.length - 1]);
    }
  }

  // Suggestions: existing tags not already applied, matching the current input.
  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    return suggestions
      .filter(s => !has(s))
      .filter(s => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [suggestions, input, initialTags]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Tags</h2>
        {pending && <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontWeight: 600 }}>Saving…</span>}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6b7280' }}>
        Free-form labels for triage and filtering (e.g. <em>rush</em>, <em>exchange</em>, <em>wholesale</em>). The orders list filters by them.
      </p>

      {error && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.75rem' }}>
          {error}
        </div>
      )}

      {!canEdit ? (
        initialTags.length === 0 ? (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>No tags yet.</p>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {initialTags.map(t => (
              <span key={t.id} style={{
                display: 'inline-flex', alignItems: 'center',
                padding: '4px 10px', borderRadius: 20,
                background: '#fce7f3', color: '#9d174d',
                fontSize: '0.8125rem', fontWeight: 600,
              }}>
                {t.name}
              </span>
            ))}
          </div>
        )
      ) : (
        <>
          {/* Chips + input */}
          <div
            onClick={() => inputRef.current?.focus()}
            style={{
              display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
              padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
              background: 'white', cursor: 'text', minHeight: 44,
            }}
          >
            {initialTags.map(t => (
              <span key={t.id} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '4px 6px 4px 10px', borderRadius: 20,
                background: '#fce7f3', color: '#9d174d',
                fontSize: '0.8125rem', fontWeight: 600,
              }}>
                {t.name}
                <button
                  type="button"
                  onClick={e => { e.stopPropagation(); removeTag(t); }}
                  aria-label={`Remove ${t.name}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    width: 18, height: 18, borderRadius: '50%', border: 'none',
                    background: 'rgba(157,23,107,0.15)', color: '#9d174d',
                    cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1,
                  }}
                >×</button>
              </span>
            ))}
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              onBlur={() => input.trim() && addTag(input)}
              placeholder={initialTags.length === 0 ? 'Add a tag…' : ''}
              style={{
                flex: 1, minWidth: 100, border: 'none', outline: 'none',
                fontSize: '0.8125rem', color: '#111827', background: 'transparent', padding: '4px 0',
              }}
            />
          </div>

          {/* Suggestions from existing tags */}
          {filtered.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
              <span style={{ fontSize: '0.6875rem', color: '#9ca3af', alignSelf: 'center', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {input.trim() ? 'Matches' : 'Existing'}
              </span>
              {filtered.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => addTag(s)}
                  style={{
                    padding: '4px 10px', borderRadius: 20, border: '1px solid #e5e7eb',
                    background: '#f9fafb', color: '#374151', fontSize: '0.75rem', cursor: 'pointer',
                  }}
                >
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
