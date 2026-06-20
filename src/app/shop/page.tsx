// 5-min ISR. Search/filter params still bypass the cache because Next keys
// the ISR slot on (path + searchParams). Was `force-dynamic` before the
// 2026-05-24 audit.
export const revalidate = 300;

import type { Metadata } from 'next';
import { getProducts } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, faqLd } from '@/lib/seo';
import { canonicalCategory, CATEGORY_DESCRIPTIONS } from '@/lib/category-taxonomy';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';

// Category-landing FAQ. Parameterised by the active category label so every
// landing page gets useful, unique copy + FAQPage rich-result eligibility,
// without hand-authoring a bespoke set for all 18 leaf categories. The answers
// are universally true store facts (authenticity, COD, delivery, returns) that
// also reinforce the PK-market trust signals Google rewards.
function landingFaqs(label: string): { q: string; a: string }[] {
  const c = label.toLowerCase();
  return [
    { q: `Are your ${c} products authentic?`,
      a: `Yes — every ${c} product at Yellow Pink is 100% genuine, sourced from authorised channels and imported for the Pakistani market. We never sell counterfeits.` },
    { q: `Is cash on delivery (COD) available for ${c}?`,
      a: `Absolutely. You can order any ${c} product with cash on delivery nationwide across Pakistan, and pay only when your parcel arrives.` },
    { q: `How long does delivery take?`,
      a: `Orders are typically delivered in 2–4 working days, with tracking shared on WhatsApp once your order ships.` },
    { q: `Can I return ${c} products?`,
      a: `Yes — unused items can be returned within ${RETURNS_WINDOW_DAYS} days of delivery. Start a return from your account or message us on WhatsApp and we'll help.` },
  ];
}
import { loadFacetData, loadTagData } from '@/lib/shop-facets';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; q?: string; brand?: string }> }): Promise<Metadata> {
  const { category, subcategory, cat, q, brand } = await searchParams;
  // Resolve ?category= (or the legacy ?cat=) to its canonical label, so the
  // slug form (?category=combo-packs) and the label form (?category=Combo
  // Packs) collapse onto ONE title + canonical URL instead of two duplicates.
  const resolvedCategory = canonicalCategory(category ?? cat);
  // ?subcategory= is always a leaf category, so it gets the SAME slug-or-label
  // normalisation — otherwise ?subcategory=combo-packs and ?subcategory=Combo
  // Packs would render two different titles + canonicals for the same page.
  const resolvedSubcategory = canonicalCategory(subcategory);
  // Sanitise free-text params before interpolating them into the title /
  // description / og:title (audit SEV-2: raw `<img onerror=…>` once ended up
  // in the og:title `content` attribute). Strip every character with
  // structural meaning in HTML and clamp length.
  const clean = (s: string | undefined, max: number) =>
    s?.trim() ? s.trim().replace(/[<>"'&]/g, '').slice(0, max) : '';
  const trimmedQ = clean(q, 80);
  const trimmedBrand = clean(brand, 60);
  // Title: query > subcategory > category > brand > generic. Each variant
  // gets a distinct, human-readable title (good for SERPs).
  let title: string;
  if (trimmedQ)                 title = `Search: ${trimmedQ}`;
  else if (resolvedSubcategory) title = `${resolvedSubcategory} — Shop`;
  else if (resolvedCategory)    title = `${resolvedCategory} — Shop`;
  else if (trimmedBrand)        title = `${trimmedBrand} — Shop`;
  else                          title = 'Shop All Products';

  // Canonical strategy:
  //   • `/shop`, `/shop?category=Foo` (`?subcategory=Bar`) and a pure
  //     `/shop?brand=Baz` are real index targets — each canonicalizes to
  //     itself, with the category in its canonical label form.
  //   • Free-text searches, attr/price/stock filters, sort, pagination, and
  //     brand+category combos are variations of the same set — they
  //     canonicalize back to `/shop` (or the matching category root), so
  //     Google never indexes every brand×category permutation.
  const canonicalParams = new URLSearchParams();
  if (resolvedCategory) canonicalParams.set('category', resolvedCategory);
  if (resolvedSubcategory) canonicalParams.set('subcategory', resolvedSubcategory);
  if (trimmedBrand && !resolvedCategory && !resolvedSubcategory) canonicalParams.set('brand', trimmedBrand);
  const qs = canonicalParams.toString();

  // Description: search > subcategory copy > category landing copy > brand
  // line > generic. Every category, subcategory and brand page gets its OWN
  // description rather than silently inheriting its parent taxon's.
  let description: string;
  if (trimmedQ) {
    description = `Search results for "${trimmedQ}" — imported skincare, makeup, and wellness products. COD nationwide in Pakistan.`;
  } else if (resolvedSubcategory && CATEGORY_DESCRIPTIONS[resolvedSubcategory]) {
    description = CATEGORY_DESCRIPTIONS[resolvedSubcategory];
  } else if (resolvedCategory && CATEGORY_DESCRIPTIONS[resolvedCategory]) {
    description = CATEGORY_DESCRIPTIONS[resolvedCategory];
  } else if (trimmedBrand) {
    description = `Shop the ${trimmedBrand} range at Yellow Pink — 100% authentic, imported ${trimmedBrand}, with cash-on-delivery nationwide in Pakistan.`;
  } else {
    description = 'Browse imported skincare, makeup, and wellness products. COD available nationwide in Pakistan.';
  }

  return pageMeta({
    title,
    description,
    path: `/shop${qs ? `?${qs}` : ''}`,
    // Block free-text searches from being indexed (they're infinite-state).
    noIndex: Boolean(trimmedQ),
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; taxon?: string; on_sale?: string; q?: string; brand?: string; tag?: string; featured?: string; bestseller?: string }> }) {
  const [products, facetData, tagData] = await Promise.all([
    getProducts(),
    loadFacetData(),
    loadTagData(),
  ]);
  const { category, subcategory, cat, taxon, on_sale, q, brand, tag: tagParam, featured, bestseller } = await searchParams;
  const searchParamsFeatured = featured === '1';
  const searchParamsBestseller = bestseller === '1';

  // ?category= is canonical; ?cat= is a legacy WP param the proxy already
  // 301s across. CollectionPage resolves the value (taxon or leaf) itself.
  const initialCategory = category ?? cat ?? 'All';

  // Resolve ?taxon=makeup into the macro-bucket category set so the
  // CollectionPage can multi-filter. We resolve here so the server-rendered
  // header reflects the right active category from the first paint.
  const { findTaxon } = await import('@/lib/category-taxonomy');
  const taxonObj = findTaxon(taxon);

  // Scope the JSON-LD ItemList to whatever the URL implies — taxon →
  // products in those categories, single category → that category, else
  // top of the catalog. We cap at 24 to keep the schema lean.
  const scopedProducts = taxonObj
    ? products.filter(p => taxonObj.categories.includes(p.category)).slice(0, 24)
    : initialCategory !== 'All'
      ? products.filter(p => p.category === initialCategory).slice(0, 24)
      : products.slice(0, 24);

  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    ...(taxonObj ? [{ name: taxonObj.label, path: `/shop?taxon=${taxonObj.key}` }] : []),
    ...(initialCategory !== 'All' && !taxonObj
      ? [{ name: initialCategory, path: `/shop?category=${encodeURIComponent(initialCategory)}` }]
      : []),
  ];

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }}
      />
      {/* Only emit the ItemList when it actually has items. Taxon-level
          category labels (e.g. ?category=Skincare) have no exact leaf-category
          match server-side, which otherwise produced an empty ItemList — a
          structured-data markup error flagged by SEO audits. */}
      {scopedProducts.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: jsonLd(itemListLd(
              taxonObj?.label ?? (initialCategory !== 'All' ? initialCategory : 'All products'),
              scopedProducts.map(p => ({
                name: p.name,
                path: `/product/${p.slug}`,
              })),
            )),
          }}
        />
      )}
      {/* `key` on the destination params remounts CollectionPage on a genuine
          listing change — switching taxon/category/subcategory, a ?q= search,
          or ?on_sale=1 — so its URL-seeded state re-initialises. Client-side
          navigation between two /shop?… URLs otherwise reuses the instance and
          leaves the view stale until a hard refresh. The component writes its
          OWN filter params (brand/price/sort/page) which are deliberately NOT
          in this key, so applying filters never triggers a remount. */}
      <CollectionPage
        key={`${taxon ?? ''}|${initialCategory}|${subcategory ?? ''}|${q ?? ''}|${on_sale ?? ''}`}
        products={products}
        attributes={facetData.attributes}
        productValueMap={facetData.productValueMap}
        productTagMap={tagData.productTagMap}
        allTags={tagData.allTags}
        initialCategory={initialCategory}
        initialSubcategory={subcategory ?? null}
        initialOnSaleOnly={on_sale === '1'}
        initialBrand={brand ?? null}
        initialTags={tagParam ?? null}
        initialFeatured={searchParamsFeatured}
        initialBestseller={searchParamsBestseller}
      />
      {/* Category-landing FAQ — only on a genuine category/taxon/subcategory
          landing (not search or brand-filtered views, which canonicalise away),
          so the indexable landing pages carry FAQPage structured data + on-page
          E-A-T copy. */}
      {(() => {
        const landingLabel = taxonObj?.label
          ?? (subcategory ? canonicalCategory(subcategory) : null)
          ?? (initialCategory !== 'All' ? canonicalCategory(initialCategory) : null);
        if (!landingLabel || q || brand) return null;
        const faqs = landingFaqs(landingLabel);
        return (
          <section className="container" style={{ padding: '8px 0 var(--section-gap)' }}>
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: jsonLd(faqLd(faqs.map(f => ({ question: f.q, answer: f.a })))) }}
            />
            <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 16px' }}>
              {landingLabel} — frequently asked
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 760 }}>
              {faqs.map((f, i) => (
                <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink-900)' }}>{f.q}</summary>
                  <p className="body-text" style={{ color: 'var(--ink-700)', margin: '8px 0 0' }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      })()}
    </main>
  );
}
