import { describe, it, expect } from 'vitest';
import { rewriteWaMeLinks } from './whatsapp';

// The six CMS pages the 14 Sep 2026 Semrush audit flagged (terms-and-conditions,
// shipping, returns, faq, editorial-standards, disclaimer) all carried the same
// raw wa.me number in an anchor href. These cover that shape plus the variants
// an editor could plausibly paste.
describe('rewriteWaMeLinks', () => {
  it('rewrites a bare wa.me href to the internal redirect', () => {
    const html = '<p>Message us on <a href="https://wa.me/923004374577">WhatsApp</a>.</p>';
    expect(rewriteWaMeLinks(html, 'page-faq')).toBe(
      '<p>Message us on <a href="/go/whatsapp?src=page-faq">WhatsApp</a>.</p>',
    );
  });

  it('carries a pre-typed ?text= message across', () => {
    const html = '<a href="https://wa.me/923004374577?text=Hi%20there">Chat</a>';
    const out = rewriteWaMeLinks(html, 'page-returns');
    expect(out).toContain('text=Hi+there');
    expect(out).toContain('src=page-returns');
    expect(out).not.toContain('wa.me');
  });

  it('handles the &amp;-escaped query an HTML editor produces', () => {
    const html = '<a href="https://wa.me/923004374577?text=Hello&amp;utm=x">Chat</a>';
    expect(rewriteWaMeLinks(html)).toBe('<a href="/go/whatsapp?text=Hello&amp;src=cms">Chat</a>');
  });

  it('rewrites api.whatsapp.com, protocol-relative and single-quoted forms', () => {
    expect(rewriteWaMeLinks("<a href='https://api.whatsapp.com/send?phone=923004374577'>a</a>"))
      .toBe("<a href='/go/whatsapp?src=cms'>a</a>");
    expect(rewriteWaMeLinks('<a href="//wa.me/923004374577">a</a>'))
      .toBe('<a href="/go/whatsapp?src=cms">a</a>');
    expect(rewriteWaMeLinks('<a href="http://wa.me/923004374577">a</a>'))
      .toBe('<a href="/go/whatsapp?src=cms">a</a>');
  });

  it('rewrites every occurrence on a page, not just the first', () => {
    // terms-and-conditions carried three; returns carried two.
    const html = '<a href="https://wa.me/923004374577">one</a> and <a href="https://wa.me/923004374577">two</a>';
    expect(html.match(/wa\.me/g)).toHaveLength(2);
    expect(rewriteWaMeLinks(html)).not.toContain('wa.me');
  });

  it('leaves a wa.me URL that is visible text, not a link, alone', () => {
    // The Shipping and FAQ pages print the number for humans to read; only the
    // crawlable href is the problem.
    const html = '<p>Our number is https://wa.me/923004374577 — save it.</p>';
    expect(rewriteWaMeLinks(html)).toBe(html);
  });

  it('does not touch other links', () => {
    const html = '<a href="/page/contact">Contact</a><a href="mailto:hello@yellowpink.pk">Email</a>';
    expect(rewriteWaMeLinks(html)).toBe(html);
  });
});
