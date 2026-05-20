# Cowork Full Test — Yellow Pink (start to end)

The complete end-to-end QA + UX audit of Yellow Pink. Walk the **entire
site** — storefront and admin — as a real user and as a UX professional,
and produce one punch list the dev team works straight from.

This supersedes the earlier round-specific plans. It folds in: the
storefront journey, the admin functional + UX audit, regression of every
fix shipped since QA round 2, the new features, and cross-cutting checks.

- **Storefront:** https://yellow-pink.vercel.app/  · **Admin:** /admin
- Ask the user for the **owner login**. Create a **test customer** via
  signup with a real inbox you control (to verify emails).
- Test on **desktop** and **mobile (≈390px)**; spot-check **tablet**.
- It's a live site: test orders use **Cash on Delivery**; prefix test data
  ("TEST —…"); never delete real products / customers / orders.

---

## How to report

One report. For every issue:

```
[SEVERITY] Area — short title
  Where:    URL / page / element
  Steps:    what you did
  Expected: what should happen
  Actual:   what happened (screenshot)
  Fix:      a concrete suggestion (for UX items)
```

Severity: **P0** blocker (checkout broken, crash, data loss, security) ·
**P1** major (a core flow or key page broken/unusable) · **P2** minor
(awkward UX, inconsistency, visual glitch) · **P3** polish · **CLEANUP**
remove-this. Group by area, sort by severity. End with the deliverable
in the last section.

---

## Part A — Storefront (the customer journey)

Walk the whole purchase journey end to end. Watch the browser console for
errors and the network tab for failed requests throughout.

### A1. Home & navigation
- Homepage: every section renders with real products, no placeholders.
- The **trust bar** under the hero — four distinct relevant icons.
- Header **mega-menu**: hover each taxon (Makeup / Skincare / Wellness /
  Bundles) — the dropdown opens and you can move down into it and click an
  item without it closing. All nav links sit on one baseline.
- The header **wishlist heart** opens `/wishlist`.
- On scroll: the announcement bar scrolls away, the header stays pinned.
- Click every header + footer link — all resolve. Footer says delivery is
  nationwide.

### A2. Shop & discovery
- `/shop`: each top tab (All / Makeup / Skincare / Wellness / Bundles); the
  sub-category chip row shows only non-empty categories — click each, all
  return products.
- Sort options; pagination — page 2 jumps the viewport to the top.
- **Search** (overlay): a product name, a brand, a category word, gibberish
  — results relevant, empty state intentional.
- Product tiles: hover, quick-add, wishlist heart.

### A3. Product page
- Open several PDPs incl. a no-brand product and one with a long name.
  Gallery image is a sensible size on desktop, no horizontal scroll,
  breadcrumb has no empty segment.
- Variants, image gallery/zoom, key benefits, FAQ, reviews section, related
  products, Subscribe & Save (wellness PDPs), sticky mobile buy-bar.
- Opening/closing the how-to-use & ingredients accordions must **not**
  resize the gallery image.
