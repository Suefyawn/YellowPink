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

## 2. New features to test

- **Order confirmation → vendor dispatch** (PR #64) — Admin → **Vendors**
  (add a supplier); on an order, "Mark customer-confirmed" then pick a
  vendor and "Send on WhatsApp" (prefilled order details).
- **Checkout** (PR #70) — gift-card and referral fields are intentionally
  removed; only the Coupon field + loyalty points remain.

## 3. DB migrations applied to the live database

`101` vendors + order confirmation columns · `102` Skincare→Cleansers &
Treatments rename · `103` analytics_rfm_segments rebuilt on
v_customer_segments. (Plus `099`–`100` from the round-1 finish.)

## 4. Config still on the owner (not code)

- Set `NEXT_PUBLIC_SITE_URL` in Vercel to the production domain — proper fix
  for email/og-image absolute URLs (a fallback is in place).
- WhatsApp business number is read from `NEXT_PUBLIC_WHATSAPP_NUMBER`
  (already set) — verify storefront WhatsApp buttons open +92 300 4374577.

## 5. Deliberately deferred

- Products list **TAG column / thumbnails** — left pending a decision on the
  product-tag feature's future.
- A full visual responsiveness sweep of every page — that's this handoff's
  end-to-end test.

---

## Fix log (ad-hoc, newest first)

Items the owner spotted between formal QA rounds.

- **Footer delivery copy** (PR #71) — "Karachi · Lahore · Islamabad" →
  "Delivering nationwide across Pakistan" (site footer + email footer).
- **PDP hero image height** (PR #71) — squared on desktop; `4/5` on phone.
- **PDP gallery oversized on desktop** (PR #68) — grid capped at 1080px.
