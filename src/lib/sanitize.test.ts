import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('strips scripts and event handlers', () => {
    expect(sanitizeHtml('<p onclick="x()">hi</p><script>evil()</script>')).toBe('<p>hi</p>');
  });

  it('neutralises javascript: hrefs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toContain('href="#"');
  });

  it('adds nofollow + noopener + target to external links', () => {
    const out = sanitizeHtml('<a href="https://example.com/page">ref</a>');
    expect(out).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toContain('target="_blank"');
  });

  it('merges into an existing rel and keeps target', () => {
    const out = sanitizeHtml('<a href="https://example.com" rel="sponsored" target="_self">x</a>');
    expect(out).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(out).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(out).toContain('target="_self"'); // existing target preserved
  });

  it('leaves internal + relative links untouched', () => {
    expect(sanitizeHtml('<a href="/shop">shop</a>')).toBe('<a href="/shop">shop</a>');
    expect(sanitizeHtml('<a href="https://www.yellowpink.pk/blog">blog</a>')).toBe('<a href="https://www.yellowpink.pk/blog">blog</a>');
  });
});

describe('sanitizeHtml — in-body images (editor support, 1 Sep 2026)', () => {
  it('keeps images from our own hosts with allowed attributes', () => {
    const out = sanitizeHtml('<img src="https://images.yellowpink.pk/blog/x.webp" alt="cream" loading="lazy" />');
    expect(out).toContain('src="https://images.yellowpink.pk/blog/x.webp"');
    expect(out).toContain('alt="cream"');
  });

  it('keeps relative-path images', () => {
    expect(sanitizeHtml('<img src="/catalog/x.webp" alt="" />')).toContain('src="/catalog/x.webp"');
  });

  it('drops images hosted anywhere else', () => {
    expect(sanitizeHtml('<img src="https://evil.example.com/pixel.png" />')).not.toContain('<img');
    expect(sanitizeHtml('<img src="http://images.yellowpink.pk/x.png" />')).not.toContain('<img'); // http, not https
    expect(sanitizeHtml('<img src="//evil.example.com/p.png" />')).not.toContain('<img'); // protocol-relative
  });

  it('strips event handlers from an allowed image', () => {
    const out = sanitizeHtml('<img src="/catalog/x.webp" onerror="alert(1)" />');
    expect(out).toContain('<img');
    expect(out).not.toContain('onerror');
  });
});
