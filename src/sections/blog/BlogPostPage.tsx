import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { ProductImage } from '@/components/ui/ProductImage';
import { sanitizeHtml } from '@/lib/sanitize';
import { linkProductMentions } from '@/lib/link-product-mentions';
import { NewsletterSignup } from '@/components/marketing/NewsletterSignup';
import { BlogShareStrip } from './BlogShareStrip';
import type { BlogPost, Product } from '@/types';

interface BlogPostPageProps {
  post: BlogPost;
  relatedPosts: BlogPost[];
  relatedProducts: Product[];
}

export function BlogPostPage({ post, relatedPosts, relatedProducts }: BlogPostPageProps) {
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
        <div className="container" style={{ maxWidth: 800, padding: '48px var(--side) 0' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
            <Overline style={{ color: 'var(--ink-500)' }}>{post.category}</Overline>
            <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
            <span className="small-text">{post.read_time}</span>
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.75rem', fontWeight: 500, letterSpacing: '-0.025em', lineHeight: 1.1, marginBottom: 16 }}>{post.title}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', fontSize: '1.0625rem', lineHeight: 1.6, marginBottom: 24 }}>{post.excerpt}</p>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center', paddingBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--paper2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>YP</span>
            </div>
            <div>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Yellow Pink Editorial</div>
              <div className="small-text">{post.date}</div>
            </div>
          </div>
          <BlogShareStrip title={post.title} path={`/blog/${post.slug}`} excerpt={post.excerpt} />
          <div style={{ borderBottom: '1px solid var(--line)', marginTop: 16 }} />
        </div>

        <div className="container" style={{ maxWidth: 960, padding: '32px var(--side)' }}>
          <div style={{ aspectRatio: '16/9', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
            <ProductImage src={post.image_url} alt={post.title} priority sizes="(max-width: 1024px) 100vw, 960px" />
          </div>
        </div>

        <div className="container" style={{ maxWidth: 680, padding: '0 var(--side) 24px' }}>
          {post.body ? (
            <div
              className="blog-body"
              style={{ lineHeight: 1.8, color: 'var(--ink-700)' }}
              dangerouslySetInnerHTML={{ __html: linkProductMentions(sanitizeHtml(post.body), relatedProducts) }}
            />
          ) : (
            <p className="body-text" style={{ color: 'var(--ink-500)', fontStyle: 'italic' }}>
              No content yet.
            </p>
          )}

          {/* Bottom-of-post share strip — catches the reader who finishes the
              article and is most likely to share. The top one catches readers
              who recognise the post by headline alone. */}
          <BlogShareStrip title={post.title} path={`/blog/${post.slug}`} excerpt={post.excerpt} />
        </div>

        {/* Newsletter capture at the natural "I just read something good"
            moment. Goes through the existing /api/newsletter pipeline so
            opt-in + Resend welcome email + unsubscribe-token issuance all
            stay consistent with the modal + footer surfaces. */}
        <div className="container" style={{ maxWidth: 680, padding: '0 var(--side) 48px' }}>
          <div
            style={{
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
              One fortnightly note from the editors — new pieces, restocks, and the routines we&apos;re actually using. Unsubscribe any time.
            </p>
            <NewsletterSignup source="footer" variant="light" ctaLabel="Sign up" />
          </div>
        </div>

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
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--gutter)' }} className="duo-grid">
                  {relatedPosts.map((rp) => (
                    <Link key={rp.id} href={`/blog/${rp.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                      <article style={{ cursor: 'pointer' }}>
                        <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 12 }}>
                          <ProductImage src={rp.image_url} alt={rp.title} sizes="(max-width: 700px) 100vw, 50vw" />
                        </div>
                        <Overline style={{ color: 'var(--ink-500)', display: 'block', marginBottom: 4 }}>{rp.category}</Overline>
                        <h3 className="h3" style={{ marginBottom: 4 }}>{rp.title}</h3>
                        <span className="small-text">{rp.date} · {rp.read_time}</span>
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
