# Moving back to the Supabase Free plan

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
| Egress | JSON only since the R2 migration | 5 GB/month | ample |

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

## Watch after the downgrade

Egress is the one limit that bit before. The dashboard's Supabase usage page
shows the running month; if it ever trends past ~4 GB, find what is serving
media from Supabase again (grep new code for `storage/v1/object`) before it
becomes a restriction.
