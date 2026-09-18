import { revalidatePath, revalidateTag } from 'next/cache';
import { BLOG_CACHE_TAG, CATALOG_CACHE_TAG, SETTINGS_CACHE_TAG } from './cache-tags';

// Immediate expiry, not stale-while-revalidate: staff expect the edit they
// just saved to be on the live page they open next. `{ expire: 0 }` works
// from server actions and route handlers alike (updateTag is actions-only).
const NOW = { expire: 0 } as const;

/**
 * Revalidate the storefront ISR pages that surface catalogue data — products,
 * brands, collections, category pages, deals, and journal posts (whose buy
 * modules embed live product price/stock). Admin create/update/delete/publish
 * mutations call this so an edit shows on the live site immediately.
 *
 * Because every catalogue write funnels through here, the routes' periodic
 * ISR window can be long (an hour) — it exists only as a safety net. Short
 * windows defeat the build-time prerender on a low-traffic site: entries
 * expire between visits and every organic/crawler hit pays a cold render.
 *
 * The dynamic detail routes are revalidated by their route pattern (the `page`
 * form) because a single catalogue change can touch many of them at once — a
 * product appears on its PDP, on every brand/collection page that lists it,
 * and on smart collections whose rules it now matches — and we can't cheaply
 * enumerate which. The listing/home routes are literal paths.
 */
export function revalidateStorefrontCatalog(): void {
  // The cached readers first (lib/supabase, shop-facets, collections-data,
  // search-data), then the pages, so the regenerated pages read fresh rows.
  revalidateTag(CATALOG_CACHE_TAG, NOW);
  revalidatePath('/');
  revalidatePath('/shop');
  revalidatePath('/collections');
  revalidatePath('/brands');
  revalidatePath('/deals');
  revalidatePath('/k-beauty');
  revalidatePath('/product/[slug]', 'page');
  revalidatePath('/brand/[slug]', 'page');
  revalidatePath('/collection/[slug]', 'page');
  revalidatePath('/category/[slug]', 'page');
  revalidatePath('/blog/[slug]', 'page');
}

/**
 * Revalidate the storefront pages a single blog write touches: the post
 * itself, the journal listing, and the home page (which surfaces the featured
 * and latest posts).
 *
 * Every blog write must call this. Without it a post keeps serving its old
 * body for up to the route's 1-hour ISR window, and because the write paths
 * also ping IndexNow/Google, a crawler is invited to re-read a page that is
 * still stale — the correction lands in the index an hour late, or not at all
 * if the crawl beats the regeneration (audit fix, 4 Sep 2026).
 *
 * `slug` is optional so a delete, which no longer has a live path to bust,
 * still clears the listing and home page.
 */
export function revalidateBlogPost(slug?: string | null): void {
  revalidateTag(BLOG_CACHE_TAG, NOW);
  if (slug) revalidatePath(`/blog/${slug}`);
  revalidatePath('/blog');
  revalidatePath('/');
}

/**
 * Bust the cached site_settings map and the sale-event calendar, then the
 * layout that renders them. Settings and Sales & occasions call this after a
 * save; the other settings writers (winback, broadcast, abandoned-cart copy)
 * touch keys no storefront page renders and ride the five-minute TTL.
 */
export function revalidateSiteSettings(): void {
  revalidateTag(SETTINGS_CACHE_TAG, NOW);
  revalidatePath('/', 'layout');
  revalidatePath('/', 'page');
}
