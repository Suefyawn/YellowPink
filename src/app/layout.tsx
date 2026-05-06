import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';
import { SiteChrome } from '@/components/layout/SiteChrome';

export const metadata: Metadata = {
  title: 'Yellow Pink — Imported Beauty & Wellness',
  description: 'International skincare, makeup, and clinical-grade nutraceuticals. Now in Pakistan with COD.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteChrome>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
