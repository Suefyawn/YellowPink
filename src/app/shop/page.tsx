// 5-min ISR. Search/filter params still bypass the cache because Next keys
// the ISR slot on (path + searchParams). Was `force-dynamic` before the
// 2026-05-24 audit.
export const revalidate = 300;

import type { Metadata } from 'next';
import Link from 'next/link';
import { getProducts, supabase, isDemo } from '@/lib/supabase';
import { CollectionPage } from '@/sections/collection/CollectionPage';
import { pageMeta, jsonLd, breadcrumbLd, itemListLd, productInStock } from '@/lib/seo';
import { Breadcrumbs } from '@/components/layout/Breadcrumbs';
import { canonicalCategory, CATEGORY_DESCRIPTIONS, findTaxon, TAXON_SEO, categoryHref, isHealthCategory, taxonForCategory } from '@/lib/category-taxonomy';
import { brandSlug } from '@/lib/brands';
import { RETURNS_WINDOW_DAYS } from '@/lib/commerce';
import { getDefaultEstimatedDays } from '@/lib/shipping';

// Category-landing FAQ. Parameterised by the active category label so every
// landing page gets useful, unique copy + FAQPage rich-result eligibility,
// without hand-authoring a bespoke set for all 18 leaf categories. The answers
// are universally true store facts (authenticity, COD, delivery, returns) that
// also reinforce the PK-market trust signals Google rewards.
function landingFaqs(label: string, estimatedDays?: { min: number; max: number } | null): { q: string; a: string }[] {
  const c = label.toLowerCase();
  const deliveryRange = estimatedDays ? `${estimatedDays.min}–${estimatedDays.max}` : 'a few';
  return [
    { q: `Are your ${c} products authentic?`,
      a: `Yes, every ${c} product at Yellow Pink is 100% genuine, sourced from authorised channels and imported for the Pakistani market. We never sell counterfeits.` },
    { q: `Is cash on delivery (COD) available for ${c}?`,
      a: `Absolutely. You can order any ${c} product with cash on delivery nationwide across Pakistan, and pay only when your parcel arrives.` },
    { q: `How long does delivery take?`,
      a: `Orders are typically delivered in ${deliveryRange} working days, with tracking shared on WhatsApp once your order ships.` },
    { q: `Can I return ${c} products?`,
      a: `Yes, unused items can be returned within ${RETURNS_WINDOW_DAYS} days of delivery. Start a return from your account or message us on WhatsApp and we'll help.` },
  ];
}
import { loadFacetData, loadTagData } from '@/lib/shop-facets';

