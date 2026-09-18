import { withRenderedDates } from './price-tokens';
import { createClient } from '@supabase/supabase-js';
import type { Product, BlogPost } from '@/types';
import { DEMO_PRODUCTS, DEMO_BLOG_POSTS, DEMO_SITE_SETTINGS } from './demo-data';
import { isDemo } from './is-demo';
import { cachedRead, liveFallback, reportSupabaseFailure } from './supabase-resilience';
import { CATALOG_CACHE_TAG, BLOG_CACHE_TAG, SETTINGS_CACHE_TAG } from './cache-tags';

/** True when no Supabase env vars are configured. Storefront helpers fall
 *  back to stub data so the site renders for design / a11y review on a
 *  fresh clone without setting up Supabase. Re-exported from ./is-demo so
 *  client components can read the flag without pulling this module (and its
 *  `createClient` call) into the browser bundle. */
export { isDemo };

const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Placeholder URL/key so createClient doesn't throw on import in demo mode.
const supabaseUrl = envUrl || 'https://demo.invalid';
const supabaseAnonKey = envKey || 'demo-anon-key';

// Anonymous storefront read client. It NEVER manages a user session, the
// logged-in customer session is owned exclusively by the @supabase/ssr
// cookie client (lib/supabase-browser + lib/supabase-server). persistSession
// / autoRefreshToken are off so that, even if this module is ever pulled
// into the browser bundle, it can't construct a competing session store that
// races the cookie client and makes signed-in customers look logged-out.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Service-role client (server-only) ──────────────────────────────────────
// Use for sensitive tables that have RLS enabled with service-role-only
// policies (`staff_members`, `audit_log`, `analytics_*`). NEVER import from a
// `'use client'` file, the service-role key would leak into the JS bundle.
//
// Lazy getter so a client-bundled import of this module doesn't trip the
// missing-env-var path at module-evaluation time. Throws on first call if
// the key really is missing at runtime on the server.
let _admin: ReturnType<typeof createClient> | null = null;
export function supabaseAdmin() {
  if (_admin) return _admin;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    if (isDemo) return supabase;
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations');
  }
  _admin = createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _admin;
}

// ─── Resilience layer ───────────────────────────────────────────────────────
// Every public storefront getter routes through this so a failed read never
// throws into the global-error boundary. What it returns instead depends on
// the mode:
//
//   * demo mode (no Supabase env): the demo fallback, so a fresh clone renders.
//   * production: the EMPTY shape of that fallback (`[]` / `null`, or the
//     explicit `live` value), and the failure is reported to Sentry.
//
// Production used to get the demo rows too. On 17 Sep 2026 Supabase restricted
// the project (Free-plan egress quota) and for two days every page served the
// sample catalogue, fake prices and all, while every monitor read "200 OK".
// An empty shelf plus an alert beats a fake shelf and silence.

async function safe<T>(
  label: string,
  fn: () => Promise<T>,
  fallback: T,
  live?: T,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    // Demo mode is opt-in for offline rendering and the placeholder URL
    // deliberately can't be reached, so don't report those failures.
    if (isDemo) return fallback;
    reportSupabaseFailure(label, err);
    return live !== undefined ? live : liveFallback(fallback);
  }
}

// ─── Cross-request caching ──────────────────────────────────────────────────
// Catalogue reads are cached in Next's data cache and busted by tag from the
// admin write paths (lib/revalidate-storefront), so the TTLs below are safety
// nets, not the freshness mechanism. Before this the full 177 kB product
// projection was fetched on nearly every render (~10,000 times a day under a
// crawler), which is how the Free plan's 5 GB monthly egress went in eleven
// days. Settings and the sale calendar keep a short TTL because a handful of
// their writers do not bust the tag.
const CATALOG_TTL = 3600;
const SETTINGS_TTL = 300;
const catalog = { tags: [CATALOG_CACHE_TAG], revalidate: CATALOG_TTL } as const;
const blog = { tags: [BLOG_CACHE_TAG], revalidate: CATALOG_TTL } as const;

