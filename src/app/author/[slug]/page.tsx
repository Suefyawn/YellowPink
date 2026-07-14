// Author profile pages (SEO audit D3): one page per REAL blog byline (see
// lib/authors.ts — no invented personas), giving the Article JSON-LD author
// node a resolvable url and the bylines an on-site anchor.
//
// ISR like the other profile/archive routes. This segment deliberately has NO
// loading.tsx: a loading boundary makes Next stream a 200 shell before the
// slug is resolved, turning an unknown slug into a soft-404. notFound() is
// thrown in generateMetadata so invalid /author/* URLs (incl. legacy
// WordPress /author/<user> ones) return a real HTTP 404.
export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AUTHORS, authorBySlug } from '@/lib/authors';
import { supabase, isDemo, getSiteSettings } from '@/lib/supabase';
import { redirectIfMapped } from '@/lib/redirects';
import { pageMeta, jsonLd, breadcrumbLd, absoluteUrl, ORGANIZATION_ID } from '@/lib/seo';
import { socialSameAs } from '@/lib/socials';
import { formatBlogDate } from '@/lib/dates';
import { Overline } from '@/components/ui/Overline';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export function generateStaticParams() {
  return AUTHORS.map(a => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const a = authorBySlug(slug);
  // Unknown author → resolve HERE, in metadata (mirrors the tag/brand routes):
  // honour a manual redirect mapping first, then a real 404.
  if (!a) {
    await redirectIfMapped(`/author/${slug}`);
    notFound();
  }
  return pageMeta({
    title: `${a.name}, Author`,
    description: a.bio.slice(0, 160),
    path: `/author/${a.slug}`,
  });
}

interface AuthorPostRow { slug: string; title: string; date: string | null; category: string | null }

async function postsByAuthor(dbNames: string[]): Promise<AuthorPostRow[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title, date, category')
    .in('author', dbNames)
    .order('date', { ascending: false })
    .limit(500);
  return (data ?? []) as AuthorPostRow[];
}

export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const a = authorBySlug(slug);
  if (!a) {
    await redirectIfMapped(`/author/${slug}`);
    notFound();
  }

  const [posts, settings] = await Promise.all([
    postsByAuthor(a.dbNames),
    getSiteSettings(),
  ]);

  // Person-or-Organization node for the author entity. sameAs points at the
  // store's public social profiles (owner-managed via Settings) — for the
  // in-house editorial team those ARE its profiles.
  const sameAs = socialSameAs(settings);
  const authorLd = {
    '@context': 'https://schema.org',
    '@type': a.type,
    name: a.name,
    description: a.bio,
    url: absoluteUrl(`/author/${a.slug}`),
    ...(sameAs.length ? { sameAs } : {}),
    ...(a.type === 'Organization'
      ? { parentOrganization: { '@id': ORGANIZATION_ID } }
      : { worksFor: { '@id': ORGANIZATION_ID } }),
  };

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Blog', path: '/blog' },
    { name: a.name, path: `/author/${a.slug}` },
  ];

  const initials = a.name
    .replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '')
    .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'YP';

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(authorLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(crumbs)) }} />
      <section style={{ padding: '40px var(--side) 64px' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Breadcrumbs items={crumbs} />

          <div style={{ display: 'flex', gap: 20, alignItems: 'center', margin: '24px 0 28px', flexWrap: 'wrap' }}>
            <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--ink-700)' }}>{initials}</span>
            </div>
            <div>
              <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>Author</Overline>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, margin: 0 }}>{a.name}</h1>
            </div>
          </div>

          <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.75, marginBottom: 20 }}>{a.bio}</p>

          <p className="small-text" style={{ color: 'var(--ink-500)', marginBottom: 32 }}>
            Health and supplement guides are checked by the doctors on our{' '}
            <Link href="/medical-review-board" style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>
              Medical Review Board
            </Link>.
          </p>

          {posts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 500, margin: '0 0 14px' }}>
                Articles by {a.name} ({posts.length})
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {posts.map(p => (
                  <li key={p.slug}>
                    <Link href={`/blog/${p.slug}`} style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600, textDecoration: 'none' }}>{p.title}</Link>
                    {p.date && (
                      <span className="small-text" style={{ color: 'var(--ink-500)', marginLeft: 8 }}>{formatBlogDate(p.date)}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
