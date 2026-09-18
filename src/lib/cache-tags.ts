// Next data-cache tags shared by the storefront readers (lib/supabase and
// friends) and the admin write paths that bust them (lib/revalidate-storefront).
// Kept in a dependency-free module so both sides can import it without pulling
// the Supabase client into a file that should not have it.
//
// Why these exist (17 Sep 2026 outage): the storefront re-read the full
// catalogue from Supabase on nearly every render, which burned the Free plan's
// monthly egress in eleven days and had Supabase return 402 for everything.
// Reads are now cached across requests under these tags, and every catalogue
// write invalidates the matching tag so admin edits still show immediately.

/** Products, collections, facets, brand/category rails. */
export const CATALOG_CACHE_TAG = 'storefront-catalog';
/** Journal posts and their tiles. */
export const BLOG_CACHE_TAG = 'storefront-blog';
/** site_settings and the sale-event calendar the layout reads on every page. */
export const SETTINGS_CACHE_TAG = 'site-settings';