// Tile-projection for collection / listing pages, narrow on purpose so
// the inline RSC payload that ships every Product to the client doesn't
// carry per-row description / how_to_use / ingredients / key_benefits /
// faq strings. P0-3 finding in the 2026-05-19 launch audit: /shop was
// shipping ~277KB of inline JSON, the bulk of it long-form fields no
// tile reads. Switching from select('*') saves ~400KB on /shop and
// /shop?taxon=*.
// `kind` matters on tiles: ProductTile's quick-add and the mini-cart's
// cross-sell row route/skip variable products, but without the column every
// product read as simple and a shade product could be one-tap added with no
// variant on the line.
// `vendor_id` matters on tiles too: cart lines are built by spreading the
// product object, and the vendor free-shipping rule (NB Sons ≥ Rs 1,999,
// migration 770) keys off cartItem.vendor_id. Without the column, a tile
// quick-add produced a vendor-less cart line and a qualifying basket was
// quoted the full delivery rate at checkout (a real Jul 31 order paid Rs 250
// it shouldn't have).
const PRODUCT_TILE_COLUMNS =
  'id, brand, name, variant, price, original_price, category, subcategory, tag, slug, stock, track_inventory, continue_selling_when_out, vendor_id, image_url, is_bestseller, is_featured, is_popular, popularity_score, trend_score, units_sold, sales_score, packaging, status, created_at, rating, review_count, kind';

// Shared purchasability predicate — every storefront product surface must
// apply it (the 2026-08-04 audit found four rails that forgot the stock
// filter and could show sold-out tiles).
//
// The third clause is what keeps a live listing alive past zero: without it
// this filter would delete keep-selling products from every rail the moment
// their count ran out, which is exactly the disappearance the flag exists to
// prevent. Keep it in lock-step with lib/sellable.isSellable — this is the
// SQL half of the same rule.
const PURCHASABLE = 'stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true';

const readPublishedProducts = cachedRead(['products:published'], async () => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_TILE_COLUMNS)
    // Storefront catalogue, published only. Draft products aren't live
    // yet, and archived products (a soft-deleted product with order
    // history) must drop off the storefront while keeping their row for
    // Analytics + order detail.
    .eq('status', 'published')
    .order('id');
  if (error) throw error;
  return (data ?? []) as unknown as Product[];
}, catalog);

export async function getProducts(): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS;
  return safe('getProducts', readPublishedProducts, DEMO_PRODUCTS);
}

// PostgREST's "no rows" code for .single(): an expected miss, not a failure.
const NO_ROWS = 'PGRST116';

const readProductBySlug = cachedRead(['product:by-slug'], async (slug: string) => {
  // Published only, an archived/draft product has no live PDP; the page
  // 404s on a null product (see product/[slug]/page.tsx).
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .single();
  if (error && error.code !== NO_ROWS) throw error;
  if (data) return data as Product;

  // Fallback: some slugs have a doubled brand prefix (e.g. cerave-cerave-acne-control-cleanser).
  // If the exact slug fails, try matching any slug that ends with -{slug}.
  const { data: fallback, error: fallbackError } = await supabase
    .from('products')
    .select('*')
    .ilike('slug', `%-${slug}`)
    .eq('status', 'published')
    .limit(1)
    .single();
  if (fallbackError && fallbackError.code !== NO_ROWS) throw fallbackError;
  return (fallback as Product | null) ?? null;
}, catalog);

export async function getProductBySlug(slug: string): Promise<Product | null> {
  if (isDemo) return DEMO_PRODUCTS.find(p => p.slug === slug) ?? null;
  return safe('getProductBySlug', () => readProductBySlug(slug), DEMO_PRODUCTS.find(p => p.slug === slug) ?? null);
}

/** Real social proof for the homepage "Real shoppers, real results" section.
 *  Every number and every quote comes from the live database — the section
 *  previously shipped hardcoded stats ("2,400+ reviews", "50k+ orders") and
 *  invented review cards, which is exactly the fake-review pattern the
 *  section's own copy disclaims. Returns null (section hides) rather than
 *  ever padding with fiction. */
