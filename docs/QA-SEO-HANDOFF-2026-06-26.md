# Browser-Agent QA Handoff — SEO session (2026-06-26)

Verification checklist for the SEO changes shipped in PRs **#382, #383, #384**.
Everything testable from the shell/DB has already been verified (see
"Automated results" at the bottom). The items below need a **real browser**
(visual rendering, interactive UX, Google's structured-data validator) and are
what we need you to confirm.

Production site: **https://www.yellowpink.pk**
Admin: **https://www.yellowpink.pk/admin** (owner login required)

For each test: record PASS/FAIL, a screenshot, and any console errors.

---

## 1. PDP visual rendering — enriched product names (H1)

We rewrote ~57 product names to descriptive form; the `name` drives the visible
`<h1>`. Confirm the longer names render cleanly (no overflow, no awkward
mid-word breaks, no overlap with the price/gallery) on **desktop and mobile**.

Check these (a mix of the longest new names + the user-reported ones):

- https://www.yellowpink.pk/product/meth-d-ultrapin  → H1 "Meth-D + Ultrapin Nerve Support & Pain Relief Bundle"
- https://www.yellowpink.pk/product/argivital-sachet → H1 "Argivital L-Arginine Heart & Circulation Sachet"
- https://www.yellowpink.pk/product/m-sol-sachet     → H1 "M-Sol Myo-Inositol Sachet for PCOS & Fertility"
- https://www.yellowpink.pk/product/kidogest-drops   → H1 "Kidogest Herbal Colic Drops for Babies"
- https://www.yellowpink.pk/product/simfolic         → H1 "Simfolic Myo-Inositol + Folic Acid for PCOS"
- https://www.yellowpink.pk/product/simdac-drops     → H1 "Simdac Vitamin A, D3 & C Drops for Kids"
- https://www.yellowpink.pk/product/skin1004-madagascar-centella-tone-up-sunscreen (longest name, 77 chars — pre-existing)

**PASS:** H1 is fully visible, wraps gracefully, layout intact on a 375px-wide
mobile viewport and on desktop.

---

## 2. Google Rich Results / structured-data validation (Semrush #45)

We removed invalid `currenciesAccepted`/`paymentAccepted` from the Organization
JSON-LD and confirmed it's clean in the raw HTML. Validate with Google's tool
that there are **no errors** (warnings OK):

1. Open https://search.google.com/test/rich-results
2. Test https://www.yellowpink.pk/product/meth-d
   - Expect valid **Product** (with offers/price) and **Organization / OnlineStore** items, **0 errors**.
3. Test https://www.yellowpink.pk/  (homepage)
   - Expect valid **Organization/OnlineStore** + **WebSite (Sitelinks search box)**, **0 errors**.
4. Test https://www.yellowpink.pk/shop?category=skincare
   - Expect **0 errors** (this is the page type Semrush flagged 399× before the fix).

**PASS:** 0 errors on all three; Organization no longer reports unknown fields.

---

## 3. Brand-filter UX — must NOT regress (PR #384)

We changed the **canonical** of `/shop?brand=X` to point at `/brand/<slug>`, but
deliberately did **not** add a redirect, so the on-page brand filter must still
work as before.

1. Go to https://www.yellowpink.pk/shop
2. Open the **Brand** filter in the sidebar and tick a brand (e.g. "Anua").
3. **Expected:** the grid filters to that brand and the URL becomes
   `…/shop?brand=Anua` — you should **stay on /shop** (NOT get redirected to
   `/brand/anua`). Filtering should feel instant (client-side).
4. View source / DevTools `<head>`: the canonical should read
   `<link rel="canonical" href="https://www.yellowpink.pk/brand/anua"/>`.
5. Untick the brand → grid returns to all products.

**PASS:** filter works client-side with no redirect; canonical points to the
brand page. **FAIL:** if ticking a brand navigates you to `/brand/...` or the
filter no longer works.

---

## 4. Brand archive pages render (now the canonical target)

Since `/brand/<slug>` is now the consolidation target, confirm a few render with
the right products:

- https://www.yellowpink.pk/brand/anua
- https://www.yellowpink.pk/brand/the-ordinary
- https://www.yellowpink.pk/brand/rare-beauty

**PASS:** page loads (200), shows that brand's products, has an H1 with the brand
name. **Edge case to watch:** if/when a brand with an apostrophe is published
(e.g. "Nature's Bounty"), confirm `/shop?brand=Nature's Bounty`'s canonical
resolves to a real `/brand/nature-s-bounty` page (slug logic was written for this
but no apostrophe brand is currently published to test live).

---

## 5. WhatsApp / share links still function (PR #382/#383)

We added `rel="nofollow"` to these — confirm the href still works (nofollow must
not break the link):

1. On any page, click the floating green **WhatsApp** button (bottom-right FAB).
   → Expect WhatsApp web/app to open a chat to the store with the pre-filled
   "Hi Yellow Pink!…" message.
2. On a blog post (e.g. /blog/glutathione-benefits-skin-pakistan-guide-2), click
   the **WhatsApp** and **Facebook** share buttons in the share strip.
   → Expect WhatsApp share / Facebook sharer to open with the post URL.
3. PDP "Chat on WhatsApp" CTA → opens WhatsApp.

**PASS:** all open correctly. (DevTools should show `rel="nofollow noopener
noreferrer"` on each — already confirmed in HTML.)

---

## 6. /login page (PR #382)

1. https://www.yellowpink.pk/login → renders the login form, returns 200.
2. View source `<head>`: `<meta name="robots" content="noindex, nofollow"/>`.
3. Login still works end-to-end (enter credentials → reach /account).

**PASS:** page works, is noindexed, login flow unaffected.

---

## 7. Admin — draft meta backfill spot-check (PR #384, migration 213)

The 348 drafts (mostly Golden Pearl) got auto-generated `seo_title` +
`seo_description`. These aren't public yet, so check in admin:

1. Admin → Products → filter to **Draft**.
2. Open 3–4 drafts (e.g. search "Light & Glow Face Wash", "Brightening Rice
   Cleanser", a "Pack of …" item).
3. Confirm each has a populated **SEO title** and **SEO description** field that
   reads sensibly and on-topic (derived from the product's own copy).
4. **Known limitation to verify, not fix:** some multipack/variant drafts share
   identical description text with their single-unit sibling (≈55 pages). Note
   any you see — these should be differentiated **before** those drafts are
   published, but are harmless while in draft (not indexed).

**PASS:** drafts have coherent, on-topic meta; note any duplicate-description
pairs for the pre-publish cleanup list.

---

## Automated results (already verified — for context, no action needed)

| Area | Check | Result |
|---|---|---|
| NB Sons names (211) | Live H1 + Product JSON-LD `name` on 5 PDPs | ✅ PASS |
| Thin products (212) | H1 + title + on-topic meta on 6 PDPs | ✅ PASS |
| nofollow (382/383) | `rel="nofollow…"` on WhatsApp FAB + blog WA/FB share | ✅ PASS |
| noindex login (382) | `/login` = `noindex, nofollow`, HTTP 200 | ✅ PASS |
| Brand canonical (384) | `/shop?brand=X` canonical → `/brand/<slug>` (3 brands) | ✅ PASS |
| Brand targets (384) | `/brand/{anua,the-ordinary,rare-beauty}` → 200 | ✅ PASS |
| Coverage | 153 published + 372 draft: 0 missing title/desc, 0 one-word names | ✅ PASS |
| Duplicate meta (published) | 0 duplicate titles, 0 duplicate descriptions | ✅ PASS |
| Duplicate meta (draft) | 1 dup title, 55 dup descriptions | ⚠ pre-publish cleanup (not indexed) |
| Build | `tsc --noEmit` + `eslint` + Vercel prod deploy | ✅ PASS (green) |
| Semrush #45/#109/#39 | Already fixed live; will clear on next crawl | ✅ verified live |

**Open follow-ups (not blockers):**
- Dedupe the ~55 draft descriptions before publishing those products.
- Trigger a fresh Semrush crawl (auto-scheduled) to clear the stale 422 errors.
