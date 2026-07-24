'use client';

import { useSearch } from '@/context/SearchContext';

// Visible, tappable search entry on the mobile homepage. The behaviour data
// showed search is the single most-used homepage interaction (more events
// than product-card clicks) on 82% mobile traffic — yet the only entry point
// was a small header icon. This pill opens the existing SearchOverlay; no new
// search backend. Hidden on desktop, where the header field is prominent.
export function HomeSearchPill() {
  const { setSearchOpen } = useSearch();
  return (
    <div className="home-search-pill-wrap">
      <style>{`
        .home-search-pill-wrap { display: none; }
        @media (max-width: 768px) {
          .home-search-pill-wrap { display: block; padding: 4px var(--side) 14px; background: var(--paper); }
        }
        .home-search-pill {
          display: flex; align-items: center; gap: 10px; width: 100%;
          padding: 12px 16px; border: 1px solid var(--line); border-radius: 999px;
          background: var(--paper2, #faf6ee); color: var(--ink-500);
          font-family: var(--font-ui); font-size: 0.9375rem; text-align: left; cursor: pointer;
        }
      `}</style>
      <button type="button" className="home-search-pill" onClick={() => setSearchOpen(true)} aria-label="Search products">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
        </svg>
        Search CeraVe, sunscreen, vitamins…
      </button>
    </div>
  );
}
