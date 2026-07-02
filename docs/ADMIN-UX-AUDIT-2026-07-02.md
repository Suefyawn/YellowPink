# Admin & storefront UI/UX audit — 2026-07-02

**Method.** Every admin screen (47 routes — all lists, all detail/edit/new forms,
all settings sub-pages) was rendered against a production-like local stack and
captured at desktop (1440px) and phone (390px) widths; the storefront's 18 page
types were captured at 360/390/768/1440. Automated probes measured horizontal
overflow and sub-40px touch targets on every screen. In parallel, three code
reviews covered every admin form/action (feedback, validation, destructive
actions, pending states), the information architecture (navigation, tables,
cross-linking, terminology), and the operator workflows (order triage, catalog
entry, returns, support). Findings were merged and de-duplicated below.

Status keys: **[BUG]** defect; **[UX]** design/flow improvement; **[FIXED]**
already addressed on the audit branch.

---

## 1. Outright bugs found

1. **[FIXED]** Command palette's "New order" pointed at a route that didn't
   exist (404 via the `[id]` route). Manual order creation now exists at
   `/admin/orders/new`.
2. **[BUG]** The **order detail page swallows all of its own feedback**: save
   costs / record payment / save note / mark-confirmed redirect with
   `?costs=saved`-style params the page never reads — and *failures* redirect
   with `?err=` that is equally invisible. A failed save looks identical to a
   success on the most-used admin page. (`orders/[id]/page.tsx` takes no
   `searchParams`.)
3. **[BUG]** **BlogForm loses your article on a failed save**: React 19 resets
   uncontrolled fields when a form action settles; ProductForm carries the
   documented fix, BlogForm doesn't — a duplicate-slug error wipes category,
   author, excerpt and the entire body. No dirty-guard either. Same latent
   class in CouponEditModal, Team modals, VariantsSection.
4. **[BUG]** **Coupons create form clears on validation error** (redirect
   round-trip) — type a full config, get "Value is required", lose everything.
5. **[BUG]** `setOrderConfirmed` discards its DB error — the button can fail
   silently. Delete-order / delete-customer / delete-blog flash params are
   dropped by their list pages too (a *failed* customer delete is invisible).
6. **[BUG]** Coupon rows can show **"EXPIRED" and "Active" simultaneously**;
   vendor payouts can show "Settled" beside a red "you pay PKR 4,870";
   Returns KPI can read "Return rate 116.7%".
7. **[BUG]** Analytics/Inventory duplicate the brand in product names
   ("Garnier Garnier Hydra Bomb…"); audit log identifies entities by truncated
   UUIDs instead of order numbers; copy typos ("Review Boardwho",
   "italic textwith", "2 ordersare"); dashboard sparkline deltas all read
   "▲ 100%" whenever the previous period is zero.
8. **[BUG]** Palette permission mismatch: Finance/COD gated on `analytics` in
   the palette but `finance` in the sidebar. `/admin/help/whatsapp` has zero
   inbound links (orphan page). `/admin/profile` renders the dashboard
   (redirect?) — verify intent.
9. **[BUG][storefront]** `/checkout` renders fully with an **empty cart** —
   no items in the summary, "Due now PKR 200", Place Order enabled (server
   rejects, but the UX invites a dead click). No redirect to /cart.
10. **[BUG][storefront]** The mobile PDP renders the sticky buy bar **in-flow
    above the real buy box** — two quantity steppers and two ADD TO CART
    buttons stacked, and no H1/price block leads the page.
11. **[BUG][storefront]** Thank-you page password field: the "Show" toggle
    overlaps the placeholder text at every width.

## 2. Mobile responsiveness (admin)

Automated probes: **zero horizontal page overflow at 360/768 on list pages** —
the card system (orders swipe-cards, label/value tables, bottom nav) is
genuinely strong. But five screens still break out of the viewport at 390px:

| Screen | Actual width | Cause |
|---|---|---|
| Customer detail | **706px** | stat row + desktop Order History table |
| Help (manual) | 562px | doc tables/code blocks; 47k px tall, no TOC |
| Settings → Integrations | 512px | mono ENV-VARS/SETUP-REF columns |
| Returns | 475px | amounts + Approve/Reject row |
| Order detail | 436px | customer-card header links, "Open in Map" |

Also: **Reviews moderation** is a squeezed desktop grid (1–3 words/line beside
a button column); the **product form keeps its two-column grid at 390px**
(truncated placeholders, 2-word-wide textareas); the sticky save-bar + helper +
bottom-nav stack eats ~25% of the viewport on settings/product pages; audit log
renders 300 events as one 55,000px page; and dense tables carry dozens of
sub-40px tap targets (audit ~90, products@768 111, brands 87, orders 58).

## 3. Highest-leverage workflow improvements

1. **Courier booking should advance the order** — after a successful booking,
   auto-set status→shipped (which is also the only path that emails the
   customer). Today the operator must scroll to "Update Order" separately, and
   forgetting means the customer is never notified.
2. **Bulk status changes silently skip customer emails** that the single-order
   path sends. Make them equal (or warn).
3. **Messages inbox has zero customer context** — show "3 orders · PKR 12,400 ·
   last: YP-1042 (shipped)" in each thread header (one query by email).
4. **Duplicate-product action + redirect to edit after create** (variants/tags
   are only editable post-create, so today every variable product means
   create → find in list → reopen). Biggest catalog-entry time-saver.
