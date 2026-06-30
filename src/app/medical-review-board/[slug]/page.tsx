export const revalidate = 3600;

import type { Metadata } from 'next';
import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getReviewerBySlug } from '@/lib/reviewers';
import { supabase, isDemo } from '@/lib/supabase';
import { pageMeta, jsonLd, breadcrumbLd, absoluteUrl, ORGANIZATION_ID } from '@/lib/seo';
import { Overline } from '@/components/ui/Overline';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const r = await getReviewerBySlug(slug);
  if (!r) return { title: 'Reviewer not found', robots: { index: false, follow: true } };
  const cred = r.credentials ? `, ${r.credentials}` : '';
  return pageMeta({
    title: `${r.name}${cred}, Medical Reviewer`,
    description: r.bio?.slice(0, 160) || `${r.name}${cred} medically reviews Yellow Pink's health and supplement content${r.specialty ? ` in ${r.specialty}` : ''}.`,
    path: `/medical-review-board/${r.slug}`,
    image: r.photo_url ?? undefined,
  });
}

async function reviewedPosts(reviewerId: string): Promise<{ slug: string; title: string }[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('blog_posts')
    .select('slug, title')
    .eq('reviewer_id', reviewerId)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(50);
  return (data ?? []) as { slug: string; title: string }[];
}

export default async function ReviewerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = await getReviewerBySlug(slug);
  if (!r) notFound();

  const posts = await reviewedPosts(r.id);

  // Person schema, the verifiable expertise node. sameAs points at the
  // reviewer's external professional profile (PMDC / hospital / LinkedIn).
  const personLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: r.name,
    ...(r.credentials ? { honorificSuffix: r.credentials } : {}),
    ...(r.specialty ? { jobTitle: r.specialty } : {}),
    ...(r.bio ? { description: r.bio } : {}),
    ...(r.photo_url ? { image: r.photo_url } : {}),
    url: absoluteUrl(`/medical-review-board/${r.slug}`),
    ...(r.profile_url ? { sameAs: [r.profile_url] } : {}),
    ...(r.review_topics.length ? { knowsAbout: r.review_topics } : {}),
    ...(r.languages.length ? { knowsLanguage: r.languages } : {}),
    ...(r.education ? { alumniOf: { '@type': 'EducationalOrganization', name: r.education } } : {}),
    ...(r.affiliation ? { affiliation: { '@type': 'Organization', name: r.affiliation } } : {}),
    worksFor: { '@id': ORGANIZATION_ID },
  };

  // Compact "fact" rows shown under the bio, only the ones that are filled.
  const facts: { label: string; value: string }[] = [
    ...(r.specialty ? [{ label: 'Specialty', value: r.specialty }] : []),
    ...(r.affiliation ? [{ label: 'Practises at', value: r.affiliation }] : []),
    ...(r.experience_years ? [{ label: 'Experience', value: `${r.experience_years}+ years` }] : []),
    ...(r.education ? [{ label: 'Education', value: r.education }] : []),
    ...(r.languages.length ? [{ label: 'Languages', value: r.languages.join(', ') }] : []),
  ];

  return (
    <main className="fade-in">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(personLd) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd([
          { name: 'Home', path: '/' },
          { name: 'Medical Review Board', path: '/medical-review-board' },
          { name: r.name, path: `/medical-review-board/${r.slug}` },
        ])) }}
      />
      <section style={{ padding: '40px var(--side) 64px' }}>
        <div className="container" style={{ maxWidth: 720, margin: '0 auto' }}>
          <Breadcrumbs items={[
            { name: 'Home', path: '/' },
            { name: 'Medical Review Board', path: '/medical-review-board' },
            { name: r.name, path: `/medical-review-board/${r.slug}` },
          ]} />

          <div style={{ display: 'flex', gap: 20, alignItems: 'center', margin: '24px 0 28px', flexWrap: 'wrap' }}>
            {r.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.photo_url} alt={r.name} width={96} height={96} style={{ width: 96, height: 96, borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: '1.75rem', fontWeight: 600, color: 'var(--ink-700)' }}>
                  {r.name.replace(/^(dr|prof|mr|ms|mrs)\.?\s+/i, '').split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('')}
                </span>
              </div>
            )}
            <div>
              <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--ink-500)' }}>Medical Reviewer</Overline>
              <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, margin: '0 0 4px' }}>{r.name}</h1>
              {r.credentials && <div style={{ fontSize: '0.9375rem', color: 'var(--ink-700)', fontWeight: 600 }}>{r.credentials}</div>}
              {r.specialty && <div style={{ fontSize: '0.875rem', color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600, marginTop: 2 }}>{r.specialty}</div>}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 10px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, color: '#15803d' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
                Verified medical reviewer
              </div>
            </div>
          </div>

          {r.bio && <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.75, marginBottom: 20 }}>{r.bio}</p>}

          {facts.length > 0 && (
            <dl style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 18px', margin: '0 0 24px', fontSize: '0.9375rem' }}>
              {facts.map(f => (
                <Fragment key={f.label}>
                  <dt style={{ color: 'var(--ink-500)', fontWeight: 600 }}>{f.label}</dt>
                  <dd style={{ margin: 0, color: 'var(--ink-900)' }}>{f.value}</dd>
                </Fragment>
              ))}
            </dl>
          )}

          {r.review_topics.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-500)', marginBottom: 8 }}>Reviews content on</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {r.review_topics.map(t => (
                  <span key={t} style={{ padding: '5px 12px', background: 'var(--paper2)', border: '1px solid var(--line)', borderRadius: 20, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)' }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {r.profile_url && (
            <a href={r.profile_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', fontSize: '0.875rem', fontWeight: 600, color: 'var(--brand-pink-text, #9d174d)', marginBottom: 32 }}>
              View professional profile &rarr;
            </a>
          )}

          {posts.length > 0 && (
            <div style={{ borderTop: '1px solid var(--line)', paddingTop: 24 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 500, margin: '0 0 14px' }}>
                Articles reviewed by {r.name} ({posts.length})
              </h2>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {posts.map(p => (
                  <li key={p.slug}>
                    <Link href={`/blog/${p.slug}`} style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600, textDecoration: 'none' }}>{p.title}</Link>
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
