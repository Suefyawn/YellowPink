# Deployment Log

Running log of production-side incidents, root causes, and the fixes that
followed. Each entry is dated and titled by symptom — read it like an
ops journal. New entries go to the top.

---

## 2026-05-19 — Production-ready polish pass: Supabase advisor cleanup + Next 16 lint compliance

**Goal:** ship the project past the last remaining Database Linter
findings and clear every ESLint error so the codebase passes Next 16's
React Compiler rules with no eslint-disable-bandages on legitimate
bugs.

**Migration shipped — `20260525_073_security_hardening.sql` (applied):**

- Dropped wide-open admin write/update/delete policies on
  `public.products`, `public.blog_posts`, `public.orders` (all granted
  to the **`anon`** role with `USING true`). These were vestigial from
  an early RLS pattern that pre-dated the service-role admin client;
  the admin client bypasses RLS, so the policies were attack surface
  only. Verified via `pg_policies` after the drop.
- Dropped `anyone can insert orders` (any `public` user could INSERT) —
  `place_order` is the only sanctioned write path (SECURITY DEFINER).
- Dropped duplicate read / insert policies (`public read products`
  duplicated `products_read_all`; `reviews_insert_any` /
  `reviews_read_approved` duplicated their counterparts;
  `service role full access` on `analytics_cache` duplicated
  `analytics_cache_service_all`).
- Converted `v_customer_segments` and `v_orders_revenue` views from
  SECURITY DEFINER to `security_invoker = on` — these are read by
  staff via `supabaseAdmin()`, so DEFINER buy-in was accidental.
- Pinned `search_path = public, pg_temp` on the four functions the
  linter flagged (`set_updated_at`, `touch_updated_at`,
  `decrement_stock`, `notify_order_confirmation`). Defense in depth
  against schema-shadowing attacks.

**Advisor delta:** 2 ERROR-level findings → 0; 11 `rls_policy_always_true`
WARNs → 1 (the one remaining is the intentional anon-INSERT path for
newsletter signup, which is server-side rate-limited).

**Lint pass:** 38 errors + 17 warnings → 0. Highlights:

- Converted `CollectionPage`'s `useRef(readInitial()).current` pattern
  to `useState(readInitial)` — the URL-hydrated initial snapshot now
  lives in state (one-time mount initializer) instead of a ref, which
  satisfies the React Compiler's `react-hooks/refs` rule and is the
  documented Next 16 pattern.
- Resolved a real `Cannot access variable before declared` bug in
  `NewsletterModal.tsx` — `useEscapeKey(open, () => close())` was
  reading `close` before its `const` declaration. Moved the function
  above the hook calls and inlined the reference.
- Cleaned up stale `eslint-disable-next-line no-console` directives on
  three files (the no-console rule isn't part of Next 16's config).
- Removed unused imports (`Link` in `RecentlyViewed`, `CollectionPage`;
  `lookupByWpId` in WP-import variations), unused vars (`_a`,
  `setImageUrl`, `wpTermLookup`, `supabase`), and the
  empty-interface anti-pattern in `admin/products/import/actions.ts`.
- Escaped 9 unescaped apostrophe/quote entities in JSX.
- Marked 2 `prefer-const` violations (`productMap`, `optionMap`).
- For genuine "subscribe to external system" patterns (CartContext
  hydration from localStorage, WishlistPage / RecentlyViewed product
  fetches, SearchOverlay typeahead, Header route-change reset) added
  `eslint-disable-next-line react-hooks/set-state-in-effect` with a
  one-line explanation of *why* the rule's exception applies. No
  bandages over real bugs — every disable comment is a known-good
  external-store sync.

**Test fix:** `staff-auth.test.ts` was failing because
`tests/setup.ts` exported `STAFF_SESSION_SECRET='test-secret'`
(11 chars) — under the 16-char floor in `session-secret.ts` — so the
runtime silently fell back to the dev fallback while the test computed
its legacy SHA-256 with the literal `'test-secret'`. Bumped the test
secret to `'test-secret-at-least-16-chars-long'`.

Also dropped the `require('crypto')` style import (no-require-imports
rule) in favour of `import { createHash } from 'node:crypto'`.

**Verification gate (all green):**
- `npm run typecheck` — clean
- `npm run lint`      — clean (0 errors, 0 warnings)
- `npm test`          — 78/78 pass
- `npm run build`     — succeeds

