# Deployment Log

Running log of production-side incidents, root causes, and the fixes that
followed. Each entry is dated and titled by symptom — read it like an
ops journal. New entries go to the top.

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
