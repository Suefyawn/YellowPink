// WordPress posts → public.blog_posts. Featured image goes through media uploader.

import { wp } from '../wp';
import { upsertBatched } from '../sb';
import { uploadIfNeeded } from '../media';

interface WpPost {
  id: number;
  date: string;
  modified: string;
  slug: string;
  status: 'publish' | 'draft' | 'private';
  title: { rendered: string };
  content: { rendered: string };
  excerpt: { rendered: string };
  featured_media: number;
  categories?: number[];
  _embedded?: {
    'wp:featuredmedia'?: Array<{ id: number; source_url: string; alt_text?: string }>;
    'wp:term'?: Array<Array<{ id: number; name: string; taxonomy: string }>>;
  };
}

function plain(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/(script|style)>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim();
}

function readingTime(text: string): string {
  const words = text.split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.ceil(words / 200))} min read`;
}

export async function run(): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  const posts: WpPost[] = [];
  for await (const p of wp.paginate<WpPost>('/posts', { per_page: 50, status: 'publish', _embed: 1 })) {
    posts.push(p);
  }
  if (posts.length === 0) return { imported: 0, skipped: 0, errors };

  const rows = await Promise.all(posts.map(async p => {
    const fm = p._embedded?.['wp:featuredmedia']?.[0];
    const m = fm ? await uploadIfNeeded({ id: fm.id, source_url: fm.source_url, alt_text: fm.alt_text }) : null;
    const cats = p._embedded?.['wp:term']?.[0]?.filter(t => t.taxonomy === 'category') ?? [];
    const plainBody = plain(p.content?.rendered ?? '');
    return {
      wp_post_id:   p.id,
      slug:         p.slug,
      title:        plain(p.title?.rendered ?? '') || p.slug,
      excerpt:      plain(p.excerpt?.rendered ?? '').slice(0, 300) || plainBody.slice(0, 300),
      category:     cats[0]?.name ?? 'General',
      date:         p.date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      read_time:    readingTime(plainBody),
      featured:     false,
      body:         p.content?.rendered ?? null,           // keep HTML
      image_url:    m?.url ?? fm?.source_url ?? null,
    };
  }));

  const ins = await upsertBatched('blog_posts', rows, { onConflict: 'wp_post_id' });
  errors.push(...ins.errors);
  return { imported: ins.inserted, skipped: 0, errors };
}
