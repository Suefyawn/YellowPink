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
    // PNG icons matching yellowpink.pk's actual brand mark (the hand-drawn
     // yellow flower scribble). 192/512 are the PWA-required pair; the
     // maskable variant lets Android render us with its themed background.
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-192-maskable.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    categories: ['shopping', 'lifestyle', 'beauty'],
    lang: 'en-PK',
  };
}
