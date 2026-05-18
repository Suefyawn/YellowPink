# YellowPink WordPress → Supabase importer

A one-shot importer that pulls products, variations, categories, attributes,
images, customers, orders, reviews, coupons, blog posts, and pages from a
live WooCommerce site into the YellowPink Supabase project, and builds a
301-redirect map for URL preservation.

## What gets imported

| WP entity                        | → Supabase                                     |
|----------------------------------|------------------------------------------------|
| Product categories               | `categories` (hierarchy preserved)             |
| Product attributes + terms       | `product_attributes`, `attribute_values`       |
| Simple products                  | `products` (`kind='simple'`)                   |
| Variable products + variations   | `products` (`kind='variable'`) + `product_variants` + `variant_attribute_values` |
| Product images                   | downloaded → Supabase Storage `images/` → `product_images` |
| Cross-sells / upsells            | `product_relations`                            |
| Coupons (Woo)                    | `coupons` (with the new richer fields)         |
| Customers (Woo)                  | `auth.users` (via Supabase Admin API) + `profiles` + `addresses` |
| Orders (Woo)                     | `orders` (status mapped) + `order_events`      |
| Product reviews (WP comments)    | `product_reviews`                              |
| WP posts                         | `blog_posts`                                   |
| WP pages                         | `pages`                                        |
| Old product / category / page / post URLs | `redirects` (source = `wp_import`, 301) |

Every row is keyed on the original WordPress / WooCommerce id (`wp_term_id`,
`wp_product_id`, `wp_variation_id`, `legacy_wp_user_id`, `legacy_wp_order_id`,
`wp_post_id`, `wp_page_id`, `wp_coupon_id`, `legacy_wp_comment_id`,
`wp_media_id`). Re-running the importer **upserts** based on these keys — it's
safe to re-run, and only changed rows are written.

## Prerequisites

1. **Apply the new migrations** (in numeric order) in the Supabase SQL editor
   — see `supabase/migrations/20260518_*`. They add the catalog-depth tables,
   pages, redirects, WP legacy fields, and coupon extensions.

2. **Create the `images` Storage bucket** (public) if it doesn't exist:
   ```sql
   insert into storage.buckets (id, name, public) values ('images', 'images', true)
   on conflict (id) do nothing;
   ```

3. **Get a WooCommerce REST API key** (WordPress admin → WooCommerce →
   Settings → Advanced → REST API → Add key). Set permissions to
   **Read** (Read/Write if you also want to push updates back later).

4. **Get a WordPress Application Password** (WP admin → Users → your user →
   Application Passwords) for the `/wp/v2/*` endpoints (posts, pages, media,
   users). The consumer key/secret above only authorise `/wc/v3/*`.

5. **Get the Supabase service-role key** (Supabase project → Settings → API).
   This bypasses RLS — the importer needs it to write across tables.

## Configure env

Fill in these env vars (copy from `.env.example`) in a file the importer can
read — either `.env.local` at the repo root or exported into your shell:

```
# WordPress / WooCommerce
WP_SITE_URL=https://your-wp-site.com
WC_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxxxxxxxxx
WC_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxxxxxxxxx
WP_USERNAME=admin
WP_APPLICATION_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx

# Supabase (server-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Optional
WP_IMPORT_DRY_RUN=true        # log everything but don't write
WP_IMPORT_SKIP_MEDIA=false    # set true to skip image downloads (URLs kept as-is)
WP_IMPORT_BATCH_SIZE=50
```

## Run

```bash
# Run everything in order:
npm run wp-import

# Or run just one step:
npm run wp-import -- categories
npm run wp-import -- products
npm run wp-import -- orders
# (see scripts/wp-import/run.ts for the full list)

# Dry run — log without writing:
WP_IMPORT_DRY_RUN=true npm run wp-import
```

Each run inserts a row in `wp_import_runs` with per-step counts and any
errors, so you can audit history from the Supabase dashboard.

## Cutover checklist (hard-cutover plan)

1. Put WordPress in maintenance mode (or take it read-only).
2. Run `npm run wp-import` and verify counts.
3. Send the "we moved — set your password" email to your customer list using
   Supabase Auth's bulk-password-reset flow (you can script this against the
   `profiles` table to get the email list).
4. Flip the Vercel domain (or DNS) to point `yellowpink.pk` at the Next.js
   deployment.
5. Leave WordPress online at a `legacy.yellowpink.pk` subdomain for 30 days
   as a safety net. Old URLs at `yellowpink.pk/product/old-slug` now 301 to
   the matching new URL via the `redirects` table + `src/proxy.ts`.

## Troubleshooting

- **401 from WC**: consumer key/secret pair is wrong, or your WordPress install
  isn't on HTTPS (WC requires it for Basic Auth).
- **401 from WP**: application password is wrong, or your user doesn't have
  the `read` capability you need (admins always do).
- **Stalls on media**: the WP server is slow to serve full-resolution images.
  Set `WP_IMPORT_SKIP_MEDIA=true` for an initial pass; re-run with media
  enabled later.
- **Customer email already exists in Supabase**: the importer skips creating
  the auth user but still upserts the `profiles` row (linking by email).
