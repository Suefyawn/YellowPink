'use client';

import { useState } from 'react';
import { checkUrlIndexStatus } from '@/app/admin/settings/integrations/google-actions';
import { PK_TZ } from '@/lib/dates';

type Result = Awaited<ReturnType<typeof checkUrlIndexStatus>>;

// Per-URL "is this indexed by Google?" check via the URL Inspection API.
// There's no API to *force* indexing; this reports current status so you can
// confirm whether a page (e.g. one you just fixed/redirected) is in the index.
export function UrlIndexChecker() {
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Result | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true); setRes(null);
    try { setRes(await checkUrlIndexStatus(url)); }
    finally { setBusy(false); }
  }

  const indexed = res?.ok && /index/i.test(res.coverage ?? '') && !/not indexed/i.test(res.coverage ?? '');

  return (
    <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16 }}>
      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Check a page’s index status</label>
      <p style={{ margin: '0 0 10px', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.5 }}>
        Paste a URL or path (e.g. <code>/blog/your-post</code>) to see whether Google has it indexed.
      </p>
      <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={url} onChange={e => setUrl(e.target.value)} disabled={busy}
          placeholder="/product/your-product"
          style={{ flex: '1 1 240px', minWidth: 0, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.8125rem', outline: 'none', fontFamily: 'monospace' }}
        />
        <button type="submit" disabled={busy} style={{ padding: '8px 16px', fontSize: '0.8125rem', fontWeight: 600, background: '#111827', color: '#fff', border: 'none', borderRadius: 7, cursor: busy ? 'wait' : 'pointer' }}>
          {busy ? 'Checking…' : 'Check'}
        </button>
      </form>
      {res && (
        res.ok ? (
          <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 8, fontSize: '0.8125rem', background: indexed ? '#f0fdf4' : '#fffbeb', border: `1px solid ${indexed ? '#bbf7d0' : '#fde68a'}`, color: indexed ? '#166534' : '#92400e' }}>
            <strong>{res.coverage}</strong>
            <div style={{ marginTop: 2, color: '#6b7280' }}>
              {res.verdict && <>Verdict: {res.verdict}. </>}
              {res.lastCrawl ? `Last crawled ${new Date(res.lastCrawl).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: PK_TZ })}.` : 'Not crawled yet.'}
            </div>
          </div>
        ) : (
          <div role="alert" style={{ marginTop: 10, fontSize: '0.8125rem', color: '#dc2626' }}>{res.error}</div>
        )
      )}
    </div>
  );
}
