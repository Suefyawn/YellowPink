'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Overline } from '@/components/ui/Overline';
import { ProductImage } from '@/components/ui/ProductImage';
import type { BlogPost } from '@/types';

const PAGE_SIZE = 12;

/** Lucide-style 24x24 stroke icons, one per top-level blog category, so the
 *  filter rail reads at a glance instead of as a wall of text chips. New
 *  categories silently fall back to the tag glyph below. */
const CATEGORY_ICON_PATHS: Record<string, string> = {
  Wellness: 'M11 20A7 7 0 0 1 4 13C4 9 7 4 11 2c1 3 1.5 5.5 1.5 8 0 1.5-.5 3-1.5 4 1.5 0 3-1 4-2.5C16 14 16 17 13 19a7 7 0 0 1-2 1Z',
  Skincare: 'M12 2c3.5 4.5 7 8.8 7 12.5a7 7 0 1 1-14 0C5 10.8 8.5 6.5 12 2Z',
  Makeup: 'M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3ZM19 14l.75 2.25L22 17l-2.25.75L19 20l-.75-2.25L16 17l2.25-.75L19 14ZM5 14l.6 1.8L7.4 16.4l-1.8.6L5 18.8l-.6-1.8L2.6 16.4l1.8-.6L5 14Z',
  "Women's Health": 'M12 21s-7-4.5-9.5-9C.8 8.4 2.3 5 5.8 5c1.9 0 3.4 1 4.2 2.4C10.8 6 12.3 5 14.2 5c3.5 0 5 3.4 3.3 7-2.5 4.5-9.5 9-9.5 9Z',
  'Heart Health': 'M3 12h4l2-6 4 12 2-6h6 M12 21s-7-4.5-9.5-9C.8 8.4 2.3 5 5.8 5c1.9 0 3.4 1 4.2 2.4C10.8 6 12.3 5 14.2 5c3.5 0 5 3.4 3.3 7-2.5 4.5-9.5 9-9.5 9Z',
  'Bone & Joint': 'M7 17a2.5 2.5 0 1 1 1.8-4.2l5.4-5.4A2.5 2.5 0 1 1 17 5a2.5 2.5 0 0 1-2.4 3.2l-5.4 5.4A2.5 2.5 0 0 1 7 17Z M14.5 9.5l0 0M9.5 14.5l0 0',
  Fertility: 'M12 14c-2.5 0-4.5-2-4.5-4.5C7.5 6.5 9.5 3 12 2c2.5 1 4.5 4.5 4.5 7.5 0 2.5-2 4.5-4.5 4.5ZM12 14v8m-3-3h6',
  "Men's Health": 'M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3Z',
  Hair: 'M5 8c2-3 5-4 7-4s5 1 7 4M5 8c0 4 2 6 2 9M19 8c0 4-2 6-2 9M9 8c0 5 1.5 7.5 1.5 9M15 8c0 5-1.5 7.5-1.5 9',
};
const DEFAULT_ICON_PATH = 'M4 4h7l9 9-7 7-9-9V4Z M8 8h.01';

function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  if (category === 'All') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CATEGORY_ICON_PATHS[category] ?? DEFAULT_ICON_PATH} />
    </svg>
  );
}

const ClockIcon = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />
  </svg>
);

/** Parses "10 min read" → 10 so posts can be sorted shortest-first. Posts
 *  with an unparseable read_time sort last rather than crashing the sort. */
function readMinutes(readTime: string | undefined): number {
  const n = readTime ? parseInt(readTime, 10) : NaN;
  return Number.isFinite(n) ? n : Infinity;
}

type SortMode = 'newest' | 'quick';