export interface HomeSocialProof {
  avgRating: number;
  reviewCount: number;
  brandCount: number;
  reviews: Array<{ author: string; body: string; verified: boolean; brand: string | null; product: string }>;
}

const readHomeSocialProof = cachedRead(['home:social-proof'], async (): Promise<HomeSocialProof | null> => {
    const [ratingsRes, reviewsRes, brandsRes] = await Promise.all([
      supabase.from('product_reviews').select('rating').eq('approved', true),
      supabase
        .from('product_reviews')
        .select('author_name, body, verified_purchase, helpful_count, products(brand, name)')
        .eq('approved', true)
        .eq('rating', 5)
        .order('helpful_count', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(24),
      supabase.from('brands').select('id', { count: 'exact', head: true }),
    ]);

    if (ratingsRes.error) throw ratingsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    const ratings = (ratingsRes.data ?? []) as Array<{ rating: number }>;
    if (ratings.length < 10) return null; // too thin to make claims from

    type Row = {
      author_name: string | null; body: string | null; verified_purchase: boolean | null;
      products: { brand: string | null; name: string } | null;
    };
    // Substantial quotes only, at most one per brand so the row shows range,
    // not three cards about one product line.
    const seenBrands = new Set<string>();
    const reviews: HomeSocialProof['reviews'] = [];
    for (const r of (reviewsRes.data ?? []) as unknown as Row[]) {
      const body = (r.body ?? '').trim();
      const brand = r.products?.brand ?? null;
      if (body.length < 80 || !r.products) continue;
      if (brand && seenBrands.has(brand)) continue;
      if (brand) seenBrands.add(brand);
      reviews.push({
        author: r.author_name ?? 'Verified customer',
        body,
        verified: r.verified_purchase ?? false,
        brand,
        product: r.products.name,
      });
      if (reviews.length === 3) break;
    }
    if (reviews.length < 3) return null;

    return {
      avgRating: Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10,
      reviewCount: ratings.length,
      brandCount: brandsRes.count ?? 0,
      reviews,
    };
}, catalog);

export async function getHomeSocialProof(): Promise<HomeSocialProof | null> {
  if (isDemo) return null;
  return safe('getHomeSocialProof', readHomeSocialProof, null);
}

/** Editorial bestsellers, flagged by `is_bestseller=true`. Falls back to
 *  the highest-stock published products if the flag hasn't been seeded yet
 * , homepage rails should never go empty. */
const readBestsellers = cachedRead(['products:bestsellers'], async (limit: number) => {
    // Demand-driven "Popular right now" rail. Ordering, in priority:
    //   1. is_bestseller   , the owner's manual pin always leads (override)
    //   2. popularity_score, daily demand (views + carts + sales) set by the
    //      popularity-refresh cron — what makes the rail reflect what shoppers
    //      actually look at and buy instead of a static flag
    //   3. created_at      , newest-first tiebreak so a fresh product with no
    //      demand signal yet still ranks above older zero-demand ones
    // Published + in-stock only, so the rail never shows a dead tile. One
    // query: the manual pins fall out on top for free.
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true')
      .order('is_bestseller', { ascending: false })
      .order('popularity_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
}, catalog);

export async function getBestsellers(limit = 8): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, limit);
  return safe('getBestsellers', () => readBestsellers(limit), DEMO_PRODUCTS.slice(0, limit));
}

/** "Best Sellers" rail — ordered by real units sold (nightly `units_sold`),
 *  with the manual is_bestseller pin still leading as the owner override.
 *  Zero-sale products sort last by recency, so the rail is never empty. */
const readTopSellers = cachedRead(['products:top-sellers'], async (limit: number) => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true')
      .order('is_bestseller', { ascending: false })
      // Decayed sales (sales_score), not raw units: at a few orders/day raw
      // counts are a coin flip below rank 3. Demand then freshness tiebreak.
      .order('sales_score', { ascending: false })
      .order('popularity_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
}, catalog);

export async function getTopSellers(limit = 4): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, limit);
  return safe('getTopSellers', () => readTopSellers(limit), DEMO_PRODUCTS.slice(0, limit));
}

