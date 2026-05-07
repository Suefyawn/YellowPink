'use client';
import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { PromoBanner } from './PromoBanner';
import { Header } from './Header';
import { Footer } from './Footer';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlayWrapper } from '@/components/search/SearchOverlayWrapper';
import { KeyboardShortcuts } from './KeyboardShortcuts';

export function SiteChrome({
  children,
  settings,
}: {
  children: React.ReactNode;
  settings: Record<string, string>;
}) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return <>{children}</>;
  return (
    <>
      {settings.announcement_active === 'true' && (
        <AnnouncementBar
          text={settings.announcement_text ?? 'Free delivery on orders over PKR 2,500 — COD Nationwide'}
          bgColor={settings.announcement_color ?? '#111827'}
        />
      )}
      {settings.promo_active === 'true' && (
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
      <SearchOverlayWrapper />
      <KeyboardShortcuts />
    </>
  );
}
