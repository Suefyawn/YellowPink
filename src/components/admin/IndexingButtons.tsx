'use client';

import { useTransition } from 'react';
import { useToast } from '@/components/admin/Toast';
import { requestIndexing, resubmitAllUrls } from '@/app/admin/actions';

const btn: React.CSSProperties = {
  padding: '10px 18px', background: 'white', color: '#374151',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 7,
};

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

/** Per-item "Submit to search engines" button. `path` is a storefront path
 *  like "/blog/my-post" or "/product/my-slug". */
export function SubmitToIndexButton({ path }: { path: string }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await requestIndexing(path);
          toast(r.message, r.ok ? 'success' : 'error');
        })
      }
      style={{ ...btn, opacity: pending ? 0.6 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}
      title="Ping Google + Bing/Yandex to (re)crawl this page"
    >
      <SearchIcon />
      {pending ? 'Submitting…' : 'Submit to index'}
    </button>
  );
}

/** Bulk "resubmit everything" button — submits the whole catalogue + blog to
 *  IndexNow in one go. */
export function ResubmitAllButton() {
  const toast = useToast();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const r = await resubmitAllUrls();
          toast(r.message, r.ok ? 'success' : 'error');
        })
      }
      style={{ ...btn, opacity: pending ? 0.6 : 1, cursor: pending ? 'not-allowed' : 'pointer' }}
      title="Submit the whole site to IndexNow (Bing/Yandex)"
    >
      <SearchIcon />
      {pending ? 'Submitting…' : 'Resubmit all to index'}
    </button>
  );
}
