// Meta (Facebook / Instagram) product catalog feed, RSS 2.0 + g: namespace.
//
// Submit this URL, https://www.yellowpink.pk/feeds/meta-catalog.xml, in Meta
// Commerce Manager → Catalog → Data sources → Add items → Use a data feed →
// Scheduled feed. Meta re-fetches on the schedule you set (hourly–daily). The
// same catalog powers the Facebook/Instagram Shop and Advantage+ catalog ads.
//
// Meta's data-feed spec mirrors Google's (same g: fields); the only meaningful
// differences we honour here: availability uses the "in stock" / "out of stock"
// phrasing Meta expects, and we keep the catalogue single-feed (well under
// Meta's per-feed item cap). Field reference:
// https://www.facebook.com/business/help/120325381656392
//
// Items are emitted at the parent-product level (one row per /product/[slug]),
// matching the Google feed; variant-level rows with item_group_id are a future
// expansion if per-variant pricing is needed in the Shop.

import { supabase, isDemo } from '@/lib/supabase';
import { SITE_NAME, SITE_URL, absoluteUrl } from '@/lib/seo';
import { googleProductCategory } from '@/lib/google-product-category';
import { loadFeedVariants, type FeedVariant } from '@/lib/product-feed';

export const revalidate = 3600; // 1h, Meta polls on a schedule; this is plenty.

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

// Meta caps the title at 200 chars and the description at 9999; we keep the
// description to a meaningful 1000-char summary and strip HTML, feed text
// must be plain.
function clean(text: string | null, max: number): string {
  if (!text) return '';
  const stripped = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > max ? stripped.slice(0, max - 1).trimEnd() + '…' : stripped;
}

// One <item>. With a `variant`, emits that variant's own row grouped under the
// parent via item_group_id; otherwise the parent product row.
function item(p: FeedProduct, variant?: FeedVariant): string {
  const baseTitle = p.brand ? `${p.brand}, ${p.name}` : p.name;
  const title = clean(variant ? `${baseTitle}, ${variant.label}` : baseTitle, 150);
  const description = clean(p.description || p.short_description || p.name, 1000);
  const link = absoluteUrl(`/product/${p.slug}`);
  const imageLink = (variant?.image_url ?? p.image_url) ?? '';
  const stock = variant ? variant.stock : p.stock;
  // Meta expects "in stock" / "out of stock" (with spaces).
  const available =
    p.track_inventory === false || stock > 0 ? 'in stock' : 'out of stock';
  // g:price is the regular price, g:sale_price the discounted one. When the
  // compare-at price is higher the item is on sale, emit both so the Shop can
  // render the strikethrough.
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
    `      <g:condition>new</g:condition>`,
    `      <g:price>${regularPrice}.00 PKR</g:price>`,
    salePrice != null ? `      <g:sale_price>${salePrice}.00 PKR</g:sale_price>` : '',
    variant?.sku ? `      <g:mpn>${xmlEscape(variant.sku)}</g:mpn>` : '',
    p.brand ? `      <g:brand>${xmlEscape(p.brand)}</g:brand>` : '',
    // Imported resale beauty SKUs rarely carry a GTIN/MPN we can publish.
    `      <g:identifier_exists>no</g:identifier_exists>`,
    // Valid Google-taxonomy category (Meta accepts the same field) + the
    // free-form internal category as product_type.
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
  const products = (await loadProducts()).filter(p => p.image_url); // Meta requires an image_link
  // One row per PRODUCT, with g:id = parent product id. This is deliberate:
  // the Pixel/CAPI send the parent product id as content_ids (the PDP can't
  // know which variant a shopper will pick at view/add time), so a variant-
  // level catalog (g:id = variant id) silently breaks dynamic retargeting for
  // every product that has variants. Parent-level ids keep the catalog and the
  // pixel in lockstep. A variant product is "in stock" if ANY enabled variant
  // is; its price is the parent/base price.
  const variantsByProduct = isDemo ? new Map<string, FeedVariant[]>() : await loadFeedVariants(products.map(p => p.id));
  const items = products
    .map(p => {
      const vs = variantsByProduct.get(p.id);
      if (vs && vs.length) {
        const anyInStock = vs.some(v => v.stock > 0);
        return item({ ...p, stock: anyInStock ? 1 : 0 });
      }
      return item(p);
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xmlEscape(SITE_NAME)}</title>
    <link>${xmlEscape(SITE_URL)}</link>
    <description>${xmlEscape(`${SITE_NAME} product feed for Meta Commerce (Facebook & Instagram Shop)`)}</description>
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Robots-Tag': 'noindex',
    },
  });
}
