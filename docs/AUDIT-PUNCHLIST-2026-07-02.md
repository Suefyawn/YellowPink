# YellowPink full-audit punch-list — 2026-07-02 (first pass)

Scope covered: every `src` file (456 files, read in full across 12 chunks),
all 176 published products + the draft catalogue, all 178 blog posts, every
CMS page, technical + on-page + structural SEO of the live site, the whole
admin panel driven end-to-end against a local replica of production, docs
accuracy, and the current GA4 / Search Console / PostHog / Sentry / Web
Vitals / Semrush / Supabase-advisor data.

Status keys: **[FIXED]** committed on `claude/yellowpink-full-audit-zqeleh`;
**[TODO]** fix pending in this pass; **[DATA]** owner/content action, not code.

---

## Critical (3)

1. **[FIXED]** `place_order` trusted the client's `discount_amount` and
   `shipping` — anyone could post `discount = subtotal` (with or without a
   coupon) or `shipping = 0` and place a near-free order. Now validates the
   coupon server-side (expiry, caps, min/max, email/product restrictions),
   recomputes the discount, floors shipping at the resolved zone rate, and
   records redemptions. Verified against a 10-case forgery matrix.
2. **[FIXED]** Products with order history were **hard-deleted** — the
   archive-instead-of-delete guard passed a JS array to `.contains()`, which
   postgrest serialised wrong, so the order-history check always errored to
   zero. Now archives; fails safe.
3. **[FIXED]** `/admin/messages` rendered the **entire customer inbox to
   unauthenticated requests** (inverted `if (session && …)` guard + edge gate
   that only checked cookie *presence*). Guard corrected; the edge middleware
   now verifies the staff cookie's HMAC + expiry so forged cookies never reach
   any page.

## High — fixed this pass

- **[FIXED]** Approved reviews never rendered on PDPs (the `product_reviews`
  "read approved" RLS policy existed in prod but was never in a migration; a
  rebuilt DB showed zero reviews). Captured in a repair migration.
- **[FIXED]** Draft/archived products leaked into PDP "pairs with" / "you may
  also like", homepage rails, recently-viewed and blog nudges → dead links.
  `status='published'` enforced everywhere.
- **[FIXED]** Homepage hero could render blank (empty `<h1>`, `href=""` CTA)
  when a settings key was missing — per-field fallbacks added.
- **[FIXED]** Footer Terms/Disclaimer 404s; hard-coded legal FAQ cards
  contradicting the CMS body (payment methods, returns window); disclaimer &
  terms meta descriptions were raw WordPress shortcode / entity soup.
- **[FIXED]** "Frequently bought together" on a sold-out PDP added a qty-0
  phantom line that dead-ended checkout with a raw-UUID error.
- **[FIXED]** External-inventory products (`track_inventory=false`) were
  rejected at checkout (fixed in the `place_order` rewrite).
- **[FIXED]** Orders "Export CSV" silent no-op; "Delete order" 404 (a stray
  re-export de-registered the server action — also fixed the dead **Delete
  blog post** and **Delete customer** buttons in the same family); bulk
  "Cancelled" didn't restock; "Resend confirmation" claimed success on a
  failed send.
- **[FIXED]** Finance "Revenue (paid orders)" counted unpaid orders.
- **[FIXED]** Product form wiped entered data on a rejected save; no draft
  status (every new product went live + pinged search engines).
- **[FIXED]** Disabled/scheduled promos vanished from `/admin/promos`.
- **[FIXED]** Customer orders never wrote `inventory_ledger` rows (sales
  invisible in the "permanent audit trail") — restored via `place_order`.
- **[FIXED]** `/admin/indexing` "Check now" hit Vercel's 300s function
  timeout (unbounded serial Google calls) — seen in production.

## High — TODO (fix pending in this pass)

