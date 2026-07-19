// Google Merchant Center product feed (RSS 2.0 + g: namespace).
//
// Submit this URL, https://www.yellowpink.pk/feeds/google-merchant.xml, as a
// scheduled-fetch feed in Merchant Center → Products → Feeds. Google re-reads
// it on whatever cadence you set there; one fetch a day is the typical choice.
// We don't paginate: the catalogue is well under the 150 000-item-per-feed cap.
//
// Field reference: https://support.google.com/merchants/answer/7052112
//
// Items emitted at the parent-product level (one row per /product/[slug]).
// Variant-level emission with item_group_id is a future expansion if/when we
// want per-variant prices to show in Shopping; for now Shopping shows the
// parent price and the PDP handles variant selection.

import { supabase, isDemo } from '@/lib/supabase';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo';
import { googleProductCategory } from '@/lib/google-product-category';
import { loadFeedVariants, type FeedVariant } from '@/lib/product-feed';

export const revalidate = 3600; // 1h, Merchant Center polls daily, this is plenty.
// Read live rows on every regeneration — without this the route's Supabase
// fetches sit in the persistent Data Cache and the feed freezes (see the
// matching note in app/sitemap.ts; a stale Merchant feed risks disapprovals).
export const fetchCache = 'force-no-store';

interface FeedProduct {
  id: string;
  slug: string;
  name: string;
  brand: string | null;
  description: string | null;
  short_description: string | null;
  image_url: string | null;
  price: number;
  original_price: number | null;
  stock: number;
  track_inventory: boolean | null;
  category: string | null;
  status: string | null;
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Merchant Center hard-limits the description at 5000 chars and the title at
// 150 chars. We keep the description shorter (1000) so it stays a meaningful
// summary rather than a wall of marketing copy, and we strip HTML, feed text
// must be plain.
function clean(text: string | null, max: number): string {
  if (!text) return '';
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > max ? stripped.slice(0, max - 1).trimEnd() + '…' : stripped;
}

// Emits one <item>. With a `variant`, the row represents that single variant
// (its own id, price, stock, image) grouped under the parent via item_group_id;
// without one, it's the parent product row (products with no variants).
function item(p: FeedProduct, variant?: FeedVariant): string {
  const baseTitle = p.brand ? `${p.brand}, ${p.name}` : p.name;
  const title = clean(variant ? `${baseTitle}, ${variant.label}` : baseTitle, 150);
  const description = clean(p.description || p.short_description || p.name, 1000);
  const link = absoluteUrl(`/product/${p.slug}`);
  const imageLink = (variant?.image_url ?? p.image_url) ?? '';
  const stock = variant ? variant.stock : p.stock;
  const available =
    p.track_inventory === false || stock > 0 ? 'in_stock' : 'out_of_stock';
  // Merchant Center convention: g:price is the regular/MSRP price, g:sale_price
  // is the discounted price. When the compare-at price is higher, the item is
  // on sale, show both so Shopping can render the strikethrough.
  const basePrice = variant ? variant.price : p.price;
  const compareAt = variant ? variant.compare_at_price : p.original_price;
  const onSale = compareAt != null && compareAt > basePrice;
  const regularPrice = onSale ? compareAt! : basePrice;
  const salePrice = onSale ? basePrice : null;

  const lines = [
    `    <item>`,
    // Human-readable stable ids (slug / slug--sku) so feed rows match the
    // Product JSON-LD `sku` and read sensibly in Merchant Center diagnostics.
    // Safe to choose now: the feed has never been submitted, so no id history
    // exists to preserve.
    `      <g:id>${xmlEscape(variant ? `${p.slug}--${variant.sku || variant.id}` : p.slug)}</g:id>`,
    variant ? `      <g:item_group_id>${xmlEscape(p.slug)}</g:item_group_id>` : '',
    `      <g:title>${xmlEscape(title)}</g:title>`,
    `      <g:description>${xmlEscape(description)}</g:description>`,
    `      <g:link>${xmlEscape(link)}</g:link>`,
    imageLink ? `      <g:image_link>${xmlEscape(imageLink)}</g:image_link>` : '',
    `      <g:availability>${available}</g:availability>`,
    `      <g:price>${regularPrice} PKR</g:price>`,
    salePrice != null ? `      <g:sale_price>${salePrice} PKR</g:sale_price>` : '',
    variant?.sku ? `      <g:mpn>${xmlEscape(variant.sku)}</g:mpn>` : '',
    `      <g:condition>new</g:condition>`,
    p.brand ? `      <g:brand>${xmlEscape(p.brand)}</g:brand>` : '',
    // Most imported beauty SKUs we resell don't have a GTIN/MPN we can publish.
    // identifier_exists=no tells Merchant Center to skip the unique-product-
    // identifier requirement rather than reject the row.
    `      <g:identifier_exists>no</g:identifier_exists>`,
    // google_product_category MUST come from Google's taxonomy, so map the
    // internal label to a valid taxonomy ID (falls back to Health & Beauty).
    // product_type stays the free-form internal category.
    `      <g:google_product_category>${googleProductCategory(p.category)}</g:google_product_category>`,
    p.category ? `      <g:product_type>${xmlEscape(p.category)}</g:product_type>` : '',
    `    </item>`,
  ].filter(Boolean);
  return lines.join('\n');
}

async function loadProducts(): Promise<FeedProduct[]> {
  if (isDemo) {
    const { DEMO_PRODUCTS } = await import('@/lib/demo-data');
    return DEMO_PRODUCTS.map(p => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand ?? null,
      description: p.description ?? null,
      short_description: p.short_description ?? null,
      image_url: p.image_url ?? null,
      price: p.price,
      original_price: p.original_price ?? null,
      stock: p.stock,
      track_inventory: p.track_inventory ?? true,
      category: p.category ?? null,
      status: 'published',
    }));
  }
  const { data } = await supabase
    .from('products')
    .select('id, slug, name, brand, description, short_description, image_url, price, original_price, stock, track_inventory, category, status')
    .eq('status', 'published');
  return (data ?? []) as FeedProduct[];
}

export async function GET(): Promise<Response> {
  const products = (await loadProducts()).filter(p => p.image_url); // Merchant Center requires an image_link
  // Products with variants emit one row per variant (grouped by item_group_id);
  // products without variants emit a single parent row.
  const variantsByProduct = isDemo ? new Map<string, FeedVariant[]>() : await loadFeedVariants(products.map(p => p.id));
  const items = products
    .map(p => {
      const vs = variantsByProduct.get(p.id);
      return vs && vs.length ? vs.map(v => item(p, v)).join('\n') : item(p);
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>${xmlEscape(`${SITE_NAME} product feed for Google Merchant Center`)}</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      // Merchant Center fetches this URL directly; it should never appear as
      // its own result in regular Google Search.
      'X-Robots-Tag': 'noindex',
    },
  });
}
