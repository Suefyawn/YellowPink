/**
 * SEO parity gate for the Cloudflare migration (plan rule 2).
 *
 * Crawls every sitemap URL plus every known redirect source on two origins
 * and diffs what search engines see: status, final URL, title, canonical,
 * description, robots, H1, JSON-LD @types, Article dates, OG image,
 * image/link counts and word count. Any unexplained difference is a reason
 * not to cut over.
 *
 *   npx tsx scripts/seo-parity.ts --a https://www.yellowpink.pk --b https://staging.yellowpink.pk
 *   npx tsx scripts/seo-parity.ts --a https://www.yellowpink.pk --save docs/seo/crawl-2026-09-19.json
 *   npx tsx scripts/seo-parity.ts --a docs/seo/crawl-2026-09-19.json --b https://www.yellowpink.pk
 *
 * --a / --b: an origin to crawl, or a saved crawl JSON to compare against.
 *            When --a is a saved crawl, --b is crawled over exactly its paths.
 * --save:    write the crawl of --a to this file (for a before/after diff).
 * --ua:      "browser" (default) or "googlebot"; run both before a cutover.
 * --limit:   only the first N paths (smoke run).
 * Exit code 1 when any URL differs.
 */
import fs from 'node:fs';
import path from 'node:path';

type Page = {
  url: string;
  status: number;
  finalUrl: string;
  title: string | null;
  canonical: string | null;
  description: string | null;
  robots: string | null;
  xRobots: string | null;
  h1: string | null;
  ldTypes: string[];
  datePublished: string | null;
  dateModified: string | null;
  ogImage: string | null;
  images: number;
  internalLinks: number;
  words: number;
  cacheControl: string | null;
};

const UAS = {
  browser: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 seo-parity',
  googlebot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html) seo-parity',
};

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const attr = (html: string, re: RegExp) => html.match(re)?.[1]?.trim() ?? null;
const decode = (s: string | null) => s?.replace(/&amp;/g, '&').replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"') ?? null;

function parse(url: string, res: Response, rawHtml: string): Page {
  // React streams late Suspense content as hidden segments that the browser
  // swaps in; count what a crawler sees before that swap, once, so a boundary
  // that resolves late on one host does not double its links and images.
  const html = rawHtml.replace(/<div hidden id="S:\d+">[\s\S]*?<\/div>(?=<script|$)/g, '');
  const head = html.slice(0, html.indexOf('</head>') >>> 0 || html.length);
  const ldTypes = [...html.matchAll(/"@type"\s*:\s*"([A-Za-z]+)"/g)].map(m => m[1]).sort();
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ');
  // Root-relative hrefs only: share links carry the page URL inside their
  // query string and would count as internal on the production host.
  const internalLinks = [...html.matchAll(/<a\s[^>]*href="([^"]+)"/g)].filter(m => m[1].startsWith('/')).length;
  return {
    url,
    status: res.status,
    finalUrl: res.url,
    title: decode(attr(head, /<title>([^<]*)<\/title>/)),
    canonical: attr(head, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/),
    description: decode(attr(head, /<meta[^>]+name="description"[^>]+content="([^"]*)"/)),
    robots: attr(head, /<meta[^>]+name="robots"[^>]+content="([^"]*)"/),
    xRobots: res.headers.get('x-robots-tag'),
    h1: decode(attr(html, /<h1[^>]*>([\s\S]*?)<\/h1>/)?.replace(/<[^>]+>/g, '') ?? null),
    ldTypes: [...new Set(ldTypes)],
    datePublished: attr(html, /"datePublished"\s*:\s*"([^"]+)"/),
    dateModified: attr(html, /"dateModified"\s*:\s*"([^"]+)"/),
    ogImage: attr(head, /<meta[^>]+property="og:image"[^>]+content="([^"]*)"/),
    images: (html.match(/<img\s/g) ?? []).length,
    internalLinks,
    words: text.split(/\s+/).filter(Boolean).length,
    cacheControl: res.headers.get('cache-control'),
  };
}

async function fetchPage(origin: string, pathname: string, ua: string): Promise<Page> {
  const url = origin + pathname;
  // Follow redirects so finalUrl + status describe what a crawler lands on.
  const res = await fetch(url, { headers: { 'user-agent': ua, accept: 'text/html' }, redirect: 'follow' });
  const html = res.headers.get('content-type')?.includes('html') ? await res.text() : '';
  return parse(url, res, html);
}

async function sitemapPaths(origin: string): Promise<string[]> {
  const xml = await (await fetch(origin + '/sitemap.xml')).text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => new URL(m[1]).pathname);
}

function redirectPaths(): string[] {
  // The redirects table (admin-managed), next.config.ts redirects and the
  // WordPress patterns in src/proxy.ts; regenerate before each cutover.
  const file = path.join('docs', 'seo', 'redirect-sources.txt');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).filter(l => l.startsWith('/'));
}

const EMPTY = (url: string, err: unknown): Page => ({ url, status: 0, finalUrl: String(err), title: null, canonical: null, description: null, robots: null, xRobots: null, h1: null, ldTypes: [], datePublished: null, dateModified: null, ogImage: null, images: 0, internalLinks: 0, words: 0, cacheControl: null });

