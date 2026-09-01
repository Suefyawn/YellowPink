'use client';

// Blog body editor (1 Sep 2026): the owner asked for something closer to
// WordPress/Shopify than a bare monospace box. Deliberately NOT a heavy
// rich-text dependency (free-tier bundle discipline): a toolbar that writes
// the same clean HTML the storefront sanitizer allows, an image button that
// uploads through /api/upload (auto-optimised server-side) and drops a
// <figure> in place, and a Preview tab rendered through the REAL storefront
// sanitizer so what you see is what publishes.

import { useMemo, useRef, useState } from 'react';
import { sanitizeHtml } from '@/lib/sanitize';
import { deriveReadTime } from '@/lib/reading-time';

interface Props {
  name: string;
  defaultValue?: string;
}

type Wrap = { before: string; after: string; placeholder: string };

const BLOCKS: Array<{ label: string; title: string } & Wrap> = [
  { label: 'H2', title: 'Section heading', before: '\n<h2>', after: '</h2>\n', placeholder: 'Section heading' },
  { label: 'H3', title: 'Sub-heading', before: '\n<h3>', after: '</h3>\n', placeholder: 'Sub-heading' },
  { label: 'B', title: 'Bold (Ctrl+B)', before: '<strong>', after: '</strong>', placeholder: 'bold text' },
  { label: 'I', title: 'Italic (Ctrl+I)', before: '<em>', after: '</em>', placeholder: 'italic text' },
  { label: '¶', title: 'Paragraph', before: '\n<p>', after: '</p>\n', placeholder: 'Paragraph text' },
  { label: '• List', title: 'Bullet list', before: '\n<ul>\n  <li>', after: '</li>\n  <li>Second point</li>\n</ul>\n', placeholder: 'First point' },
  { label: '1. List', title: 'Numbered list', before: '\n<ol>\n  <li>', after: '</li>\n  <li>Step two</li>\n</ol>\n', placeholder: 'Step one' },
  { label: '❝', title: 'Quote', before: '\n<blockquote>', after: '</blockquote>\n', placeholder: 'Quoted text' },
];

const TABLE_SNIPPET = `
<table>
  <thead>
    <tr><th>Product</th><th>Best for</th><th>Price</th></tr>
  </thead>
  <tbody>
    <tr><td>…</td><td>…</td><td>…</td></tr>
    <tr><td>…</td><td>…</td><td>…</td></tr>
  </tbody>
</table>
`;

export function BlogBodyEditor({ name, defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue);
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const words = useMemo(
    () => value.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
    [value],
  );

  /** Wrap the selection (or insert a placeholder) and restore focus. */
  const apply = ({ before, after, placeholder }: Wrap) => {
    const el = areaRef.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const selected = value.slice(s, e) || placeholder;
    const next = value.slice(0, s) + before + selected + after + value.slice(e);
    setValue(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + selected.length);
    });
  };

  const insertAtCursor = (snippet: string) => {
    const el = areaRef.current;
    const s = el ? el.selectionStart : value.length;
    setValue(value.slice(0, s) + snippet + value.slice(s));
    requestAnimationFrame(() => el?.focus());
  };

  const addLink = () => {
    const url = window.prompt('Link URL (e.g. /product/some-product or https://…)');
    if (!url) return;
    apply({ before: `<a href="${url.trim()}">`, after: '</a>', placeholder: 'link text' });
  };

  const uploadImage = async (file: File) => {
    setUploading(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('preset', 'general');
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Image upload failed'); return; }
      insertAtCursor(`\n<figure>\n  <img src="${data.url}" alt="" loading="lazy" />\n  <figcaption></figcaption>\n</figure>\n`);
    } catch {
      setError('Image upload failed, check your connection');
    } finally {
      setUploading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); apply(BLOCKS[2]); }
    if (k === 'i') { e.preventDefault(); apply(BLOCKS[3]); }
    if (k === 'k') { e.preventDefault(); addLink(); }
  };

  const toolBtn: React.CSSProperties = {
    padding: '5px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#374151',
    background: 'white', border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer',
  };
  const tabBtn = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
    border: 'none', borderBottom: active ? '2px solid #C5286A' : '2px solid transparent',
    background: 'none', color: active ? '#C5286A' : '#6b7280',
  });

  return (
    <div>
      {/* The form still submits a plain "body" field — server actions unchanged. */}
      <input type="hidden" name={name} value={value} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '1px solid #e5e7eb', marginBottom: 10 }}>
        <button type="button" style={tabBtn(tab === 'write')} onClick={() => setTab('write')}>Write</button>
        <button type="button" style={tabBtn(tab === 'preview')} onClick={() => setTab('preview')}>Preview</button>
        <span style={{ marginLeft: 'auto', fontSize: '0.71875rem', color: '#9ca3af' }}>
          {words.toLocaleString()} words · {deriveReadTime(value)}
        </span>
      </div>

      {tab === 'write' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {BLOCKS.map(b => (
              <button key={b.label} type="button" title={b.title} style={toolBtn} onClick={() => apply(b)}>
                {b.label}
              </button>
            ))}
            <button type="button" title="Link (Ctrl+K)" style={toolBtn} onClick={addLink}>Link</button>
            <button type="button" title="Comparison table" style={toolBtn} onClick={() => insertAtCursor(TABLE_SNIPPET)}>Table</button>
            <button type="button" title="Divider" style={toolBtn} onClick={() => insertAtCursor('\n<hr/>\n')}>─</button>
            <button type="button" title="Upload an image into the post" style={{ ...toolBtn, color: '#C5286A', borderColor: '#f3bcd3' }}
              disabled={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Uploading…' : 'Image'}
            </button>
          </div>
          <textarea
            ref={areaRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={20}
            style={{
              width: '100%', boxSizing: 'border-box', padding: '12px 14px',
              border: '1px solid #d1d5db', borderRadius: 7, resize: 'vertical',
              fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.8125rem', lineHeight: 1.7,
              color: '#111827', background: 'white', outline: 'none',
            }}
            placeholder="Write the post here. Use the toolbar for headings, lists, links, tables and images — it writes the exact HTML the blog publishes."
          />
          <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
            Select text and press a toolbar button to format it. Images upload through the media
            pipeline and are optimised automatically. Check the Preview tab before saving.
          </span>
        </>
      )}

      {tab === 'preview' && (
        <div
          style={{
            border: '1px solid #e5e7eb', borderRadius: 7, padding: '18px 22px', background: 'white',
            fontSize: '0.9375rem', lineHeight: 1.7, color: '#374151', minHeight: 200, maxWidth: '72ch',
          }}
          className="cms-prose"
          // Rendered through the SAME sanitizer the storefront uses, so the
          // preview can never show markup that publishing would strip.
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) || '<p style="color:#9ca3af">Nothing to preview yet.</p>' }}
        />
      )}

      {error && <span style={{ fontSize: '0.75rem', color: '#ef4444', display: 'block', marginTop: 6 }}>{error}</span>}

      <input
        ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f); e.target.value = ''; }}
      />
    </div>
  );
}