**Lesson:** Database Linter findings stack up *fast* if you don't
re-run the advisor between migrations. The wide-open `admin write
products` policies were technically dead (service_role bypasses RLS
anyway, so writes worked even without them) but the linter still
flagged them as ERRORs — easy to overlook because the app behaved
correctly. Audit the advisor every time you ship a migration, even if
the surface area looks identical.

---

## 2026-05-19 — Resend + PostHog API keys verified, analytics_cache seeded

**Resend** — API key `re_J7Pq…` verified:
- `GET /domains` shows `yellowpink.pk` with `status: "verified"`, region
  `ap-northeast-1`, sending enabled.

**PostHog** — personal API key `phx_yQ8i…` verified:
- HogQL probe `SELECT 1 AS ok` returned `[[1]]`.
- One-off populate via `scripts/refresh-analytics-local.mjs` wrote
  `analytics_cache['posthog']`:
  - pageviews: 254
  - uniqueUsers: 8
  - sessions: 19
  - trend: 2 days (May 18: 94, May 19: 160)
- Dashboard PostHog widget will show real numbers on next render
  instead of the empty-state hint.

`scripts/refresh-analytics-local.mjs` — small Node ESM helper that
calls the same PostHog + Sentry endpoints as the in-app
`refreshAnalytics()` server action, but skips the auth gate so it
works from the developer's machine using `.env.local`. Useful when
Vercel env vars aren't yet set but you want to seed the cache.

**Reminder for the user:** mirror these two keys into Vercel env
vars so the in-app Refresh Analytics button works (or hand me a
Vercel token and I'll set them):
- `RESEND_API_KEY=re_J7Pq…`
- `POSTHOG_PERSONAL_API_KEY=phx_yQ8i…`

The Sentry widget is still empty because `SENTRY_AUTH_TOKEN` isn't
set locally. Once that lands (Sentry → Settings → Auth Tokens), the
same helper script populates `analytics_cache['sentry']`.

---

## 2026-05-19 — Resend domain verified (handled by user)

**Action:** User completed Resend domain verification end-to-end:
- Added `yellowpink.pk` as a sending domain in Resend
- Pasted SPF + DKIM (+ DMARC) TXT records at the registrar
- Confirmed `verified` status in Resend dashboard

`EMAIL_FROM="Yellow Pink <orders@yellowpink.pk>"` and `RESEND_API_KEY`
are set in Vercel env vars.

**Smoke test to consider:** trigger one transactional email path
(newsletter signup, order placement, or staff invite) and confirm
landing at the test inbox + check that SPF + DKIM pass headers
(in Gmail: "Show original" → look for `SPF: PASS` and `DKIM: PASS`
under the Resend signing domain).

**Lesson:** A "verified" badge in Resend only means the records were
detected at lookup time — it does NOT guarantee the records still
resolve correctly tomorrow if the registrar rotates nameservers or
the TXT records get edited. Set up a one-line Sentry alert for the
specific Resend "domain unverified" failure mode so we hear about it
before customers report missing order emails.

---

## 2026-05-19 — WP → Supabase migration: 6 runs to get clean

**Goal:** complete the partial WP import (266 products + 64 blog posts
from an ad-hoc earlier script) and pick up everything missing:
categories, attributes, variants, images, customers, orders, reviews,
pages, redirects.

**Final state (verified clean):**

| Table | Count | vs WP |
|---|---|---|
| products | 109 | = published count |
| product_variants | 177 | = all variations |
| product_images | 463 | OK |
| categories | 45 | OK |
| product_attributes (parent) | 3 | OK (32 attribute_values) |
| product_categories | 162 | OK |
| product_relations | 512 | OK |
| blog_posts | 64 | OK |
| pages | 9 | OK |
| coupons | 15 | 12 WP + 3 pre-existing local |
| orders | 51 | 50 WP + 1 prior test |
| auth.users + profiles | 70 / 70 | OK |
| product_reviews | 23 | + 17 spam-filtered |
| redirects (wp_import) | 118 | OK |

**Six-run path to clean:**

Run 1 — surfaced four importer bugs at once:
- `sb.ts:25` did `.select('id')` after every upsert; join tables
  (`product_categories`, `product_relations`) have no `id` column.
- `orders.ts:155` set a `notes` field; orders table has no such column.
- Schema gap: products had a `products_set_updated_at` BEFORE UPDATE
  trigger but no `updated_at` column.
- 266 legacy products without `wp_product_id` had slugs that collided
  with the WP import's upsert (the upsert key is `wp_product_id`, so
  the legacy rows never matched — INSERT was attempted and failed on
  the slug unique constraint).

