'use client';
import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { PromoBanner } from './PromoBanner';
import { Header } from './Header';
import { Footer } from './Footer';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlay } from '@/components/search/SearchOverlay';
import { KeyboardShortcuts } from './KeyboardShortcuts';
import type { Promo } from '@/lib/promos';

interface SiteChromeProps {
  children: React.ReactNode;
  settings: Record<string, string>;
  /** Resolved by the server layout for the current visitor's audience.
   *  If null, we fall back to the legacy site_settings-based config so the
   *  bars still render before the merchant has authored any rows. */
  promos?: { top_bar: Promo | null; hero_strip: Promo | null } | null;
  /** Server-resolved data for the search overlay. Passed through here
   *  (rather than rendered as its own server-component wrapper) because
   *  SiteChrome is `'use client'` — an async server component cannot live
   *  inside a client tree without a Suspense boundary. */
  searchTrending: string[];
  searchCategories: string[];
}

export function SiteChrome({ children, settings, promos, searchTrending, searchCategories }: SiteChromeProps) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return <>{children}</>;

  // ── Top bar (thin announcement) ──
  // Prefer a live `promos` row for the slot; otherwise fall back to the
  // settings-driven AnnouncementBar.
  const topBar = promos?.top_bar;
  const topBarSettingsActive = settings.announcement_active === 'true';

  // ── Hero strip (richer promo card) ──
  const heroStrip = promos?.hero_strip;
  const heroStripSettingsActive = settings.promo_active === 'true';

  return (
    <>
      {topBar ? (
        <AnnouncementBar
          text={topBar.headline}
          bgColor={topBar.bg_color ?? '#111827'}
        />
      ) : topBarSettingsActive && (
        <AnnouncementBar
          text={settings.announcement_text ?? 'Free delivery on orders over PKR 2,500 — COD Nationwide'}
          bgColor={settings.announcement_color ?? '#111827'}
        />
      )}

      {heroStrip ? (
        <PromoBanner
          label={heroStrip.label ?? 'New'}
          headline={heroStrip.headline}
          subline={heroStrip.subline ?? ''}
          ctaText={heroStrip.cta_text ?? ''}
          ctaUrl={heroStrip.cta_url ?? '/shop'}
          bgColor={heroStrip.bg_color ?? '#E8487F'}
          textColor={heroStrip.text_color ?? '#ffffff'}
          endDate={heroStrip.show_countdown ? (heroStrip.end_at ?? '') : ''}
        />
      ) : heroStripSettingsActive && (
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

      <Header />
      {children}
      <Footer />
      <MiniCart />
      <SearchOverlay trending={searchTrending} categories={searchCategories} />
      <KeyboardShortcuts />
    </>
  );
}
