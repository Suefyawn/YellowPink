import type { MetadataRoute } from 'next';

// Web App Manifest — makes the storefront installable as a PWA on mobile.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Yellow Pink',
    short_name: 'Yellow Pink',
    description: 'Imported beauty, skincare, and wellness — Pakistan.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#FFFCF7',
    theme_color: '#F7C948',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    categories: ['shopping', 'lifestyle', 'beauty'],
    lang: 'en-PK',
  };
}
