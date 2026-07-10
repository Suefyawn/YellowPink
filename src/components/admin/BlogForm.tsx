'use client';
import { startTransition, useActionState, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createBlogPost, updateBlogPost } from '@/app/admin/actions';
import { ImageUpload } from './ImageUpload';
import { SubmitToIndexButton } from './IndexingButtons';
import { suggestReviewer } from '@/lib/reviewer-match';
import { REVIEW_TOPICS } from '@/lib/review-topics';
import type { BlogPost } from '@/types';

export interface BlogFormReviewer {
  id: string;
  name: string;
  specialty: string | null;
  review_topics: string[];
  is_default: boolean;
  active: boolean;
}

function toSlug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function today() {
  return new Date().toISOString().split('T')[0];
}

// Canonical blog taxonomy. Kept as a fixed dropdown (not free text) so the
// category list can't drift back into the WP-import mess of near-duplicate
// values, see migrations 100 and 189. Add a new category here when one is
// needed (and migrate existing rows onto it).
const BLOG_CATEGORIES = [
  'Skincare',
  'Hair',
  'Makeup',
  'Wellness',
  "Women's Health",
  "Men's Health",
  'Fertility',
  'Bone & Joint',
] as const;

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px',
  border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827',
  background: 'white', outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem',
  fontWeight: 600, color: '#374151', marginBottom: 5,
};

