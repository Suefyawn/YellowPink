import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitize';

describe('sanitizeHtml', () => {
  it('strips scripts and event handlers', () => {
    expect(sanitizeHtml('<p onclick="x()">hi</p><script>evil()</script>')).toBe('<p>hi</p>');
  });

  it('neutralises javascript: hrefs', () => {
    expect(sanitizeHtml('<a href="javascript:alert(1)">x</a>')).toContain('href="#"');
  });

  it('adds noopener + noreferrer + target to external links, and does NOT nofollow editorial citations', () => {
    const out = sanitizeHtml('<a href="https://example.com/page">ref</a>');
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noreferrer[^"]*"/);
    expect(out).not.toMatch(/nofollow/);
    expect(out).toContain('target="_blank"');
  });

  it('merges into an existing rel (an editor-written nofollow or sponsored survives) and keeps target', () => {
    const out = sanitizeHtml('<a href="https://example.com" rel="sponsored nofollow" target="_self">x</a>');
    expect(out).toMatch(/rel="[^"]*sponsored[^"]*"/);
    expect(out).toMatch(/rel="[^"]*nofollow[^"]*"/);
    expect(out).toMatch(/rel="[^"]*noopener[^"]*"/);
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

// Stored-XSS regression, found by the 14 Sep 2026 security review.
//
// sanitizeHtml stripped event handlers with two passes that both required the
// value to be QUOTED. Tags that allow attributes (a, span, img) were then
// returned untouched, so an UNQUOTED handler survived the whole sanitizer and
// reached dangerouslySetInnerHTML. Anyone with CMS or blog-API write access
// could store script that ran for every reader.
describe('sanitizeHtml strips unquoted event handlers', () => {
  const payloads = [
    '<span onmouseover=alert(1)>hover</span>',
    '<a href="/x" onmouseover=alert(1)>click</a>',
    '<img src="/blog-heroes/a.webp" onerror=alert(1)>',
    '<a href="/x" ONMOUSEOVER=alert(1)>upper</a>',
    '<span onmouseover = alert(1) >spaced</span>',
    '<img src="/blog-heroes/a.webp" onload=alert`1`>',
  ];

  it.each(payloads)('removes the handler from %s', p => {
    const out = sanitizeHtml(p);
    expect(out).not.toMatch(/\son\w+/i);
    expect(out).not.toContain('alert');
  });

  it('still strips the quoted form it always caught', () => {
    expect(sanitizeHtml('<span onmouseover="alert(1)">x</span>')).toBe('<span>x</span>');
  });

  it('keeps the attributes each tag is actually allowed', () => {
    expect(sanitizeHtml('<a href="/shop" target="_blank" rel="noopener">go</a>'))
      .toContain('href="/shop"');
    expect(sanitizeHtml('<img src="/blog-heroes/a.webp" alt="A hero" width="1216" height="688">'))
      .toBe('<img src="/blog-heroes/a.webp" alt="A hero" width="1216" height="688">');
  });

  it('drops attributes outside the allowlist', () => {
    const out = sanitizeHtml('<a href="/x" formaction="/evil" data-x="1" srcdoc="y">t</a>');
    expect(out).toContain('href="/x"');
    expect(out).not.toContain('formaction');
    expect(out).not.toContain('srcdoc');
  });

  it('re-quotes values so one cannot break out of its attribute', () => {
    const out = sanitizeHtml('<a href=/x" onmouseover=alert(1)>t</a>');
    expect(out).not.toMatch(/\son\w+/i);
  });

  it('leaves closing tags intact', () => {
    expect(sanitizeHtml('<a href="/x">t</a>')).toContain('</a>');
  });
});
