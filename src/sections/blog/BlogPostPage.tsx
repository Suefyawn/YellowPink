import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { ProductImage } from '@/components/ui/ProductImage';
import { sanitizeHtml } from '@/lib/sanitize';
import { linkProductMentions } from '@/lib/link-product-mentions';
import { extractBlogFaq } from '@/lib/blog-faq';
import { BlogProductNudge } from '@/components/blog/BlogProductNudge';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import { BlogShareStrip } from './BlogShareStrip';
import { BlogToc, type TocHeading } from './BlogToc';
import { absoluteUrl, jsonLd, faqLd } from '@/lib/seo';
import { formatBlogDate } from '@/lib/dates';
import { MedicalDisclaimer } from '@/components/MedicalDisclaimer';
import { isHealthCategory } from '@/lib/category-taxonomy';
import { reviewerLabel, type MedicalReviewer } from '@/lib/eeat';
import type { BlogPost, Product } from '@/types';

interface BlogPostPageProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
  relatedProducts: Product[];
  /** Store-wide medical reviewer (health posts only); null otherwise. */
  reviewer?: MedicalReviewer | null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&hellip;/g, '…');
}

function slugify(text: string): string {
  const base = text.toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return base || 'section';
}

// Pulls the <h2> headings out of the article body, gives each a stable id
// (for anchor links) and returns the rewritten HTML plus the heading list
// that feeds the table-of-contents rail.
function extractHeadings(html: string): { html: string; headings: TocHeading[] } {
  const headings: TocHeading[] = [];
  const seen = new Set<string>();

  const out = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/gi, (match, attrs: string | undefined, inner: string) => {
    const text = decodeEntities(inner.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
    if (!text) return match;

    let id = slugify(text);
    if (seen.has(id)) {
      let n = 2;
      while (seen.has(`${id}-${n}`)) n++;
      id = `${id}-${n}`;
    }
    seen.add(id);
    headings.push({ id, text });

    // Respect an id the CMS already set.
    if (attrs && /\sid=/i.test(attrs)) return match;
    return `<h2${attrs ?? ''} id="${id}">${inner}</h2>`;
  });

  return { html: out, headings };
}

