# Cowork Handoff — Yellow Pink (fixes since QA round 2)

A running log of everything changed since the round-2 QA report, kept so the
next **end-to-end** cowork test has a complete picture of what to re-verify.
This is a living document — new ad-hoc fixes are appended to the **Fix log**
at the bottom as they ship.

- **Storefront:** https://yellow-pink.vercel.app/ · **Admin:** /admin
- Use the structured report format and severities from
  `.audit/COWORK_TEST_PLAN_R2.md`.
- When testing: pull the latest `main` — every item below is merged via PR.

---

## 1. Round-2 report — what was fixed

Verify each still holds end to end.

### Storefront
- **P1 — signed-in customers bounced to /login** (PR #61). Logging in must
  now reach `/account`, `/account/orders`, `/account/subscriptions`; a
  wellness PDP must show the Subscribe & Save form (not "Sign in to
  subscribe"); browser console must have **no** "Multiple GoTrueClient
  instances" warning. *This is the highest-priority thing to confirm.*
- **Email logo + og:image** (PR #62) — order emails show the flower logo;
  `og:image` resolves to the live origin, not the old WP domain.
- **Mobile horizontal scroll** (PR #63) — no sideways scroll on PDP /
  collection at 390px.
- **Pagination scroll-to-top** (PR #66) — clicking page 2 on `/shop` jumps
  to the top.
- **"Skincare" name clash** (PR #66) — the Skincare tab's chips are
  "Cleansers & Treatments / Moisturizers / Hair Care" — no "Skincare" chip.
- **PDP gallery** (PR #68, #71) — image is a sensible size on desktop
  (square ≥901px), `4/5` on phone; long product names don't overflow.

### Admin
- **Product edit — Category** (PR #65) — the Category dropdown pre-fills the
  product's real category; Save is not blocked.
- **Order status dropdown** (PR #65) — stays in sync after a status change.
- **Dashboard declutter** (PR #67) — traffic widgets (funnel / PostHog /
  top pages / top events) moved to the Analytics page.
- **Analytics customer segments** (PR #69) — the Analytics "Customer
  segments" panel now matches the `/admin/segments` counts.
- **Revenue chart** (PR #56) — no overlapping/jumbled labels.

### Verified non-issues (no change needed)
- **Header mega-menu** — exists and works (per-taxon hover dropdown).
- **Inventory restock "silent"** — a wrong-sign restock is rejected with a
  clear message.
- **"New customers · 30 days = 71"** — the query *does* filter to 30 days;
  the count is high only because the customer import was recent.
- **Search "serum" → 0 results** — genuine catalogue gap, correct empty
  state.

## 2. New features / reworks to test

- **Order confirmation → vendor dispatch** (PR #64) — Admin → **Vendors**
  (add a supplier); on an order, "Mark customer-confirmed" then pick a
  vendor and "Send on WhatsApp" (prefilled order details).
- **Checkout** (PR #70) — gift-card and referral fields are intentionally
  removed; only the Coupon field + loyalty points remain.
- **Product edit form revamp** (PR #75) — grouped into titled sections;
  "Key benefits" and "FAQ" are now add/remove row editors (no more raw
  JSON). Verify: adding/removing rows saves, and an existing product's
  benefits/FAQ pre-load into the editors.
- **Header** (PR #73) — mega-menu stays open when moving to the dropdown;
  a wishlist heart icon now reaches `/wishlist`; the header stays sticky
  on scroll while the announcement bar scrolls away.
- **Homepage trust bar** (PR #74) — four distinct relevant icons.
- **Settings page UX** (PR #79) — a jump-nav of section pills at the top
  and a sticky save bar at the bottom. Verify the pills scroll to their
  cards and the save bar stays visible while scrolling.
- **Invoice printing** (PR #77) — printing an order now outputs only a
  branded invoice card (parcel-ready), not the whole admin page.
- **Product copy** (PR #82, #83) — `how_to_use` is form-correct for 30
  wellness products (a syrup/drops/effervescent no longer says "swallow a
  tablet"); `short_description` has no leftover `&#…;` HTML entities and
  the Energy Boost blurb matches the real product.
- **Wellness content rebuild** (PR #86) — 44 wellness products' full
  content (description, short description, ingredients, key benefits,
  how-to-use) rebuilt from the authoritative vendor data.
- **Inventory managed externally** (PR #87) — product-form toggle; such
  products stay sellable, are excluded from low-stock + the Inventory
  screen, and show a "Managed externally" badge.
- **Homepage blog** (PR #88) — "From the Journal" rail of 3 recent posts.
- **Centralized sale** (PR #89) — Admin → Settings → Sale switch drives a
  featured Sale Collection band on the homepage (replaced the mis-labelled
  "New Arrivals" section).
- **Vendor cost / margin / payouts** (PR #90) — per-vendor commission % +
  per-product cost + settlement direction; product form shows a live
  margin; Vendors has a Payouts table; dispatching an order writes a
  settlement row.
- **Vendor product import** (PR #91, #94) — SimZee Zinc Syrup, Hydrating
  Face Wash, Vitamin C Serum, Rooposh Feminine Wash, images self-hosted.
- **Mobile admin tables** (PR #93) — admin list tables collapse to one
  card per row on phones.
- **Bank Transfer accounts** (PR #100) — a managed list of bank / wallet
  accounts (Settings → Payments), shown at checkout, on the confirmation
  page and in the confirmation email.

## 3. DB migrations applied to the live database

`101` vendors + order-confirmation columns · `102` Skincare→Cleansers &
Treatments rename · `103` analytics_rfm_segments rebuild · `104`
`how_to_use` rewrite · `105` `short_description` cleanup · `106` price
sync from WordPress · `107` wellness content rebuild · `108`
`track_inventory` column + `place_order` rewrite · `109` vendor
margins/payouts (columns + `vendor_settlements`) · `110` import 4 vendor
products · `111` re-host vendor images · `112` lock the `images` storage
bucket · `113` Trimo-M price · `114` Flex-4 / Repro-M / Marixtizer prices.
(Plus `099`–`100` from the round-1 finish.)

## 4. Config (Vercel env vars)

- `POSTHOG_PERSONAL_API_KEY` + `SENTRY_AUTH_TOKEN` — **set by the owner**;
  the dashboard "Refresh analytics" + the PostHog/Sentry widgets need them.
- `NEXT_PUBLIC_WHATSAPP_NUMBER` — set; verify WhatsApp buttons open
  +92 300 4374577.
- `NEXT_PUBLIC_SITE_URL` — **still recommended**: set to the production
  domain so email/og-image absolute URLs use it (a fallback works without).

## 5. Deliberately deferred

- Products list **TAG column / thumbnails** — left pending a decision on the
  product-tag feature's future.
- A full visual responsiveness sweep of every page — that's this handoff's
  end-to-end test.

---

## Fix log (ad-hoc, newest first)

Items the owner spotted between formal QA rounds.

- **Bank Transfer accounts** (PR #100) — multi bank/wallet account list
  replaces the single instructions field; shown at checkout, on the
  confirmation page and in the confirmation email.
- **Vendor price parity** (PR #98, #99) — Trimo-M, Flex-4, Repro-M and
  Marixtizer matched to nbsons.com pricing.
- **PDP opens at the top** (PR #97) — a product no longer opens scrolled
  to its footer after a tile tap from a scrolled-down page.
- **Images storage hardening** (PR #94, #95, #96) — vendor product images
  re-hosted on Supabase Storage; the `images` bucket locked to
  service-role writes; the unused Shopify CDN host removed.
- **Mobile admin tables** (PR #93) — Orders / Products / and the other
  admin tables collapse to cards on phones.
- **Price sync** (PR #85) — 20 products' prices corrected against the
  live yellowpink.pk store.
- **Product short descriptions** (PR #83) — decoded leftover WordPress HTML
  entities in 21 products; rewrote the OCR-garbled Energy Boost blurb.
- **Product how-to-use** (PR #82) — rewrote 30 wellness products that had
  generic "take one tablet" text regardless of the real form.
- **PDP image steady on accordion open** (PR #81) — the gallery image no
  longer grows/shrinks when the how-to-use/ingredients accordions toggle.
- **Settings page UX** (PR #79) — section jump-nav + sticky save bar.
- **Invoice printing** (PR #77) — prints only a branded, parcel-ready
  invoice card, not the whole order page.
- **Trust-bar icons** (PR #74) — four relevant icons instead of one glyph.
- **Header — mega-menu hover** (PR #73) — dropdown no longer closes before
  you can click an item.
- **Header — nav alignment** (PR #73) — Sale/Blog sit level with the rest.
- **Header — wishlist link** (PR #73) — a heart icon now reaches `/wishlist`.
- **Header — sticky** (PR #73) — `body` overflow fix so the header pins.
- **Product edit form** (PR #75) — sectioned layout + JSON-free editors.
- **Footer delivery copy** (PR #71) — "Karachi · Lahore · Islamabad" →
  "Delivering nationwide across Pakistan" (site footer + email footer).
- **PDP hero image height** (PR #71) — squared on desktop; `4/5` on phone.
- **PDP gallery oversized on desktop** (PR #68) — grid capped at 1080px.
