# WordPress → Supabase one-shot migration

This is a one-time migration. Once you've run it and verified the counts,
you're done with WordPress — leave the WP site read-only as a 30-day
safety net and never touch this importer again.

## Run it

```bash
npm run wp-import
```

That's the whole command. The importer pulls — in dependency order —
categories, attributes, products, variations, coupons, customers,
orders, reviews, blog posts, pages, and a 301-redirect map for URL
preservation. Each run inserts a row into `wp_import_runs` with
per-step counts so you can audit the history from Supabase.

Re-running is safe: every entity is keyed on its original WP/Woo id and
**upserts**, so a second run picks up anything that changed without
duplicating rows.

## Required env vars

Already in `.env.local` for the current install — set the same five
in your shell if running from another machine:

```
WP_SITE_URL                            # https://yellowpink.pk
WC_CONSUMER_KEY / WC_CONSUMER_SECRET   # WooCommerce → Settings → Advanced → REST API
WP_USERNAME / WP_APPLICATION_PASSWORD  # WP → Users → your user → Application Passwords
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY              # bypasses RLS; the importer needs it
```

## Verify

After the run completes, paste this into Supabase Studio → SQL Editor:

```sql
select
  (select count(*) from public.products)                            as products,
  (select count(*) from public.product_variants)                    as variants,
  (select count(*) from public.product_images)                      as images,
  (select count(*) from public.categories)                          as categories,
  (select count(*) from public.product_attributes)                  as attrs,
  (select count(*) from public.blog_posts)                          as blog_posts,
  (select count(*) from public.pages)                               as pages,
  (select count(*) from public.coupons)                             as coupons,
  (select count(*) from public.orders)                              as orders,
  (select count(*) from auth.users)                                 as auth_users,
  (select count(*) from public.profiles)                            as profiles,
  (select count(*) from public.product_reviews)                     as reviews,
  (select count(*) from public.redirects where source = 'wp_import') as wp_redirects;
```

Counts should match (or exceed, if new orders have landed since) the
totals shown in your WooCommerce dashboard.

## If a step fails

Each step writes its errors to the `wp_import_runs.errors` jsonb column
plus stdout. The most common causes:

- **401 from WC** — consumer key/secret wrong, or WP isn't HTTPS.
- **401 from WP** — application password wrong, or your user lacks the `read` capability.
- **Stalled on media** — slow WP server; set `WP_IMPORT_SKIP_MEDIA=true` for a first pass, rerun later with media enabled.
- **Customer email already exists** — importer skips the auth.users insert but still upserts the profile.

## Dry run

```bash
WP_IMPORT_DRY_RUN=true npm run wp-import
```

Logs every entity it would write, writes nothing. Useful for a sanity
check before the real run.