export function BlogPostPage({ post, relatedPosts, relatedProducts, reviewer }: BlogPostPageProps) {
  // Lift the FAQ block out of the prose first, so it renders as a real
  // accordion (and powers FAQPage structured data) instead of a run of
  // headings. extractBlogFaq returns the body unchanged when there's no FAQ.
  const sanitized = post.body ? sanitizeHtml(post.body) : '';
  const { html: bodyNoFaq, faqs } = extractBlogFaq(sanitized);
  const { html: withIds, headings } = bodyNoFaq
    ? extractHeadings(bodyNoFaq)
    : { html: '', headings: [] as TocHeading[] };
  const bodyHtml = bodyNoFaq ? linkProductMentions(withIds, relatedProducts) : '';
  // Split the body at the first H2 so a buyable product nudge can sit right
  // after the intro (above the fold for single-page blog visitors), without
  // touching the prose. Falls back to a single block when there's no H2 or no
  // products to recommend.
  const showNudge = relatedProducts.length > 0 && bodyHtml.length > 0;
  const firstH2 = showNudge ? bodyHtml.search(/<h2\b/i) : -1;
  const bodyTop = firstH2 > 0 ? bodyHtml.slice(0, firstH2) : bodyHtml;
  const bodyRest = firstH2 > 0 ? bodyHtml.slice(firstH2) : '';
  // Keep the FAQ reachable from the table of contents.
  if (faqs.length > 0) headings.push({ id: 'faq', text: 'Frequently asked questions' });
  const showToc = headings.length >= 2;

  const newsletterCard = (
    <div
      style={{
        marginTop: 40,
        padding: '24px 28px',
        background: 'var(--paper2, #faf6ee)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-card)',
        textAlign: 'left',
      }}
    >
      <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>
        The fortnight edit
      </Overline>
      <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontSize: '1.375rem', fontWeight: 500, letterSpacing: '-0.01em' }}>
        Liked this one? Get the next in your inbox.
      </h3>
      <p className="small-text" style={{ marginBottom: 14, color: 'var(--ink-700)', lineHeight: 1.55 }}>
        One fortnightly note from the editors, new pieces, restocks, and the routines we&apos;re actually using. Unsubscribe any time.
      </p>
      <NewsletterSignup source="footer" variant="light" ctaLabel="Sign up" />
    </div>
  );

  const bodyInner = (
    <div className="blog-article-main">
      {post.body ? (
        bodyRest ? (
          <>
            <div className="blog-body cms-prose" dangerouslySetInnerHTML={{ __html: bodyTop }} />
            <BlogProductNudge products={relatedProducts} />
            <div className="blog-body cms-prose" dangerouslySetInnerHTML={{ __html: bodyRest }} />
          </>
        ) : (
          <div
            className="blog-body cms-prose"
            dangerouslySetInnerHTML={{ __html: bodyHtml }}
          />
        )
      ) : (
        <p className="body-text" style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}>
          No content yet.
        </p>
      )}

      {/* FAQ rendered as an accordion (lifted out of the prose above) + FAQPage
          structured data, so the questions read as a real FAQ and are eligible
          for Google's Q&A / structured-snippet treatment. */}
      {faqs.length > 0 && (
        <section id="faq" className="blog-faq" style={{ marginTop: 44 }} aria-label="Frequently asked questions">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(faqs.map(f => ({ question: f.question, answer: f.answerText })))) }}
          />
          <h2 className="wp-block-heading" style={{ marginBottom: 8 }}>Frequently asked questions</h2>
          <div>
            {faqs.map((f, i) => (
              <details
                key={i}
                className="blog-faq-item"
                style={{ borderBottom: '1px solid var(--line)', padding: '16px 2px' }}
              >
                <summary
                  style={{
                    cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center',
                    justifyContent: 'space-between', gap: 16, fontWeight: 600, fontSize: '1.0625rem',
                    color: 'var(--ink-900)', lineHeight: 1.4,
                  }}
                >
                  <span>{f.question}</span>
                  <span className="blog-faq-icon" aria-hidden="true" style={{ flexShrink: 0, color: 'var(--brand-pink-text, #9d174d)', fontSize: '1.5rem', lineHeight: 1, transition: 'transform 0.2s' }}>+</span>
                </summary>
                <div
                  className="blog-faq-answer"
                  style={{ marginTop: 12, lineHeight: 1.8, color: 'var(--ink-700)' }}
                  dangerouslySetInnerHTML={{ __html: f.answerHtml }}
                />
              </details>
            ))}
          </div>
        </section>
      )}

      {/* YMYL safeguard: health/wellness articles, and any post a doctor has
          been assigned to review, carry a medical disclaimer (educational, not
          advice). Pure beauty posts don't. */}
      {(isHealthCategory(post.category) || reviewer) && <MedicalDisclaimer variant="editorial" />}

      {/* Bottom-of-post share strip, catches the reader who finishes the
          article and is most likely to share. */}
      <BlogShareStrip title={post.title} url={absoluteUrl(`/blog/${post.slug}`)} excerpt={post.excerpt} />

      {/* Newsletter capture at the natural "I just read something good"
          moment. Goes through the existing /api/newsletter pipeline. */}
      {newsletterCard}
    </div>
  );

  return (
    <div>
      <div className="container" style={{ padding: '16px var(--side)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Link href="/blog" style={{ fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)', textDecoration: 'none' }}>Journal</Link>
          <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem' }}>/</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--ink-900)' }}>{post.category}</span>
        </div>
      </div>

      <article style={{ borderTop: '1px solid var(--line)' }}>
        <div className="container" style={{ maxWidth: 1120, padding: '48px var(--side) 0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <Overline style={{ color: 'var(--ink-500)' }}>{post.category}</Overline>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
            <span className="small-text">{post.read_time}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.75rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 16, maxWidth: 880 }}>{post.title}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.6, marginBottom: 24, maxWidth: 720 }}>{post.excerpt}</p>
          {(() => {
            const author = post.author?.trim() || 'Yellow Pink Editorial Team';
            const initials = author
              .replace(/^(dr|mr|ms|mrs)\.?\s+/i, '')
              .split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'YP';
            return (
              <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 16 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{initials}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>By {author}</div>
                  <div className="small-text">
                    {formatBlogDate(post.date)}
                    {reviewer && <> · Medically reviewed</>}
                  </div>
                </div>
              </div>
            );
          })()}
          {/* E-E-A-T: credentialed medical-reviewer line on health posts. Shown
              only when the store has named a real reviewer (lib/eeat.ts). */}
          {reviewer && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '10px 14px', marginBottom: 16, borderRadius: 10,
                background: 'var(--surface-2, #faf7f2)', border: '1px solid var(--line)',
                fontSize: '0.8125rem', color: 'var(--ink-700)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <path d="M22 4 12 14.01l-3-3" />
              </svg>
              <span>
                Medically reviewed by{' '}
                {reviewer.profileSlug ? (
                  <Link href={`/medical-review-board/${reviewer.profileSlug}`} style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>
                    {reviewerLabel(reviewer)}
                  </Link>
                ) : reviewer.url ? (
                  <a href={reviewer.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>
                    {reviewerLabel(reviewer)}
                  </a>
                ) : (
                  <strong style={{ color: 'var(--ink-900)' }}>{reviewerLabel(reviewer)}</strong>
                )}
                {reviewer.specialty ? ` · ${reviewer.specialty}` : ''}
                {' '}· Last reviewed {post.updated_at ? new Date(post.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : formatBlogDate(post.date)}
              </span>
            </div>
          )}
          <BlogShareStrip title={post.title} url={absoluteUrl(`/blog/${post.slug}`)} excerpt={post.excerpt} />
          <div style={{ borderBottom: '1px solid var(--line)', marginTop: 16 }} />
        </div>

        <div className="container" style={{ maxWidth: 1120, padding: '32px var(--side)' }}>
          <div style={{ aspectRatio: '16/9', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
            <ProductImage src={post.image_url} alt={post.title} priority sizes="(max-width: 1180px) 100vw, 1120px" />
          </div>
        </div>

        {showToc ? (
          <div className="container blog-article-grid" style={{ maxWidth: 1120, padding: '0 var(--side) 48px' }}>
            <aside className="blog-article-sidebar">
              <BlogToc headings={headings} />
              <div className="blog-sidebar-card blog-sidebar-card-compact">
                <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>The fortnight edit</Overline>
                <p style={{ margin: '0 0 12px', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  Get the next guide in your inbox.
                </p>
                <NewsletterSignup source="blog" variant="light" ctaLabel="Sign up" />
              </div>
            </aside>
            {bodyInner}
          </div>
        ) : (
          <div className="container" style={{ maxWidth: 760, padding: '0 var(--side) 48px' }}>
            {bodyInner}
          </div>
        )}

        <hr className="hairline" />

        {relatedProducts.length > 0 && (
          <section style={{ padding: '48px 0' }}>
            <div className="container">
              <Overline style={{ display: 'block', marginBottom: 24 }}>Mentioned in This Article</Overline>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid-3">
                {relatedProducts.map((p) => (
                  <ProductTile key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}

        {relatedPosts.length > 0 && (
          <>
            <hr className="hairline" />
            <section style={{ padding: '48px 0' }}>
              <div className="container">
                <Overline style={{ display: 'block', marginBottom: 24 }}>More from {post.category}</Overline>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="blog-grid">
                  {relatedPosts.map((rp) => (
                    <Link key={rp.id} href={`/blog/${rp.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <article style={{ cursor: 'pointer' }}>
                        <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 12 }}>
                          <ProductImage src={rp.image_url} alt={rp.title} sizes="(max-width: 700px) 100vw, 50vw" />
                        </div>
                        <Overline style={{ color: 'var(--ink-500)', display: 'block', marginBottom: 4 }}>{rp.category}</Overline>
                        <h3 className="h3" style={{ marginBottom: 4 }}>{rp.title}</h3>
                        <span className="small-text">{formatBlogDate(rp.date)} · {rp.read_time}</span>
                      </article>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          </>
        )}
      </article>
    </div>
  );
}
