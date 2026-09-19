# Cutover runbook: www.yellowpink.pk from Vercel to Cloudflare Workers

Cutover A of the migration plan (hosting only; Supabase stays). Nothing below
is destructive to Vercel: it keeps serving until the DNS records change, and
rollback is putting them back. Pick a quiet night (22:00 to 06:30 PKT).

The SEO rules that guard this are in `docs/seo/README.md`: no URL changes, a
full-crawl parity check before and after, nothing cached that failed, and the
Semrush/Search Console snapshot the day before and the day after.

## State before the window (filled in as it is prepared)

| Piece | State |
| --- | --- |
| Code | branch `claude/cloudflare-workers-phase-a`; `npm run build`, `build:next`, typecheck, lint, 706 unit tests green |
| Staging | Worker `yellowpink` at `staging.yellowpink.pk`, fenced (`NOINDEX`, `JOBS_DISABLED`, `EMAIL_DISABLED`), sharing production Supabase |
| Production Worker | `yellowpink-production`, deployed dark on workers.dev, fenced, production secrets set |
| Scheduler | `yellowpink-scheduler` (staging) / `yellowpink-scheduler-production` |
| R2 | `yellowpink-images` (existing, behind images.yellowpink.pk), `yellowpink-page-cache`, `yellowpink-production-page-cache`, `yellowpink-backups` (all APAC) |
| DNS today | `www` CNAME to Vercel, apex `A` to Vercel (both DNS-only); `images` proxied to R2 |
| Baselines | `docs/seo/crawl-2026-09-19-*.json`, `docs/seo/snapshot-2026-09-19.json`, `docs/seo/semrush-organic-pk-2026-09-19.csv` |

## Owner steps before the window

1. Workers Builds: connect the GitHub repo to the `yellowpink-production` Worker,
   build command empty, deploy command `npm run deploy:production`, branch `main`,
   build variables = the `NEXT_PUBLIC_*` list in `docs/CLOUDFLARE.md`.
2. Secrets on the production Worker (`wrangler secret put NAME --env production`):
   the list in `docs/CLOUDFLARE.md`, values from `vercel env pull`.
3. The day before: in Cloudflare DNS, lower the TTL of the `www` CNAME and the
   apex `A` records to 5 minutes.
4. Run `npm run seo:parity -- --a https://www.yellowpink.pk --save docs/seo/crawl-<date>-browser.json`
   (and `--ua googlebot`) and `npm run seo:snapshot -- --semrush <csv>` the day before.

## The window

1. **Freeze.** Pause the blog automation and any Cowork task that writes to the store.
2. **Un-fence production** in `wrangler.jsonc` `env.production`: delete `NOINDEX`,
   `JOBS_DISABLED`, `EMAIL_DISABLED`; set `"workers_dev": false`; add
   `"routes": [{ "pattern": "www.yellowpink.pk", "custom_domain": true }]`. Commit to `main`.
3. **DNS.** Delete the Vercel `www` CNAME. Deploy (`npm run deploy:production`, or
   let Workers Builds run it): wrangler creates the `www` record and certificate
   for the custom domain. Replace the apex `A` records with one proxied
   `AAAA 100::` (it exists only so the redirect rule can run).
4. **Rules.** Redirect Rule "apex to www": when hostname equals `yellowpink.pk`,
   dynamic redirect to `concat("https://www.yellowpink.pk", http.request.uri.path)`,
   status 301, preserve query string. Turn on Always Use HTTPS. Cache Rules:
   `/img*` and `/_next/static/*` cache everything, edge TTL a day; a rule that
   sets edge TTL 0 for 404/5xx responses. Leave Rocket Loader, Auto Minify,
   Email Obfuscation, Mirage, Polish and Web Analytics injection off. Bot Fight
   Mode may be on; add a WAF skip for SemrushBot.
5. **Scheduler.** `wrangler secret put CRON_SECRET -c workers/scheduler/wrangler.jsonc --env production`
   with the production value, then `npm run deploy:scheduler:production`.
6. **Checks.** `curl -sI http://yellowpink.pk/` (301 to https://www), `https://yellowpink.pk/x?y=1`
   (301, query kept), `https://www.yellowpink.pk/` (200), `/robots.txt` (no Disallow: /),
   `/sitemap.xml`, `/api/health` with the secret, a product, a blog post, a
   collection, `/shop?cat=Makeup` (301). Then
   `npm run seo:parity -- --a docs/seo/crawl-<date>-browser.json --b https://www.yellowpink.pk`
   must report 0 diffs. Place a COD test order end to end, upload an image in admin,
   fire each cron once (`POST https://yellowpink-scheduler-production.<subdomain>.workers.dev/run/<cron>`
   with the `CRON_SECRET`), watch `npx wrangler tail yellowpink-production` and Sentry for an hour.
7. **Re-crawl.** Resubmit the sitemap in Search Console and Bing Webmaster, run
   `/api/cron/indexing-check` once, and IndexNow-submit the sitemap URLs.
8. **Resume** the automation.
9. **Rollback** at any point: put the Vercel `www` CNAME and apex `A` records back,
   remove the route from `wrangler.jsonc`. Supabase is untouched, so nothing is lost.
   Triggers: a parity diff on a ranking URL, a sitemap URL not 200, an unexplained
   Sentry error class, or the day-after `seo:snapshot --compare` alarms.

## After 72 hours stable

1. `npm run seo:snapshot -- --semrush <new csv> --compare docs/seo/snapshot-<day-before>.json`
   (repeat weekly for four weeks).
2. Pause the Vercel project; delete `vercel.json`; delete the project a week later.
3. Update the memory/docs that still say "Vercel": `docs/USER-MANUAL.md` help pages
   that mention Vercel env vars, `docs/OWNER-TODO.md`.
