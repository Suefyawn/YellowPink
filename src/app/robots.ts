import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/account/', '/checkout', '/thank-you'],
      },
    ],
    sitemap: 'https://yellowpink.pk/sitemap.xml',
  };
}
