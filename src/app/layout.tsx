export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import '@/styles/globals.css';
import { Providers } from '@/context/Providers';
import { SiteChrome } from '@/components/layout/SiteChrome';
import { WebVitalsReporter } from '@/components/layout/WebVitalsReporter';
import { getSiteSettings } from '@/lib/supabase';
import { SITE_URL, SITE_NAME, jsonLd, organizationLd, websiteLd } from '@/lib/seo';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} — Imported Beauty & Wellness`,
    template: `%s | ${SITE_NAME}`,
  },
  description: 'International skincare, makeup, and clinical-grade nutraceuticals. Now in Pakistan with COD.',
  applicationName: SITE_NAME,
  themeColor: '#F7C948',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
  openGraph: {
    siteName: SITE_NAME,
    locale: 'en_PK',
    type: 'website',
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
  },
  alternates: {
    canonical: SITE_URL,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const settings = await getSiteSettings();
  return (
    <html lang="en">
      <head>
        {/* Site-wide JSON-LD: Organization + WebSite (sitelinks search box). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(organizationLd()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(websiteLd()) }}
        />
      </head>
      <body>
        <WebVitalsReporter />
        <Providers>
          <SiteChrome settings={settings}>{children}</SiteChrome>
        </Providers>
      </body>
    </html>
  );
}
