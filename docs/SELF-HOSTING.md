# Running Yellow Pink on your own server

Last updated: 14 September 2026

This is the guide for moving the store off Vercel onto a plain Node server (a
VPS, a container, anything that runs Node 22). Written after the 14 Sep review
of hosting options.

## Why a Node server and not Cloudflare Workers

The short version: Vercel's Hobby plan is not available to this store, and
Cloudflare Workers cannot run two of its dependencies.

**Vercel Hobby is off the table.** Vercel's fair-use policy states that "Hobby
teams are restricted to non-commercial personal use only. All commercial usage
of the platform requires either a Pro or Enterprise plan," and defines
commercial usage to include "any method of requesting or processing payment
from visitors of the site." The store takes JazzCash, Easypaisa and cash on
delivery. No amount of usage reduction changes this, so getting off the bill
means leaving Vercel rather than downgrading.

**Cloudflare Workers was evaluated and rejected.** Cloudflare's current Next.js
path is `vinext`, which their own documentation describes as beta: "Before
adopting it for an existing production application, run the compatibility
check." That check was run against this codebase and reported 90% compatible,
but it scans imports and config, not runtime behaviour, and it missed three
things that matter here:

- **`sharp`** is loaded with a dynamic `await import('sharp')` in
  `src/lib/image-normalize.ts`, so a static scan cannot see it. It is a native
  binary and does not run on Workers at all. It backs `/api/media` and
  `/api/upload`, which means the daily blog automation's hero upload, product
  photos and review photos all depend on it.
- **`web-push`** (`src/lib/push.ts`) is the same class of problem.
- **Fourteen cron endpoints** behind three `vercel.json` entries, with
  `/api/cron/daily` fanning out to nine more. None of that ports automatically.

