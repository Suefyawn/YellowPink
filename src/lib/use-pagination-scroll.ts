'use client';

// Pagination scroll + focus handling for the product listings.
//
// Both listings intercept their own ?page=N links and update the route with
// { scroll: false }. That is right for a filter change (ticking a brand
// should not throw the viewport to the top) but the same path handled page
// changes, so "next" left the shopper exactly where they clicked: at the
// pagination control, beside the footer, looking at the end of the new page.
//
// What a page change should do, and what this hook does:
//   • scroll to the top of the RESULTS GRID, not the page, so the filter bar
//     and count stay in view and the shopper keeps their bearings;
//   • land below the sticky header, measured from the real element rather
//     than a hard-coded offset, so a promo banner or the mobile header height
//     never hides the first row;
//   • run AFTER the new tiles have committed. The old code scrolled one frame
//     after the click, before the new page streamed in; the codebase already
//     records that a smooth scroll gets aborted by that layout shift. Keying
//     the effect on the page number runs it post-commit, and the jump is
//     instant, which is also what the big storefronts do on a page flip;
//   • move keyboard focus to the grid (preventScroll, we already positioned
//     it) so keyboard and screen-reader users arrive at the results rather
//     than staying on a button that has since changed meaning;
//   • announce "Page N of M" through a polite live region.
//
// Filters do none of this. The click handlers that mean "change page" call
// markIntent() first; a page value that changes any other way (a filter
// resetting to page 1, a Back navigation) is left alone.
//
// The hook owns scroll and focus only. Pushing the URL (so Back returns to
// the previous page) happens in the page-click handler itself, so nothing
// here depends on effect ordering. The live-region text is built by the
// caller from scrolledPage + its own totalPages.

import { useEffect, useRef, useState, type RefObject } from 'react';

export interface PaginationScroll<T extends HTMLElement> {
  /** Attach to the grid container (give it tabIndex={-1}). */
  gridRef: RefObject<T | null>;
  /** Call from every prev/next/number handler before changing the page. */
  markIntent: () => void;
  /** The page the grid was last scrolled to after a pagination click, or
   *  null before the first one. Render "Showing page N of M" from it in a
   *  `.sr-only` element with aria-live="polite". */
  scrolledPage: number | null;
}

function stickyHeaderHeight(): number {
  if (typeof document === 'undefined') return 0;
  const el = document.querySelector<HTMLElement>('header');
  if (!el) return 0;
  const pos = getComputedStyle(el).position;
  return pos === 'sticky' || pos === 'fixed' ? el.getBoundingClientRect().height : 0;
}

export function usePaginationScroll<T extends HTMLElement>(page: number): PaginationScroll<T> {
  const gridRef = useRef<T | null>(null);
  const intentRef = useRef(false);
  const [scrolledPage, setScrolledPage] = useState<number | null>(null);

  useEffect(() => {
    if (!intentRef.current) return;
    intentRef.current = false;
    const grid = gridRef.current;
    if (!grid) return;
    const top = grid.getBoundingClientRect().top + window.scrollY - stickyHeaderHeight() - 16;
    window.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    grid.focus({ preventScroll: true });
    setScrolledPage(page);
  }, [page]);

  return {
    gridRef,
    markIntent: () => { intentRef.current = true; },
    scrolledPage,
  };
}
