import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase, isDemo, getSiteSettings } from '@/lib/supabase';
import { redirectIfMapped } from '@/lib/redirects';
import { parseCommerceConfig, formatPkr } from '@/lib/commerce';
import { DEMO_PAGES } from '@/lib/demo-data';
import { sanitizeHtml } from '@/lib/sanitize';
import { pageMeta, jsonLd, pageArticleLd, faqLd, breadcrumbLd } from '@/lib/seo';
import { getPageFaq } from '@/lib/page-faqs';
import { ContactForm } from '@/components/contact/ContactForm';
import { ContactChannels } from '@/components/contact/ContactChannels';
import { socialLinks } from '@/lib/socials';
import type { Page } from '@/types';

// Static content imported from WordPress (About, Privacy, Terms, FAQ…).
// Slugs come from wp_pages.slug — the same slug WP used, so links + redirects
// stay stable.

async function loadPage(slug: string): Promise<Page | null> {
  if (isDemo) return DEMO_PAGES.find(p => p.slug === slug) ?? null;
  try {
    const { data } = await supabase
      .from('pages')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .maybeSingle();
    return (data as Page | null) ?? null;
  } catch (err) {
    // Same resilience pattern as the storefront getters — a missing `pages`
    // table shouldn't 404 every CMS slug.
    console.warn(`[supabase] loadPage(${slug}) failed; falling back to null. ${(err as Error).message}`);
    return null;
  }
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
  // No live page? An old WP URL (e.g. /page/home, a draft import Google still
  // has indexed) may have a manual redirect — honour it before 404ing.
  if (!page) { await redirectIfMapped(`/page/${slug}`); notFound(); }

  const settings = await getSiteSettings();
  const commerce = parseCommerceConfig(settings);
  // body_html is sanitised once at import-time (see importer) but defensively
  // re-sanitise here in case content was edited via raw SQL. Then substitute the
  // dynamic shipping tokens so CMS pages (Shipping, FAQ) always reflect the live
  // admin-configured rate/threshold instead of hard-coded numbers that drift.
  const safeHtml = sanitizeHtml(page.body_html)
    .replaceAll('{{flat_shipping}}', formatPkr(commerce.defaultShippingRate))
    .replaceAll('{{free_shipping_threshold}}', formatPkr(commerce.freeShippingThreshold));
  const isContact = page.slug === 'contact';
  const faqs = getPageFaq(page.slug, commerce);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(pageArticleLd({
            title: page.title,
            description: page.meta_description ?? page.excerpt ?? page.title,
            path: `/page/${page.slug}`,
          })),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home',     path: '/' },
            { name: page.title, path: `/page/${page.slug}` },
          ])),
        }}
      />
      {faqs && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(faqs)) }}
        />
      )}
      <article className="container" style={{ padding: '64px var(--side)' }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <header style={{ marginBottom: 36, paddingBottom: 24, borderBottom: '1px solid var(--line)' }}>
            <h1
              className="display-l"
              style={{ fontSize: '2.5rem', fontWeight: 500, margin: 0, letterSpacing: '-0.025em', lineHeight: 1.1 }}
            >
              {page.title}
            </h1>
          </header>
          <div
            className="cms-prose"
            dangerouslySetInnerHTML={{ __html: safeHtml }}
          />
          {/* Contact page: WhatsApp-first channel cards (the fast paths), then
              a real "email us" form. Submissions land in Admin → Messages and
              forward to the owner, since hello@yellowpink.pk has no inbox. */}
          {isContact && (
            <div style={{ marginTop: 32 }}>
              <ContactChannels
                phone={settings.store_phone ?? null}
                email={settings.store_email ?? null}
                socials={socialLinks(settings)}
              />
            </div>
          )}
          {isContact && (
            <section style={{ marginTop: 44 }} aria-label="Send us a message">
              <h2 className="h2" style={{ marginBottom: 8 }}>Send us a message</h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 24 }}>
                Prefer to write? Fill this in and we&apos;ll reply by email,
                usually within one working day.
              </p>
              <ContactForm />
            </section>
          )}
          {faqs && (
            <section style={{ marginTop: 48 }} aria-label="Frequently asked questions">
              <h2 className="h2" style={{ marginBottom: 24 }}>Frequently asked questions</h2>
              <div>
                {faqs.map(f => (
                  <details
                    key={f.question}
                    className="faq-item"
                    style={{
                      borderBottom: '1px solid var(--line)',
                      padding: '16px 0',
                    }}
                  >
                    <summary
                      style={{
                        cursor: 'pointer', fontWeight: 600, fontSize: '1rem',
                        listStyle: 'none', display: 'flex', justifyContent: 'space-between',
                        alignItems: 'center', gap: 16,
                      }}
                    >
                      <span>{f.question}</span>
                      <span
                        aria-hidden="true"
                        className="faq-chevron"
                        style={{
                          color: 'var(--ink-500)', fontSize: '1.25rem',
                          flexShrink: 0,
                          // Rotates 45° when the details is open via CSS in
                          // globals.css — turns + into × cleanly.
                          transition: 'transform 200ms ease-out',
                          display: 'inline-block',
                        }}
                      >+</span>
                    </summary>
                    <p style={{ marginTop: 12, color: 'var(--ink-700)', lineHeight: 1.6 }}>
                      {f.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
      </article>
    </>
  );
}
