// Markdown for agents: content negotiation on the storefront.
//
// A request for `/`, `/product/<slug>` or `/blog/<slug>` that carries
// `Accept: text/markdown` is rewritten here by src/proxy.ts and gets a plain
// markdown rendering of the same page instead of the HTML. Browsers never send
// that Accept value, so they keep getting HTML. Convention:
// https://developers.cloudflare.com/fundamentals/reference/markdown-for-agents/
//
// The homepage reuses /llms.txt, which already IS the markdown description of
// the store. Products and posts are rendered from their rows; the post body is
// HTML from the editor, flattened to markdown by the small converter below
// (headings, paragraphs, lists, links, tables collapse to rows).

import { NextRequest, NextResponse } from 'next/server';
import { getProductBySlug, getBlogPostBySlug, getProducts } from '@/lib/supabase';
import { renderContentTokens, renderFaqTokens, formatRs } from '@/lib/price-tokens';
import { SITE_URL } from '@/lib/seo';
import { GET as llms } from '../../llms.txt/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Editor HTML → markdown. Good enough for prose: not a full parser. */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/\r/g, '')
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, t) => `\n${'#'.repeat(+n)} ${inline(t)}\n`)
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_, t) => `- ${inline(t)}\n`)
    .replace(/<tr[^>]*>([\s\S]*?)<\/tr>/gi, (_, r: string) =>
      '| ' + [...r.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(m => inline(m[1])).join(' | ') + ' |\n')
    .replace(/<(p|div|blockquote|figure|ul|ol|table)[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .split('\n').map(l => inline(l).trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function inline(s: string): string {
  return s
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) =>
      `[${strip(t)}](${href.startsWith('/') ? SITE_URL + href : href})`)
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+/g, ' ');
}
const strip = (s: string) => s.replace(/<[^>]+>/g, '');

function reply(md: string): NextResponse {
  return new NextResponse(md, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Vary': 'Accept',
      // Rough tokens-per-response hint the convention asks for; 4 chars/token.
      'x-markdown-tokens': String(Math.ceil(md.length / 4)),
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path') ?? '/';

  if (path === '/') return reply(await (await llms()).text());

  const product = path.match(/^\/product\/([^/]+)$/);
  if (product) {
    const p = await getProductBySlug(decodeURIComponent(product[1]));
    if (!p || p.status !== 'published') return new NextResponse('Not found', { status: 404 });
    const faq = renderFaqTokens((p.faq ?? []) as { q: string; a: string }[], [p]) ?? [];
    const md = [
      `# ${p.name}`,
      `Brand: ${p.brand ?? ''}  `,
      `Price: ${formatRs(p.price)} (cash on delivery across Pakistan)  `,
      `URL: ${SITE_URL}${path}`,
      '',
      p.short_description ?? '',
      '',
      renderContentTokens(p.description, [p]),
      p.how_to_use ? `\n## How to use\n${p.how_to_use}` : '',
      p.ingredients ? `\n## Ingredients\n${p.ingredients}` : '',
      faq.length ? `\n## FAQ\n${faq.map(f => `**${f.q}**\n${f.a}`).join('\n\n')}` : '',
    ].join('\n');
    return reply(md);
  }

  const post = path.match(/^\/blog\/([^/]+)$/);
  if (post) {
    const b = await getBlogPostBySlug(decodeURIComponent(post[1]));
    if (!b) return new NextResponse('Not found', { status: 404 });
    const products = await getProducts();
    const body = htmlToMarkdown(renderContentTokens(b.body, products));
    const md = [
      `# ${renderContentTokens(b.title, products)}`,
      `${b.date ? `Published ${b.date}. ` : ''}URL: ${SITE_URL}${path}`,
      '',
      b.excerpt ? `${b.excerpt}\n` : '',
      body,
    ].join('\n');
    return reply(md);
  }

  return new NextResponse('Not found', { status: 404 });
}
