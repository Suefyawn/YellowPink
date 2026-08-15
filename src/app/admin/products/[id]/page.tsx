import { notFound } from 'next/navigation';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { ProductForm } from '@/components/admin/ProductForm';
import { VariantsSection } from '@/components/admin/VariantsSection';
import { ProductGallerySection } from '@/components/admin/ProductGallerySection';
import { ProductTagsEditor } from '@/components/admin/ProductTagsEditor';
import { ProductInventoryHistory } from '@/components/admin/ProductInventoryHistory';
import { BundlePricingCard } from '@/components/admin/BundlePricingCard';
import type { BundleComponentRow } from '@/lib/bundle-pricing';
import type { Product, ProductAttribute, AttributeValue, ProductVariant, Vendor } from '@/types';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { AdminFlash } from '@/components/admin/AdminFlash';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

interface VariantWithOptions extends ProductVariant {
  option_value_ids: string[];
}

async function loadAttributesAndVariants(productId: string): Promise<{
  attributes: AttributeWithValues[];
  variants: VariantWithOptions[];
}> {
  // Attributes + values: load every global attribute so the admin can pick.
  const [{ data: attrRows }, { data: valRows }, { data: variantRows }] = await Promise.all([
    supabase.from('product_attributes').select('id, slug, name, visible_on_pdp, usable_in_filter, sort_order').order('sort_order'),
    supabase.from('attribute_values').select('id, attribute_id, slug, value, color_hex, image_url, sort_order').order('sort_order'),
    supabase
      .from('product_variants')
      .select('id, product_id, sku, price, compare_at_price, stock, image_url, weight_grams, enabled, sort_order')
      .eq('product_id', productId)
      .order('sort_order'),
  ]);

  const attributes: AttributeWithValues[] = ((attrRows ?? []) as ProductAttribute[]).map(a => ({
    ...a,
    values: ((valRows ?? []) as AttributeValue[]).filter(v => v.attribute_id === a.id),
  }));

  const variants = (variantRows ?? []) as ProductVariant[];
  const variantIds = variants.map(v => v.id);
  const optionMap = new Map<string, string[]>();
  if (variantIds.length) {
    const { data: vavRows } = await supabase
      .from('variant_attribute_values')
      .select('variant_id, attribute_value_id')
      .in('variant_id', variantIds);
    for (const r of (vavRows ?? []) as Array<{ variant_id: string; attribute_value_id: string }>) {
      const arr = optionMap.get(r.variant_id) ?? [];
      arr.push(r.attribute_value_id);
      optionMap.set(r.variant_id, arr);
    }
  }
  const variantsWithOptions: VariantWithOptions[] = variants.map(v => ({
    ...v,
    option_value_ids: optionMap.get(v.id) ?? [],
  }));

  return { attributes, variants: variantsWithOptions };
}

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ error?: string; created?: string; duplicated?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.edit'))) {
    return <NoAccess section="Products" />;
  }
  const { id } = await params;
  const { error: feedbackError, created, duplicated } = (await searchParams) ?? {};
  const { data: rawProduct } = await supabase.from('products').select('*').eq('id', id).single();
  if (!rawProduct) notFound();
  const product = rawProduct as Product;

  const { attributes, variants } = await loadAttributesAndVariants(product.id);
  // vendors RLS has no policy, read with the service role.
  const { data: vendorData } = await supabaseAdmin().from('vendors').select('*').order('name');

  // Journal posts whose body links to this product's page. Unpublishing while
  // these exist leaves dead links in live articles, so the form warns first.
  const { data: linkingPosts } = await supabaseAdmin()
    .from('blog_posts')
    .select('id, title')
    .like('body', `%/product/${product.slug}%`)
    .limit(10);
  const linkedPosts = ((linkingPosts ?? []) as Array<{ id: string | number; title: string }>)
    .map(bp => ({ id: String(bp.id), title: bp.title }));

  // Gallery images (product-page photos, cover first) for the reorder editor.
  const { data: galleryRows } = await supabase
    .from('product_images').select('id, url, alt').eq('product_id', product.id).order('sort_order');
  const galleryImages = (galleryRows ?? []) as Array<{ id: string; url: string; alt: string | null }>;

  // Tags: this product's current set + the full tag vocabulary for suggestions.
  const [{ data: mapRows }, { data: allTagRows }] = await Promise.all([
    supabase.from('product_tag_map').select('product_tags(name)').eq('product_id', product.id),
    supabase.from('product_tags').select('name').order('name'),
  ]);
  const productTags = ((mapRows ?? []) as Array<{ product_tags: { name: string } | { name: string }[] | null }>)
    .flatMap(r => (Array.isArray(r.product_tags) ? r.product_tags : r.product_tags ? [r.product_tags] : []))
    .map(t => t.name);
  const allTags = ((allTagRows ?? []) as Array<{ name: string }>).map(t => t.name);

  // Bundle composition: what this set contains (admin sees drafts too — the
  // card badges them). The panel shows for anything that has components or
  // is named/categorised like a set, so combos can be assembled from scratch.
  const { data: componentRows } = await supabaseAdmin()
    .from('bundle_components')
    .select('qty, sort_order, product:products!bundle_components_component_product_id_fkey(*)')
    .eq('bundle_product_id', product.id)
    .order('sort_order');
  const bundleComponents: BundleComponentRow[] = ((componentRows ?? []) as unknown as Array<{ qty: number; product: Product | null }>)
    .filter(r => r.product)
    .map(r => ({ qty: r.qty, product: r.product! }));
  const looksLikeBundle =
    /\b(bundle|combo|set|stack|kit|duo|pack)\b/i.test(product.name) ||
    ['Combo Packs', 'Budget Bundles'].includes(product.category ?? '');
  const showBundleCard = bundleComponents.length > 0 || looksLikeBundle;
  // Commission terms let the pricing panel derive costs (retail − our cut)
  // for components with no explicit cost price entered. numeric columns can
  // arrive as strings, so coerce.
  const commissionByVendor: Record<string, number> = {};
  for (const v of (vendorData ?? []) as Vendor[]) {
    const pct = Number(v.commission_pct);
    if (v.id && Number.isFinite(pct) && pct > 0) commissionByVendor[v.id] = pct;
  }
  let componentOptions: Array<{ id: string; name: string; brand: string | null; price: number }> = [];
  if (showBundleCard) {
    const { data: optionRows } = await supabase
      .from('products')
      .select('id, name, brand, price')
      .eq('status', 'published')
      .neq('id', product.id)
      .order('name');
    componentOptions = (optionRows ?? []) as typeof componentOptions;
  }

  return (
    <>
      <AdminFlash
        message={
          created ? 'Product created — you can now add variants, tags and extra images below.'
          : duplicated ? 'Draft copy created — review the details, then publish when ready.'
          : null
        }
        clearPath={`/admin/products/${id}`}
      />
      {feedbackError && (
        <div
          role="status"
          style={{
            margin: '24px 36px 0', padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
            background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
          }}
        >
          {feedbackError}
        </div>
      )}
      <ProductForm
        product={product}
        vendors={(vendorData ?? []) as Vendor[]}
        linkedPosts={linkedPosts}
        variantStock={(() => {
          const enabled = variants.filter(v => v.enabled);
          return enabled.length > 0
            ? { count: enabled.length, total: enabled.reduce((n, v) => n + (v.stock ?? 0), 0) }
            : null;
        })()}
      />
      <div style={{ padding: '0 36px 32px' }}>
        <ProductTagsEditor productId={product.id} initialTags={productTags} suggestions={allTags} />
        <ProductGallerySection productId={product.id} initialImages={galleryImages} />
        {showBundleCard && (
          <BundlePricingCard
            bundle={product}
            components={bundleComponents}
            options={componentOptions}
            commissionByVendor={commissionByVendor}
          />
        )}
        <VariantsSection
          productId={product.id}
          productKind={product.kind ?? 'simple'}
          attributes={attributes}
          variants={variants}
          stockCounted={(product.stock_mode ?? (product.track_inventory === false ? 'untracked' : 'own')) === 'own'}
          // Cover image first, then the gallery, deduped — the per-variant
          // image picker assigns from these (no separate upload path).
          productImages={[...new Set([product.image_url, ...galleryImages.map(g => g.url)].filter((u): u is string => Boolean(u)))]}
        />
        <ProductInventoryHistory productId={product.id} />
      </div>
    </>
  );
}