- **[TODO]** **Blog create AND edit both fail** with "Expected boolean,
  received string" — the checkbox/hidden-input FormData pattern. Same root
  cause breaks the **account address book** create/edit, the **shipping zone
  "Active" toggle** (always saves off), and **notification recipient** save
  (always paused). One systemic fix + audit of every boolean form field.
- **[TODO]** Registered **customers are invisible** in admin (`get_admin_users`
  returns nothing) — captured the prod function in the repair migration; needs
  verification that the admin page renders them.
- **[TODO]** Deleting a **vendor cascade-deletes its settlement (financial)
  history**; the FK-error guard is dead code.
- **[TODO]** **CSV product import** broken (anon client, no insert policy);
  WooCommerce import maps empty sale price → free product.
- **[TODO]** Disabled **product variants** vanish from the editor, can't be
  re-enabled.
- **[TODO]** **Courier booking always sends full order total as COD**, even
  for prepaid orders.
- **[TODO]** **Referral programme** entirely non-functional — `referred_by_code`
  is never captured, yet the rewards page promises 500 pts / 10%.
- **[TODO]** **Anon API can insert pre-approved "verified-purchase" reviews**
  (RLS insert policy constrains no columns; rating trigger manipulable).
- **[TODO]** **Reviewer dashboard** article list always empty (`getReviewedPosts`
  selects a nonexistent `blog_posts.status` column).
- **[TODO]** **Product video upload** (30 MB) can't work on Vercel (4.5 MB body
  limit) — needs direct-to-storage upload or removal of the control.
- **[TODO]** deleteBrand/deleteCollection **swallow DB errors and show
  success**; product/brand/collection mutations don't revalidate storefront
  ISR (up to 5-min stale prices/status); manual-collection save is
  delete-then-insert with no transaction.
- **[TODO]** Staff with the advertised `settings` permission can open Settings
  pages but every save throws unhandled Unauthorized (owner-only in practice).

## Medium / Low
91 medium + 101 low findings are catalogued in the per-area reports
(`scratchpad/audit/*.md`). Highlights: CSV formula-injection in exports;
several public server actions unauthenticated/unrate-limited
(`refreshAnalyticsCore`, quiz, reviewer application); PostgREST 1000-row
truncation in Finance P&L and "uncapped" exports; newsletter can't reach past
~90 subscribers; soft-404 fixes; title-length/JSON-LD SEO polish; ~30 emoji
→ inline-SVG icon replacements (done); many honest-empty-state and
confirmation-dialog gaps.

---

## Data / analytics signals (owner action — not code)

- **Indexing:** only 6 of 122 tracked URLs indexed by Google; 32 "Discovered –
  not indexed", the new blog programme is effectively invisible to search.
- **Conversion:** 28-day funnel 186 view_item → 1 purchase; **zero mobile
  purchases** despite mobile being most of the traffic. Worth a focused
  mobile-checkout investigation once the purchase-path fixes ship.
- **Web Vitals:** `/reviewer` p75 LCP 7.3s; `/blog` CLS 0.475 / INP 304ms;
  LCP > 2.5s on home/product/blog (small samples).
- **Sentry:** 0 events ever received — the SDK is very likely not reporting;
  verify DSN wiring (no DSN found in the live client bundles).
- **Supabase advisors:** 36 security warnings — leaked-password protection
  off, several SECURITY DEFINER RPCs anon-callable, ~25 RLS-enabled tables
  with no policy. Triage separately.
- **Semrush:** the previously-flagged "22 broken JS/CSS" is **gone** in the
  latest crawl (confirmed mid-deploy artifact); the 495 "temporary redirects"
  are the robots-disallowed `/account`→`/login` auth gate (crawl noise, not a
  defect). Authority Score 2, 2 backlinks, ~24 keywords, 0 est. traffic — the
  domain is effectively pre-launch in search terms.

## Still running (this pass)
Blog-content sweep (178 posts) and product-data sweep (176 products) and the
Settings/Permissions admin E2E were finishing as this list was written;
their findings will be folded in before the pass closes, then all
critical/high findings go through adversarial verification.
