# Running Yellow Pink on Cloudflare

Last updated: 19 September 2026

The store builds for Cloudflare Workers the way Searchable does (its ADR-41 to
ADR-55 are the reference): vinext turns the Next.js app into a Worker, the
Response Store keeps rendered pages in R2 with a SQLite Durable Object as the
index, uploads go through the R2 and Images bindings, and a small scheduler
Worker holds the cron triggers. Until cutover A (`docs/CUTOVER.md`) Vercel keeps
serving production from the same commits; `npm run build:next` still works.

Phase A keeps Supabase as the database. Phase B (D1 + better-auth) is a
separate branch and a second cutover; see the migration plan.

## Layout

| Piece | Where |
| --- | --- |
| Worker entry | `src/worker.ts`: vinext's fetch handler wrapped with `@sentry/cloudflare`; re-exports the Response Store classes |
| Runtime differences | `src/lib/platform.ts` (Node) / `src/lib/platform.workerd.ts` (Workers), swapped by `vite.config.ts`. Nothing else imports `cloudflare:workers` |
| Bindings | `wrangler.jsonc`: `MEDIA` (R2 `yellowpink-images`, behind images.yellowpink.pk), `CACHE_BODIES` + `CACHE_METADATA` (page cache), `IMAGES` (upload resizing), `ASSETS` (public/), `CF_VERSION_METADATA` |
| Environments | default = staging (`staging.yellowpink.pk`, fenced), `env.production` = `yellowpink-production` |
| Scheduler | `workers/scheduler/` (four Cron Triggers, service binding to the site, `CRON_SECRET`) |
| Patches | `patches/` via patch-package: a Response Store outage is a cache miss; UA-less revalidations keep metadata in `<head>` |

## Staging fences

The staging Worker shares the production Supabase project, so it must never
act like production. `wrangler.jsonc` sets, for staging and for production
while it is deployed dark:

- `NOINDEX=1`: `robots: noindex` meta on every page, `X-Robots-Tag: noindex, nofollow` on every proxied response, `robots.txt` is `Disallow: /`.
- `JOBS_DISABLED=1`: every `/api/cron/*` handler answers 401 (`src/lib/cron-auth.ts`).
- `EMAIL_DISABLED=1`: `send()` in `src/lib/email.ts` logs and drops.

## Build and deploy

```bash
npm run build              # vinext build -> dist/
npm run start              # wrangler dev on the built Worker (reads .dev.vars)
npm run deploy             # staging
npm run deploy:production  # production (Workers Builds runs exactly this on main)
npm run deploy:scheduler / deploy:scheduler:production
```

Never split `npm run build` from the deploy: a build without
`CLOUDFLARE_ENV=production` writes the staging config into `dist/server/wrangler.json`
and a `--skip-build` deploy then puts the staging domain and fences on the
production Worker (this took searchable.pk down for 25 minutes on 19 Sep 2026).

`NEXT_PUBLIC_*` values are inlined at build time from the shell (`.env.local`
locally, the Workers Builds variables in the dashboard). They are not read from
`wrangler.jsonc`. Set these for a production build:
`NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_WHATSAPP_NUMBER`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`,
`NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `NEXT_PUBLIC_SENTRY_DSN`
(plus `NEXT_PUBLIC_META_PIXEL_ID`, `NEXT_PUBLIC_GOOGLE_ADS_ID`,
`NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL`, `NEXT_PUBLIC_CLARITY_PROJECT_ID` if set
on Vercel). `vercel env pull .env.vercel` gives the full list.

## Secrets

Everything that is not `NEXT_PUBLIC_*` and not a plain var in `wrangler.jsonc` is
a Worker secret: `wrangler secret put NAME` (add `--env production` for the
production Worker). From the Vercel project, the set is:

`SUPABASE_SERVICE_ROLE_KEY`, `ADMIN_PASSWORD`, `STAFF_SESSION_SECRET`,
`CRON_SECRET`, `HEALTH_CHECK_SECRET`, `RESEND_API_KEY`, `RESEND_WEBHOOK_SECRET`,
`RESEND_INBOUND_WEBHOOK_SECRET`, `EMAIL_FROM`, `OWNER_EMAIL`,
`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `SENTRY_DSN`,
`POSTHOG_PERSONAL_API_KEY`, `CLARITY_API_TOKEN`, `BING_WEBMASTER_API_KEY`,
`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `BLOG_API_TOKEN`,
`COURIER_WEBHOOK_SECRET`, `ORDER_TOKEN_SECRET`, `NEWSLETTER_TOKEN_SECRET`,
the `JAZZCASH_*`, `EASYPAISA_*`, `TCS_*`, `WHATSAPP_*`, `META_CAPI_*` keys, and
`R2_PUBLIC_BASE` is a var. The `R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET`
set is only needed on Node (Vercel, scripts); on Workers the `MEDIA` binding writes directly.

The scheduler needs only `CRON_SECRET`, the same value as the site's.

## Local development

`npm run dev` is unchanged (`next dev`, Node). `npm run dev:workers` runs vinext's
dev server against `wrangler.dev.jsonc` (local R2, no page cache). `npm run start`
runs the built Worker under wrangler with `.dev.vars` (copy `.env.local`, add
`APP_ENV=development`, `R2_PUBLIC_BASE=https://images.yellowpink.pk`, and the
fences if the build should not mail or run jobs).

## What differs from Vercel

- Rendered pages are cached in the Response Store, one copy for the world per
  revalidation window; browsers get `Cache-Control: private, max-age=0,
  must-revalidate` and the `X-Nextjs-Cache` header says HIT/MISS/UPDATING.
- `htmlLimitedBots: /.*/` in `next.config.ts` keeps title, canonical and
  description in `<head>` for every visitor (the cache serves one rendering to
  crawlers and browsers alike).
- Category pages render on demand (no build-time prerender), like collections.
- Cron: the scheduler Worker calls `/api/cron/daily` (09:00 UTC),
  `/api/cron/indexing-check` (09:30), `/api/cron/weekly` (Mondays 10:00) and
  `/api/cron/abandoned-cart-bells` (every 10 minutes, which replaces the
  pg_cron job). The daily and weekly fan-outs call their sub-jobs in-process.
- Upload resizing uses the Images binding (5,000 unique transformations a
  month included); push notifications use Web Crypto (`src/lib/push.ts`).
- Sentry: `@sentry/cloudflare` on the server, the same browser SDK as before;
  no source-map upload yet.

## Allowances (Workers Paid, shared with Searchable)

10M requests and 30M CPU-ms a month, 10 GB R2, 5,000 Images transformations,
Cron Triggers included. At the store's traffic (a few thousand pageviews a day)
the bill stays at the plan's USD 5. The crawler flood that drained the Vercel
budget is a Cloudflare WAF matter now (Bot Fight Mode, or a rule on the
looping paths); it costs nothing in Worker invocations once the page cache
answers it.
