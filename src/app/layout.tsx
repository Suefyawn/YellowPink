import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';
import { AnnouncementBar } from '@/components/layout/AnnouncementBar';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { MiniCart } from '@/components/cart/MiniCart';
import { SearchOverlayWrapper } from '@/components/search/SearchOverlayWrapper';
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts';

export const metadata: Metadata = {
  title: 'Yellow Pink — Imported Beauty & Wellness',
  description: 'International skincare, makeup, and clinical-grade nutraceuticals. Now in Pakistan with COD.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AnnouncementBar />
          <Header />
          {children}
          <Footer />
          <MiniCart />
          <SearchOverlayWrapper />
          <KeyboardShortcuts />
        </Providers>
      </body>
    </html>
  );
}
