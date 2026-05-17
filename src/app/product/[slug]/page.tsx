// ISR: cache the rendered PDP for 5 min; admin edits call revalidatePath('/product/...') to bust.
export const revalidate = 300;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, supabase } from '@/lib/supabase';
import { PDPPage } from '@/sections/pdp/PDPPage';
import { ReviewsSection } from '@/components/pdp/ReviewsSection';
import { RecentlyViewed } from '@/components/pdp/RecentlyViewed';
import { FrequentlyBoughtTogether } from '@/components/pdp/FrequentlyBoughtTogether';
import { pageMeta, jsonLd, productLd, breadcrumbLd } from '@/lib/seo';
import type { Product, ProductReview, ProductImage, ProductVariant, ProductAttribute, AttributeValue } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  const title = `${product.brand} ${product.name}${product.variant ? ` — ${product.variant}` : ''}`;
  const description = `Buy ${product.brand} ${product.name} in Pakistan. PKR ${product.price.toLocaleString()}. Fast COD delivery nationwide.`;
  return pageMeta({
    title,
    description,
    path: `/product/${product.slug}`,
    image: product.image_url ?? undefined,
    type: 'product',
    keywords: [product.brand, product.name, product.category, 'Pakistan', 'COD'],
  });
}

// Each variant carries the option ids that identify it (e.g. [shade=coral, size=250ml]).
export interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

async function loadVariantData(productId: string): Promise<{
  variants: VariantWithOptions[];
  attributes: AttributeWithValues[];
}> {
  const { data: variantRows } = await supabase
    .from('product_variants')
    .select('id, product_id, sku, price, compare_at_price, stock, image_url, weight_grams, enabled, sort_order')
    .eq('product_id', productId)
    .eq('enabled', true)
    .order('sort_order');

  const variants = (variantRows ?? []) as ProductVariant[];
  if (variants.length === 0) return { variants: [], attributes: [] };

  const variantIds = variants.map(v => v.id);
  const { data: vavRows } = await supabase
    .from('variant_attribute_values')
    .select('variant_id, attribute_value_id')
    .in('variant_id', variantIds);

  const valueIds = Array.from(new Set((vavRows ?? []).map(r => r.attribute_value_id as string)));
  if (valueIds.length === 0) return { variants: variants.map(v => ({ ...v, option_value_ids: [] })), attributes: [] };

  const { data: valueRows } = await supabase
    .from('attribute_values')
    .select('id, attribute_id, slug, value, color_hex, image_url, sort_order')
    .in('id', valueIds)
    .order('sort_order');

  const values = (valueRows ?? []) as AttributeValue[];
  const attributeIds = Array.from(new Set(values.map(v => v.attribute_id)));

  const { data: attrRows } = await supabase
    .from('product_attributes')
    .select('id, slug, name, visible_on_pdp, usable_in_filter, sort_order')
    .in('id', attributeIds)
    .order('sort_order');

  const attributes: AttributeWithValues[] = ((attrRows ?? []) as ProductAttribute[]).map(a => ({
    ...a,
    values: values.filter(v => v.attribute_id === a.id),
  }));

  // Build variant.option_value_ids lookup.
  const byVariant = new Map<string, string[]>();
  for (const row of vavRows ?? []) {
    const list = byVariant.get(row.variant_id as string) ?? [];
    list.push(row.attribute_value_id as string);
    byVariant.set(row.variant_id as string, list);
  }
  const variantsWithOptions: VariantWithOptions[] = variants.map(v => ({
    ...v,
    option_value_ids: byVariant.get(v.id) ?? [],
  }));

  return { variants: variantsWithOptions, attributes };
}

async function loadGallery(productId: string): Promise<ProductImage[]> {
  const { data } = await supabase
    .from('product_images')
    .select('id, product_id, variant_id, url, alt, sort_order')
    .eq('product_id', productId)
    .order('sort_order');
  return (data ?? []) as ProductImage[];
}

async function loadFrequentlyBoughtTogether(productId: string): Promise<Product[]> {
  // RPC returns [{ product_id, co_count }] ordered desc.
  const { data, error } = await supabase.rpc('frequently_bought_with' as never, {
    p_product_id: productId,
    p_limit:      4,
  } as never);
  if (error) return [];
  const rows = (data ?? []) as Array<{ product_id: string; co_count: number }>;
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.product_id);
  const { data: products } = await supabase.from('products').select('*').in('id', ids);
  const map = new Map(((products ?? []) as Product[]).map(p => [p.id, p]));
  // Preserve RPC order.
  return ids.map(id => map.get(id)).filter((p): p is Product => Boolean(p));
}

async function loadCrossSells(productId: string, fallbackCategory: string): Promise<Product[]> {
  // Prefer explicit cross-sells / upsells from product_relations.
  const { data: rels } = await supabase
    .from('product_relations')
    .select('related_product_id, kind, sort_order')
    .eq('product_id', productId)
    .in('kind', ['cross_sell', 'upsell'])
    .order('sort_order')
    .limit(8);

  const relatedIds = Array.from(new Set((rels ?? []).map(r => r.related_product_id as string)));

  if (relatedIds.length > 0) {
    const { data } = await supabase.from('products').select('*').in('id', relatedIds);
    const map = new Map(((data ?? []) as Product[]).map(p => [p.id, p]));
    return relatedIds.map(id => map.get(id)).filter((p): p is Product => Boolean(p)).slice(0, 4);
  }

  // Fallback: same category.
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('category', fallbackCategory)
    .neq('id', productId)
    .limit(8);
  return ((data ?? []) as Product[]).sort(() => Math.random() - 0.5).slice(0, 4);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const [{ data: reviewRows }, variantData, gallery, crossSells, fbt] = await Promise.all([
    supabase
      .from('product_reviews')
      .select('id, author_name, rating, body, created_at, photo_urls, verified_purchase, helpful_count')
      .eq('product_id', product.id)
      .eq('approved', true)
      .order('created_at', { ascending: false }),
    product.kind === 'variable' ? loadVariantData(product.id) : Promise.resolve({ variants: [], attributes: [] }),
    loadGallery(product.id),
    loadCrossSells(product.id, product.category),
    loadFrequentlyBoughtTogether(product.id),
  ]);

  const reviews = (reviewRows ?? []) as Pick<ProductReview, 'id' | 'author_name' | 'rating' | 'body' | 'created_at' | 'photo_urls' | 'verified_purchase' | 'helpful_count'>[];

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productLd(product, reviews)) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd([
            { name: 'Home',           path: '/' },
            { name: 'Shop',           path: '/shop' },
            { name: product.category, path: `/shop?cat=${encodeURIComponent(product.category)}` },
            { name: product.name,     path: `/product/${product.slug}` },
          ])),
        }}
      />
      <PDPPage
        product={product}
        relatedProducts={crossSells}
        variants={variantData.variants}
        attributes={variantData.attributes}
        gallery={gallery}
      />
      <FrequentlyBoughtTogether anchor={product} suggestions={fbt} />
      <ReviewsSection productId={product.id} reviews={reviews} />
      <RecentlyViewed currentProductId={product.id} />
    </main>
  );
}
