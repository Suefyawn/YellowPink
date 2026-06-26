'use client';

import { useState } from 'react';

// Direct photo upload for the Medical Review Board (apply form + reviewer
// dashboard) — a clinician attaches an image instead of pasting a URL. Uploads
// to /api/upload/reviewer and keeps the resulting public URL in a hidden input
// (name defaults to `photo_url`) so it submits with the surrounding form. Works
// inside a plain server-action <form> because it's a self-contained client
// island.
export function PhotoUpload({
  name = 'photo_url',
  defaultUrl = '',
}: { name?: string; defaultUrl?: string }) {
  const [url, setUrl] = useState(defaultUrl);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function onFile(file: File) {
    setStatus('uploading'); setMsg('');
    const fd = new FormData();
    fd.append('file', file);
    try {
      const res = await fetch('/api/upload/reviewer', { method: 'POST', body: fd });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) { setStatus('error'); setMsg(data.error ?? 'Upload failed.'); return; }
      setUrl(data.url); setStatus('idle');
    } catch {
      setStatus('error'); setMsg('Upload failed. Please try again.');
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: 'var(--paper2, #f3f4f6)', border: '1px solid var(--line, #e5e7eb)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={url} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span aria-hidden="true" style={{ fontSize: 22, color: '#9ca3af' }}>👤</span>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <label style={{ display: 'inline-block', padding: '8px 14px', border: '1px solid var(--line, #d1d5db)', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: status === 'uploading' ? 'wait' : 'pointer', background: '#fff', color: 'var(--ink-900, #111827)' }}>
              {status === 'uploading' ? 'Uploading…' : url ? 'Change photo' : 'Upload photo'}
              <input
                type="file" accept="image/jpeg,image/png,image/webp" hidden
                disabled={status === 'uploading'}
                onChange={e => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ''; }}
              />
            </label>
            {url && status !== 'uploading' && (
              <button type="button" onClick={() => setUrl('')} style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: '0.8125rem', cursor: 'pointer', textDecoration: 'underline' }}>
                Remove
              </button>
            )}
          </div>
          {status === 'error'
            ? <span role="alert" style={{ fontSize: '0.75rem', color: 'var(--error, #dc2626)' }}>{msg}</span>
            : <span style={{ fontSize: '0.75rem', color: 'var(--ink-500, #6b7280)' }}>JPG, PNG or WebP, up to 4&nbsp;MB.</span>}
        </div>
      </div>
    </div>
  );
}
