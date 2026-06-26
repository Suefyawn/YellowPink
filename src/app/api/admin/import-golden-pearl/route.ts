// ============================================================================
// One-off / re-runnable importer: pull the full Golden Pearl catalogue
// (goldenpearl.com.pk, a Shopify storefront) and stage every product as a
// DRAFT in our catalogue, with all its images.
//
// Idempotent: products are matched by slug, so re-running only inserts items
// that aren't already present — existing drafts (and any edits an admin has
// made) are left untouched. Guarded by CRON_SECRET; nothing runs unless the
// caller presents the bearer token.
//
// Trigger:  curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
//             https://<site>/api/admin/import-golden-pearl
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SOURCE = 'https://goldenpearl.com.pk';
const BRAND = 'Golden Pearl';

// Shopify product_type → our flat leaf `category`. Anything unmapped falls back
// to Cleansers & Treatments (the broadest skin/personal-care bucket). The exact
// Shopify type is preserved verbatim in `subcategory` so an admin can refine.
const CATEGORY_MAP: Record<string, string> = {
  'Shampoo': 'Hair Care', 'Hair Color': 'Hair Care', 'Hair Oil': 'Hair Care',
  'Haircare Bundle': 'Combo Packs',
  'Face Cream': 'Moisturizers', 'Lotion': 'Moisturizers', 'Moisturizer': 'Moisturizers',
  'Moisturizer Cream': 'Moisturizers', 'Body Butter': 'Moisturizers', 'Skin Shiner': 'Moisturizers',
  'Massage Cream': 'Moisturizers', 'Bulk Face Cream': 'Moisturizers', 'Skin Polish': 'Moisturizers',
  'Sun Block': 'Sunscreens',
  'Body Spray': 'Fragrance',
  'Face Wash': 'Cleansers & Treatments', 'Facial Scrub': 'Cleansers & Treatments',
  'Skin Serum': 'Cleansers & Treatments', 'Cleanser': 'Cleansers & Treatments',
  'Soap': 'Cleansers & Treatments', 'Bleach': 'Cleansers & Treatments',
  'Bleach Powder': 'Cleansers & Treatments', 'Hair Removal Cream': 'Cleansers & Treatments',
  'Face Mask': 'Cleansers & Treatments', 'Facial': 'Cleansers & Treatments',
  'Facial Products': 'Cleansers & Treatments', 'Facial Toner': 'Cleansers & Treatments',
  'Witch Hazel Skin Toner': 'Cleansers & Treatments', 'Rose & Aloe Vera Skin Toner': 'Cleansers & Treatments',
  'Vitamin C Skin Toner': 'Cleansers & Treatments', 'Rose & Vit C Micellar Water': 'Cleansers & Treatments',
  'Hyaluronic & Aloe Micellar Water': 'Cleansers & Treatments', 'Moisturizing Cleansing Milk': 'Cleansers & Treatments',
  'Cream Developers': 'Cleansers & Treatments', '24K Gold Glam Cream Bleach': 'Cleansers & Treatments',
  'Bulk 24K Gold Glam Cream Bleach': 'Cleansers & Treatments',
  'Bundle': 'Combo Packs', 'Skincare Bundle': 'Combo Packs', 'Facial Jars Bundle': 'Combo Packs',
  'Body Care Bundle': 'Combo Packs', 'Facial Kit': 'Combo Packs',
};
const mapCategory = (pt: string) => CATEGORY_MAP[pt] ?? 'Cleansers & Treatments';

// Shopify body_html → clean, readable plain text for our `description` field.
function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null;
  let t = html
    .replace(/<\s*(br|\/p|\/li|\/h[1-6]|\/div)\s*>/gi, '\n')
    .replace(/<\s*li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/gi, "'")
    .replace(/&ldquo;|&rdquo;/gi, '"')
    .replace(/&ndash;|&mdash;/gi, '-')
    .replace(/&hellip;/gi, '...')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F\uFFFD]/g, "")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (t.length > 7800) t = t.slice(0, 7790).trim() + '…';
  return t || null;
}

interface ShopifyVariant { price?: string; compare_at_price?: string | null; grams?: number }
interface ShopifyImage { src: string; alt?: string | null }
interface ShopifyProduct {
  handle: string; title: string; body_html?: string; product_type?: string;
  variants?: ShopifyVariant[]; images?: ShopifyImage[];
}