5. **Product CSV export** — import already upserts by slug; one export endpoint
   completes the spreadsheet round-trip for mass repricing/restock.
6. **Sidebar badges for pending Returns and unmoderated Reviews** (queries
   already exist on the dashboard); "Needs attention" should include unread
   messages and fresh pending orders so morning triage is one screen.
7. **Order detail layout**: two columns with items + payment + status control
   in the top rail — today the status changer sits ~4,800px below the status
   badge it affects, under cost/notes cards used far less often.
8. **Reviews list needs the standard toolkit** (search, product filter,
   pagination — it currently silently caps at 20 approved), and an owner
   **public reply** field. Coupons list needs search + the "+ New" pattern.

## 4. Systemic fixes (each kills a whole class)

- **`ActionForm` wrapper** (useActionState + manual dispatch + pending
  SubmitButton + toast + optional dirty-guard): eliminates silent saves,
  field-wipe-on-error, double submits and unsaved-loss across every plain
  `<form action>` — settings, coupons create, order-detail widgets,
  brands/tags/collections/vendors, finance. The building blocks already exist
  (Toast, ProductForm's dispatch trick, DeleteButton's transition).
- **`OrderStatusBadge` + one colour map** for all 9 statuses. Four divergent
  copies exist today; `refunded`/`payment_pending` render grey fallbacks on
  the orders list, different hues on the dashboard, a third palette in the
  filter pills.
- **Button colour system**: magenta = primary, grey outline = secondary,
  red = destructive, green = WhatsApp only. Today "Approve" is green on
  Returns and magenta on Reviews; black/purple/blue one-offs abound.
- **Shared `PageHeader`** (title/subtitle/actions) and a **filter-preserving
  `BackLink`** (Orders already restores its filtered list via sessionStorage;
  Products/Customers/Blog dump you back to page 1).
- **One date formatter** — four formats coexist ("2 Jul 2026", "1 July 2026",
  "02-Jul-26", "29-Jun-26").
- **Plain-language ops surface**: env-var names (RESEND_API_KEY ×30 on Email
  log, JAZZCASH_MERCHANT_ID on Payments) and "Resubmit all to index" belong
  behind operator wording; a single "email sending isn't connected" banner
  beats per-row red errors.
- **Confirmation consolidation** on the styled DeleteButton pattern (three
  patterns coexist), plus missing confirms: Cancel shipment, Clear payment,
  Deactivate staff.

## 5. Navigation / IA

Proposed sidebar re-organisation (−2 top-level items, frequency-ordered):

```
INSIGHTS   Dashboard · Analytics · Finance (COD becomes a tab)
SELL       Orders · Products · Inventory · Returns · Vendors
CATALOGUE  Collections · Brands · Tags
CUSTOMERS  Customers · Segments · Messages · Reviews
MARKETING  Coupons · Blog · Medical reviewers (renamed) · Newsletter
SYSTEM     Settings · Team · Activity log · Email log · Broken links · Indexing
```

Key mis-filings today: Coupons under "People"; COD promoted to top level;
Email log in Marketing but settings-gated; "Review Board" adjacent to
"Reviews" despite being unrelated concepts.

## 6. Storefront visual quality (all breakpoints)

Automated probes found **zero horizontal overflow on all 18 page types at all
four widths** — the responsive skeleton is solid. The visual review's
conversion-ranked list:

1. Empty-cart checkout (bug #9 above).
2. Mobile PDP duplicate buy box (bug #10).
3. **Cookie banner floats mid-viewport over hero CTAs on every page** — dock
   it to the bottom edge.
4. PDP weight: the review form renders fully expanded (~1,200px) on every
   visit, and the buy-box trust tiles repeat verbatim in the section below.
5. Shop at 1440: 3 oversized columns, inconsistent card anatomy (jagged
   baselines) — 4-up with fixed slots.
6. Collection pages: broken hero = dead first viewport; 1-col mobile grid vs
   shop's 2-col; white-on-light title scrims.
7. Home at 768: editorial split tiles stack into two 600px slabs.
8. Checkout chrome: full nav + newsletter + 40-link footer on the one page
   that wants zero exits; optional Email carries the emphasis border while
   required Phone is plain.
9. Quiz at 1440 sits left-of-centre with an empty right half.
10. Polish: "Show"-toggle overlap (bug #11), monospace placeholders, FAQ page
    duplicated accordion, blog-post double newsletter block, track-page
    truncated placeholder.

## 7. Genuinely good (keep, and use as internal reference)

Order detail as a single-surface command centre with bilingual WhatsApp
prefills; the mobile card system (swipe-to-status orders, label/value tables,
bottom nav, FAB); Inventory (best table in the app); Returns lifecycle;
Customer detail; Finance & COD reconciliation; Notifications settings; Team;
Newsletter compose ("Send to 10 subscribers"); Help/WhatsApp guide; storefront
thank-you page, K-Beauty editorial page, blog shoppable-article layout;
`Pagination`, `Toast`, `DeleteButton`, `ImageUpload` components.

---

*Full per-screen notes and raw captures: session scratchpad
(`adminux/*.md`, `admin-shots/`, `store-shots/`). Findings from six parallel
reviews (3 code lenses, 3 visual lenses over 165 screenshots + probes).*
