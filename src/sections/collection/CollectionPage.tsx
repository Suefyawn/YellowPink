'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { ProductTile } from '@/components/ui/ProductTile';
import { track } from '@/lib/analytics';
import { useBodyScrollLock, useEscapeKey, useFocusTrap } from '@/lib/hooks/useBodyScrollLock';
import { TAXONS, findTaxon, taxonForCategory, canonicalCategory, categorySlug, CATEGORY_DESCRIPTIONS, CATEGORY_INTRO } from '@/lib/category-taxonomy';
import type { Product, ProductAttribute, AttributeValue } from '@/types';

interface AttributeWithValues extends ProductAttribute {
  values: AttributeValue[];
}

const PAGE_SIZE = 48;

// Top-level shop tabs are the 4 taxons, with "All" first. The sub-category
// chips below are the active taxon's leaf categories, filtered down to the
// ones that actually have products (see `subcats`) so the row can never
// surface an empty category.
const TOP_CATEGORY_NAMES = ['All', ...TAXONS.map(t => t.label)];

type SortKey = 'featured' | 'price-low' | 'price-high' | 'name';

interface Props {
  products: Product[];
  attributes?: AttributeWithValues[];
  /** Map of product_id → list of attribute_value_ids that the product's variants cover. */
  productValueMap?: Record<string, string[]>;
  /** Initial top tab, a taxon label ("Makeup") or "All". */
  initialCategory?: string;
  /** Initial leaf-category chip (one of the 18 product categories). */
  initialSubcategory?: string | null;
  /** Optional pre-applied "on sale" filter, set by `?on_sale=1`. */
  initialOnSaleOnly?: boolean;
  /** Pre-applied brand filter (comma-separated) from `?brand=`. Resolved on the
   *  server and passed in so it survives prerender/hydration, `useSearchParams`
   *  is empty on the first client render of this statically-generated route, so
   *  reading brand only from the URL there left the filter unapplied on load. */
  initialBrand?: string | null;
  /** product_id → tag slugs, for the Tags facet + filtering. */
  productTagMap?: Record<string, string[]>;
  /** Full tag vocabulary (slug + display name) for facet labels. */
  allTags?: { slug: string; name: string }[];
  /** Pre-applied tag filter (comma-separated slugs) from `?tag=`. Server-seeded
   *  for the same first-render reason as initialBrand. */
  initialTags?: string | null;
  /** Pre-applied Featured / Bestseller highlight filters from `?featured=1` /
   *  `?bestseller=1`. */
  initialFeatured?: boolean;
  initialBestseller?: boolean;
  /** Server-resolved `?page=` (1-based). Seeded on the server for the same
   *  first-render reason as initialBrand, `useSearchParams` is empty on the
   *  first client render, which silently discarded the page param on load. */
  initialPage?: number;
  /** Rank-ordered product ids from the `search_products` RPC for the current
   *  `?q=` term, resolved server-side so this page and the search overlay
   *  agree on what matches (same fuzzy pg_trgm search, same counts). null →
   *  fall back to the local substring filter (demo mode / RPC failure). */
  searchIds?: string[] | null;
}