It also flagged `next/font/google` as partial ("fonts loaded from CDN, not
self-hosted"), which is a regression, and `@sentry/nextjs` as needing manual
server-side setup, which would cost the server-side error tracking this store
actually uses.

Next.js's own documentation, meanwhile, lists Cloudflare under "Other
Platforms" as **not** a verified adapter, while stating that "To run Next.js,
your platform needs a Node.js server. That's it," and that Node deployments
support every Next.js feature. On a Node server `sharp`, `web-push`, ISR,
middleware and `after()` all keep working with no code changes.

## What changed in the repo

- `next.config.ts` sets `output: 'standalone'`. Vercel ignores this, so the two
  can run side by side during a cutover.
- `@vercel/analytics` and `@vercel/speed-insights` are removed. Neither runs off
  Vercel, and both were already duplicated: pageviews and events go to GA4,
  PostHog and Clarity, and `WebVitalsReporter` beacons every Core Web Vital to
  `/api/vitals`, which is what the admin Analytics page reads. Nothing was lost.
- `npm run build:standalone` and `npm run start:standalone` were added.
- `scripts/run-cron.sh` replaces the `vercel.json` cron entries.

## Build

```bash
npm ci
npm run build:standalone
```

`build:standalone` is `next build` plus two copies:

```
cp -r public          .next/standalone/public
cp -r .next/static    .next/standalone/.next/static
```

**Those copies are not optional and Next does not do them for you.** Deploy
without them and the server returns HTML with no CSS, no JavaScript and no
images, which looks like a broken site rather than a missing step. The npm
script exists so it cannot be forgotten.

The result is `.next/standalone/` at roughly 97 MB, containing `server.js` and
only the traced dependencies. Native packages such as `sharp` appear as real
directories under `node_modules`; pure-JS ones such as `web-push` are bundled
into `.next/server/chunks` instead, so do not be alarmed that
`node_modules/web-push` is absent.

## Run

```bash
PORT=3000 HOSTNAME=127.0.0.1 node .next/standalone/server.js
```

Bind to localhost and put nginx or Caddy in front for TLS. A systemd unit is at
`deploy/yellowpink.service`.

Environment: the server reads the same variables as the Vercel deployment. See
`.env.example`. `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` are the minimum for the store to leave demo
mode; without them it boots and serves, but with demo products and no
collections.

## Cron

Vercel called three routes on a schedule. System cron does it now, via
`scripts/run-cron.sh`, which reads `CRON_SECRET` and `APP_URL` from
`/etc/yellowpink.env` (cron runs with almost no environment, so it sources that
file rather than relying on a profile).

```cron
CRON_TZ=UTC
0  9 * * *  /srv/yellowpink/scripts/run-cron.sh daily          >> /var/log/yellowpink-cron.log 2>&1
30 9 * * *  /srv/yellowpink/scripts/run-cron.sh indexing-check >> /var/log/yellowpink-cron.log 2>&1
0 10 * * 1  /srv/yellowpink/scripts/run-cron.sh weekly         >> /var/log/yellowpink-cron.log 2>&1
```

Only these three. `/api/cron/daily` fans out to abandoned-cart, courier-sync,
order-actions, occasion-coupons, popularity-refresh, review-requests,
stuck-payments, not-found-digest and analytics-refresh in its own handler;
calling those directly from cron would double-run them.

The script exits non-zero on failure so `MAILTO` or a cron monitor notices. A
silently failing cron is how the abandoned-cart and review-request emails would
stop going out without anyone finding out for weeks.

## Automated setup

`scripts/provision.sh <domain>` performs this whole document on a fresh
Ubuntu box: packages, Node 22, Caddy with automatic TLS, the app user, the
clone, swap if the machine is small, the build, the systemd unit, the
firewall and the three cron jobs. It is idempotent, so a failed run can
simply be repeated, and it stops to have `/etc/yellowpink.env` filled in
rather than starting a store in demo mode.

`scripts/deploy.sh` updates a running server afterwards. It builds before it
restarts, so a broken commit leaves the previous version serving.

[`SERVER-SETUP.md`](./SERVER-SETUP.md) is the same ground written for
someone who has never used a server.

## Render instead of a VPS

`render.yaml` at the repo root is the same deployment as a Render blueprint:
one Starter web service running `server.js` and the three cron jobs above.
Create the `yellow-pink-env` environment group first (`vercel env pull`, then
"Add from .env" in the Render dashboard), then Render → New → Blueprint →
pick this repo. Steps 1, 2 and 4 of the checklist below are then done for
you; steps 3, 5 and 6 are unchanged.

## Cutover checklist

1. Provision the box, install Node 22, nginx/Caddy, and a TLS certificate.
   **If you have never done this, follow [`SERVER-SETUP.md`](./SERVER-SETUP.md)**,
   which walks through choosing a provider, creating the machine and running
   `scripts/provision.sh` — one command that does steps 1, 2 and 4 of this
   list for you.
2. Copy the repo, set the environment file, `npm ci && npm run build:standalone`.
3. Start it on localhost, proxy to it, and check the site over the real domain
   **before** moving DNS: `/`, `/shop`, a product page, a collection page,
   `/page/faq`, `/robots.txt`, `/sitemap.xml`, and a test checkout.
4. Install the crontab above and run each of the three jobs once by hand.
5. Move DNS. Keep Vercel running until DNS has propagated; `output: 'standalone'`
   is inert there, so the same commit serves both.
6. Cancel the Vercel plan only once the new box has served a full day including
   a successful daily cron run.

## Known differences from Vercel

- **No Vercel Analytics or Speed Insights.** Replaced as described above.
- **Image optimisation is unchanged.** The store already used a custom loader
  (`src/lib/image-loader.ts`) routing through `/img` to images.weserv.nl, so
  Vercel's metered `/_next/image` transformer was never in the path. Nothing to
  migrate.
- **ISR is per-instance.** On a single server this is exactly the same
  behaviour. If the store is ever run on more than one instance, configure a
  shared `cacheHandler`, or revalidation on one instance will not propagate to
  the others.
- **`after()` needs graceful shutdown.** The systemd unit sends SIGTERM and
  allows time to drain, so `after()` callbacks (the WhatsApp click log, order
  emails) finish rather than being killed mid-flight.
