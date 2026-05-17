import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { sanitizeHtml } from '@/lib/sanitize';
import { pageMeta } from '@/lib/seo';
import type { Page } from '@/types';

// Static content imported from WordPress (About, Privacy, Terms, FAQ…).
// Slugs come from wp_pages.slug — the same slug WP used, so links + redirects
// stay stable.

async function loadPage(slug: string): Promise<Page | null> {
  const { data } = await supabase
    .from('pages')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  return (data as Page | null) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) return {};
  return pageMeta({
    title: page.meta_title ?? page.title,
    description: page.meta_description ?? page.excerpt ?? page.title,
    path: `/page/${page.slug}`,
  });
}

export default async function StaticPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await loadPage(slug);
  if (!page) notFound();

  // body_html is sanitised once at import-time (see importer) but defensively
  // re-sanitise here in case content was edited via raw SQL.
  const safeHtml = sanitizeHtml(page.body_html);

  return (
    <article className="container" style={{ padding: '64px var(--side)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <h1
          className="display-l"
          style={{ fontSize: '2.5rem', fontWeight: 500, margin: '0 0 32px', letterSpacing: '-0.025em' }}
        >
          {page.title}
        </h1>
        <div
          className="body-text"
          style={{ color: 'var(--ink-700)', lineHeight: 1.7, fontSize: '1.0625rem' }}
          dangerouslySetInnerHTML={{ __html: safeHtml }}
        />
      </div>
    </article>
  );
}
