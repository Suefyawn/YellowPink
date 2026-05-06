'use client';
import { usePathname } from 'next/navigation';
import { AnnouncementBar } from './AnnouncementBar';
import { Header } from './Header';
import { Footer } from './Footer';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlayWrapper } from '@/components/search/SearchOverlayWrapper';
import { KeyboardShortcuts } from './KeyboardShortcuts';

export function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith('/admin')) return <>{children}</>;
  return (
    <>
      <AnnouncementBar />
      <Header />
      {children}
      <Footer />
      <MiniCart />
      <SearchOverlayWrapper />
      <KeyboardShortcuts />
    </>
  );
}