/** "Trending Now" rail — ordered purely by recent momentum (nightly
 *  `trend_score` = views + add-to-carts). No manual pin: trending is a live
 *  signal by definition. Zero-signal products sort last by recency. */
const readTrending = cachedRead(['products:trending'], async (limit: number) => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true')
      .order('trend_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
}, catalog);

export async function getTrending(limit = 4): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, limit);
  return safe('getTrending', () => readTrending(limit), DEMO_PRODUCTS.slice(0, limit));
}

/** Newest published, purchasable products — the homepage "New In" rail and
 *  anywhere else fresh stock should surface. Pure recency, no flags. */
const readNewArrivals = cachedRead(['products:new-arrivals'], async (limit: number) => {
    // 30-day floor so "just landed" copy can't silently describe old stock;
    // the rail self-hides during a dry spell (ProductRail returns null on []).
    const floor = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or('stock.gt.0,track_inventory.is.false,continue_selling_when_out.is.true')
      .gte('created_at', floor)
      .order('created_at', { ascending: false })
      // Bulk imports share created_at to the second; id tiebreak keeps the
      // order stable across renders.
      .order('id')
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
}, catalog);

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, limit);
  return safe('getNewArrivals', () => readNewArrivals(limit), DEMO_PRODUCTS.slice(0, limit));
}

/** EVERY owner-flagged (`is_featured`), published, purchasable product,
 *  demand-ordered. The catalog is small, so the full flagged set is cheap;
 *  the merchandising composer picks the daily four and handles the fill-up
 *  when fewer than four are flagged (it needs the sellers pool to exclude,
 *  which this helper cannot see). */
const readFeatured = cachedRead(['products:featured'], async () => {
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('is_featured', true)
      .eq('status', 'published')
      // Sold-out products must not hold a Featured slot (audit fix).
      .or(PURCHASABLE)
      .order('popularity_score', { ascending: false })
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Product[];
}, catalog);

export async function getFeatured(): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.slice(0, 6);
  return safe('getFeatured', readFeatured, DEMO_PRODUCTS.slice(0, 6));
}

/** Products on sale = `original_price > price`. Sorted by discount % so the
 *  deepest deals lead. */
const readOnSale = cachedRead(['products:on-sale'], async (limit: number) => {
    // discount_pct is a STORED generated column (migration 2026-08-04):
    // round(100*(original_price-price)/original_price). Exact SQL predicate,
    // deepest discounts first, 10% floor so token discounts don't headline,
    // in-stock only. Replaces the old lossy overfetch that sorted by
    // original_price and could miss discounted rows past limit*4.
    const { data, error } = await supabase
      .from('products')
      .select(PRODUCT_TILE_COLUMNS)
      .eq('status', 'published')
      .or(PURCHASABLE)
      .gte('discount_pct', 10)
      .order('discount_pct', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as Product[];
}, catalog);

export async function getOnSale(limit = 8): Promise<Product[]> {
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.original_price && p.original_price > p.price).slice(0, limit);
  return safe('getOnSale', () => readOnSale(limit), DEMO_PRODUCTS.slice(0, limit));
}

/** Resolve a taxon slug ("makeup" / "wellness" / etc.) or a single-category
 *  name into a product list. Returns []  if the taxon is unknown so the home
 *  sections render their empty-state, not their full catalog. */
export async function getProductsByTaxon(taxonOrCategory: string, limit = 8): Promise<Product[]> {
  const { categoriesForTaxon } = await import('./category-taxonomy');
  const taxonCats = categoriesForTaxon(taxonOrCategory);
  const cats = taxonCats ?? [taxonOrCategory];
  if (isDemo) return DEMO_PRODUCTS.filter(p => cats.includes(p.category)).slice(0, limit);
  return safe('getProductsByTaxon', () => readProductsByCategories(cats as string[], limit),
    DEMO_PRODUCTS.filter(p => cats.includes(p.category)).slice(0, limit));
}

const readProductsByCategories = cachedRead(['products:by-categories'], async (cats: string[], limit: number) => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_TILE_COLUMNS)
    .in('category', cats)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Product[];
}, catalog);

