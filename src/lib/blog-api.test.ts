import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import {
  authorizeBlogApi,
  idColumn,
  blogApiCreateSchema,
  blogApiUpdateSchema,
} from './blog-api';

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
