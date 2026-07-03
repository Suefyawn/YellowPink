'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

export interface ManualTocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

// Reader chrome for the rendered user manual: a sticky sidebar table of
// contents (built server-side from the heading ids) with a filter box and
// scroll-position tracking, plus a back-to-top button. On phones the TOC
// collapses into a <details> above the article. The markdown stays the
// single source of truth — this only navigates it.
export function ManualViewer({ html, toc }: { html: string; toc: ManualTocEntry[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [showTop, setShowTop] = useState(false);
  const articleRef = useRef<HTMLElement>(null);

  // Track which section heading is currently at the top of the viewport.
  useEffect(() => {
    const headings = Array.from(articleRef.current?.querySelectorAll('h2[id], h3[id]') ?? []);
    if (headings.length === 0) return;
    const observer = new IntersectionObserver(
      entries => {
        for (const e of entries) {
          if (e.isIntersecting) { setActive(e.target.id); break; }
        }
      },
      { rootMargin: '0px 0px -75% 0px' },
    );
    headings.forEach(h => observer.observe(h));
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { observer.disconnect(); window.removeEventListener('scroll', onScroll); };
  }, []);

  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return toc;
    return toc.filter(t => t.text.toLowerCase().includes(q));
  }, [toc, filter]);

  const tocList = (compact: boolean) => (
    <nav aria-label="Manual contents">
      <input
        type="search"
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Find a section…"
        aria-label="Filter sections"
        style={{
          width: '100%', padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', marginBottom: 10, background: 'white', color: '#111827', outline: 'none',
        }}
      />
      <div style={{ maxHeight: compact ? 320 : 'calc(100vh - 180px)', overflowY: 'auto', paddingRight: 4 }}>
        {visible.map(t => {
          const isActive = active === t.id;
          return (
            <a
              key={t.id}
              href={`#${t.id}`}
              style={{
                display: 'block', padding: '5px 10px', borderRadius: 6, textDecoration: 'none',
                fontSize: t.level === 2 ? '0.8125rem' : '0.75rem',
                fontWeight: t.level === 2 ? 600 : 400,
                marginLeft: t.level === 3 ? 12 : 0,
                color: isActive ? '#C5286A' : t.level === 2 ? '#111827' : '#6b7280',
                background: isActive ? '#fdf2f8' : 'transparent',
              }}
            >
              {t.text}
            </a>
          );
        })}
        {visible.length === 0 && (
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', padding: '4px 10px' }}>No sections match.</p>
        )}
      </div>
    </nav>
  );

  return (
    <div className="yp-manual-layout">
      {/* Mobile: collapsible contents above the article. */}
      <details className="yp-manual-toc-mobile" style={{
        background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
        padding: '12px 16px', marginBottom: 16,
      }}>
        <summary style={{ cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>
          Contents
        </summary>
        <div style={{ marginTop: 10 }}>{tocList(true)}</div>
      </details>

      {/* Desktop: sticky sidebar. */}
      <aside className="yp-manual-toc" aria-hidden={false}>
        <div style={{
          position: 'sticky', top: 24, background: 'white', borderRadius: 10,
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '16px 14px',
        }}>
          {tocList(false)}
        </div>
      </aside>

      <article
        ref={articleRef}
        className="yp-manual"
        style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '32px 36px', minWidth: 0 }}
        dangerouslySetInnerHTML={{ __html: html }}
      />

      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Back to top"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 20,
            width: 40, height: 40, borderRadius: '50%', border: '1px solid #e5e7eb',
            background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.12)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m18 15-6-6-6 6" />
          </svg>
        </button>
      )}

      <style>{`
        .yp-manual-layout { display: grid; grid-template-columns: 240px minmax(0, 920px); gap: 20px; align-items: start; }
        .yp-manual-toc-mobile { display: none; }
        @media (max-width: 1023px) {
          .yp-manual-layout { display: block; }
          .yp-manual-toc { display: none; }
          .yp-manual-toc-mobile { display: block; }
        }
        html { scroll-behavior: smooth; }
        .yp-manual h2[id], .yp-manual h3[id] { scroll-margin-top: 20px; }
      `}</style>
    </div>
  );
}