// Grouped form sections: a labelled divider so the long single column reads
// as Basics / Attribution / Media / Content instead of one undifferentiated
// scroll. Matches ProductForm's grouping grammar.
function Section({ title, first = false, children }: { title: string; first?: boolean; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: first ? 0 : 28, paddingTop: first ? 0 : 24, borderTop: first ? 'none' : '1px solid #f3f4f6' }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '0.8125rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

export function BlogForm({ post, reviewers = [], initialTitle }: { post?: BlogPost; reviewers?: BlogFormReviewer[]; initialTitle?: string }) {
  const isEdit = Boolean(post);
  const boundAction = isEdit ? updateBlogPost.bind(null, post!.id) : createBlogPost;
  const [state, action, pending] = useActionState(boundAction, null);

  // Warn before leaving with unsaved edits (tab close / refresh / external
  // nav). Suppressed while submitting, a successful save redirects away.
  // Same guard as ProductForm.
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty || pending) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty, pending]);

  // `initialTitle` pre-fills a new post from an external prompt (the
  // Search-demand "Write a guide" action seeds the searched term as the title).
  const [title, setTitle] = useState(post?.title ?? initialTitle ?? '');
  const [slug, setSlug] = useState(post?.slug ?? (initialTitle ? toSlug(initialTitle) : ''));
  const [imageUrl] = useState(post?.image_url ?? '');

  // Category + reviewer are controlled so the reviewer suggestion can react
  // to the category choice and "Use suggestion" can set the picker.
  const [category, setCategory] = useState(post?.category ?? '');
  // Health topic drives the direct reviewer match; controlled so the reviewer
  // suggestion reacts to it.
  const [topic, setTopic] = useState(post?.topic ?? '');
  const [reviewerId, setReviewerId] = useState((post as { reviewer_id?: string | null } | undefined)?.reviewer_id ?? '');

  // Live specialty-match against the review board (same scorer the bulk
  // assignment page uses). Purely a hint — staff still choose.
  const suggestion = useMemo(() => {
    if (!category || reviewers.length === 0) return null;
    return suggestReviewer({ title, category, topic }, reviewers);
  }, [title, category, topic, reviewers]);

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/blog" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>
          ← Blog
        </Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {isEdit ? 'Edit Post' : 'New Post'}
        </h1>
      </div>

      <div style={{ background: 'white', borderRadius: 10, padding: '28px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', maxWidth: 820 }}>
        {state?.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 7, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
            {state.error}
          </div>
        )}

        {/* Submitted manually (preventDefault + startTransition) instead of via
            the `action` prop: React resets every uncontrolled field once a
            form action settles, so a rejected save (e.g. duplicate slug) used
            to wipe the writer's entered data — including the whole body.
            Dispatching the same useActionState action ourselves keeps the DOM
            state intact while error/pending behave identically. Same pattern
            as ProductForm. */}
        <form
          onSubmit={e => {
            e.preventDefault();
            setDirty(false);
            const formData = new FormData(e.currentTarget);
            startTransition(() => action(formData));
          }}
          onInput={() => { if (!dirty) setDirty(true); }}
        >
          <Section title="Basics" first>
          {/* Title */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Title *</label>
            <input
              name="title" required
              value={title}
              onChange={e => { setTitle(e.target.value); if (!isEdit) setSlug(toSlug(e.target.value)); }}
              style={{ ...inp, fontSize: '1rem', fontWeight: 500 }}
              placeholder="Post title"
            />
          </div>

          {/* Slug */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>URL Slug *</label>
            <input
              name="slug" required
              value={slug}
              onChange={e => setSlug(e.target.value)}
              style={{ ...inp, fontFamily: 'monospace', fontSize: '0.8125rem' }}
              placeholder="post-url-slug"
            />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
              /blog/{slug || 'post-slug'}
            </span>
          </div>

          {/* Row: Category, Date, Read time */}
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <label style={lbl}>Category *</label>
              <select name="category" required value={category} onChange={e => setCategory(e.target.value)} style={inp}>
                <option value="" disabled>Choose a category</option>
                {BLOG_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Date *</label>
              <input name="date" type="date" required defaultValue={post?.date ?? today()} style={inp} />
            </div>
            <div>
              <label style={lbl}>Read Time *</label>
              <input name="read_time" required defaultValue={post?.read_time} style={inp} placeholder="5 min read" />
            </div>
          </div>

          </Section>

          <Section title="Byline & medical review">
          {/* Health topic: matches the post to a reviewer who covers it. */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Health topic</label>
            <select name="topic" value={topic} onChange={e => setTopic(e.target.value)} style={inp}>
              <option value="">None (not health-specific)</option>
              {REVIEW_TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
              Pick the topic this article is about; the reviewer suggestion below jumps to a board doctor who covers it.
            </span>
          </div>

          {/* Author */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Author</label>
            <input
              name="author"
              defaultValue={post?.author ?? 'Yellow Pink Editorial Team'}
              style={inp}
              placeholder="Yellow Pink Editorial Team"
            />
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
              Shown as the byline. Use a named expert for health/beauty posts to strengthen E-E-A-T.
            </span>
          </div>

          {/* Medical reviewer (E-E-A-T), assign a board doctor to health posts. */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Medically reviewed by</label>
            <select name="reviewer_id" value={reviewerId ?? ''} onChange={e => setReviewerId(e.target.value)} style={inp}>
              <option value="">— None —</option>
              {reviewers.map(r => (
                <option key={r.id} value={r.id}>{r.name}{r.specialty ? ` · ${r.specialty}` : ''}</option>
              ))}
            </select>
            {suggestion && suggestion.reviewerId !== reviewerId && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
                marginTop: 6, padding: '8px 12px', background: '#fdf2f8',
                border: '1px solid #fbcfe8', borderRadius: 7, fontSize: '0.8125rem', color: '#9d174d',
              }}>
                <span>
                  Suggested: <strong>{suggestion.reviewerName}</strong>
                  <span style={{ color: '#be185d', opacity: 0.8 }}> — {suggestion.reason}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setReviewerId(suggestion.reviewerId)}
                  style={{
                    padding: '3px 10px', borderRadius: 6, border: '1px solid #f9a8d4',
                    background: 'white', color: '#9d174d', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Use suggestion
                </button>
              </div>
            )}
            <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4, display: 'block' }}>
              For health/supplement posts, assign a real doctor from your <a href="/admin/reviewers" style={{ color: '#9d174d' }}>Review Board</a> who has reviewed it. Adds a &ldquo;Medically reviewed by&rdquo; byline + schema. Only assign if they genuinely reviewed it.
            </span>
          </div>

          </Section>

          <Section title="Media & placement">
          {/* Cover Image */}
          <div style={{ marginBottom: 16 }}>
            <ImageUpload name="image_url" currentUrl={imageUrl} label="Cover Image" aspect={16 / 9} />
          </div>

          {/* Featured */}
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <input
              type="checkbox" name="featured" id="featured"
              defaultChecked={post?.featured ?? false}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            <label htmlFor="featured" style={{ fontSize: '0.875rem', color: '#374151', cursor: 'pointer', userSelect: 'none' }}>
              Featured post (shown prominently on the blog)
            </label>
          </div>

          </Section>

          <Section title="Content">
          {/* Excerpt */}
          <div style={{ marginBottom: 16 }}>
            <label style={lbl}>Excerpt *</label>
            <textarea
              name="excerpt" required
              defaultValue={post?.excerpt}
              rows={3}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }}
              placeholder="Short summary shown on the blog listing page…"
            />
          </div>

          {/* Body */}
          <div style={{ marginBottom: 28 }}>
            <label style={lbl}>Body</label>
            <textarea
              name="body"
              defaultValue={post?.body ?? ''}
              rows={16}
              style={{ ...inp, resize: 'vertical', lineHeight: 1.7, fontFamily: 'monospace', fontSize: '0.8125rem' }}
              placeholder="Full post content (plain text or Markdown)…"
            />
          </div>

          </Section>

          {/* Sticky save bar, pins to the viewport bottom on long posts.
              Same pattern as ProductForm. */}
          <div
            className="adm-sticky-actions"
            style={{
              position: 'sticky', bottom: 0,
              marginTop: 8, padding: '12px 16px',
              background: 'rgba(255,255,255,0.94)',
              backdropFilter: 'saturate(140%) blur(8px)',
              WebkitBackdropFilter: 'saturate(140%) blur(8px)',
              borderTop: '1px solid #e5e7eb',
              borderRadius: '0 0 10px 10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, flexWrap: 'wrap',
              boxShadow: '0 -6px 18px rgba(0,0,0,0.04)',
              zIndex: 5,
            }}
          >
            <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
              {pending
                ? 'Saving…'
                : isEdit
                  ? <>Editing <strong style={{ color: '#111827' }}>{post?.title ?? 'post'}</strong></>
                  : 'Drafting a new post'}
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              {isEdit && post?.slug && <SubmitToIndexButton path={`/blog/${post.slug}`} />}
              <Link href="/admin/blog" className="adm-btn adm-btn-secondary">
                Cancel
              </Link>
              <button type="submit" disabled={pending} className="adm-btn adm-btn-primary" style={{ padding: '10px 24px', fontSize: '0.875rem' }}>
                {pending ? 'Saving…' : isEdit ? 'Save Changes' : 'Publish Post'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
