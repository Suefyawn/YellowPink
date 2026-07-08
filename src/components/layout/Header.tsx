'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { HeaderShell } from './HeaderShell';
import type { Taxon } from '@/lib/category-taxonomy';

/** Thin wrapper: the only thing this component does is turn the route
 *  (pathname + search params) into "what's active" answers for HeaderShell.
 *  useSearchParams() requires a Suspense boundary during static rendering
 *  (see SiteChrome), which is exactly why the actual markup lives in
 *  HeaderShell, not here, HeaderFallback renders that same markup with no
 *  router hooks at all so the Suspense fallback is pixel-identical to this
 *  and swapping the two causes no layout shift. */
export function Header() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  function isTaxonActive(taxon: Taxon): boolean {
    return searchParams.get('taxon') === taxon.key || (!!curCat && taxon.categories.includes(curCat));
  }

  function isCategoryActive(cat: string): boolean {
    return curCat === cat;
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