export function CollectionPage({
  products,
  attributes = [],
  productValueMap = {},
  initialCategory = 'All',
  initialSubcategory = null,
  initialOnSaleOnly = false,
  initialBrand = null,
  productTagMap = {},
  allTags = [],
  initialTags = null,
  initialFeatured = false,
  initialBestseller = false,
  initialPage,
  searchIds = null,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  // ─── URL-state hydration ────────────────────────────────────────────────
  // Parse once on mount from the search params; subsequent updates are
  // pushed via router.replace below.
  const readInitial = () => {
    const sp = searchParams;
    // The proxy 301s ?cat=→?category= and ?sub=→?subcategory= so by the time
    // we read here, the canonical names are in place. We still fall through
    // to the short forms as a belt-and-braces safety net (e.g. if someone
    // disables middleware during local dev).
    //
    // Resolve whatever the URL carries, ?taxon=, ?category= (which may be a
    // taxon OR a leaf), ?subcategory=, into a (top tab, leaf chip) pair.
    // The top tab is always a taxon label; the chip is always a leaf.
    const { cat, sub } = (() => {
      const taxonParam = sp.get('taxon');
      const catParam = sp.get('category') ?? sp.get('cat')
        ?? (initialCategory !== 'All' ? initialCategory : null);
      const subParam = sp.get('subcategory') ?? sp.get('sub') ?? initialSubcategory ?? null;
      let topLabel = 'All';
      let leaf: string | null = null;
      const taxon = findTaxon(taxonParam) ?? findTaxon(catParam);
      if (taxon) {
        topLabel = taxon.label;
      } else if (catParam) {
        // catParam is a leaf category, normalise the slug/label form to its
        // canonical label, then map it back to its owning taxon. Without the
        // canonicalCategory() step a slug URL (?category=combo-packs) would
        // never match a taxon's category list and the chip + product filter
        // would silently come up empty.
        const leafCat = canonicalCategory(catParam);
        const owner = taxonForCategory(leafCat);
        if (owner && leafCat) { topLabel = owner.label; leaf = leafCat; }
      }
      if (subParam) {
        // Same canonicalisation for ?subcategory=, both URL forms collapse
        // onto the one canonical leaf label.
        const leafSub = canonicalCategory(subParam);
        if (leafSub) {
          leaf = leafSub;
          const owner = taxonForCategory(leafSub);
          if (owner) topLabel = owner.label;
        }
      }
      return { cat: topLabel, sub: leaf };
    })();
    const sort = (sp.get('sort') as SortKey | null) ?? 'featured';
    // Prefer the server-resolved page (present on the first render, when
    // useSearchParams is still empty on this static route); fall back to the
    // client URL for in-session reads.
    const pageNum = Math.max(1, initialPage ?? (Number(sp.get('page') ?? '1') || 1));
    // Prefer the server-resolved initialBrand (present on first render); fall
    // back to the client URL for in-session reads. Resolve each URL token to
    // the catalog's canonical brand string (case/space-insensitive) so a link
    // like ?brand=anua or ?brand=Beauty%20Of%20Joseon still matches the
    // exact-cased value stored on the products, otherwise a casing drift in
    // the URL would silently filter to nothing / everything.
    const brandCanon = new Map<string, string>();
    for (const p of products) {
      if (p.brand) {
        const k = p.brand.trim().toLowerCase();
        if (!brandCanon.has(k)) brandCanon.set(k, p.brand);
      }
    }
    const brands = (initialBrand ?? sp.get('brand') ?? '')
      .split(',').map(s => s.trim()).filter(Boolean)
      .map(b => brandCanon.get(b.toLowerCase()) ?? b);
    const attrs  = sp.get('attr')?.split(',').filter(Boolean) ?? [];
    // Tag slugs from the server-seeded value first, then the live URL.
    const tagSlugs = (initialTags ?? sp.get('tag') ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const min = sp.get('min'); const max = sp.get('max');
    return {
      cat, sub, sort, pageNum,
      tags: new Set(tagSlugs),
      featured: sp.get('featured') === '1' || initialFeatured,
      bestseller: sp.get('bestseller') === '1' || initialBestseller,
      // Free-text search term, populated when the user comes in from the
      // search overlay (`/shop?q=cerave`) or from a WP-style `/?s=foo`
      // redirect (see proxy.ts).
      q: sp.get('q') ?? '',
      brands: new Set(brands),
      attrs:  new Set(attrs),
      min: min ? Number(min) : ('' as number | ''),
      max: max ? Number(max) : ('' as number | ''),
      stock: sp.get('stock') === '1',
      // ?on_sale=1 (canonical) and ?sale=1 (legacy chip state) both seed
      // the on-sale filter. initialOnSaleOnly comes from the server when
      // the URL had ?on_sale=1, so it wins regardless of chip state.
      sale:  sp.get('sale') === '1' || sp.get('on_sale') === '1' || initialOnSaleOnly,
    };
  };
  // Mount-time only, the useState initialiser runs once. Navigating to a
  // different listing (another taxon/category/subcategory, a ?q= search, or
  // ?on_sale=1) remounts this component because shop/page.tsx keys it on those
  // destination params, so the snapshot is always re-read for a new listing.
  // Internal filter changes (brand/price/sort/page) don't change that key, so
  // they keep working as in-place state updates. Storing the URL-hydrated
  // snapshot in state (not a ref) satisfies the React Compiler's
  // "no refs in render" rule.
  const [initialState] = useState(readInitial);

  const [activeCategory, setActiveCategory] = useState<string>(initialState.cat);
  const [activeSubcategory, setActiveSubcategory] = useState<string | null>(initialState.sub);
  const [sortBy, setSortBy] = useState<SortKey>(initialState.sort);
  const [page, setPage] = useState(initialState.pageNum);

  // ─── Facets (price / brand / in-stock / on-sale) ─────────────────────────
  // Brand list + price bounds come from the taxon-scoped product set so they
  // make sense as the user navigates between top tabs. "All" → whole catalog.
  const categoryScoped = useMemo(() => {
    const t = findTaxon(activeCategory);
    if (!t) return products;
    return products.filter(p => t.categories.includes(p.category));
  }, [products, activeCategory]);

  const allBrands = useMemo<string[]>(() =>
    Array.from(
      new Set(
        categoryScoped
          .map(p => p.brand)
          .filter((b): b is string => Boolean(b)),
      ),
    ).sort()
  , [categoryScoped]);

  // Tag display-name lookup (slug → name) from the full vocabulary.
  const tagNameBySlug = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of allTags) m.set(t.slug, t.name);
    return m;
  }, [allTags]);

  // Per-facet product counts within the current category scope, layered-nav
  // style, so each brand / tag shows how many products carry it.
  const brandCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of categoryScoped) if (p.brand) m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
    return m;
  }, [categoryScoped]);

  // Tags present in scope (slug → count), most-used first, limited to the
  // known vocabulary so a stale slug can't leak in.
  const tagsInScope = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of categoryScoped) {
      for (const slug of (productTagMap[p.id] ?? [])) {
        if (tagNameBySlug.has(slug)) m.set(slug, (m.get(slug) ?? 0) + 1);
      }
    }
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1] || (tagNameBySlug.get(a[0]) ?? '').localeCompare(tagNameBySlug.get(b[0]) ?? ''))
      .map(([slug, count]) => ({ slug, count }));
  }, [categoryScoped, productTagMap, tagNameBySlug]);

  const priceBounds = useMemo(() => {
    if (categoryScoped.length === 0) return { min: 0, max: 10000 };
    let min = Infinity, max = -Infinity;
    for (const p of categoryScoped) {
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    return { min: Math.floor(min), max: Math.ceil(max) };
  }, [categoryScoped]);

  const [selectedBrands, setSelectedBrands] = useState<Set<string>>(initialState.brands);
  const [selectedValueIds, setSelectedValueIds] = useState<Set<string>>(initialState.attrs);
  const [priceMin, setPriceMin] = useState<number | ''>(initialState.min);
  const [priceMax, setPriceMax] = useState<number | ''>(initialState.max);
  const [inStockOnly, setInStockOnly] = useState(initialState.stock);
  const [onSaleOnly, setOnSaleOnly] = useState(initialState.sale);
  const [selectedTags, setSelectedTags] = useState<Set<string>>(initialState.tags);
  const [featuredOnly, setFeaturedOnly] = useState(initialState.featured);
  const [bestsellerOnly, setBestsellerOnly] = useState(initialState.bestseller);
  const [q, setQ] = useState(initialState.q);

  // Filter rail is collapsed by default so the catalogue shows immediately.
  // When open it's a fixed left-side slide-in panel on every viewport.
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterPanelRef = useRef<HTMLElement | null>(null);
  useBodyScrollLock(filtersOpen);
  useEscapeKey(filtersOpen, () => setFiltersOpen(false));
  useFocusTrap(filtersOpen, filterPanelRef);
  // Look up an attribute_value by id (for the chip label).
  const attrValueLookup = useMemo(() => {
    const m = new Map<string, { attrName: string; value: string }>();
    for (const a of attributes) for (const v of a.values) m.set(v.id, { attrName: a.name, value: v.value });
    return m;
  }, [attributes]);

  interface Chip { key: string; label: string; remove: () => void }
  const activeChips: Chip[] = useMemo(() => {
    const out: Chip[] = [];
    if (q.trim()) {
      out.push({
        key: 'q', label: `“${q.trim()}”`,
        remove: () => setQ(''),
      });
    }
    if (priceMin !== '' || priceMax !== '') {
      const lo = priceMin !== '' ? `PKR ${priceMin}` : '';
      const hi = priceMax !== '' ? `PKR ${priceMax}` : '';
      out.push({
        key: 'price', label: lo && hi ? `${lo}, ${hi}` : lo ? `≥ ${lo}` : `≤ ${hi}`,
        remove: () => { setPriceMin(''); setPriceMax(''); },
      });
    }
    if (inStockOnly) out.push({ key: 'stock', label: 'In stock', remove: () => setInStockOnly(false) });
    if (onSaleOnly) out.push({ key: 'sale', label: 'On sale', remove: () => setOnSaleOnly(false) });
    if (featuredOnly) out.push({ key: 'featured', label: 'Featured', remove: () => setFeaturedOnly(false) });
    if (bestsellerOnly) out.push({ key: 'bestseller', label: 'Bestseller', remove: () => setBestsellerOnly(false) });
    for (const b of selectedBrands) out.push({ key: `b:${b}`, label: b, remove: () => toggleBrand(b) });
    for (const slug of selectedTags) out.push({ key: `t:${slug}`, label: tagNameBySlug.get(slug) ?? slug, remove: () => toggleTag(slug) });
    for (const id of selectedValueIds) {
      const v = attrValueLookup.get(id);
      out.push({
        key: `a:${id}`,
        label: v ? `${v.attrName}: ${v.value}` : id.slice(0, 8),
        remove: () => toggleValue(id),
      });
    }
    return out;
  }, [q, priceMin, priceMax, inStockOnly, onSaleOnly, featuredOnly, bestsellerOnly, selectedBrands, selectedTags, selectedValueIds, attrValueLookup, tagNameBySlug]);

  function toggleTag(slug: string) {
    setSelectedTags(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug); else next.add(slug);
      return next;
    });
  }
  function toggleBrand(b: string) {
    setSelectedBrands(prev => {
      const next = new Set(prev);
      if (next.has(b)) next.delete(b); else next.add(b);
      return next;
    });
  }
  function toggleValue(id: string) {
    setSelectedValueIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function clearFilters() {
    setSelectedBrands(new Set());
    setSelectedTags(new Set());
    setSelectedValueIds(new Set());
    setPriceMin(''); setPriceMax('');
    setInStockOnly(false); setOnSaleOnly(false);
    setFeaturedOnly(false); setBestsellerOnly(false);
    setQ('');
  }

  // Reset paging when *any* filter / sort / category / query changes.
  // Page state isn't derivable (it's user-driven within a filter set), so
  // resetting it on filter change has to happen in an effect.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(1); }, [activeCategory, activeSubcategory, sortBy, selectedBrands, selectedTags, selectedValueIds, priceMin, priceMax, inStockOnly, onSaleOnly, featuredOnly, bestsellerOnly, q]);
  // Brand list rebuilds per-category; when the shopper switches the top tab we
  // drop brand selections that no longer apply. This must NOT run on mount,   // doing so wiped the brand seeded from `?brand=` in the URL (e.g. landing on
  // /shop?brand=Anua from a K-Beauty brand card), flipping the page straight
  // back to "all products". Guard the first run so the initial URL brand
  // survives; only genuine category switches clear the selection.
  const didMountBrandReset = useRef(false);
  useEffect(() => {
    if (!didMountBrandReset.current) { didMountBrandReset.current = true; return; }
    setSelectedBrands(new Set());
    setSelectedTags(new Set());
  }, [activeCategory]);

  // ─── URL persistence ─────────────────────────────────────────────────────
  // Builds the canonical /shop URL for the current filter state at a given
  // page. Shared by the persistence effect below AND the pagination links,
  // so pages 2+ render as real crawlable <a href="?page=N"> anchors that
  // always match what the effect would write.
  const shopUrlFor = useCallback((pageN: number) => {
    const sp = new URLSearchParams();
    if (q.trim()) sp.set('q', q.trim());
    // A pure leaf-category view (no search, no facet filters) lives at the
    // /category/<slug> path route — writing the /shop?category= form here
    // would immediately 308 back to the path URL (server redirect in
    // shop/page.tsx), a wasted round-trip on every tab click. Mirror the
    // server's rule: leaf + only sort/page → path URL; anything with extra
    // filters stays on /shop (the category page has no facet UI).
    const hasShopOnlyFilters =
      q.trim() !== '' || selectedBrands.size > 0 || selectedTags.size > 0 ||
      selectedValueIds.size > 0 || priceMin !== '' || priceMax !== '' ||
      inStockOnly || onSaleOnly || featuredOnly || bestsellerOnly;
    const leaf = activeSubcategory
      ?? (activeCategory && activeCategory !== 'All' && !findTaxon(activeCategory) ? activeCategory : null);
    if (leaf && !hasShopOnlyFilters) {
      if (sortBy !== 'featured') sp.set('sort', sortBy);
      if (pageN !== 1) sp.set('page', String(pageN));
      const qs2 = sp.toString();
      return `/category/${categorySlug(canonicalCategory(leaf) ?? leaf)}${qs2 ? `?${qs2}` : ''}`;
    }
    // Use `category=` / `subcategory=` (matches header nav + sitemap +
    // breadcrumb canonical URLs, see audit SEV-2 on cat/category mismatch).
    if (activeCategory && activeCategory !== 'All') sp.set('category', activeCategory);
    if (activeSubcategory) sp.set('subcategory', activeSubcategory);
    if (sortBy !== 'featured') sp.set('sort', sortBy);
    if (pageN !== 1) sp.set('page', String(pageN));
    if (selectedBrands.size > 0) sp.set('brand', Array.from(selectedBrands).join(','));
    if (selectedTags.size > 0) sp.set('tag', Array.from(selectedTags).join(','));
    if (selectedValueIds.size > 0) sp.set('attr', Array.from(selectedValueIds).join(','));
    if (priceMin !== '') sp.set('min', String(priceMin));
    if (priceMax !== '') sp.set('max', String(priceMax));
    if (inStockOnly) sp.set('stock', '1');
    if (onSaleOnly) sp.set('sale', '1');
    if (featuredOnly) sp.set('featured', '1');
    if (bestsellerOnly) sp.set('bestseller', '1');
    const qs = sp.toString();
    return qs ? `/shop?${qs}` : '/shop';
  }, [q, activeCategory, activeSubcategory, sortBy, selectedBrands, selectedTags, selectedValueIds, priceMin, priceMax, inStockOnly, onSaleOnly, featuredOnly, bestsellerOnly]);

  useEffect(() => {
    // Replace, not push, filtering shouldn't pile up history entries.
    router.replace(shopUrlFor(page), { scroll: false });
  }, [shopUrlFor, page, router]);

  const activeFilterCount =
    (q.trim() ? 1 : 0) +
    selectedBrands.size +
    selectedTags.size +
    selectedValueIds.size +
    (priceMin !== '' || priceMax !== '' ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (onSaleOnly ? 1 : 0) +
    (featuredOnly ? 1 : 0) +
    (bestsellerOnly ? 1 : 0);

  // Leaf categories that actually have at least one product. The sub-category
  // chip row is built from this set so it can never show an empty category,   // it stays correct automatically as the catalogue changes.
  const populatedLeaves = useMemo(
    () => new Set(products.map(p => p.category)),
    [products],
  );

  function handleTopCategory(cat: string) {
    setActiveCategory(cat);
    setActiveSubcategory(null);
  }

  // Pagination clicks must scroll back to the top of the catalogue.
  // `router.replace(..., { scroll: false })` suppresses Next's own scroll
  // restoration, so we scroll explicitly. Deferred one frame so it runs
  // after the new page's tiles commit, and INSTANT (not smooth), a smooth
  // scroll gets aborted by the layout shift as the fresh tiles render,
  // which left the viewport stranded at the foot of the previous page.
  function goToPage(next: number) {
    setPage(next);
    requestAnimationFrame(() => window.scrollTo({ top: 0 }));
  }

  // Prev/next pagination arrow, shared by the enabled <a> and the disabled
  // <span> so both bounds render identically.
  const pageArrowStyle = (disabled: boolean): React.CSSProperties => ({
    padding: '8px 14px', background: 'none', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
    fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', cursor: disabled ? 'default' : 'pointer',
    color: disabled ? 'var(--ink-400)' : 'var(--ink-900)', transition: 'all 150ms',
    textDecoration: 'none', display: 'inline-block',
  });

  // Free-text query. When the server resolved the term through the
  // `search_products` RPC (pg_trgm, same engine as the header typeahead) we
  // filter by its id set, so this page and the overlay agree on what
  // matches and how many. The case-insensitive substring match against
  // brand + name + category + variant remains the fallback for demo mode /
  // an RPC failure.
  const qLower = q.trim().toLowerCase();
  const activeTaxon = findTaxon(activeCategory);
  const searchIdSet = useMemo(() => (searchIds ? new Set(searchIds) : null), [searchIds]);
  // RPC rank (best match first) so the default "Featured" sort presents
  // results in the same order the overlay does.
  const searchRank = useMemo(() => {
    if (!searchIds) return null;
    const m = new Map<string, number>();
    searchIds.forEach((id, i) => m.set(id, i));
    return m;
  }, [searchIds]);

  let filtered = products.filter(p => {
    if (qLower) {
      if (searchIdSet) {
        if (!searchIdSet.has(p.id)) return false;
      } else {
        const hay = `${p.brand} ${p.name} ${p.category ?? ''} ${p.variant ?? ''}`.toLowerCase();
        if (!hay.includes(qLower)) return false;
      }
    }
    // Category scope: an active leaf chip narrows to that exact leaf
    // category; otherwise the active taxon narrows to its leaf set; the
    // "All" tab applies no category filter at all.
    if (activeSubcategory) {
      if (p.category !== activeSubcategory) return false;
    } else if (activeTaxon && !activeTaxon.categories.includes(p.category)) {
      return false;
    }
    if (selectedBrands.size > 0 && (!p.brand || !selectedBrands.has(p.brand))) return false;
    // Tags are OR within the facet: a product matches if it carries ANY of the
    // selected tags (layered-nav convention).
    if (selectedTags.size > 0) {
      const pTags = productTagMap[p.id] ?? [];
      if (!pTags.some(slug => selectedTags.has(slug))) return false;
    }
    if (featuredOnly && !p.is_featured) return false;
    if (bestsellerOnly && !p.is_bestseller) return false;
    if (priceMin !== '' && p.price < priceMin) return false;
    if (priceMax !== '' && p.price > priceMax) return false;
    if (inStockOnly && p.track_inventory !== false && p.stock <= 0) return false;
    if (onSaleOnly && !(p.original_price && p.original_price > p.price)) return false;
    if (selectedValueIds.size > 0) {
      const productValues = productValueMap[p.id] ?? [];
      // Require the product to cover at least one selected value *per attribute* the user picked.
      // Build attrId → selectedValueIds map for this filter set.
      const selectedByAttr = new Map<string, string[]>();
      for (const id of selectedValueIds) {
        for (const a of attributes) {
          const v = a.values.find(x => x.id === id);
          if (v) {
            const arr = selectedByAttr.get(a.id) ?? [];
            arr.push(id);
            selectedByAttr.set(a.id, arr);
            break;
          }
        }
      }
      for (const [, ids] of selectedByAttr) {
        if (!ids.some(id => productValues.includes(id))) return false;
      }
    }
    return true;
  });

  if (sortBy === 'price-low') filtered = [...filtered].sort((a, b) => a.price - b.price);
  else if (sortBy === 'price-high') filtered = [...filtered].sort((a, b) => b.price - a.price);
  else if (sortBy === 'name') filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  else if (qLower && searchRank) {
    // Default sort during an RPC-backed search: relevance order, matching
    // the typeahead overlay.
    filtered = [...filtered].sort((a, b) => (searchRank.get(a.id) ?? Infinity) - (searchRank.get(b.id) ?? Infinity));
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Sub-category chips = the active taxon's leaf categories, filtered to the
  // ones that actually have products so the row never shows an empty chip.
  const subcats = activeTaxon
    ? activeTaxon.categories.filter(leaf => populatedLeaves.has(leaf))
    : [];
  // A single-brand view with no category filter is effectively that brand's
  // landing page, show the brand name as the heading and a brand intro line
  // (otherwise the page is the generic "All Products" with no copy of its own).
  const singleBrand = selectedBrands.size === 1 && activeCategory === 'All' && !activeSubcategory
    ? Array.from(selectedBrands)[0]
    : null;
  const pageTitle = singleBrand
    ?? activeSubcategory
    ?? (activeCategory === 'All' ? 'All Products' : activeCategory);
  // Align the strongest on-page heading with the head term the <title> carries:
  // category / taxon / subcategory landings get the " in Pakistan" geo modifier
  // (e.g. "Cleansers & Treatments in Pakistan"). Brand landings keep the bare
  // brand name (their intro line carries the geo cue), and "All Products" stays
  // as-is.
  const heading = !singleBrand && activeCategory !== 'All'
    ? `${pageTitle} in Pakistan`
    : pageTitle;

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Shop</Overline>
          <h1 className="display-l" style={{ fontSize: '2.5rem', marginBottom: 12 }}>{heading}</h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 560, marginBottom: 32 }}>
            {singleBrand
              ? `Explore the full ${singleBrand} range at Yellow Pink, 100% authentic, imported, with cash-on-delivery across Pakistan.`
              // Prefer the richer keyword-led intro for wellness head-term pages;
              // fall back to the short CATEGORY_DESCRIPTIONS blurb otherwise.
              : (activeSubcategory ? CATEGORY_INTRO[activeSubcategory] ?? CATEGORY_DESCRIPTIONS[activeSubcategory] : undefined)
                ?? CATEGORY_INTRO[activeCategory]
                ?? CATEGORY_DESCRIPTIONS[activeCategory]
                ?? CATEGORY_DESCRIPTIONS.All}
          </p>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto', marginBottom: -1 }}>
            {TOP_CATEGORY_NAMES.map(cat => (
              <button key={cat} onClick={() => handleTopCategory(cat)} style={{
                padding: '12px 20px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                color: activeCategory === cat && !activeSubcategory ? 'var(--ink-900)' : 'var(--ink-500)',
                borderBottom: activeCategory === cat && !activeSubcategory ? '2px solid var(--ink-900)' : '2px solid transparent',
                transition: 'color 150ms, border-color 150ms',
                whiteSpace: 'nowrap', flexShrink: 0,
              }}>{cat}</button>
            ))}
          </div>
          {subcats.length > 0 && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0', borderTop: '1px solid var(--line)' }}>
              {subcats.map(sub => (
                <button key={sub} onClick={() => setActiveSubcategory(activeSubcategory === sub ? null : sub)} style={{
                  padding: '6px 14px', background: activeSubcategory === sub ? 'var(--ink-900)' : 'transparent',
                  border: '1px solid', borderColor: activeSubcategory === sub ? 'var(--ink-900)' : 'var(--line)',
                  borderRadius: 100, cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 500,
                  color: activeSubcategory === sub ? 'var(--paper)' : 'var(--ink-700)',
                  transition: 'all 150ms',
                  whiteSpace: 'nowrap', flexShrink: 0,
                }}>{sub}</button>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={{ padding: 'var(--section-gap) 0' }}>
        <div className="container">

          {/* ─── Toolbar above the grid: Filters toggle · chips · sort · count ─ */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
            {/* flex-basis auto (not `flex: 1` = basis 0): with basis 0 this group
                always "fits" any leftover space so the toolbar row never wraps,
                and on phones the group shrank narrower than the Filters pill,
                which then painted over the product count. Basis auto makes the
                row wrap the count/sort cluster onto its own line instead. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', flex: '1 1 auto' }}>
              <button
                type="button"
                onClick={() => setFiltersOpen(o => !o)}
                aria-expanded={filtersOpen}
                aria-controls="shop-filter-rail"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '8px 14px', borderRadius: 100,
                  border: '1px solid ' + (filtersOpen ? 'var(--ink-900)' : 'var(--line)'),
                  background: filtersOpen ? 'var(--ink-900)' : 'var(--paper)',
                  color: filtersOpen ? 'var(--paper)' : 'var(--ink-900)',
                  fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  fontFamily: 'var(--font-ui)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <line x1="4" y1="6" x2="20" y2="6" /><line x1="7" y1="12" x2="17" y2="12" /><line x1="10" y1="18" x2="14" y2="18" />
                </svg>
                Filters{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
              </button>

              {/* Active filter chips, always visible so users know what's applied
                  without opening the rail. */}
              {activeChips.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={c.remove}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '5px 10px', borderRadius: 100,
                    border: '1px solid var(--line)',
                    background: 'var(--paper2)', color: 'var(--ink-900)',
                    fontSize: '0.75rem', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)',
                  }}
                  aria-label={`Remove filter ${c.label}`}
                >
                  {c.label}
                  <span aria-hidden="true" style={{ color: 'var(--ink-500)', fontSize: '0.875rem', lineHeight: 1 }}>×</span>
                </button>
              ))}
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: 'var(--brand-pink-text)', fontWeight: 600,
                  fontFamily: 'var(--font-ui)',
                }}>
                  Clear all
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <span className="small-text">{filtered.length} product{filtered.length !== 1 ? 's' : ''}</span>
              <select value={sortBy} onChange={e => { const s = e.target.value as SortKey; setSortBy(s); track({ name: 'select_sort', payload: { sort: s } }); }}
                aria-label="Sort products"
                style={{
                  padding: '6px 10px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
                  background: 'var(--paper)', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem',
                  color: 'var(--ink-900)', cursor: 'pointer', outline: 'none',
                }}
              >
                <option value="featured">Featured</option>
                <option value="price-low">Price: Low → High</option>
                <option value="price-high">Price: High → Low</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          {/* Backdrop behind the slide-in rail (all viewports). Clicking closes it. */}
          <div
            onClick={() => setFiltersOpen(false)}
            aria-hidden="true"
            className="shop-rail-backdrop"
            style={{
              position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.45)',
              // Above the sticky header (z=100) so the header is dimmed +
              // inert while the rail is open; below the rail itself. Was 90,
              // which left the header floating un-dimmed on top of the
              // backdrop and painting over the rail's top controls.
              zIndex: 110,
              opacity: filtersOpen ? 1 : 0,
              pointerEvents: filtersOpen ? 'auto' : 'none',
              transition: 'opacity 220ms ease-out',
            }}
          />

          {/* Filter rail, fixed slide-in panel from the left, on every viewport.
              Always in the DOM so opening / closing animates the transform. */}
          <aside
            id="shop-filter-rail"
            className="shop-rail"
            ref={filterPanelRef}
            role="dialog"
            aria-modal={filtersOpen}
            aria-label="Filter products"
            // `inert` when closed removes the off-screen price/brand/tag controls
            // from the tab order and the a11y tree — `aria-hidden` alone left
            // focusable descendants reachable (a WCAG violation) and tabbable.
            inert={!filtersOpen}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 320, maxWidth: '88vw',
              background: 'var(--paper)',
              borderRight: '1px solid var(--line)',
              boxShadow: filtersOpen ? '4px 0 24px rgba(0,0,0,0.12)' : 'none',
              transform: filtersOpen ? 'translateX(0)' : 'translateX(-100%)',
              transition: 'transform 280ms ease-out, box-shadow 280ms ease-out',
              // Above the sticky header (z=100) and this rail's own backdrop
              // (110); below the mini-cart (200) / search overlay (300) /
              // mobile nav (950). Was 100, tying with the header, whose
              // stacking context could then paint over the rail's top
              // controls (desktop and mobile), hiding Filters/close.
              zIndex: 120,
              overflowY: 'auto',
              padding: '20px 24px 32px',
              display: 'flex', flexDirection: 'column',
            }}
          >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Overline>Filters</Overline>
                <button
                  type="button"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                  className="shop-rail-close"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '1.125rem', color: 'var(--ink-500)', padding: 4, lineHeight: 1,
                    display: 'none',
                  }}
                >
                  ×
                </button>
              </div>

              {/* Price */}
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                  Price (PKR)
                </legend>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Minimum price in PKR"
                    placeholder={String(priceBounds.min)}
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none' }}
                  />
                  <span aria-hidden="true" style={{ color: 'var(--ink-500)' }}>–</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    aria-label="Maximum price in PKR"
                    placeholder={String(priceBounds.max)}
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value === '' ? '' : Number(e.target.value))}
                    style={{ width: '100%', padding: '6px 8px', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.8125rem', outline: 'none' }}
                  />
                </div>
              </fieldset>

              {/* Toggles */}
              <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={inStockOnly} onChange={e => setInStockOnly(e.target.checked)} />
                  In stock only
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={onSaleOnly} onChange={e => setOnSaleOnly(e.target.checked)} />
                  On sale
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={featuredOnly} onChange={e => setFeaturedOnly(e.target.checked)} />
                  Featured
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 0' }}>
                  <input type="checkbox" checked={bestsellerOnly} onChange={e => setBestsellerOnly(e.target.checked)} />
                  Bestseller
                </label>
              </fieldset>

              {/* Tags */}
              {tagsInScope.length > 0 && (
                <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                  <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Tags
                  </legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                    {tagsInScope.map(({ slug, count }) => (
                      <label key={slug} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '3px 0' }}>
                        <input type="checkbox" checked={selectedTags.has(slug)} onChange={() => toggleTag(slug)} />
                        <span style={{ flex: 1 }}>{tagNameBySlug.get(slug) ?? slug}</span>
                        <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{count}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Brand */}
              {allBrands.length > 1 && (
                <fieldset style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                  <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                    Brand
                  </legend>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 280, overflowY: 'auto', paddingRight: 4 }}>
                    {allBrands.map(b => (
                      <label key={b} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', padding: '3px 0' }}>
                        <input type="checkbox" checked={selectedBrands.has(b)} onChange={() => toggleBrand(b)} />
                        <span style={{ flex: 1 }}>{b}</span>
                        <span style={{ color: 'var(--ink-500)', fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums' }}>{brandCounts.get(b) ?? 0}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Variant attribute facets (Shade, Size, etc.) */}
              {attributes.map(attr => {
                const hasColor = attr.values.some(v => v.color_hex);
                return (
                  <fieldset key={attr.id} style={{ border: 'none', padding: 0, margin: '0 0 20px' }}>
                    <legend style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--ink-900)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                      {attr.name}
                    </legend>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {attr.values.map(v => {
                        const active = selectedValueIds.has(v.id);
                        if (hasColor && v.color_hex) {
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => toggleValue(v.id)}
                              title={v.value}
                              aria-label={v.value}
                              aria-pressed={active}
                              style={{
                                width: 28, height: 28, borderRadius: '50%',
                                border: active ? '2px solid var(--ink-900)' : '2px solid var(--line)',
                                outline: active ? '2px solid var(--paper)' : 'none', outlineOffset: -3,
                                background: v.color_hex,
                                cursor: 'pointer', padding: 0,
                              }}
                            />
                          );
                        }
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => toggleValue(v.id)}
                            aria-pressed={active}
                            style={{
                              padding: '4px 10px',
                              border: '1px solid ' + (active ? 'var(--ink-900)' : 'var(--line)'),
                              background: active ? 'var(--ink-900)' : 'var(--paper)',
                              color: active ? 'var(--paper)' : 'var(--ink-900)',
                              borderRadius: 100,
                              fontSize: '0.75rem',
                              cursor: 'pointer',
                            }}
                          >
                            {v.value}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                );
              })}
            </aside>

            {/* ─── Product grid (always full-width, rail floats over the top) ─ */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--gutter)' }} className="product-grid">
            {paginated.map((p) => (
              <ProductTile key={p.id} product={p} />
            ))}
          </div>
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: 'center', padding: '56px 24px',
                background: 'linear-gradient(135deg, var(--paper2) 0%, var(--paper) 100%)',
                border: '1px dashed var(--line)', borderRadius: 'var(--radius-card)',
                marginTop: 24,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 60, height: 60, margin: '0 auto 18px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FDE7F0 0%, #FFF8E1 100%)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', color: 'var(--brand-pink-text)',
                }}
              >○</div>
              <h2 className="display-l" style={{ fontSize: '1.5rem', margin: '0 0 8px' }}>
                {q.trim()
                  ? <>No results for &ldquo;{q.trim()}&rdquo;</>
                  : activeFilterCount > 0
                  ? 'No products match those filters'
                  : 'No products in this category yet'}
              </h2>
              <p className="body-text" style={{ color: 'var(--ink-700)', maxWidth: 420, margin: '0 auto 20px' }}>
                {q.trim()
                  ? 'Try a different spelling, a shorter term, or browse a category instead.'
                  : activeFilterCount > 0
                  ? "Try clearing a filter or two, we'll show you what's available."
                  : "We're restocking, check back soon or browse another category."}
              </p>
              <div style={{ display: 'inline-flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                {(q.trim() || activeFilterCount > 0) && (
                  <button
                    type="button"
                    onClick={() => { setQ(''); clearFilters(); }}
                    className="btn-primary"
                    style={{ fontSize: '0.75rem' }}
                  >Clear all filters</button>
                )}
                {TOP_CATEGORY_NAMES
                  .filter(c => c !== 'All' && c !== activeCategory)
                  .slice(0, 3)
                  .map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => { setQ(''); setActiveCategory(c); }}
                      style={{
                        padding: '10px 16px',
                        background: 'white', border: '1px solid var(--line)',
                        borderRadius: 'var(--radius-card)',
                        fontFamily: 'var(--font-ui)', fontSize: '0.75rem', fontWeight: 600,
                        letterSpacing: '0.06em', textTransform: 'uppercase',
                        color: 'var(--ink-900)', cursor: 'pointer',
                        minHeight: 36,
                      }}
                    >Try {c}</button>
                  ))
                }
              </div>
            </div>
          )}
          {/* Pagination renders real <a href="?page=N"> links (built via
              shopUrlFor so they mirror the active filters), so pages 2+ are
              crawl-discoverable, while onClick intercepts for the same
              instant client-side page flip as before. Disabled prev/next
              at the bounds are spans, not dead links. */}
          {totalPages > 1 && (
            <nav aria-label="Product pages" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, marginTop: 48 }}>
              {page === 1 ? (
                <span aria-hidden="true" style={pageArrowStyle(true)}>←</span>
              ) : (
                <a
                  href={shopUrlFor(page - 1)}
                  onClick={e => { e.preventDefault(); goToPage(page - 1); }}
                  aria-label="Previous page"
                  style={pageArrowStyle(false)}
                ><span aria-hidden="true">←</span></a>
              )}
              {(() => {
                const pages: (number | '…')[] = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 4) pages.push('…');
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
                  if (page < totalPages - 3) pages.push('…');
                  pages.push(totalPages);
                }
                return pages.map((p, i) =>
                  p === '…' ? (
                    <span key={`ellipsis-${i}`} style={{ padding: '8px 6px', fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', color: 'var(--ink-500)' }}>…</span>
                  ) : (
                    <a
                      key={p}
                      href={shopUrlFor(p as number)}
                      onClick={e => { e.preventDefault(); goToPage(p as number); }}
                      aria-label={`Page ${p}`}
                      aria-current={page === p ? 'page' : undefined}
                      style={{
                        padding: '8px 12px', border: '1px solid', borderRadius: 'var(--radius-card)',
                        borderColor: page === p ? 'var(--ink-900)' : 'var(--line)',
                        background: page === p ? 'var(--ink-900)' : 'none',
                        fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
                        color: page === p ? 'var(--paper)' : 'var(--ink-900)', cursor: 'pointer', transition: 'all 150ms',
                        textDecoration: 'none', display: 'inline-block',
                      }}
                    >{p}</a>
                  )
                );
              })()}
              {page === totalPages ? (
                <span aria-hidden="true" style={pageArrowStyle(true)}>→</span>
              ) : (
                <a
                  href={shopUrlFor(page + 1)}
                  onClick={e => { e.preventDefault(); goToPage(page + 1); }}
                  aria-label="Next page"
                  style={pageArrowStyle(false)}
                ><span aria-hidden="true">→</span></a>
              )}
            </nav>
          )}
            </div> {/* close product grid column */}
        </div>
      </section>
    </div>
  );
}