Run 2 — after `sb.ts` + `orders.ts` fixes + deleting the 266 legacy
products. Still hit the `updated_at` trigger + a similar legacy
problem on blog (64 legacy rows without `wp_post_id`).

Run 3 — after deleting 64 legacy blog posts and temporarily disabling
the two order-creation triggers (`on_order_created`,
`orders_notify_new`) to avoid customer emails for 6-month-old orders.
First clean run for blog (64) and orders (50). Products only got to
100/145 because…

Run 4 — …WP was returning all statuses (`status=any`), pulling
~36 drafts/private products on top of 109 published. One draft shared
a slug with a published product (WP lets them coexist; renames on
publish). Fixed importer to `status='publish'`.

Also surfaced the same `updated_at` trigger on `orders` and
`blog_posts` (because run 3 made them existing rows, so run 4's
upserts now took the UPDATE path).

Run 5 — after migration 072 added `updated_at` to `orders`,
`blog_posts`, and `site_settings`. Everything green except 8 variants
in batch 0 colliding on SKU `PBSV`. Investigation showed WP has
exactly 1 distinct non-empty variant SKU across 177 variations, and
it's the placeholder `PBSV` on all 8 Pixi Blush Sticks variations.

Run 6 — clean. Importer now nulls SKUs that appear more than once
within a parent's variants. 709 entities imported, 0 errors.

**Post-import cleanup:**
- Re-enabled `on_order_created` and `orders_notify_new` triggers.
- Pruned 34 unpublished products that had snuck in during runs 1-3
  (drafts with valid `wp_product_id` not in the current
  publish-status list). CASCADE swept their `product_images`,
  `product_categories`, `product_relations`, `product_variants`.

**Migrations applied (in repo):**
- `071_products_updated_at.sql`
- `072_updated_at_blog_orders_settings.sql`

**Code changes shipped (in repo):**
- `scripts/wp-import/sb.ts` — `.select('id')` replaced with
  `count: 'exact'`, fixes join-table upserts.
- `scripts/wp-import/importers/orders.ts` — `notes` field removed
  from the orders payload.
- `scripts/wp-import/importers/products.ts` — fetches only
  `status='publish'` from `/wc/v3/products`.
- `scripts/wp-import/importers/variations.ts` — dedupes shared
  SKUs across a parent's variants by nulling the duplicates.

**Lesson:** Always probe the source-of-truth dataset (`/wc/v3/products?status=publish`)
BEFORE the first import run, so the dev DB looks like production from
the start. Also: when a BEFORE UPDATE trigger references a NEW.<col>,
prefix the migration that creates the trigger with a hard check that
`<col>` exists on the table — `do $$ if not exists … raise exception$$`
catches this at trigger-creation time instead of years later when
someone tries to upsert.

---

## 2026-05-19 — Vercel "build failed" was actually plan-limit rejection

**Symptom:** User reported "build failed" after pushing 10 commits
(`399f755` → `be82f82`) plus a `dcf0451` docs commit. Vercel dashboard
visible to user showed a failure banner.

**Investigation:**
- Confirmed all 10 commits were on `origin/main` (`git ls-remote`).
- Queried Vercel via MCP. The project's `latestDeployment` was still
  `dpl_EWbwpFTz` for commit `9195c568` — created ~12 minutes earlier
  and READY. Zero deployment records existed for `399f755`+.
- `since` filter on `list_deployments` returned an empty list past
  `9195c568`. No FAILED record either — Vercel had simply never tried.
- Ran `next build` locally on HEAD: cleanly succeeded. Code was fine.
- Pushed empty commit `5367b35` to nudge the GitHub→Vercel webhook.
  Re-polled 75 s later: still `9195c568`. Webhook wasn't lagging — it
  was inert.
- Tried `mcp__vercel__deploy_to_vercel`: it just returned instructions
  to use the CLI or git push. No direct deploy capability.
- Tried `npx vercel deploy --prod`: requires a token, none on disk
  (`~/.vercel` missing).
- Asked user to either reconnect the GitHub integration or supply a
  Vercel access token.

**Root cause (user-supplied):** Vercel Hobby plan limits.
- Hobby caps cron entries at **2 per project**, all **daily or less
  frequent**.
