import { HeaderShell } from './HeaderShell';

const inactive = () => false;

/** Suspense fallback for <Header/> (see SiteChrome). Renders the exact same
 *  HeaderShell markup with every "is this active" answer forced to false, no
 *  usePathname/useSearchParams calls, so it's safe inside the static shell
 *  during prerendering. Because it's the same component at the same size,
 *  the moment the real, route-aware Header streams in there's no layout
 *  shift, just the active nav item lighting up, the "body loads, header pops
 *  in a beat later" jitter this replaced was HeaderShell's fallback being a
 *  bare `null`, which reserved no space at all. */
export function HeaderFallback() {
  return (
    <HeaderShell
      navKey=""
      isActiveLink={inactive}
      isTaxonActive={inactive}
      isCategoryActive={inactive}
    />
  );
}
