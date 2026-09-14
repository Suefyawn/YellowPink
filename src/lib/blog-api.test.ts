import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  authorizeBlogApi,
  idColumn,
  blogApiCreateSchema,
  blogApiUpdateSchema,
  unknownKeyError,
} from './blog-api';
import { deriveReadTime } from './reading-time';

function req(authHeader?: string): NextRequest {
  return new NextRequest('https://www.yellowpink.pk/api/blog', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('idColumn', () => {
  it('treats a UUID as the id column', () => {
    expect(idColumn('3f2504e0-4f89-41d3-9a0c-0305e82c3301')).toBe('id');
  });
  it('treats anything else as a slug', () => {
    expect(idColumn('how-to-increase-sperm-count')).toBe('slug');
    expect(idColumn('not-a-uuid')).toBe('slug');
  });
});

describe('authorizeBlogApi', () => {
  const original = process.env.BLOG_API_TOKEN;
  beforeEach(() => { process.env.BLOG_API_TOKEN = 'secret-token-123'; });
  afterEach(() => { process.env.BLOG_API_TOKEN = original; });

  it('returns 503 when the token is not configured', () => {
    delete process.env.BLOG_API_TOKEN;
    const res = authorizeBlogApi(req('Bearer secret-token-123'));
    expect(res?.status).toBe(503);
  });

  it('returns 401 when the header is missing', () => {
    expect(authorizeBlogApi(req())?.status).toBe(401);
  });

  it('returns 401 on a wrong token', () => {
    expect(authorizeBlogApi(req('Bearer nope'))?.status).toBe(401);
  });

  it('returns 401 on a token that shares a prefix but differs in length', () => {
    expect(authorizeBlogApi(req('Bearer secret-token-1'))?.status).toBe(401);
  });

  it('authorizes a correct bearer token (null = pass)', () => {
    expect(authorizeBlogApi(req('Bearer secret-token-123'))).toBeNull();
  });

  it('is case-insensitive on the Bearer scheme', () => {
    expect(authorizeBlogApi(req('bearer secret-token-123'))).toBeNull();
  });
});

describe('blogApiCreateSchema', () => {
  const valid = {
    title: 'Test Post',
    slug: 'test-post',
    excerpt: 'An excerpt.',
    category: 'Wellness',
    date: '2026-06-22',
  };

  it('accepts a minimal valid payload', () => {
    expect(blogApiCreateSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects an invalid (uppercase) slug', () => {
    expect(blogApiCreateSchema.safeParse({ ...valid, slug: 'Test_Post' }).success).toBe(false);
  });

  it('accepts a site-relative image path (admin form would reject this)', () => {
    const r = blogApiCreateSchema.safeParse({ ...valid, image_url: '/blog-heroes/x.webp' });
    expect(r.success).toBe(true);
  });

  it('accepts an absolute https image url', () => {
    const r = blogApiCreateSchema.safeParse({ ...valid, image_url: 'https://cdn.example.com/x.png' });
    expect(r.success).toBe(true);
  });

  it('rejects a bare (scheme-less, non-relative) image url', () => {
    const r = blogApiCreateSchema.safeParse({ ...valid, image_url: 'example.com/x.png' });
    expect(r.success).toBe(false);
  });
});

describe('blogApiUpdateSchema', () => {
  it('accepts an empty object (route guards against no-op separately)', () => {
    expect(blogApiUpdateSchema.safeParse({}).success).toBe(true);
  });
  it('accepts a single-field patch', () => {
    expect(blogApiUpdateSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });
  it('still validates a slug when present', () => {
    expect(blogApiUpdateSchema.safeParse({ slug: 'Bad Slug' }).success).toBe(false);
  });
});

// Regression for the 13 Sep 2026 scheduled post, which went live with an empty
// body and "3 min read". Two separate defects produced that single outcome.
describe('blog API rejects mistyped fields instead of dropping them', () => {
  const valid = {
    title: 'Best Sunscreen in Pakistan',
    slug: 'best-sunscreen-pakistan',
    excerpt: 'Which SPF to buy and why.',
    category: 'Skincare',
    topic: null,
    date: '2026-09-13',
    featured: false,
    reviewer_id: null,
  };

  it('accepts a well-formed post', () => {
    expect(blogApiCreateSchema.safeParse({ ...valid, body: '<p>Hello</p>' }).success).toBe(true);
  });

  it('rejects `content` rather than silently discarding it', () => {
    // This is the exact call that produced a 201 and an empty post.
    const r = blogApiCreateSchema.safeParse({ ...valid, content: '<p>The whole article</p>' });
    expect(r.success).toBe(false);
  });

  it('names the offending key, and points `content` at `body`', () => {
    const r = blogApiCreateSchema.safeParse({ ...valid, content: '<p>x</p>' });
    expect(r.success).toBe(false);
    if (r.success) return;
    const msg = unknownKeyError(r.error);
    expect(msg).toContain('content');
    expect(msg).toContain('"body"');
  });

  it('rejects unknown keys on PATCH too', () => {
    expect(blogApiUpdateSchema.safeParse({ content: '<p>x</p>' }).success).toBe(false);
  });

  it('returns null from unknownKeyError for ordinary validation failures', () => {
    const r = blogApiCreateSchema.safeParse({ ...valid, title: '' });
    expect(r.success).toBe(false);
    if (r.success) return;
    expect(unknownKeyError(r.error)).toBeNull();
  });
});

describe('blog API read time', () => {
  const valid = {
    title: 'T', slug: 'read-time-post', excerpt: 'E', category: 'Skincare',
    topic: null, date: '2026-09-13', featured: false, reviewer_id: null,
  };

  it('leaves read_time undefined when omitted, so the route can derive it', () => {
    // The admin schema defaults this to the literal '3 min read', which made
    // the route's "blank → derive" branch unreachable for API callers.
    const r = blogApiCreateSchema.safeParse({ ...valid, body: '<p>hi</p>' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.read_time).toBeUndefined();
  });

  it('still honours an explicit read_time', () => {
    const r = blogApiCreateSchema.safeParse({ ...valid, body: '<p>hi</p>', read_time: '8 min read' });
    expect(r.success).toBe(true);
    if (!r.success) return;
    expect(r.data.read_time).toBe('8 min read');
  });

  it('derives a figure that matches the real length of a long post', () => {
    // ~1,890 words was the post that stayed on "3 min read".
    const body = `<p>${'word '.repeat(1890)}</p>`;
    expect(deriveReadTime(body)).toBe('9 min read');
  });
});
