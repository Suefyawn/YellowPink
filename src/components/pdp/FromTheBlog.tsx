import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import { formatBlogDate } from '@/lib/dates';
import type { BlogPost } from '@/types';

// "From the blog" rail on the PDP: the editorial pieces that actually link to
// this product (see getPostsLinkingProduct). Internal-linking win in both
// directions — PDPs gain topical supporting content, posts gain crawl paths
// from the highest-authority commercial pages. Renders nothing when no post
// mentions the product, so thin products don't get an empty section.
export function FromTheBlog({ posts }: { posts: BlogPost[] }) {
  if (posts.length === 0) return null;
  return (
    <section style={{ padding: '48px 0', borderTop: '1px solid var(--line)' }} aria-label="Articles featuring this product">
      <div className="container">
        <Overline as="h2" style={{ display: 'block', marginBottom: 24 }}>From the blog</Overline>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="blog-grid">
          {posts.map(p => (
            <Link key={p.id} href={`/blog/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <article style={{ cursor: 'pointer' }}>
                <div style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 12 }}>
                  <ProductImage src={p.image_url} alt={p.title} sizes="(max-width: 700px) 100vw, 33vw" />
                </div>
                <Overline style={{ color: 'var(--ink-500)', display: 'block', marginBottom: 4 }}>{p.category}</Overline>
                <h3 className="h3" style={{ marginBottom: 4 }}>{p.title}</h3>
                <span className="small-text">{formatBlogDate(p.date)} · {p.read_time}</span>
              </article>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