- **Product copy** — open a few wellness PDPs (a syrup, drops, an
  effervescent, a powder): "How to use" matches the real form (no "swallow
  a tablet" on a syrup). No raw `&#…;` HTML entities anywhere in the
  short/long description.

### A4. Cart & checkout
- Mini-cart drawer: free-shipping progress bar; line items link to the PDP.
- `/cart`: change qty, remove an item.
- Coupon: `WELCOME10`, `SUBSCRIBE10`, an invalid code, a below-minimum code
  — messages correct. (Gift-card / referral fields are intentionally gone.)
- Complete a **COD** checkout → `/thank-you`. Confirm the order
  confirmation email arrives **with the logo showing** (not broken).

### A5. Account & post-purchase
- **Sign up, log out, log in.** Confirm a logged-in customer can reach
  `/account`, `/account/orders`, order detail, `/account/addresses`
  (add/edit/delete/default), `/account/profile`, `/account/rewards`,
  `/account/subscriptions` — **none bounce back to `/login`**.
- `/account/rewards`: points balance, tier, history, referral code.
- Track an order via `/track`. Wishlist add/remove. Submit a review →
  it enters moderation (not visible until approved).

### A6. Content
- `/blog` + a post — filter chips show the 6 clean categories, no
  "Uncategorized"; clean text, no `&amp;`/`&#…` entities.
- Newsletter modal/signup; static `/page/...` pages; WhatsApp buttons open
  a chat to **+92 300 4374577**.

---

## Part B — Admin (every page: does it work, and is it good UX?)

Log into `/admin`. Visit **every** sidebar item. For each: confirm it loads,
shows real data, every button/action works and gives feedback — **and**
judge its UX against this lens:

> Clarity · sensible layout & hierarchy · **consistency** with other admin
> pages (cards, headers, buttons, tables, spacing, empty states) · tables
> have a sensible default sort and real empty states · forms are grouped,
> labelled, with clear save + success/error feedback · destructive actions
> confirm · usable at tablet width · no cramped/misaligned polish issues.

Pages: **Dashboard, Analytics, Products** (list + create/edit + CSV
import), **Inventory, Orders** (list + detail), **Vendors, Returns,
Customers** (list + profile), **Segments, Coupons, Promos, Blog** (list +
editor), **Reviews, Activity log, Team** (list + editing a staff member),
**Settings, Profile**, and the `/admin` login.

For each page, report functional bugs **and** UX punch-list items
separately. Flag any page that's confusing, inconsistent, or feels
unfinished.

---

## Part C — Regression: confirm the post-round-2 fixes hold

Each of these was fixed since QA round 2 — verify each still holds (mark
PASS / FAIL):

- Signed-in customers reach `/account` (the P1) · email logo · no mobile
  horizontal scroll · `/shop` pagination scroll-to-top · no "Skincare"
  chip clash · PDP gallery sized right · PDP image steady when accordions
  toggle · product copy form-correct & free of `&#…;` entities ·
  product-edit Category pre-fills · order-status dropdown stays in sync ·
  Analytics segments match the Segments page · invoice prints **only the
  invoice card** · header mega-menu hover · trust-bar icons · settings
  jump-nav + sticky save.

(Full list with PR references: `.audit/COWORK_HANDOFF.md`.)

## Part D — New features

- **Order confirmation → vendor dispatch**: Admin → Vendors (add one); on
  an order, "Mark customer-confirmed", then pick a vendor and "Send on
  WhatsApp".
- **Product-edit form**: sectioned layout; Key-benefits & FAQ are
  add/remove row editors (no JSON) — adding rows + saving works, and an
  existing product's rows pre-load.

## Part E — Cross-cutting

- **Console & network** — report every JS error / failed request, with the
  page.
- **Responsive** — repeat the core journey at phone width; check the admin
  at tablet width; report overflow, breakage, unusable controls.
- **Consistency** — pick card style / page header / primary button / table
  header / empty state and list every page that deviates.
- **Performance** — flag any slow page.
- **SEO/meta** — flag missing/wrong titles or broken share previews.
- **Empty states** — every list should look intentional when empty.

## Part F — Config to confirm

- `NEXT_PUBLIC_SITE_URL` set in Vercel? (email/og-image origin)
- Analytics: dashboard "Refresh analytics" returns `{ ok: true }`; the
  Sentry + PostHog widgets populate.
- WhatsApp buttons open +92 300 4374577.

---

## Deliverable

One report, grouped Storefront / Admin, sorted by severity, every issue in
the format above. End with:
- The **Part C** PASS/FAIL regression checklist.
- A **CLEANUP** list (anything to remove).
- The **worst-first priority list** — the top 5–8 things to fix first.
- A one-line **verdict**: is Yellow Pink ready to take real customers?
