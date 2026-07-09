// ============================================================================
// GET /feed.xml — RSS 2.0 feed of the blog (newest 30 posts).
// Built for social schedulers (Buffer, Zapier, IFTTT) that watch an RSS URL
// and auto-queue new posts to Instagram/Facebook, and for feed readers. Uses
// the same tile projection as /blog, so it stays light no matter how long
// the posts get.
// ============================================================================

import { getBlogPosts } from '@/lib/supabase';
import { SITE_URL } from '@/lib/seo';

export const revalidate = 3600; // new posts appear within the hour

function esc(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!),
  );
}

export async function GET() {
  const posts = (await getBlogPosts()).slice(0, 30);

  const items = posts.map(p => `    <item>
      <title>${esc(p.title)}</title>
      <link>${SITE_URL}/blog/${esc(p.slug)}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${esc(p.slug)}</guid>
      ${p.excerpt ? `<description>${esc(p.excerpt)}</description>` : ''}
      ${p.category ? `<category>${esc(p.category)}</category>` : ''}
      ${p.date ? `<pubDate>${new Date(p.date).toUTCString()}</pubDate>` : ''}
      ${p.image_url ? `<enclosure url="${esc(p.image_url)}" type="image/jpeg" length="0"/>` : ''}
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Yellow Pink Journal</title>
    <link>${SITE_URL}/blog</link>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Skincare, makeup and wellness guides for Pakistan — from Yellow Pink.</description>
    <language>en</language>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