/** Every published wellness product, bestsellers first then newest. Powers
 *  the homepage WellnessSection, which derives its per-concern counts +
 *  from-prices and its featured rail from one live query (no baked numbers
 *  that drift from the catalog). Wellness is ~60 rows, so pulling the full
 *  set with the tile projection is cheap and keeps the section accurate. */
export async function getWellnessProducts(): Promise<Product[]> {
  const { categoriesForTaxon } = await import('./category-taxonomy');
  const cats = (categoriesForTaxon('wellness') ?? []) as string[];
  if (isDemo) return DEMO_PRODUCTS.filter(p => cats.includes(p.category));
  return safe('getWellnessProducts', () => readWellnessProducts(cats), DEMO_PRODUCTS.filter(p => cats.includes(p.category)));
}

const readWellnessProducts = cachedRead(['products:wellness'], async (cats: string[]) => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_TILE_COLUMNS)
    .in('category', cats)
    .eq('status', 'published')
    // In stock only — a sold-out product made concern cards advertise a
    // phantom "from" price (audit fix).
    .or(PURCHASABLE)
    .order('popularity_score', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Product[];
}, catalog);

/** Products from a single brand, powers the "More from {brand}" rail on
 *  the PDP. Published only; returns [] for a missing brand so the rail
 *  collapses cleanly. */
export async function getProductsByBrand(brand: string | null | undefined, limit = 8): Promise<Product[]> {
  if (!brand) return [];
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.brand === brand).slice(0, limit);
  return safe('getProductsByBrand', () => readProductsByBrand(brand, limit), []);
}

const readProductsByBrand = cachedRead(['products:by-brand'], async (brand: string, limit: number) => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_TILE_COLUMNS)
    .eq('brand', brand)
    .eq('status', 'published')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Product[];
}, catalog);

/** Products across a curated brand list, powers brand edits like the
 *  homepage K-Beauty section (see lib/k-beauty.ts). Published only, newest
 *  first. No catalog-wide fallback: an empty result hides the section, which
 *  beats padding a "Korean beauty" rail with non-Korean products. */
export async function getProductsByBrands(brands: readonly string[], limit = 4): Promise<Product[]> {
  if (brands.length === 0) return [];
  if (isDemo) return DEMO_PRODUCTS.filter(p => p.brand && brands.includes(p.brand)).slice(0, limit);
  return safe('getProductsByBrands', () => readProductsByBrands([...brands], limit), []);
}

