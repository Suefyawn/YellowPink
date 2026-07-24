// ISR: cache the rendered PDP for 5 min; admin edits call revalidatePath('/product/...') to bust.
export const revalidate = 300;

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductBySlug, getProducts, supabase, isDemo, getProductsByBrand, getProductsByTaxon, getSiteSettings, getPostsLinkingProduct } from '@/lib/supabase';
import { redirectIfMapped } from '@/lib/redirects';

// Pre-render every published product at build so PDPs are served as static CDN
// HTML (fast TTFB worldwide, incl. Pakistan) instead of cold on-demand renders.
// Field data showed TTFB ~1.5s / LCP ~3.8s — with low, spread-out traffic most
// per-slug ISR entries were cold on each hit. dynamicParams stays true
// (default), so products added after a build still render on demand then cache.
// Returns [] in demo / if the catalogue can't be read (getProducts is
// error-safe), falling back to the previous on-demand behaviour.
export async function generateStaticParams() {
  if (isDemo) return [];
  const products = await getProducts();
  return products.map(p => ({ slug: p.slug }));
}
import { PDPPage } from '@/sections/pdp/PDPPage';
import { routineComplements } from '@/lib/routine-pairing';
import { BundleContents } from '@/components/pdp/BundleContents';
import { PartOfSet, type ContainingSet } from '@/components/pdp/PartOfSet';
import type { BundleComponentRow } from '@/lib/bundle-pricing';
import { ReviewsSection } from '@/components/pdp/ReviewsSection';
import { QuestionsSection, type ProductQuestionItem } from '@/components/pdp/QuestionsSection';
import { RecentlyViewed } from '@/components/pdp/RecentlyViewed';
import { FrequentlyBoughtTogether } from '@/components/pdp/FrequentlyBoughtTogether';
import { MoreToExplore } from '@/components/pdp/MoreToExplore';
import { FromTheBlog } from '@/components/pdp/FromTheBlog';
import { pageMeta, jsonLd, productLd, videoLd, breadcrumbLd, truncateOnWord } from '@/lib/seo';
import { parseCommerceConfig } from '@/lib/commerce';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { isEnabled } from '@/lib/flags';
import { getDefaultEstimatedDays } from '@/lib/shipping';
import { brandPlusName, stripBrandPrefix } from '@/lib/product-display';
import { categoryHref, isHealthCategory } from '@/lib/category-taxonomy';
import type { Product, ProductReview, ProductImage, ProductVariant, ProductAttribute, AttributeValue } from '@/types';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  // Missing product → notFound() (the page does the same). This segment
  // deliberately has NO loading.tsx: a loading boundary makes Next stream a
  // 200 shell before the slug is resolved, turning an invalid slug into a
  // soft-404 (HTTP 200 + 404-styled UI). Without it, notFound() runs before
  // headers flush and the response is a real 404, while the branded
  // not-found UI still renders via app/not-found.tsx. PDPs are pre-rendered
  // via generateStaticParams, so the skeleton was rarely seen anyway.
  // Honour a manual redirect first (admin Broken links → Add redirect): the
  // page body's redirectIfMapped never runs when metadata 404s before it.
  if (!product) { await redirectIfMapped(`/product/${slug}`); notFound(); }
  // Use the dedupe-aware composer so WP imports that already prefix the
  // brand inside `name` don't render "Kiko Milano Kiko Milano …" in titles.
  const displayName = brandPlusName(product.brand, product.name);
  const autoTitleBase = `${displayName}${product.variant ? `, ${product.variant}` : ''}`;
  // SERP CTR: short branded SKUs (e.g. "Semofer", "M-Sol Sachet") were ranking
  // page-1 but getting ~0 % CTR with a bare "<name> | Yellow Pink" title, the
  // SERP gave a searcher no reason to click (GSC, 2026-06). Append a localized
  // intent cue. Supplement/medicine SKUs draw heavy *informational* intent
  // ("calin g tablet uses", "m-sol sachet uses", "meth d tab", GSC, 2026-06),
  // so wellness products lead the cue with "Uses" before the commercial "Price
  // in Pakistan"; beauty products keep the price-only cue. We pick the richest
  // cue that still fits Google's ~60-char render budget, the root template adds
  // " | Yellow Pink" (14 chars), so the base is capped at 46, and only when
  // there's no variant suffix and the name doesn't already imply geo. Longer,
  // already-descriptive titles (most skincare imports) are left untouched, and
  // an admin `seo_title` override always wins (applied below).
  const CUES = isHealthCategory(product.category)
    ? [' Uses & Price in Pakistan', ' Price in Pakistan']
    : [' Price in Pakistan'];
  const cue =
    !product.variant && !/pakistan|\bpk\b/i.test(autoTitleBase)
      ? (CUES.find(c => autoTitleBase.length + c.length <= 46) ?? '')
      : '';
  const autoTitle = `${autoTitleBase}${cue}`;
  const baseDescription = product.short_description?.trim()
    ?? (product.description?.trim().slice(0, 160) || `Buy ${displayName} in Pakistan. PKR ${product.price.toLocaleString()}. Fast COD delivery nationwide.`);
  // Lead with the unique product name so near-identical shade variants that
  // share one stock description (e.g. the Pixi blush sticks) don't collapse
  // into duplicate meta descriptions.
  const leadDescription = baseDescription.toLowerCase().startsWith(displayName.toLowerCase())
    ? baseDescription
    : `${displayName}, ${baseDescription}`;
  // Keep meta descriptions in the ~155-char sweet spot Google renders, on a
  // word boundary, and append an authenticity/COD value line when there's room
  // and it isn't already implied, improves SERP CTR without changing on-page
  // copy. (Composed only from existing fields, so it stays accurate.)
  const TAIL = ' Authentic, with cash on delivery across Pakistan.';
  const autoDescription = (() => {
    const lead = truncateOnWord(leadDescription, 155);
    const hasCod = /\bcod\b|cash on delivery|pakistan/i.test(lead);
    return !hasCod && lead.length + TAIL.length <= 160 ? `${lead}${TAIL}` : lead;
  })();
  // Migration 081: admin-controlled overrides win when set; otherwise fall
  // back to the auto-templated values so existing rows keep working.
  const title = product.seo_title?.trim() || autoTitle;
  const description = product.seo_description?.trim() || autoDescription;
  // og:image MUST be a direct, crawlable URL on our own domain / Supabase —
  // NOT the images.weserv.nl proxy. weserv's robots.txt disallows every
  // `/?url=…` request (Disallow: /*?*), so a proxied og:image can't be fetched
  // by Googlebot, which is why product results never showed a SERP thumbnail.
  // The packshot host (yellowpink.pk/catalog or Supabase storage) is crawlable
  // and the file sizes are fine for WhatsApp/Facebook link previews. An admin
  // `og_image_url` (e.g. a bespoke 1200×630 card) still wins when set.
  const image = (product.og_image_url?.trim() || product.image_url) || undefined;
  return pageMeta({
    title,
    description,
    path: `/product/${product.slug}`,
    image,
    type: 'product',
    keywords: [product.brand, stripBrandPrefix(product.brand, product.name), product.category, 'Pakistan', 'COD']
      .filter((s): s is string => Boolean(s)),
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
  if (isDemo) return { variants: [], attributes: [] };
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

// This product's tags → crawlable "Tagged:" chips on the PDP. Tag archive
// pages (/tag/[slug]) are in the sitemap but the shop's Tags facet is
// client-side buttons, so without these links they'd have zero internal
// links (Semrush "orphaned sitemap page").
async function loadProductTags(productId: string): Promise<{ slug: string; name: string }[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('product_tag_map')
    .select('tag:product_tags(slug, name)')
    .eq('product_id', productId);
  return ((data ?? []) as Array<{ tag: { slug: string; name: string } | { slug: string; name: string }[] | null }>)
    .map(r => (Array.isArray(r.tag) ? r.tag[0] : r.tag))
    .filter((t): t is { slug: string; name: string } => Boolean(t))
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function loadGallery(productId: string): Promise<ProductImage[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('product_images')
    .select('id, product_id, variant_id, url, alt, sort_order')
    .eq('product_id', productId)
    .order('sort_order');
  return (data ?? []) as ProductImage[];
}

async function loadFrequentlyBoughtTogether(productId: string): Promise<Product[]> {
  if (isDemo) return [];
  // RPC returns [{ product_id, co_count }] ordered desc.
  const { data, error } = await supabase.rpc('frequently_bought_with' as never, {
    p_product_id: productId,
    p_limit:      4,
  } as never);
  if (error) return [];
  const rows = (data ?? []) as Array<{ product_id: string; co_count: number }>;
  if (rows.length === 0) return [];
  const ids = rows.map(r => r.product_id);
  // Published only: a draft/archived co-purchase must not surface a dead PDP
  // link (or an unbuyable bundle line) on a live product page.
  const { data: products } = await supabase
    .from('products')
    .select('*')
    .in('id', ids)
    .eq('status', 'published');
  const map = new Map(((products ?? []) as Product[]).map(p => [p.id, p]));
  // Preserve RPC order.
  return ids.map(id => map.get(id)).filter((p): p is Product => Boolean(p));
}

// Components of a bundle product (empty for ordinary products). Powers the
// "What's inside" section; the join keeps only published components so a
// drafted component never renders a dead link.
async function loadBundleComponents(productId: string): Promise<BundleComponentRow[]> {
  if (isDemo) return [];
  const { data } = await supabase
    .from('bundle_components')
    .select('qty, sort_order, product:products!bundle_components_component_product_id_fkey(*)')
    .eq('bundle_product_id', productId)
    .order('sort_order');
  return ((data ?? []) as unknown as Array<{ qty: number; product: Product | null }>)
    .filter(r => r.product && r.product.status === 'published')
    .map(r => ({ product: r.product!, qty: r.qty }));
}

/** Published value sets this product is a component of, with the sum of each
 *  set's components bought individually (for the savings pitch). */
async function loadContainingSets(productId: string): Promise<ContainingSet[]> {
  if (isDemo) return [];
  const { data: memberships } = await supabase
    .from('bundle_components')
    .select('bundle:products!bundle_components_bundle_product_id_fkey(*)')
    .eq('component_product_id', productId);
  const bundles = ((memberships ?? []) as unknown as Array<{ bundle: Product | null }>)
    .map(r => r.bundle)
    .filter((b): b is Product => !!b && b.status === 'published');
  if (bundles.length === 0) return [];

  const { data: compRows } = await supabase
    .from('bundle_components')
    .select('bundle_product_id, qty, product:products!bundle_components_component_product_id_fkey(price, status)')
    .in('bundle_product_id', bundles.map(b => b.id));
  const totals = new Map<string, number>();
  for (const r of ((compRows ?? []) as unknown as Array<{ bundle_product_id: string; qty: number; product: { price: number; status?: string } | null }>)) {
    if (!r.product || r.product.status !== 'published') continue;
    totals.set(r.bundle_product_id, (totals.get(r.bundle_product_id) ?? 0) + r.product.price * r.qty);
  }
  return bundles
    .map(b => ({ bundle: b, individualTotal: totals.get(b.id) ?? 0 }))
    .filter(s => s.individualTotal > s.bundle.price)
    .sort((a, b) => (b.individualTotal - b.bundle.price) - (a.individualTotal - a.bundle.price))
    .slice(0, 2);
}

async function loadCrossSells(productId: string, fallbackCategory: string): Promise<Product[]> {
  if (isDemo) {
    // In demo, surface a few same-category products from stub data.
    const { DEMO_PRODUCTS } = await import('@/lib/demo-data');
    return DEMO_PRODUCTS.filter(p => p.id !== productId && p.category === fallbackCategory).slice(0, 4);
  }
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
    // Published only, an admin-curated cross-sell that has since been
    // drafted/archived must not render as a dead "Pairs with" link.
    const { data } = await supabase
      .from('products')
      .select('*')
      .in('id', relatedIds)
      .eq('status', 'published');
    const map = new Map(((data ?? []) as Product[]).map(p => [p.id, p]));
    return relatedIds.map(id => map.get(id)).filter((p): p is Product => Boolean(p)).slice(0, 4);
  }

  // Fallback: same category, published only.
  const { data } = await supabase
    .from('products')
    .select('*')
    .eq('category', fallbackCategory)
    .eq('status', 'published')
    .neq('id', productId)
    .limit(8);
  return ((data ?? []) as Product[]).sort(() => Math.random() - 0.5).slice(0, 4);
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  // Discontinued/renamed product? Honour a manual redirect (admin Broken Links)
  // before 404ing, so an indexed dead /product/<slug> can point at a live one.
  if (!product) { await redirectIfMapped(`/product/${slug}`); notFound(); }

  const [reviewPhotosEnabled, estimatedDays, siteSettings] = await Promise.all([
    isEnabled('reviews_photos'),
    getDefaultEstimatedDays(),
    getSiteSettings(),
  ]);
  // Loyalty earn rate (points per PKR) drives the PDP "earn points" nudge.
  // Defaults to the same 0.1 the loyalty settings form seeds.
  // Live shipping config → the Product JSON-LD emits the real per-item rate
  // (free over the threshold, else the flat rate) instead of a blanket "free".
  const commerce = parseCommerceConfig(siteSettings);
  const pointsPerPkr = Number(siteSettings.loyalty_points_per_pkr ?? '0.1') || 0;
  // Points granted when a review is approved (reviews_award_points trigger).
  // Surfaced on the review form to actually drive review volume → ★ snippets.
  const reviewPoints = Math.max(0, Number(siteSettings.loyalty_review_points ?? '25') || 0);

  const [{ data: reviewRows }, { data: questionRows }, variantData, gallery, crossSells, fbt, brandProducts, categoryProducts, blogPosts, productTags, bundleComponents, containingSets] = await Promise.all([
    isDemo
      ? Promise.resolve({ data: [] as Array<Pick<ProductReview, 'id' | 'author_name' | 'rating' | 'body' | 'created_at' | 'photo_urls' | 'verified_purchase' | 'helpful_count' | 'owner_reply' | 'owner_reply_at' | 'source'>> })
      : supabase
          .from('product_reviews')
          .select('id, author_name, rating, body, created_at, photo_urls, verified_purchase, helpful_count, owner_reply, owner_reply_at, source')
          .eq('product_id', product.id)
          .eq('approved', true)
          .order('created_at', { ascending: false }),
    // Approved product Q&As (audit D1). The anon SELECT policy filters to
    // status='approved' anyway; the explicit filter keeps the query honest.
    isDemo
      ? Promise.resolve({ data: [] as ProductQuestionItem[] })
      : supabase
          .from('product_questions')
          .select('id, author_name, question, answer, created_at, answered_at')
          .eq('product_id', product.id)
          .eq('status', 'approved')
          .order('created_at', { ascending: false }),
    product.kind === 'variable' ? loadVariantData(product.id) : Promise.resolve({ variants: [], attributes: [] }),
    loadGallery(product.id),
    loadCrossSells(product.id, product.category),
    loadFrequentlyBoughtTogether(product.id),
    getProductsByBrand(product.brand, 12),
    getProductsByTaxon(product.category, 12),
    getPostsLinkingProduct(product.slug),
    loadProductTags(product.id),
    loadBundleComponents(product.id),
    loadContainingSets(product.id),
  ]);

  // Buy-box nudge for the best-saving set this product belongs to.
  const bestSet = containingSets[0];
  const setTeaser = bestSet && bestSet.individualTotal > bestSet.bundle.price
    ? (() => {
        const pct = ((bestSet.individualTotal - bestSet.bundle.price) / bestSet.individualTotal) * 100;
        return Math.round(pct) >= 1 ? { name: bestSet.bundle.name, slug: bestSet.bundle.slug, savingPct: pct } : null;
      })()
    : null;

  const reviews = (reviewRows ?? []) as Pick<ProductReview, 'id' | 'author_name' | 'rating' | 'body' | 'created_at' | 'photo_urls' | 'verified_purchase' | 'helpful_count' | 'owner_reply' | 'owner_reply_at' | 'source'>[];

  // Reviews imported from another store (source set, e.g. genuine NB Sons
  // manufacturer reviews) display on-page with attribution, but are kept OUT of
  // the Product rich-snippet markup, which Google requires to be first-party.
  const firstPartyReviews = reviews.filter(r => !r.source);

  // The bundle widget prefers real co-purchase pairs; a young store barely
  // has any, so most PDPs rendered no bundle at all. Skincare products fall
  // back to routine complements (a cleanser is offered a serum, moisturiser
  // and SPF — the quiz's own step rules), relabelled honestly since these
  // aren't observed purchases. Non-skincare products keep co-purchase-only.
  let fbtSuggestions = fbt;
  let fbtHeading: string | undefined;
  // Bundles skip the routine fallback — the What's-inside section already
  // tells the set's story, and a set suggesting another set reads as noise.
  if (fbt.length < 1 && !isDemo && bundleComponents.length < 2) {
    const complements = routineComplements(product, await getProducts());
    if (complements.length > 0) {
      fbtSuggestions = complements;
      fbtHeading = 'Complete the Routine';
    }
  }

  // Single source for both the visible trail and the BreadcrumbList schema.
  const crumbs = [
    { name: 'Home',           path: '/' },
    { name: 'Shop',           path: '/shop' },
    { name: product.category, path: categoryHref(product.category) },
    { name: product.name,     path: `/product/${product.slug}` },
  ];

  return (
    // minHeight: 100vh, guarantees the PDP block fills the viewport before
    // the gallery image decodes. Without it, on mobile between SSR delivery
    // and image-decode, the main column can be shorter than the screen and
    // the Footer (next in DOM) flashes above the fold.
    <main className="fade-in" style={{ minHeight: '100vh' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(productLd(product, firstPartyReviews, variantData.variants, {
          freeShippingEnabled: commerce.freeShippingEnabled,
          freeShippingThreshold: commerce.freeShippingThreshold,
          defaultShippingRate: commerce.defaultShippingRate,
        }, gallery.map(g => g.url))) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(breadcrumbLd(crumbs)),
        }}
      />
      {/* VideoObject when the product has a demo/swatch video — without it
          the uploaded videos were invisible to Google Video despite
          rendering in the gallery. */}
      {product.video_url && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(videoLd(product)!) }}
        />
      )}
      <Breadcrumbs items={crumbs} />
      {/* No FAQPage JSON-LD here (the visible FAQ section below stays):
          Google restricted FAQ rich results to authoritative gov/health
          sites in Aug 2023, so the markup could never render anything for a
          store — and the store-fact fallback made it identical boilerplate
          across most PDPs, diluting page uniqueness for no possible gain. */}
      {/* Keyed on the product id so a related-product click (product→product
          navigation, which otherwise reuses this client component) remounts
          PDPPage, resetting the variant picker and quantity to the new
          product's defaults instead of carrying the previous selection. */}
      <PDPPage
        key={product.id}
        product={product}
        relatedProducts={crossSells}
        variants={variantData.variants}
        attributes={variantData.attributes}
        gallery={gallery}
        estimatedDays={estimatedDays}
        pointsPerPkr={pointsPerPkr}
        tags={productTags}
        setTeaser={setTeaser}
      />
      {/* Keyed like PDPPage so a product→product navigation re-seeds the
          bundle's checkbox state for the new product. Prefixed: PDPPage above
          is a sibling already keyed on the bare product id, and duplicate
          sibling keys are a React error. */}
      {/* What's inside + savings, bundles only. Rendered before the bundle
          widget: on a bundle PDP the contents ARE the story. */}
      <BundleContents bundle={product} components={bundleComponents} />
      {/* The reverse direction: this product is cheaper inside a value set. */}
      <PartOfSet productName={product.name} sets={containingSets} />
      <FrequentlyBoughtTogether
        key={`fbt-${product.id}`}
        anchor={product}
        suggestions={fbtSuggestions}
        heading={fbtHeading}
      />
      <MoreToExplore
        brand={product.brand}
        category={product.category}
        brandProducts={brandProducts}
        categoryProducts={categoryProducts}
        excludeIds={[product.id, ...crossSells.map(p => p.id), ...fbtSuggestions.map(p => p.id)]}
      />
      <FromTheBlog posts={blogPosts} />
      <ReviewsSection productId={product.id} reviews={reviews} photosEnabled={reviewPhotosEnabled} rewardPoints={reviewPoints} />
      {/* Product Q&A (audit D1): approved questions + answers as unique
          long-tail PDP content, plus the ask form feeding the moderation
          queue (admin → Questions). */}
      <QuestionsSection productId={product.id} questions={(questionRows ?? []) as ProductQuestionItem[]} />
      <RecentlyViewed currentProductId={product.id} />
    </main>
  );
}
