# Moving back to the Supabase Free plan

> **Status, 18 Sep 2026: back on Pro.** The Free plan restricted the project
> a second time on 17 Sep (egress quota; see the incident section below) and
> the owner moved to Pro on 18 Sep. Hosting stays on Vercel + Supabase by
> owner decision the same day; no server migration. A downgrade is only on
> the table after the 30-day egress review around 18 Oct 2026, and only if
> the month on Pro came in well under 5 GB.

Owner decision, 16 Aug 2026: the store leaves the Pro plan at the end of the
current billing cycle. This file records why that is now safe, what was
changed to make it safe, and the exact steps to do on the day.

## Why the Free plan broke checkout in August, and why it will not now

The 8 Aug outage happened because serving every product image from Supabase
Storage burned through the Free plan's 5 GB monthly egress, and Supabase
put the project into a 402 restriction that also blocked the database calls
checkout needs. Since then:

- All site media serves from Cloudflare R2 (`images.yellowpink.pk`), which
  has free egress. Supabase egress is now only small JSON API calls.
- New uploads go to R2 too (`src/lib/media-storage.ts`); Supabase Storage is
  only a fallback when R2 env vars are missing.
- The last data references to Supabase Storage URLs (19 old abandoned-cart
  snapshots) were rewritten to R2 on 16 Aug.

## Current usage against Free limits (checked 16 Aug 2026)

| Dimension | Usage | Free limit | Headroom |
| --- | --- | --- | --- |
| Database size | 37 MB | 500 MB | ample |
| Storage | 492 MB (legacy backup) | 1 GB | fits |
| Auth users | 83 | 50,000 MAU | ample |
| Egress | JSON only since the R2 migration | 5 GB/month | **not ample**: see the 17 Sep section below |

## What was changed in code

- `src/lib/image-url.ts` no longer uses Supabase image transformations
  (a Pro-only feature): legacy Supabase image URLs in emails are resized
  through the site's own `/img` proxy instead.
- `.github/workflows/db-backup.yml` takes a weekly `pg_dump` (Mondays 07:00
  PKT) kept 90 days as a GitHub artifact, because the Free plan has no
  automated backups. **It needs the `SUPABASE_DB_URL` repository secret set
  once — see the workflow header.**

## Day-of checklist (owner)

1. Add the `SUPABASE_DB_URL` secret on GitHub (repo → Settings → Secrets →
   Actions) and run the "Database backup" workflow once manually to confirm
   a green run BEFORE downgrading.
2. Supabase dashboard → Organization → Billing → change plan to Free at the
   end of the cycle.
3. After the downgrade, place one test order on the storefront and load the
   admin dashboard to confirm nothing is restricted.

## Things the Free plan takes away (accepted)

- No automated backups (covered by the weekly workflow above).
- No image transformations (no longer used).
- Project pauses after 7 days of inactivity (irrelevant, the site has
  daily traffic).
- Smaller compute instance (fine at current traffic; revisit if checkout
  slows under load).

## It happened again: 17 Sep 2026, egress restriction, 2 days of demo data

**What shoppers saw.** From 17 Sep 22:43 UTC (18 Sep 03:43 PKT) until the plan
was changed, every database call returned HTTP 402
(`exceed_egress_quota`). The storefront fell back to its built-in sample
catalogue, ten `demo-` products with made-up prices, and the admin panel
showed no orders, no products, nothing. Every uptime signal stayed green:
pages returned 200, Sentry had no issue, CI was green, the daily cron
returned 207 and nobody was told. The 4 Sep audit had even counted the
"zero real runtime errors" as a strength.

**Why the Free plan's 5 GB went in eleven days.** The estimate above ("JSON
only, ample") was wrong. The product tile projection for 258 published
products is 177 kB, and it was fetched on nearly every render: `/shop` is
dynamic (it reads `searchParams`), product, category, brand, collection and
journal pages call `getProducts()`, and the root layout re-read settings,
collections, the sale calendar, the welcome coupon and the search-overlay
facets on every dynamic page. On a normal day that was roughly 2,500 full
catalogue fetches (~440 MB); on 17 Sep a crawler looping the header links
made it 9,945 fetches in 24 hours (~1.7 GB). Egress was going to run out
every eleven days or so regardless; the crawler brought it forward.

**What changed in code (18 Sep 2026).**

- Catalogue, journal, settings and facet reads are cached across requests
  in Next's data cache (`cachedRead` in `src/lib/supabase-resilience.ts`),
  tagged `storefront-catalog` / `storefront-blog` / `site-settings`. Every
  admin write path already funnelled through `revalidateStorefrontCatalog`
  / `revalidateBlogPost`; those now bust the tags too, and Settings and
  Sales & occasions bust `site-settings`, so edits still show immediately.
  Expected Supabase egress after the change: well under 100 MB a month.
- A production read failure no longer serves demo data. It returns an empty
  result and captures to Sentry; a plan restriction gets a fatal issue with
  the fingerprint `supabase-restricted` so the alert names the fix.
- The daily cron captures a fatal Sentry event when every sub-job fails.

**Still to do on the platform side (owner).** Add a Vercel Firewall rate
limit (Project → Firewall → Rules: more than ~120 requests a minute from one
IP to the storefront gets challenged). The 17 Sep crawler was 10,723 proxy
invocations in twenty minutes; the data cache makes that cheap on Supabase
now, but it still costs Vercel function invocations.

**Rule of thumb from now on.** Any reader that runs in `layout.tsx` or on
every render of a dynamic route goes through `cachedRead`. Watch Supabase →
Reports → Egress once a week for the first month; a normal day should be a
few megabytes.

## Watch after the downgrade

Egress is the one limit that bit before. The dashboard's Supabase usage page
shows the running month; if it ever trends past ~4 GB, find what is serving
media from Supabase again (grep new code for `storage/v1/object`) before it
becomes a restriction.
