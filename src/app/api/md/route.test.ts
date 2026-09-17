import { describe, it, expect } from 'vitest';
import { htmlToMarkdown } from './route';
import { SITE_URL } from '@/lib/seo';

describe('htmlToMarkdown', () => {
  it('flattens editor HTML into markdown', () => {
    const html = `<p>Intro <strong>bold</strong> and <a class="blog-product-link" href="/product/x">a link</a>.</p>
<h2 class="wp-block-heading">Section &amp; more</h2>
<ul class="wp-block-list"><li>one</li><li>two</li></ul>
<figure class="wp-block-table"><table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table></figure>
<a class="blog-cta" href="/brand/y">Shop →</a>`;
    const md = htmlToMarkdown(html);
    expect(md).toContain(`Intro **bold** and [a link](${SITE_URL}/product/x).`);
    expect(md).toContain('## Section & more');
    expect(md).toContain('- one\n- two');
    expect(md).toContain('| A | B |\n| 1 | 2 |');
    expect(md).toContain(`[Shop →](${SITE_URL}/brand/y)`);
    expect(md).not.toMatch(/<[a-z]/);
  });
});
