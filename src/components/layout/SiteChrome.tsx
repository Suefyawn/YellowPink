'use client';
import { Suspense } from 'react';
import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { PromoBanner } from './PromoBanner';
import { Header } from './Header';
import { Footer } from './Footer';
import { BackToTop } from '@/components/ui/BackToTop';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import { ScrollToTop } from './ScrollToTop';
import { WhatsAppFab } from './WhatsAppFab';
import { socialLinks } from '@/lib/socials';
import { parseCommerceConfig, freeShippingSentence } from '@/lib/commerce';

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
}

export function SiteChrome({ children, settings, searchTrending, searchCategories, footerCollections = [] }: SiteChromeProps) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return <>{children}</>;

  // Both bars are settings-driven (Admin → Settings → Homepage). The
  // audience-targeted promos table that used to take precedence here was
  // removed 2026-07-02 — it was never used (zero rows authored) and
  // duplicated these simpler settings.
  const topBarActive = settings.announcement_active === 'true';
  const heroStripActive = settings.promo_active === 'true';

  return (
    <>
      <ScrollToTop />
      {topBarActive && (
        <AnnouncementBar
          text={settings.announcement_text ?? freeShippingSentence(parseCommerceConfig(settings))}
          bgColor={settings.announcement_color ?? '#111827'}
        />
      )}

      {heroStripActive && (
        <PromoBanner
          label={settings.promo_label ?? 'Sale'}
          headline={settings.promo_headline ?? ''}
          subline={settings.promo_subline ?? ''}
          ctaText={settings.promo_cta_text ?? 'Shop Sale'}
          ctaUrl={settings.promo_cta_url ?? '/shop'}
          bgColor={settings.promo_bg_color ?? '#E8487F'}
          textColor={settings.promo_text_color ?? '#ffffff'}
          endDate={settings.promo_end_date ?? ''}
        />
      )}

      {/* Header reads useSearchParams() to highlight the active nav item;
          without a Suspense boundary, static prerender bails on every
          route that doesn't itself opt out. Wrapping here lets routes
          like /forgot-password / /reset-password / /track / /login
          prerender cleanly while Header still hydrates on the client. */}
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      {children}
      <Footer socials={socialLinks(settings)} collections={footerCollections} />
      <MiniCart />
      <SearchOverlay trending={searchTrending} categories={searchCategories} />
      <KeyboardShortcuts />
      <BackToTop />
      <WhatsAppFab number={settings.store_whatsapp?.trim() || settings.store_phone?.trim() || undefined} />
    </>
  );
}