- `vercel.json` declared **three** crons, and one (`courier-sync`) was
  hourly (`0 * * * *`).
- Vercel rejects such deploys at the plan-validation gate **before**
  creating a deployment record. That's why no FAILED entry appeared
  in the API or the dashboard list — the rejection is invisible to
  the deployments API.

**Fix shipped (`28e18a4`):**
- New `src/app/api/cron/daily/route.ts` — one endpoint that fans out
  to `abandoned-cart`, `back-in-stock`, and `courier-sync` via
  in-process fetch, sequentially, with per-job error containment.
  Returns 207 multi-status if any sub-job fails.
- `maxDuration = 60` to cover `courier-sync`'s worst case (≤200
  shipments × 1 courier API round-trip).
- `vercel.json` reduced to a single cron entry: `/api/cron/daily`
  schedule `0 9 * * *`.
- Commit body documents the Pro upgrade path (split back into three
  separate crons with `courier-sync` on a 30 min cadence).

**Aftermath:** Unstuck the 12-commit backlog (`399f755` → `28e18a4`).
Verified READY:
- `dpl_GWwi4GMqgDu3Ji32wvm12Wdh1ZwG` — commit `28e18a4`, the cron
  consolidation that ended the rejection cycle.
- `dpl_9rkiNNZiReUraFMVJCWVi4bY8ghT` — commit `56fefe4`, this
  deployment log.

**Lesson:** Vercel's plan-limit rejection is silent to the API/MCP.
If `latestDeployment` lags behind `origin/main` and no FAILED record
shows up between, suspect a `vercel.json` plan violation before
suspecting a dead webhook. Quick checks:
- `cat vercel.json` — count cron entries (Hobby ≤ 2) and check
  `schedule` is daily or less frequent.
- `npx vercel-build-output --version` not needed; the gate is
  enforced by the platform on push, not in the build runner.

---

## 2026-05-19 — 12-commit user batch + migration 070

**Pushed:** `399f755` through `be82f82` (and the build fix `28e18a4`).

User-authored commits in the batch:
- `399f755` Audit-report fixes: RLS hardening + signup defence + audit instrumentation
- `6ce9861` Multi-courier shipping: TCS COD API adapter + manual + third-party
- `4defa80` Wrap-up: dynamic trending, GoTrueClient fix, courier cron, deployment doc
- `85e03a0` Docs: slim WP-import to one command, add to deployment checklist
- `805d528` UX wave 1: fix scroll-lock crash, hydration toast flash, low contrast
- `9328a64` UX wave 2: mobile promo, admin polish, login CTA contrast
- `cde873d` UX wave 3: admin pink CTAs migrate to AA-passing tone
- `b287cc5` UX wave 4: Next 16 hydration mismatches + small polish
- `dcf0451` Docs: finalize UX audit report

Claude-authored on top:
- `be82f82` Build fix: `AddToCartToast` handles `null` brand from
  `CartContext.lastAdded` — typecheck error would have blocked the
  build once Vercel did accept the push.
- `28e18a4` Hobby cron consolidation (above).

**Migration 070 applied to Supabase** (separate from build):
- `orders` RLS on; anon SELECT removed; `auth.uid() = user_id` for
  authenticated. Guest tracking still works via `lookup_order` RPC.
- `coupons` RLS on; all policies removed. New `lookup_coupon(text)`
  SECURITY DEFINER for storefront coupon validation. Admin uses
  service_role bypass.
- Wrapped `handle_new_user`, `award_welcome_points`, and
  `generate_referral_code` triggers in `BEGIN/EXCEPTION` so any
  side-effect failure logs a NOTICE and lets the signup succeed.
- Backfilled `profiles` rows for any orphan `auth.users` rows.
- Deleted leaked `$ACTION_*` rows from `site_settings`; added CHECK
  constraint blocking future `$`-prefixed keys.
- Deduplicated `staff_members.permissions` arrays.

---

## 2026-05-19 — Production audit fixes (P0 + P1)

This session opened with a 5-agent parallel audit (security, perf, a11y,
SEO, error-handling/code-quality). Findings filed at
[`FINDINGS.md`](./FINDINGS.md). Test plan for the QA agent at
[`TEST_PLAN.md`](./TEST_PLAN.md). Highlights of fixes shipped:

**Security P0:**
- `staff_members` RLS enabled with service-role-only policy; every
  admin read rewired to `supabaseAdmin()` (migration 064).
