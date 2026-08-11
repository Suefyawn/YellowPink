import { jsonLd, faqLd } from '@/lib/seo';

export interface Faq { q: string; a: string }

/** Long-form body + FAQ block shared by the brand and collection landing
 *  pages. Both need the same thing: a substantive prose section under the
 *  product grid, and an FAQ list that doubles as FAQPage structured data.
 *  `html` is staff-authored (same trust model as blog_posts.body). */
export function ContentAndFaqs({
  html, faqs, faqHeading,
}: { html?: string | null; faqs?: Faq[] | null; faqHeading: string }) {
  const list = Array.isArray(faqs) ? faqs.filter(f => f?.q && f?.a) : [];
  if (!html && list.length === 0) return null;

  return (
    <>
      {html && (
        <section style={{ padding: '0 0 var(--section-gap)' }}>
          <div className="container">
            <div className="blog-body cms-prose" style={{ maxWidth: 720 }} dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </section>
      )}

      {list.length > 0 && (
        <section style={{ padding: '0 0 var(--section-gap)' }}>
          <div className="container">
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(list.map(f => ({ question: f.q, answer: f.a })))) }}
            />
            <div style={{ maxWidth: 720 }}>
              <h2 className="display-l" style={{ fontSize: '1.5rem', marginBottom: 16 }}>{faqHeading}</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {list.map((f, i) => (
                  <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
                    <summary className="body-text" style={{ fontWeight: 600, cursor: 'pointer' }}>{f.q}</summary>
                    <p className="body-text" style={{ color: 'var(--ink-700)', marginTop: 8 }}>{f.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
