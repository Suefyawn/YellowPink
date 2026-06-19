'use client';

import { useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setProductTags } from '@/app/admin/tag-actions';

// WooCommerce / Shopify-style tag box: type to add a tag (creating it if new),
// pick from existing tags, remove with ×, then Save. Tags are a separate
// many-to-many facet, so this saves independently of the main product form.
export function ProductTagsEditor({
  productId,
  initialTags,
  suggestions,
}: {
  productId: string;
  initialTags: string[];
  suggestions: string[];
}) {
  const router = useRouter();
  const [tags, setTags] = useState<string[]>(initialTags);
  const [input, setInput] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const dirty = useMemo(() => {
    const a = [...tags].map(t => t.toLowerCase()).sort();
    const b = [...initialTags].map(t => t.toLowerCase()).sort();
    return a.length !== b.length || a.some((x, i) => x !== b[i]);
  }, [tags, initialTags]);

  const has = (name: string) => tags.some(t => t.toLowerCase() === name.toLowerCase());

  function addTag(raw: string) {
    const name = raw.trim();
    if (!name || has(name)) { setInput(''); return; }
    setTags(prev => [...prev, name]);
    setInput('');
    setSaved(false);
  }
  function removeTag(name: string) {
    setTags(prev => prev.filter(t => t !== name));
    setSaved(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(input);
    } else if (e.key === 'Backspace' && !input && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    }
  }

  // Suggestions: existing tags not already applied, matching the current input.
  const filtered = useMemo(() => {
    const q = input.trim().toLowerCase();
    return suggestions
      .filter(s => !has(s))
      .filter(s => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [suggestions, input, tags]); // eslint-disable-line react-hooks/exhaustive-deps

  function save() {
    setError(null);
    startTransition(async () => {
      const res = await setProductTags(productId, tags);
      if (res.error) { setError(res.error); return; }
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div style={{ padding: '24px 28px', marginTop: 24, background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', maxWidth: 1000 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, gap: 12, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#111827' }}>Tags</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {saved && !dirty && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Saved</span>}
          <button
            type="button"
            onClick={save}
            disabled={!dirty || pending}
            style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: !dirty || pending ? '#e5e7eb' : '#C5286A',
              color: !dirty || pending ? '#9ca3af' : 'white',
              fontSize: '0.8125rem', fontWeight: 600, cursor: !dirty || pending ? 'default' : 'pointer',
            }}
          >
            {pending ? 'Saving…' : 'Save tags'}
          </button>
        </div>
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Free-form tags for storefront filtering and curated edits (e.g. <em>viral</em>, <em>vegan</em>, <em>gift</em>). Type and press Enter to add.
      </p>

      {error && (
        <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '8px 12px', marginBottom: 12, color: '#dc2626', fontSize: '0.75rem' }}>
          {error}
        </div>
      )}

      {/* Chips + input */}
      <div
        onClick={() => inputRef.current?.focus()}
        style={{
          display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
          padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          background: 'white', cursor: 'text', minHeight: 44,
        }}
      >
        {tags.map(t => (
          <span key={t} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 6px 4px 10px', borderRadius: 20,
            background: '#fce7f3', color: '#9d174d',
            fontSize: '0.8125rem', fontWeight: 600,
          }}>
            {t}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); removeTag(t); }}
              aria-label={`Remove ${t}`}
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
          placeholder={tags.length === 0 ? 'Add a tag…' : ''}
          style={{
            flex: 1, minWidth: 120, border: 'none', outline: 'none',
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
    </div>
  );
}