export async function generateMetadata({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; taxon?: string; q?: string; brand?: string }> }): Promise<Metadata> {
  const { category, subcategory, cat, taxon, q, brand } = await searchParams;
  // Resolve ?category= (or the legacy ?cat=) to its canonical label, so the
  // slug form (?category=combo-packs) and the label form (?category=Combo
  // Packs) collapse onto ONE title + canonical URL instead of two duplicates.
  // If ?category= is actually a TAXON label (e.g. ?category=Wellness), treat it
  // as the taxon — otherwise /shop?category=Wellness becomes a duplicate of the
  // dedicated /shop?taxon=wellness page (same products, two self-canonicals).
  const categoryTaxon = findTaxon(category ?? cat);
  const resolvedCategory = categoryTaxon ? null : canonicalCategory(category ?? cat);
  // ?subcategory= is always a leaf category, so it gets the SAME slug-or-label
  // normalisation, otherwise ?subcategory=combo-packs and ?subcategory=Combo
  // Packs would render two different titles + canonicals for the same page.
  const resolvedSubcategory = canonicalCategory(subcategory);
  // The four top-level nav landing pages (/shop?taxon=makeup|skincare|…) are
  // real index targets, give each its own title/description/self-canonical
  // instead of the generic "Shop All Products" + a canonical back to /shop.
  // Only when no (sub)category is set, since those are more specific. A taxon
  // reached via ?category=<label> resolves to the same dedicated taxon page.
  const resolvedTaxon = !resolvedCategory && !resolvedSubcategory ? (findTaxon(taxon) ?? categoryTaxon) : null;
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
  else if (resolvedSubcategory) title = `Shop ${resolvedSubcategory}`;
  else if (resolvedCategory)    title = `Shop ${resolvedCategory}`;
  else if (resolvedTaxon)       title = TAXON_SEO[resolvedTaxon.key].title;
  else if (trimmedBrand)        title = `Shop ${trimmedBrand}`;
  else                          title = 'Shop Imported Beauty & Wellness in Pakistan';

  // Canonical strategy:
  //   • `/shop` and `/shop?category=Foo` (`?subcategory=Bar`) are real index
  //     targets, each canonicalizes to itself, category in canonical label form.
  //   • A pure `/shop?brand=Baz` filter canonicalizes to the dedicated
  //     `/brand/<slug>` archive page, NOT to itself. `/shop?brand=` and
  //     `/brand/<slug>` show the same products, so self-canonicalizing the
  //     filter URL split signals across two near-duplicate pages and left the
  //     filter URL weakly linked (Semrush #213). Consolidating onto the
  //     brand page, which has bespoke copy, metadata and a sitemap entry,   //     ends the cannibalization. The filter URL keeps working for shoppers;
  //     only the canonical hint changes (no redirect, so the in-page brand
  //     filter UX is untouched).
  //   • Free-text searches, attr/price/stock filters, sort, pagination, and
  //     brand+category combos are variations of the same set, they
  //     canonicalize back to `/shop` (or the matching category root), so
  //     Google never indexes every brand×category permutation.
  const brandOnly = Boolean(
    trimmedBrand && !resolvedCategory && !resolvedSubcategory && !resolvedTaxon && !trimmedQ,
  );
  // A subcategory IS a leaf category that also lives at /shop?category=<leaf>,
  // so `/shop?category=Wellness&subcategory=Immunity` and `/shop?category=Immunity`
  // are the same page. Canonicalize the subcategory form onto the leaf-category
  // URL (drop the parent param) so the two don't compete as duplicates.
  const canonicalParams = new URLSearchParams();
  if (resolvedSubcategory) canonicalParams.set('category', resolvedSubcategory);
  else if (resolvedCategory) canonicalParams.set('category', resolvedCategory);
  else if (resolvedTaxon) canonicalParams.set('taxon', resolvedTaxon.key);
  const qs = canonicalParams.toString();
  // Slug from the RAW brand param, not the sanitised `trimmedBrand`: the
  // sanitiser strips apostrophes ("Nature's Bounty" → "Natures Bounty"), which
  // would yield `natures-bounty` and miss the real `/brand/nature-s-bounty`
  // page. brandSlug() does its own char-stripping, so the raw value is safe and
  // matches how /brand/[slug] (and the sitemap) derive the slug.
  const canonicalPath = brandOnly
    ? `/brand/${brandSlug(brand ?? trimmedBrand)}`
    : `/shop${qs ? `?${qs}` : ''}`;

  // Description: search > subcategory copy > category landing copy > brand
  // line > generic. Every category, subcategory and brand page gets its OWN
  // description rather than silently inheriting its parent taxon's.
  let description: string;
  if (trimmedQ) {
    description = `Search results for "${trimmedQ}", imported skincare, makeup, and wellness products. COD nationwide in Pakistan.`;
  } else if (resolvedSubcategory && CATEGORY_DESCRIPTIONS[resolvedSubcategory]) {
    description = CATEGORY_DESCRIPTIONS[resolvedSubcategory];
  } else if (resolvedCategory && CATEGORY_DESCRIPTIONS[resolvedCategory]) {
    description = CATEGORY_DESCRIPTIONS[resolvedCategory];
  } else if (resolvedTaxon) {
    description = TAXON_SEO[resolvedTaxon.key].description;
  } else if (trimmedBrand) {
    description = `Shop the ${trimmedBrand} range at Yellow Pink, 100% authentic, imported ${trimmedBrand}, with cash-on-delivery nationwide in Pakistan.`;
  } else {
    description = 'Browse authentic imported skincare, makeup and wellness supplements at Yellow Pink, 100% genuine international brands, with cash on delivery nationwide in Pakistan.';
  }

  return pageMeta({
    title,
    description,
    path: canonicalPath,
    // Block free-text searches from being indexed (they're infinite-state).
    noIndex: Boolean(trimmedQ),
  });
}

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ category?: string; subcategory?: string; cat?: string; taxon?: string; on_sale?: string; q?: string; brand?: string; tag?: string; featured?: string; bestseller?: string; page?: string }> }) {
  const [products, facetData, tagData, estimatedDays] = await Promise.all([
    getProducts(),
    loadFacetData(),
    loadTagData(),
    getDefaultEstimatedDays(),
  ]);
  const { category, subcategory, cat, taxon, on_sale, q, brand, tag: tagParam, featured, bestseller, page } = await searchParams;
  const searchParamsFeatured = featured === '1';
  const searchParamsBestseller = bestseller === '1';
  // Server-seeded for the same first-render reason as initialBrand:
  // useSearchParams is empty on the first client render of this statically-
  // generated route, so a crawler/shopper landing on /shop?page=3 was
  // silently reset to page 1.
  const initialPage = Math.max(1, Number(page ?? '1') || 1);

  // Free-text searches resolve through the SAME pg_trgm search_products RPC
  // the header typeahead uses, previously this page substring-filtered
  // client-side, so the overlay's result count routinely disagreed with the
  // "See all results" page (fuzzy matches the substring filter missed, and
  // vice versa). The rank-ordered ids are handed to CollectionPage; null →
  // client substring fallback (demo mode, or the RPC errored).
  let searchIds: string[] | null = null;
  if (q?.trim() && !isDemo) {
    const { data, error } = await supabase.rpc('search_products' as never, {
      p_query: q.trim(),
      p_limit: 50, // the RPC's own hard cap
    } as never);
    if (!error) searchIds = ((data ?? []) as Array<{ id: string }>).map(r => r.id);
  }

  // ?category= is canonical; ?cat= is a legacy WP param the proxy already
  // 301s across. CollectionPage resolves the value (taxon or leaf) itself.
  const initialCategory = category ?? cat ?? 'All';

  // Resolve ?taxon=makeup into the macro-bucket category set so the
  // CollectionPage can multi-filter. We resolve here so the server-rendered
  // header reflects the right active category from the first paint.
  const { findTaxon } = await import('@/lib/category-taxonomy');
  const taxonObj = findTaxon(taxon);

  // Scope the JSON-LD ItemList to whatever the URL implies, taxon →
  // products in those categories, single category → that category, else
  // top of the catalog. We cap at 24 to keep the schema lean.
  // Canonicalise the URL category so a slug form (?category=cleansers-treatments)
  // resolves to the stored label ("Cleansers & Treatments"). Without this the
  // ItemList filter (label ≠ slug) matched 0 products and the schema/breadcrumb
  // showed the raw slug. CollectionPage still receives the original value (it
  // resolves taxon-or-leaf itself); this only feeds the ItemList + breadcrumb.
  const resolvedCategory = initialCategory !== 'All'
    ? (canonicalCategory(initialCategory) ?? initialCategory)
    : 'All';

  const scopedProducts = taxonObj
    ? products.filter(p => taxonObj.categories.includes(p.category)).slice(0, 24)
    : resolvedCategory !== 'All'
      ? products.filter(p => p.category === resolvedCategory).slice(0, 24)
      : products.slice(0, 24);

  // On wellness/health category landings, surface the matching buyer guides.
  // These indexable category pages are crawled far more than the guides, so
  // linking down to them concentrates internal authority on the supplement
  // guides (which rank but sit on page 5+), and gives shoppers the research
  // content that precedes a supplement purchase. Only fetched for a genuine
  // health landing (not search / brand views), so the common path pays nothing.
  const guideLandingCat = taxonObj?.label
    ?? (subcategory ? canonicalCategory(subcategory) : null)
    ?? (initialCategory !== 'All' ? canonicalCategory(initialCategory) : null);
  let landingGuides: { slug: string; title: string }[] = [];
  if (guideLandingCat && !q && !brand && !isDemo && isHealthCategory(guideLandingCat)) {
    const { data: guideRows } = await supabase
      .from('blog_posts')
      .select('slug, title, category')
      .order('date', { ascending: false })
      .limit(60);
    landingGuides = ((guideRows ?? []) as Array<{ slug: string; title: string; category: string | null }>)
      .filter(g => isHealthCategory(g.category))
      .slice(0, 4)
      .map(g => ({ slug: g.slug, title: g.title }));
  }

  // For a leaf category (not a taxon view), insert the parent taxon crumb so
  // the trail is Home › Shop › <Taxon> › <Leaf> — a deeper, keyword-relevant
  // path that also links up to the taxon landing page.
  const leafCrumb = resolvedCategory !== 'All' && !taxonObj ? resolvedCategory : null;
  const parentTaxon = leafCrumb ? taxonForCategory(leafCrumb) : null;
  const breadcrumb = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    ...(taxonObj ? [{ name: taxonObj.label, path: `/shop?taxon=${taxonObj.key}` }] : []),
    ...(parentTaxon ? [{ name: parentTaxon.label, path: `/shop?taxon=${parentTaxon.key}` }] : []),
    ...(leafCrumb ? [{ name: leafCrumb, path: categoryHref(leafCrumb) }] : []),
  ];

  return (
    <main className="fade-in">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbLd(breadcrumb)) }}
      />
      <Breadcrumbs items={breadcrumb} />
      {/* Only emit the ItemList when it actually has items. Taxon-level
          category labels (e.g. ?category=Skincare) have no exact leaf-category
          match server-side, which otherwise produced an empty ItemList, a
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
                image: p.image_url,
                brand: p.brand,
                price: p.price,
                inStock: productInStock(p),
              })),
            )),
          }}
        />
      )}
      {/* `key` on the destination params remounts CollectionPage on a genuine
          listing change, switching taxon/category/subcategory, a ?q= search,
          or ?on_sale=1, so its URL-seeded state re-initialises. Client-side
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
        initialPage={initialPage}
        searchIds={searchIds}
      />
      {/* Category-landing FAQ, only on a genuine category/taxon/subcategory
          landing (not search or brand-filtered views, which canonicalise away),
          so the indexable landing pages carry FAQPage structured data + on-page
          E-A-T copy. */}
      {(() => {
        const landingLabel = taxonObj?.label
          ?? (subcategory ? canonicalCategory(subcategory) : null)
          ?? (initialCategory !== 'All' ? canonicalCategory(initialCategory) : null);
        if (!landingLabel || q || brand) return null;
        const faqs = landingFaqs(landingLabel, estimatedDays);
        // Vertical padding only: setting the `padding` shorthand here zeroed the
        // .container side gutter, which pushed the whole FAQ hard against the
        // left edge, out of line with the grid/heading above it (worst on
        // mobile, where there's no maxWidth to mask it).
        return (
          <section className="container" style={{ paddingTop: 8, paddingBottom: 'var(--section-gap)' }}>
            {/* Visible FAQ only — no FAQPage JSON-LD. Google restricted FAQ
                rich results to authoritative gov/health sites (Aug 2023), and
                these category questions are templated, so the markup was dead
                weight that also flagged as site-wide boilerplate in audits. */}
            <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 16px' }}>
              {landingLabel}, frequently asked
            </h2>
            {/* Rows span the content width (like the product grid); only the
                answer copy is capped to a comfortable reading measure. */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {faqs.map((f, i) => (
                <details key={i} style={{ borderBottom: '1px solid var(--line)', padding: '12px 0' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--ink-900)' }}>{f.q}</summary>
                  <p className="body-text" style={{ color: 'var(--ink-700)', margin: '8px 0 0', maxWidth: 760 }}>{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        );
      })()}

      {/* Buyer guides for health/wellness landings: internal links from a
          heavily-crawled category page down to the supplement guides. */}
      {landingGuides.length > 0 && (
        <section className="container" style={{ paddingBottom: 'var(--section-gap)' }}>
          <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 16px' }}>
            Guides worth reading
          </h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {landingGuides.map(g => (
              <li key={g.slug}>
                <Link
                  href={`/blog/${g.slug}`}
                  className="text-link"
                  style={{ display: 'block', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)', fontWeight: 600, fontSize: '0.9375rem', lineHeight: 1.4 }}
                >
                  {g.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