export function BlogPage({ posts }: { posts: BlogPost[] }) {
  // Filters are derived from the actual post categories, sorted by
  // frequency. The old hardcoded ['Skincare','Makeup','Wellness'] list
  // didn't match any real category (real values: "Bone Health",
  // "Fertility Support", "Men Health", etc.) so every non-"All" tab
  // showed zero posts.
  const categoryCounts = useMemo<[string, number][]>(() => {
    const counts = new Map<string, number>();
    for (const p of posts) {
      if (!p.category) continue;
      counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    }
    // Keep only categories with 2+ posts so the filter rail doesn't
    // explode into a long single-post-per-category list.
    return [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]);
  }, [posts]);

  const [activeFilter, setActiveFilter] = useState('All');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Anchor for pagination: revealing more results shouldn't yank the reader
  // away from where they were reading.
  const listTopRef = useRef<HTMLElement>(null);

  const featured = posts.find(p => p.featured);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matches = posts.filter(p => {
      if (activeFilter !== 'All' && p.category !== activeFilter) return false;
      if (!q) return true;
      const hay = `${p.title} ${p.excerpt ?? ''} ${p.category ?? ''}`.toLowerCase();
      return hay.includes(q);
    });
    if (sortMode === 'quick') {
      // Stable sort: posts already arrive newest-first from the server, so
      // ties on read time keep their recency order.
      return [...matches].sort((a, b) => readMinutes(a.read_time) - readMinutes(b.read_time));
    }
    return matches;
  }, [posts, activeFilter, query, sortMode]);

  const hasMore = visibleCount < filtered.length;
  // Every matching card is rendered into the DOM; cards beyond visibleCount
  // are hidden with `display:none` rather than sliced out. This keeps the
  // "load more" UX while leaving a real, crawlable <a> for every post in the
  // server HTML, so we don't need a separate "All articles" link dump to
  // avoid orphaned (un-linked) posts.

  const updateFilter = (f: string) => { setActiveFilter(f); setVisibleCount(PAGE_SIZE); };
  const updateQuery = (q: string) => { setQuery(q); setVisibleCount(PAGE_SIZE); };
  const updateSort = (s: SortMode) => { setSortMode(s); setVisibleCount(PAGE_SIZE); };
  const clearAll = () => { setActiveFilter('All'); setQuery(''); setVisibleCount(PAGE_SIZE); };

  const showMore = () => {
    setVisibleCount(c => Math.min(c + PAGE_SIZE, filtered.length));
  };

  return (
    <div>
      <section style={{ padding: '48px 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Journal</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>The Edit</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 480 }}>
            Expert guides, honest reviews, and the science behind beauty and health, no fluff.
          </p>
        </div>
      </section>

      {featured && (
        <section style={{ padding: 'var(--section-gap) 0', borderBottom: '1px solid var(--line)' }}>
          <div className="container">
            <Link href={`/blog/${featured.slug}`} style={{ textDecoration: 'none', color: 'inherit' }} className="blog-featured-link">
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 48, alignItems: 'center', cursor: 'pointer' }} className="duo-grid">
                <div className="blog-featured-img" style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden' }}>
                  <ProductImage src={featured.image_url} alt={featured.title} priority sizes="(max-width: 900px) 100vw, 60vw" />
                </div>
                <div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ padding: '3px 10px', background: 'var(--brand-yellow)', borderRadius: 'var(--radius-pill)', fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Featured</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--ink-500)' }}>
                      <CategoryIcon category={featured.category} />
                      <Overline style={{ color: 'var(--ink-500)' }}>{featured.category}</Overline>
                    </span>
                  </div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.15, marginBottom: 12 }}>{featured.title}</h2>
                  <p className="body-text" style={{ color: 'var(--ink-700)', marginBottom: 16 }}>{featured.excerpt}</p>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span className="small-text">{featured.date}</span>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
                    <span className="small-text" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClockIcon />{featured.read_time}</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </section>
      )}

      <section ref={listTopRef} style={{ padding: 'var(--section-gap) 0', scrollMarginTop: 80 }}>
        <div className="container">
          {/* Search + sort row */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 420, minWidth: 220 }}>
              <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-500)', pointerEvents: 'none' }}>
                <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={e => updateQuery(e.target.value)}
                placeholder="Search the journal, try “PCOS”, “retinol”…"
                aria-label="Search blog posts"
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 38px', border: '1px solid var(--line)', borderRadius: 'var(--radius-pill)',
                  fontSize: '0.875rem', fontFamily: 'var(--font-ui)', background: 'var(--paper2, #faf6ee)',
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
              <label htmlFor="blog-sort" className="small-text" style={{ color: 'var(--ink-500)' }}>Sort</label>
              <select
                id="blog-sort"
                value={sortMode}
                onChange={e => updateSort(e.target.value as SortMode)}
                style={{
                  padding: '8px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-pill)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-ui)', background: 'transparent', color: 'var(--ink-700)',
                  cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="newest">Newest</option>
                <option value="quick">Quickest read</option>
              </select>
            </div>
          </div>

          {/* Category filter rail */}
          <div className="blog-filter-rail" style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
            <button onClick={() => updateFilter('All')} className="blog-filter-chip" style={chipStyle(activeFilter === 'All')}>
              <CategoryIcon category="All" />
              All
              <span style={countBadgeStyle(activeFilter === 'All')}>{posts.length}</span>
            </button>
            {categoryCounts.map(([cat, count]) => (
              <button key={cat} onClick={() => updateFilter(cat)} className="blog-filter-chip" style={chipStyle(activeFilter === cat)}>
                <CategoryIcon category={cat} />
                {cat}
                <span style={countBadgeStyle(activeFilter === cat)}>{count}</span>
              </button>
            ))}
          </div>

          {/* Results count + active filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
            <span className="small-text" style={{ color: 'var(--ink-500)' }}>
              {filtered.length} {filtered.length === 1 ? 'article' : 'articles'}
            </span>
            {(activeFilter !== 'All' || query) && (
              <>
                {activeFilter !== 'All' && (
                  <button onClick={() => updateFilter('All')} style={activePillStyle}>
                    {activeFilter} <span aria-hidden="true">×</span>
                  </button>
                )}
                {query && (
                  <button onClick={() => updateQuery('')} style={activePillStyle}>
                    “{query}” <span aria-hidden="true">×</span>
                  </button>
                )}
                <button onClick={clearAll} className="text-link small-text" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  Clear all
                </button>
              </>
            )}
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--ink-500)' }}>
              <p className="body-text" style={{ marginBottom: 6 }}>No posts match that filter.</p>
              <button
                onClick={clearAll}
                style={{ background: 'none', border: 'none', color: 'var(--brand-pink-text)', cursor: 'pointer', fontWeight: 600 }}
              >
                Clear search
              </button>
            </div>
          ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="blog-grid">
            {filtered.map((post, i) => {
              const visible = i < visibleCount;
              return (
                <Link
                  key={post.id}
                  href={`/blog/${post.slug}`}
                  className="blog-tile blog-card-in"
                  style={{
                    textDecoration: 'none', color: 'inherit',
                    display: visible ? undefined : 'none',
                    animationDelay: `${(i % PAGE_SIZE) * 40}ms`,
                  }}
                >
                  <article style={{ cursor: 'pointer' }}>
                    {/* Hover lift + image zoom handled in CSS (.blog-tile:hover) instead
                        of JS onMouseEnter, the old version was a React Compiler
                        anti-pattern (mutating DOM in event handlers). */}
                    <div className="blog-tile-img" style={{ aspectRatio: '16/10', borderRadius: 'var(--radius-card)', overflow: 'hidden', marginBottom: 16, transition: 'transform 200ms ease-out' }}>
                      <ProductImage src={post.image_url} alt={post.title} sizes="(max-width: 700px) 100vw, 33vw" />
                    </div>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 6, color: 'var(--ink-500)' }}>
                      <CategoryIcon category={post.category} />
                      <Overline style={{ color: 'var(--ink-500)' }}>{post.category}</Overline>
                    </span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.3, marginBottom: 8 }}>{post.title}</h3>
                    <p className="small-text" style={{ marginBottom: 8, lineHeight: 1.5 }}>{post.excerpt}</p>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span className="small-text" style={{ fontSize: '0.75rem' }}>{post.date}</span>
                      <span style={{ width: 3, height: 3, borderRadius: '50%', background: 'var(--ink-500)' }} />
                      <span className="small-text" style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ClockIcon />{post.read_time}</span>
                    </div>
                  </article>
                </Link>
              );
            })}
          </div>
          )}

          {hasMore && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
              <button onClick={showMore} className="blog-load-more">
                Show more articles
                <span className="small-text" style={{ color: 'var(--ink-500)', fontWeight: 400 }}>
                  ({filtered.length - visibleCount} more)
                </span>
              </button>
            </div>
          )}

        </div>
      </section>
    </div>
  );
}

function chipStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
    padding: '8px 14px', borderRadius: 'var(--radius-pill)',
    border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
    background: active ? 'var(--ink-900)' : 'transparent',
    color: active ? 'var(--paper)' : 'var(--ink-700)',
    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 500,
    cursor: 'pointer', transition: 'all 150ms ease-out',
  };
}

function countBadgeStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1,
    padding: '2px 6px', borderRadius: 'var(--radius-pill)',
    background: active ? 'rgba(255,255,255,0.2)' : 'var(--paper2, #faf6ee)',
    color: active ? 'var(--paper)' : 'var(--ink-500)',
  };
}

const activePillStyle: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '4px 10px', borderRadius: 'var(--radius-pill)',
  border: '1px solid var(--line)', background: 'var(--paper2, #faf6ee)',
  color: 'var(--ink-700)', fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500,
  cursor: 'pointer',
};
