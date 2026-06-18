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
