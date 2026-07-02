# Beyond the bugs — improvements worth considering (2026-07-02)

These are NOT defects (those are fixed on `claude/yellowpink-full-audit-zqeleh`
and listed in `AUDIT-PUNCHLIST-2026-07-02.md`). This is the "what would move
the needle next" list, ordered by likely impact.

## 1. Growth / conversion (the actual business problem)
The data says the store is technically live but commercially pre-launch:
28-day funnel of 186 product views → 1 purchase, **zero mobile purchases**,
7 organic clicks, Authority Score 2, 2 backlinks. Fixes remove blockers; these
build demand:
- **Investigate the mobile purchase gap first.** Mobile is most of the traffic
  and converts at zero. Now that the purchase-path traps are fixed (FBT phantom
  line, sticky-header-over-filters, blank hero), run a real mobile checkout and
  watch a few PostHog session recordings — there may still be a device-specific
  blocker worth more than any SEO work.
- **Indexing:** only 6 of 122 URLs are indexed. The new `/admin/indexing` tool +
  IndexNow submissions are in place; the lever now is internal linking (see
  below) and earning a few backlinks — Authority Score 2 is the ceiling on
  everything else.
- **Wire up conversion tracking you can trust:** Sentry is receiving zero events
  (see #2); PostHog has data but the funnel is barely populated. Confirm
  `begin_checkout`/`purchase` fire on mobile before optimising blind.

## 2. Observability is dark
- **Sentry has received 0 events, ever.** Either the DSN isn't set in the Vercel
  env or the SDK isn't initialised in production. Until this is fixed you are
  flying blind on runtime errors — and the audit found several 500-throwing
  paths. Verify `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` and that
  `instrumentation.ts` registers on the server runtime.
- **A report-only CSP now ships** (added this pass). Watch the Sentry CSP reports
  for a week, then promote `Content-Security-Policy-Report-Only` →
  `Content-Security-Policy` to actually get XSS protection.
- Add uptime/synthetic checks on `/`, a PDP, and `/api/health` so a broken
  deploy is caught before a customer hits it (tonight's `/admin/indexing`
  timeout is the kind of thing this catches).

## 3. Data-quality / catalogue hygiene (see content-sql-todo.md)
- The 17 leaked DRAFT descriptions were neutralised with factual placeholder
  copy; **they still need real product descriptions** with genuine specs.
- **Flex-4 is mislabelled** across blog + product content as a joint supplement
  when it's a men's-vitality product — a health-accuracy issue needing editorial
  rework, not a link swap.
- Several products **hotlink images from the source store's Shopify CDN** (one
  already 404s); host these on your own storage. All ~342 Golden Pearl drafts do
  the same and shouldn't be published until fixed.
- A cluster of **mis-categorised products and blog posts** (magnesium, melatonin,
  calco-fit, gluthic…) and a few **price contradictions** (combo priced above its
  parts, meta prices out of date). Worth a single catalogue-hygiene pass.

## 4. Architecture / hardening
- **Migration drift is now fixed and verified reproducible**, but the root cause
  was objects created outside migrations (admin UI, ad-hoc SQL). Adopt a rule:
  every schema/policy/function change lands as a migration, and CI runs
  `supabase db reset` (or an equivalent from-scratch apply) on every PR so drift
  can't silently return.
- **The admin has no Sentry/observability of its own server-action failures.**
  Several actions `catch` and swallow; a shared "action failed" logger →
  Sentry would surface the silent ones.
- **The staff cookie is now HMAC-verified at the edge** (fixed this pass). Next
  step: consider rotating `STAFF_SESSION_SECRET` on a schedule and shortening
  the 10h TTL for a store handling COD cash.
- **PostgREST 1000-row default cap** silently truncates several admin reads
  (newsletter recipients, finance aggregates). These were flagged; a shared
  paginated-fetch helper would prevent the class.
- **Rate-limit the remaining public POST surfaces** (reviewer application, quiz,
  `/api/404`) — Upstash is already wired for auth/checkout; extend it.

## 5. UX / merchandising polish
- **Internal linking is thin** — good for both SEO and discovery: cross-link blog
  posts to the products they mention (and vice-versa), surface collections in
  the footer, and add "related posts" to PDPs.
- **Blog house-style drift**: ~15 posts have two CTAs, several YMYL posts lack the
  medical disclaimer, some legacy imports use bare `<h2>`. A lint script that
  checks posts against the house rules on publish would stop the drift.
- **Wishlist and reviews are under-promoted** — both work but are easy to miss;
  reviews especially drive the ★ snippets that help CTR once indexed.
- Consider a **product-description generator** (with human review) to clear the
  thin/placeholder-copy backlog at scale rather than one at a time.

## 6. Testing
- The suite is 125 unit tests + 3 Playwright specs. The bugs this audit found
  were overwhelmingly in **admin server actions** and **RLS/permission gating** —
  areas with almost no automated coverage. Highest-value additions: an E2E pass
  that logs in as each role and asserts the permission matrix, and action-level
  tests for the order/return/refund state machine and coupon/discount validation
  (the `place_order` hardening especially deserves a regression test mirroring
  the 10-case matrix used to verify it).
