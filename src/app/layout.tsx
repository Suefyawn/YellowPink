export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { getSiteSettings } from '@/lib/supabase';

export const metadata: Metadata = {
  title: 'Yellow Pink — Imported Beauty & Wellness',
  description: 'International skincare, makeup, and clinical-grade nutraceuticals. Now in Pakistan with COD.',
  themeColor: '#F7C948',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    siteName: 'Yellow Pink',
    locale: 'en_PK',
    type: 'website',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <body>
        <Providers>
          <SiteChrome settings={settings}>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