async function crawl(origin: string, ua: string, limit?: number, only?: string[]): Promise<Record<string, Page>> {
  const paths = only ?? [...new Set([...(await sitemapPaths(origin)), ...redirectPaths(), '/robots.txt', '/sitemap.xml'])];
  const todo = limit ? paths.slice(0, limit) : paths;
  const out: Record<string, Page> = {};
  let i = 0;
  // ponytail: 8-way concurrency, enough for ~950 URLs in a few minutes.
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (i < todo.length) {
      const p = todo[i++];
      try { out[p] = await fetchPage(origin, p, ua); }
      catch (e) { out[p] = EMPTY(origin + p, e); }
      if (i % 50 === 0) console.error(`  ${i}/${todo.length}`);
    }
  }));
  return out;
}

async function load(source: string, ua: string, limit?: number, only?: string[]): Promise<Record<string, Page>> {
  if (!source.startsWith('http')) return JSON.parse(fs.readFileSync(source, 'utf8'));
  console.error(`crawling ${source}`);
  return crawl(source, ua, limit, only);
}

/** Origin-relative so www.yellowpink.pk vs staging.yellowpink.pk compare
 *  equal. The production host is stripped on both sides too: a staging build
 *  correctly canonicalises to production, and a local Worker carries whatever
 *  NEXT_PUBLIC_SITE_URL the build inlined. */
const PRODUCTION = 'https://www.yellowpink.pk';
function rel(v: string | null, origin: string) {
  return v ? v.replace(origin, '').replace(PRODUCTION, '') : v;
}

function diff(a: Page, b: Page, oa: string, ob: string): string[] {
  const out: string[] = [];
  const cmp = (k: keyof Page, va: unknown, vb: unknown) => { if (JSON.stringify(va) !== JSON.stringify(vb)) out.push(`${k}: ${JSON.stringify(va)} -> ${JSON.stringify(vb)}`); };
  cmp('status', a.status, b.status);
  cmp('finalUrl', rel(a.finalUrl, oa), rel(b.finalUrl, ob));
  // cacheControl is reported, not compared: vinext answers browsers with
  // private/must-revalidate and caches at the edge itself, Vercel sent
  // s-maxage. robots/xRobots differ on staging by design (NOINDEX=1), so they
  // are compared only when neither side is a staging or local host.
  const staging = /staging\.|127\.0\.0\.1|localhost/.test(oa + ob);
  for (const k of ['title', 'description', 'h1', 'ldTypes', 'datePublished', 'dateModified', 'images', 'internalLinks'] as const) cmp(k, a[k], b[k]);
  if (!staging) for (const k of ['robots', 'xRobots'] as const) cmp(k, a[k], b[k]);
  // Canonical and og:image must be the production host on both sides once
  // live, but on staging they legitimately carry the staging host.
  cmp('canonical', rel(a.canonical, oa), rel(b.canonical, ob));
  // The default social card carries a build hash in its query string.
  cmp('ogImage', rel(a.ogImage, oa)?.split('?')[0] ?? null, rel(b.ogImage, ob)?.split('?')[0] ?? null);
  if (Math.abs(a.words - b.words) > Math.max(20, a.words * 0.03)) out.push(`words: ${a.words} -> ${b.words}`);
  return out;
}

const originOf = (source: string, pages: Record<string, Page>) =>
  source.startsWith('http') ? source : (Object.values(pages)[0]?.url.match(/^https?:\/\/[^/]+/)?.[0] ?? '');

async function main() {
  const a = arg('a'); const b = arg('b'); const save = arg('save');
  const ua = UAS[(arg('ua') ?? 'browser') as keyof typeof UAS];
  const limit = arg('limit') ? Number(arg('limit')) : undefined;
  if (!a || !ua) { console.error('usage: --a <origin|json> [--b <origin|json>] [--save file] [--ua browser|googlebot] [--limit N]'); process.exit(2); }
  const A = await load(a, ua, limit);
  if (save) { fs.mkdirSync(path.dirname(save), { recursive: true }); fs.writeFileSync(save, JSON.stringify(A, null, 1)); console.error(`saved ${Object.keys(A).length} pages to ${save}`); }
  if (!b) {
    const bad = Object.values(A).filter(p => p.status !== 200);
    console.log(`${Object.keys(A).length} pages, ${bad.length} non-200`);
    for (const p of bad) console.log(`  ${p.status} ${p.url} -> ${p.finalUrl}`);
    process.exit(bad.length ? 1 : 0);
  }
  const paths = Object.keys(A).slice(0, limit ?? Object.keys(A).length);
  const B = await load(b, ua, limit, paths);
  const oa = originOf(a, A); const ob = originOf(b, B);
  let bad = 0;
  for (const p of paths) {
    if (!B[p]) { bad++; console.log(`MISSING on B: ${p}`); continue; }
    const d = diff(A[p], B[p], oa, ob);
    if (d.length) { bad++; console.log(`DIFF ${p}\n  ${d.join('\n  ')}`); }
  }
  console.log(`${paths.length} pages compared, ${bad} differ`);
  process.exit(bad ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(2); });