- `place_order` RPC recomputes subtotal server-side from
  `products.price * qty`; rejects client-tampered totals (migration
  065).
- `place_order` also recomputes discount server-side from the
  `coupons` row; client-supplied `discount_amount` is overridden, and
  every redemption is logged into `coupon_redemptions` (migration 067).
- JazzCash + Easypaisa callbacks verify the gateway-reported amount
  matches `order.total` in paisa; status transitions are idempotent
  (gated on `status='payment_pending'`).
- `refreshAnalytics`, `coupon-actions`, `promo-actions` server
  actions all gated on `assertPermission` / `assertOwner`. They were
  publicly callable.
- 2FA backup codes now stored as SHA-256 hashes (not plaintext).
- `dashboard_kpis()` SQL aggregator replaces an unbounded
  `select * from orders` (migration 068).

**Security P1:**
- Legacy `ADMIN_PASSWORD` owner cookie HMAC-signed via Web Crypto,
  7-day server-enforced TTL, unconditional `secure: true`.
- `STAFF_SESSION_SECRET` throws at module load in production if
  unset or < 16 chars.
- `/api/cron/*` and `/api/couriers/webhook` fail closed when their
  secret is unset (were fail-open in non-production).
- `redeem_gift_card` + `redeem_loyalty_points` EXECUTE revoked from
  anon + authenticated; reachable only via `place_order` SECURITY
  DEFINER (migration 066).
- Customer `/account` middleware decodes the Supabase JWT body and
  checks `exp` (was a presence-only check).
- Cart `addToCart`/`updateQty` clamp to `product.stock`.
- `submitReview` photo URLs restricted to the Supabase Storage prefix.
- `/api/health` requires `HEALTH_CHECK_SECRET` in production
  (was unauth env-var enumeration).

**A11y / SEO / Code-quality P1:**
- `ProductTile` refactored to wrap `<Link>` internally with wishlist
  as a sibling — entire shop is now keyboard-reachable; invalid
  `<button>`-inside-`<a>` HTML gone. All 10 callers simplified.
- `--brand-pink-text` (#C5286A) replaces `--brand-pink` (#E8487F)
  wherever pink is used as TEXT on a light background. WCAG-AA
  contrast (≥4.5:1). 19 files updated.
- Pagination buttons get `aria-label`, active page gets
  `aria-current="page"`, wrapped in `<nav>`.
- `<main>` landmark added to `/account/*` (layout) and `/admin/*`
  (AdminShell).
- 8 silent-failure admin actions now surface errors via
  `redirect('?error=…')` or return-value objects: `deleteProduct`,
  `deleteBlogPost`, `bulkUpdateOrderStatus`, `approveReview`,
  `deleteReview`, `toggleStaffActive`, `deleteStaffMember`,
  `setDefaultAddress`.
- Shared coupon validator (`lib/coupon-validation.ts`) enforces
  `usage_limit_per_user`, `email_restrictions` (Woo-style
  `*@domain` wildcards), product allow/denylists, `max_order`.
- `/blog` index metadata; `/cart` + `/wishlist` `noindex`; sitemap
  `?cat=` → `?category=` aligned; `/track` + `/login` removed from
  sitemap.
- JSON-LD: logo PNG instead of SVG (`/icon-192.png`),
  `priceValidUntil` on every Offer / AggregateOffer, `dateModified`
  from `blog_posts.updated_at`.
- Sentry replay integration lazy-loaded via `requestIdleCallback`
  (was 50–80 KB gz eagerly loaded for every visit even though only
  5% are sampled).

**Mobile admin (separate findings):**
- Removed phantom 200 px left margin caused by an unbounded
  `@media (max-width: 1024px)` rule with `!important` that bled
  onto phones.
- Drawer narrowed to `min(280px, 86vw)` on phones.
- Recent Orders table wrapped in `adm-table-scroll` to scroll
  horizontally instead of forcing the page wider than the viewport.

---

## How to use this log

- **Add an entry whenever production-affecting work happens** —
  schema migration, env var change, plan upgrade, vercel.json edit,
  middleware change, public API change.
- **Front-load the root cause.** Future-you reading this in a 3 AM
  outage wants the diagnosis in the first three lines, not paragraph
  six.
- **Always link the commit SHA(s).** This file is the index that
  maps "the day X broke" to "the commit that fixed it".
- **Record the lesson at the bottom of each entry.** A pattern worth
  remembering for next time.
