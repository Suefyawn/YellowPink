'use client';
import { Suspense, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { SeasonalBar } from './SeasonalBar';
import { activeSeasonalTheme, type SeasonalTheme } from '@/lib/seasonal-theme';
import { Header } from './Header';
import { HeaderFallback } from './HeaderFallback';
import { Footer } from './Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ScrollToTop } from './ScrollToTop';
import { WhatsAppFab } from './WhatsAppFab';
import { socialLinks } from '@/lib/socials';
import { parseCommerceConfig, freeShippingSentence, freeShippingSentenceCompact } from '@/lib/commerce';
import type { Product } from '@/types';

interface SiteChromeProps {
  children: React.ReactNode;
  settings: Record<string, string>;
  /** Server-resolved data for the search overlay. Passed through here
   *  (rather than rendered as its own server-component wrapper) because
   *  SiteChrome is `'use client'`, an async server component cannot live
   *  inside a client tree without a Suspense boundary. */
  searchTrending: string[];
  searchCategories: string[];
  /** Published collections (server-resolved) for the footer's Collections
   *  column. Slim {slug,title} pairs — the footer only needs links. */
  footerCollections?: { slug: string; title: string }[];
  /** Bestseller pool (server-resolved) for the mini-cart's cross-sell row. */
  cartCrossSell?: Product[];
  /** Seasonal theme as resolved by the SERVER render (initial paint value).
   *  The chrome sits in the route's long-cached prerendered shell, so this
   *  prop can be stale around a scheduled window's edges — the effect below
   *  re-resolves with the CLIENT clock and corrects bar + palette. */
  seasonal?: SeasonalTheme | null;
}

export function SiteChrome({ children, settings, searchTrending, searchCategories, footerCollections = [], cartCrossSell = [], seasonal = null }: SiteChromeProps) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin');

  // Live seasonal state. Initialised from the server prop (matches the shell
  // HTML, so hydration is clean), then re-resolved on the client clock: the
  // shell is CDN-cached far longer than the window edges, so the client is
  // the only place the Aug-10-00:00 style flip can land on time. The window
  // dates ride in with `settings`; only the clock is read here. Re-checked
  // each minute so a tab left open crosses the boundary too.
  const [liveSeasonal, setLiveSeasonal] = useState<SeasonalTheme | null>(seasonal);
  useEffect(() => {
    if (isAdmin) return; // storefront skin only — never theme the admin
    const sync = () => {
      const t = activeSeasonalTheme(settings, new Date());
      setLiveSeasonal(t);
      document.documentElement.setAttribute('data-theme', t?.key ?? 'default');
    };
    sync();
    const id = setInterval(sync, 60_000);
    return () => clearInterval(id);
  }, [settings, isAdmin]);

  if (isAdmin) return <>{children}</>;

  // The one storefront banner: the settings-driven announcement bar
  // (Admin → Settings → Homepage). The promos table AND the richer
  // settings-driven promo strip were removed 2026-07-02 — neither was
  // used, and the owner explicitly retired the strip.
  const topBarActive = settings.announcement_active === 'true';

  return (
    <>
      <ScrollToTop />
      {/* Seasonal event bar takes the top slot while a theme is active (and
          has a message); the everyday announcement bar yields to it. */}
      {liveSeasonal?.message ? (
        <SeasonalBar
          message={liveSeasonal.message}
          compactMessage={liveSeasonal.compactMessage ?? liveSeasonal.message}
          coupon={liveSeasonal.coupon}
          bgColor={liveSeasonal.barColor}
          textColor={liveSeasonal.textColor}
        />
      ) : topBarActive && (
        <AnnouncementBar
          text={settings.announcement_text ?? freeShippingSentence(parseCommerceConfig(settings))}
          // Compact one-liner only for the default config-derived sentence;
          // owner-authored announcement_text renders unchanged at all widths.
          compactText={settings.announcement_text != null ? undefined : freeShippingSentenceCompact(parseCommerceConfig(settings))}
          bgColor={settings.announcement_color ?? '#111827'}
        />
      )}

      {/* Header reads useSearchParams() to highlight the active nav item;
          without a Suspense boundary, static prerender bails on every
          route that doesn't itself opt out. Wrapping here lets routes
          like /forgot-password / /reset-password / /track / /login
          prerender cleanly while Header still hydrates on the client.
          The fallback is the SAME header markup (via HeaderShell) with
          nav-highlighting forced off, not `null`, a `null` fallback
          reserved zero height for the static shell and made the real
          header visibly pop in a beat later, the "body loads, header
          jitters in after" bug. Matching size = no layout shift either
          way. */}
      <Suspense fallback={<HeaderFallback />}>
        <Header />
      </Suspense>
      {children}
      <Footer socials={socialLinks(settings)} collections={footerCollections} />
      <MiniCart crossSell={cartCrossSell} />
      <SearchOverlay trending={searchTrending} categories={searchCategories} />
      <KeyboardShortcuts />
      <BackToTop />
      <WhatsAppFab number={settings.store_whatsapp?.trim() || settings.store_phone?.trim() || undefined} />
    </>
  );
}