async function fetchAllProducts(): Promise<ShopifyProduct[]> {
  const all: ShopifyProduct[] = [];
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${SOURCE}/products.json?limit=250&page=${page}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; catalog-import)' },
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`source page ${page} → HTTP ${res.status}`);
    const json = (await res.json()) as { products?: ShopifyProduct[] };
    const batch = json.products ?? [];
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 250) break;
  }
  return all;
}

function authorize(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const auth = req.headers.get('authorization');
  return auth === `Bearer ${expected}`;
}

export async function POST(req: NextRequest) {
  if (!authorize(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const sb = supabaseAdmin();

  let source: ShopifyProduct[];
  try {
    source = await fetchAllProducts();
  } catch (e) {
    return NextResponse.json({ error: `fetch failed: ${(e as Error).message}` }, { status: 502 });
  }

  // Existing slugs (so re-runs and accidental handle collisions never dup).
  const { data: existingRows, error: exErr } = await sb.from('products').select('slug');
  if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
  const taken = new Set<string>((existingRows ?? []).map((r: { slug: string }) => r.slug));

  type Row = {
    brand: string; name: string; price: number; original_price: number | null;
    category: string; subcategory: string | null; slug: string; stock: number;
    track_inventory: boolean; image_url: string | null; description: string | null;
    weight_grams: number | null; kind: string; status: string;
  };
  const rows: Row[] = [];
  const imagesBySlug = new Map<string, { url: string; alt: string }[]>();

  for (const p of source) {
    let slug = p.handle;
    if (taken.has(slug)) slug = `golden-pearl-${slug}`;
    if (taken.has(slug)) continue; // already imported under the namespaced slug
    taken.add(slug);

    const v0 = p.variants?.[0] ?? {};
    const price = Number(v0.price ?? 0);
    const compare = Number(v0.compare_at_price ?? 0);
    rows.push({
      brand: BRAND,
      name: (p.title ?? '').trim().slice(0, 200),
      price: isFinite(price) ? price : 0,
      original_price: compare > price ? compare : null,
      category: mapCategory((p.product_type ?? '').trim()),
      subcategory: (p.product_type ?? '').trim() || null,
      slug,
      stock: 0,
      track_inventory: false,
      image_url: p.images?.[0]?.src ?? null,
      description: htmlToText(p.body_html),
      weight_grams: v0.grams ? Math.round(Number(v0.grams)) : null,
      kind: 'simple',
      status: 'draft',
    });
    imagesBySlug.set(
      slug,
      (p.images ?? []).map((im) => ({ url: im.src, alt: (im.alt || p.title || '').slice(0, 300) })),
    );
  }

  if (dryRun) {
    const dist: Record<string, number> = {};
    rows.forEach((r) => { dist[r.category] = (dist[r.category] ?? 0) + 1; });
    return NextResponse.json({ ok: true, dryRun: true, fetched: source.length, toInsert: rows.length, dist });
  }

  if (rows.length === 0) {
    return NextResponse.json({ ok: true, fetched: source.length, inserted: 0, images: 0, note: 'nothing new' });
  }

  // Bulk-insert products in chunks, collecting id↔slug to attach images.
  const slugToId = new Map<string, string>();
  for (let i = 0; i < rows.length; i += 100) {
    const chunk = rows.slice(i, i + 100);
    const { data, error } = await sb.from('products').insert(chunk).select('id, slug');
    if (error) return NextResponse.json({ error: `product insert: ${error.message}`, insertedSoFar: slugToId.size }, { status: 500 });
    for (const r of (data ?? []) as { id: string; slug: string }[]) slugToId.set(r.slug, r.id);
  }

  // Bulk-insert images for the newly inserted products.
  const imageRows: { product_id: string; url: string; alt: string; sort_order: number }[] = [];
  for (const [slug, imgs] of imagesBySlug) {
    const pid = slugToId.get(slug);
    if (!pid) continue;
    imgs.forEach((im, idx) => imageRows.push({ product_id: pid, url: im.url, alt: im.alt, sort_order: idx }));
  }
  let imagesInserted = 0;
  for (let i = 0; i < imageRows.length; i += 500) {
    const chunk = imageRows.slice(i, i + 500);
    const { error } = await sb.from('product_images').insert(chunk);
    if (error) return NextResponse.json({ error: `image insert: ${error.message}`, inserted: slugToId.size, imagesInserted }, { status: 500 });
    imagesInserted += chunk.length;
  }

  return NextResponse.json({
    ok: true,
    fetched: source.length,
    inserted: slugToId.size,
    images: imagesInserted,
  });
}
