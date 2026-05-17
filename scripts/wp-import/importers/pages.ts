// WordPress pages → public.pages.

import { wp } from '../wp';
import { upsertBatched } from '../sb';

interface WpPage {
  id: number;
  date: string;
  slug: string;
  status: 'publish' | 'draft' | 'private';
  title:   { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  menu_order?: number;
  yoast_head_json?: { title?: string; description?: string };
}

function plain(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const pages: WpPage[] = [];
  for await (const p of wp.paginate<WpPage>('/pages', { per_page: 100, status: 'publish' })) {
    pages.push(p);
  }
  if (pages.length === 0) return { imported: 0, skipped: 0, errors };

  const rows = pages.map(p => ({
    wp_page_id:       p.id,
    slug:             p.slug,
    title:            plain(p.title?.rendered ?? '') || p.slug,
    body_html:        p.content?.rendered ?? '',
    excerpt:          plain(p.excerpt?.rendered ?? '').slice(0, 320) || null,
    status:           'published' as const,
    meta_title:       p.yoast_head_json?.title ?? null,
    meta_description: p.yoast_head_json?.description ?? null,
    show_in_footer:   /privacy|terms|shipping|refund|return|about|contact|faq/i.test(p.slug),
    sort_order:       p.menu_order ?? 0,
  }));

  const ins = await upsertBatched('pages', rows, { onConflict: 'wp_page_id' });
  errors.push(...ins.errors);
  return { imported: ins.inserted, skipped: 0, errors };
}