const readProductsByBrands = cachedRead(['products:by-brands'], async (brands: string[], limit: number) => {
  const { data, error } = await supabase
    .from('products')
    .select(PRODUCT_TILE_COLUMNS)
    .in('brand', brands)
    .eq('status', 'published')
    .or(PURCHASABLE)
    .order('popularity_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Product[];
}, catalog);

// Tile-projection for the blog index. P0-2 finding in the 2026-05-19
// launch audit: /blog was shipping 1.95 MB of HTML, ~1.76 MB of which
// was the full WP body of every post embedded in the RSC payload, the
// tile component only renders title / excerpt / image / category /
// date. Narrowing the select cuts /blog from ~2 MB to ~150 KB.
const BLOG_TILE_COLUMNS =
  'id, slug, title, excerpt, category, date, read_time, featured, image_url, updated_at';

const readBlogPosts = cachedRead(['blog:posts'], async (limit: number | undefined) => {
    let q = supabase
      .from('blog_posts')
      .select(BLOG_TILE_COLUMNS)
      // Future-dated rows are scheduled, not published — without this gate a
      // future date pins slot 1 of every recency surface (audit fix).
      .lte('date', new Date().toISOString().slice(0, 10))
      // Secondary tiebreak on created_at: several posts share the same
      // editorial date (e.g. a whole batch published the same day), and
      // `date` alone leaves Postgres to pick an arbitrary, unstable order
      // among them.
      .order('date', { ascending: false })
      .order('created_at', { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw error;
    // Resolve [[year]]/[[month]] in headlines once, here, so every surface
    // that renders a title gets the live value. See withRenderedDates.
    return ((data ?? []) as unknown as BlogPost[]).map(p => withRenderedDates(p));
}, blog);

export async function getBlogPosts(opts: { limit?: number } = {}): Promise<BlogPost[]> {
  if (isDemo) return opts.limit ? DEMO_BLOG_POSTS.slice(0, opts.limit) : DEMO_BLOG_POSTS;
  return safe('getBlogPosts', () => readBlogPosts(opts.limit), DEMO_BLOG_POSTS);
}

/** The current featured post, if any (the one-featured unique index makes
 *  "any" mean "the"). Hero eligibility (60-day window) is applied by
 *  pickBlogHero in lib/merchandising. */
const readFeaturedBlogPost = cachedRead(['blog:featured'], async () => {
    const { data, error } = await supabase
      .from('blog_posts')
      .select(BLOG_TILE_COLUMNS)
      .eq('featured', true)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    const row = (data ?? null) as unknown as BlogPost | null;
    return row ? withRenderedDates(row) : null;
}, blog);

export async function getFeaturedBlogPost(): Promise<BlogPost | null> {
  if (isDemo) return DEMO_BLOG_POSTS.find(p => p.featured) ?? null;
  return safe('getFeaturedBlogPost', readFeaturedBlogPost, null);
}

/** Posts whose body links to a product's PDP — the reverse of the blog's
 *  house convention of inline `<a href="/product/<slug>">` links. Powers the
 *  "From the blog" rail on PDPs. The LIKE scan over ~180 rows is fine at this
 *  scale and stays fresh through the PDP's ISR window. */
const readPostsLinkingProduct = cachedRead(['blog:linking-product'], async (slug: string, limit: number) => {
    // Select body too so we can boundary-check: a plain LIKE would let
    // "melatonin" match a link to "melatonin-plus". Slugs are [a-z0-9-],
    // so any of " ' / ? # after the slug means the link really ends there.
    const { data, error } = await supabase
      .from('blog_posts')
      .select(`${BLOG_TILE_COLUMNS}, body`)
      .like('body', `%/product/${slug}%`)
      .order('date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit * 3);
    if (error) throw error;
    const exact = new RegExp(`/product/${slug}(?![a-z0-9-])`);
    return (data ?? [])
      .filter(p => exact.test((p as { body?: string }).body ?? ''))
      .slice(0, limit)
      // Drop the heavy body column before the rows enter the RSC payload.
      .map(p => { const tile = { ...(p as Record<string, unknown>) }; delete tile.body; return tile; })
      .map(p => withRenderedDates(p as unknown as BlogPost)) as unknown as BlogPost[];
}, blog);

export async function getPostsLinkingProduct(slug: string, limit = 3): Promise<BlogPost[]> {
  if (isDemo || !slug) return [];
  return safe('getPostsLinkingProduct', () => readPostsLinkingProduct(slug, limit), []);
}

const readBlogPostBySlug = cachedRead(['blog:by-slug'], async (slug: string) => {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error) {
    if (error.code === NO_ROWS) return null;
    throw error;
  }
  return withRenderedDates(data as BlogPost);
}, blog);

export async function getBlogPostBySlug(slug: string): Promise<BlogPost | null> {
  if (isDemo) return DEMO_BLOG_POSTS.find(p => p.slug === slug) ?? null;
  return safe('getBlogPostBySlug', () => readBlogPostBySlug(slug), DEMO_BLOG_POSTS.find(p => p.slug === slug) ?? null);
}

const readSiteSettings = cachedRead(['site-settings:all'], async () => {
  const { data, error } = await supabase.from('site_settings').select('key, value');
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])) as Record<string, string>;
}, { tags: [SETTINGS_CACHE_TAG], revalidate: SETTINGS_TTL });

export async function getSiteSettings(): Promise<Record<string, string>> {
  if (isDemo) return DEMO_SITE_SETTINGS;
  // Empty map on failure (every consumer has a default per key), never the
  // demo copy with its "DEMO MODE" announcement bar.
  return safe('getSiteSettings', readSiteSettings, DEMO_SITE_SETTINGS, {});
}
