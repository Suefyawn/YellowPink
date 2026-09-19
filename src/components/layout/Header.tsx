'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { HeaderShell } from './HeaderShell';
import { canonicalCategory, type Taxon } from '@/lib/category-taxonomy';

/** Thin wrapper: the only thing this component does is turn the route
 *  (pathname + search params) into "what's active" answers for HeaderShell.
 *
 *  The query string is read after mount rather than through useSearchParams():
 *  that hook suspends during static rendering, and on Workers (vinext) every
 *  cached page renders that way, so the HTML carried the header twice (the
 *  Suspense fallback plus the hidden streamed copy: +18 links on every page,
 *  found by scripts/seo-parity.ts). The server now renders the same markup
 *  once with only pathname-based highlighting; the taxon/category highlight
 *  on /shop?taxon= pages appears right after hydration. */
export function Header() {
  const pathname = usePathname();
  const [searchParams, setSearchParams] = useState(() => new URLSearchParams());
  // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate post-mount read, see the note above
  useEffect(() => { setSearchParams(new URLSearchParams(window.location.search)); }, [pathname]);
  const curCat = searchParams.get('category');

  // Decide which nav item is "active" for the current URL. We match on
  // pathname + category query so /shop?category=Makeup highlights "Makeup",
  // but plain /shop highlights "Shop", and any /blog/* highlights "Blog".
  function isActiveLink(href: string): boolean {
    const [hPath, hQuery] = href.split('?');
    if (hPath !== pathname && !(hPath === '/blog' && pathname.startsWith('/blog/'))) return false;
    if (!hQuery) {
      // /shop active only when there's no taxon / category / sale param.
      if (hPath === '/shop') {
        return !searchParams.get('taxon') && !curCat && !searchParams.get('on_sale');
      }
      return true;
    }
    const want = new URLSearchParams(hQuery);
    for (const [k, v] of want.entries()) {
      if (searchParams.get(k) !== v) return false;
    }
    return true;
  }

  // Leaf-category landings live at /category/<slug>; resolve the slug back
  // to its canonical label so nav highlighting keeps working there (the old
  // /shop?category= form still resolves via curCat for filtered views).
  const pathCat = pathname.startsWith('/category/')
    ? canonicalCategory(pathname.slice('/category/'.length).split('/')[0])
    : null;
  const activeCat = pathCat ?? curCat;

  function isTaxonActive(taxon: Taxon): boolean {
    return searchParams.get('taxon') === taxon.key || (!!activeCat && taxon.categories.includes(activeCat));
  }

  function isCategoryActive(cat: string): boolean {
    return activeCat === cat;
  }

  return (
    <HeaderShell
      navKey={`${pathname}?${searchParams.toString()}`}
      isActiveLink={isActiveLink}
      isTaxonActive={isTaxonActive}
      isCategoryActive={isCategoryActive}
    />
  );
}
