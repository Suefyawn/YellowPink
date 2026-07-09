# Yellow Pink — System Manual

A complete guide to the Yellow Pink online store, written for anyone new to the
system. It explains both sides of the platform: the **storefront** your
customers shop on, and the **admin panel** you and your staff use to run the
store and process sales.

> **Reading this in the admin:** signed-in staff can open this manual any time
> from the admin sidebar — **User manual** (bottom of the left nav, under
> *Sign out*). It always shows the latest version.

> **Keeping this current:** this manual is updated whenever user-facing
> behaviour changes. If something here doesn't match what you see on screen,
> the screen is right — please flag it so the manual can be corrected.
>
> **Last updated: 9 July 2026** — see [What's new](#9-whats-new) for the
> change history.

---

## Contents

1. [What this system is](#1-what-this-system-is)
2. [The customer experience (storefront)](#2-the-customer-experience-storefront)
3. [The admin panel — a tour](#3-the-admin-panel--a-tour)
4. [Processing a sale — the order workflow](#4-processing-a-sale--the-order-workflow)
5. [Team, roles & permissions](#5-team-roles--permissions)
6. [Store settings](#6-store-settings)
7. [Marketing & acquisition](#7-marketing--acquisition)
8. [Reference](#8-reference)
9. [What's new](#9-whats-new)

---

## 1. What this system is

Yellow Pink is an online beauty & wellness shop serving customers across
Pakistan. The platform has two halves:

- **The storefront** — the public website where customers browse products, place
  orders, and track them. Anyone can visit it.
- **The admin panel** — found at `/admin`, this is where you manage the catalogue,
  process orders, configure the store, and view performance. Only staff with a
  login can reach it.

A typical day: customers place orders on the storefront; you open the admin
panel, confirm and fulfil those orders, and keep the catalogue and settings up
to date.

---

## 2. The customer experience (storefront)

This is the journey every customer takes. Understanding it helps you support
customers and spot where an order is.

### 2.1 Browsing the store

- **Home page** — the landing page. It shows a hero banner, curated product
  rails (featured items, bestsellers, wellness picks), shop-by-category tiles,
  the latest blog posts, and trust/press sections. A dedicated **"Beauty starts
  from within"** wellness showcase presents every health concern (Women's
  Health, Immunity, Bone & Joint, and more) as its own card with a live product
  count and "from" price, a featured wellness rail, and supplement-specific
  assurances (authentic, sealed & in-date, cash on delivery). The concern cards
  and counts are generated automatically from the live catalogue, so they never
  drift from what's actually in stock. It also features **The
  K-Beauty Edit** — a band showcasing products from curated Korean beauty
  brands, linking to the K-Beauty collection page. The band appears
  automatically once at least one product from a listed K-beauty brand is
  published (the brand list is maintained by the development team), and hides
  itself if none are live.
- **K-Beauty page** (`/k-beauty`) — a dedicated collection page for the Korean
  beauty range, reachable from the main menu and footer. It has its own hero,
  spotlight cards for each Korean brand (each links to that brand's landing
  page), a "why K-beauty" ritual explainer, the full product grid, and a
  short FAQ. Products appear here automatically when they carry a brand from
  the curated K-beauty list — there is nothing extra to configure per product
  beyond setting its brand.
- **Find Your Match quiz** (`/quiz`, in the main menu) — a short interactive
  quiz that recommends products. The shopper picks a path (skincare or
  wellness), answers one or two quick questions, and gets a personalised set of
  product picks drawn live from the catalogue, with an option to have their
  results emailed along with a welcome discount (which also adds them to the
  newsletter). Every step is tracked, and the **Dashboard** shows the quiz
  funnel (starts → completions → emails) and most-recommended products.
- **Brand pages** (`/brand/<brand>`) — every brand has its own landing page
  with that brand's products, reachable from the **All Brands** directory
  (`/brands`, linked in the footer) or a K-Beauty spotlight card. Each page has
  its own on-page **sort** (Featured / Newest / Price / Name), **category
  filter** chips, and an **in-stock** toggle, so shoppers refine right there
  without leaving the page. These appear and update automatically from the
  brands on your products — nothing to configure.
- **Tag pages** (`/tag/<tag>`) — each product tag has its own landing page
  listing the tagged products with the same on-page sort + filter controls,
  created automatically from the tags you set in admin.
- **Collection pages** (`/collection/<slug>`) — curated edits you build in
  admin (Collections), each with its own hero, description, and product grid.
  Manual collections show a hand-picked, ordered list; smart collections fill
  themselves from rules and stay current automatically. All published
  collections are listed at **`/collections`**, and the three top ones also
  appear in a **"Shop by collection"** band on the homepage. The site footer
  also lists the top published collections in their own **Collections**
  column (it appears automatically once at least one collection is
  published).
- **Top menu** now includes **Collections** and **Brands** links (alongside
  K-Beauty, Sale and Blog) on both desktop and mobile.
- **Shop page** (`/shop`) — the full catalogue. Customers can filter by
  category, brand, **tags** (the free-form labels you set in admin), product
  attributes (shade, size, etc.), price range, and quick toggles for **In
  stock**, **On sale**, **Featured**, and **Bestseller**. The brand and tag
  lists show a count next to each option. They can also search by name and sort
  by newest, price, or name. Filters combine and are saved in the page URL (so a
  filtered view can be shared or bookmarked, e.g. `/shop?brand=Anua` or
  `/shop?tag=viral`). Results are paginated. Product cards show a **Sale** badge
  when discounted and an **"Only N left"** badge when stock is running low (5 or
  fewer remaining, for products whose inventory the store tracks).
- **Search overlay** — the header magnifying glass opens a full-width search
  panel. When the box is empty it shows the shopper's **Recent** searches as
  one-tap chips (the last 6, deduped), then Trending brands and Categories.
  Typing brings up live product results.
- **Product page** — each product has its images, price (and the crossed-out
  original price if it's on sale), description, ingredients, how-to-use, key
  benefits, FAQs, and its customer star rating. If a product has a **short
  video** (e.g. a makeup swatch), it appears as an extra slide in the image
  gallery with a play button — it **never autoplays** and only loads when the
  shopper taps play, so it doesn't slow the page. If the product comes in
  variants (e.g. shades), the customer picks one before adding to the cart. When
  a shipping zone has a delivery estimate configured, an **estimated delivery
  time** ("Delivery in X–Y working days · COD nationwide") shows by the
  Add-to-Cart button. Further down the page, a **"From the blog"** row shows
  up to three journal articles that feature the product (it appears
  automatically when a blog post links to the product, and stays hidden
  otherwise).
- **Sitemap page** (`/sitemap`, linked from the footer Help column) — a single
  human-readable index of the whole store: every shop category (grouped by
  Makeup / Skincare / Wellness), all collections, brands, journal posts and
  information pages, each one click away. It complements the machine
  `/sitemap.xml` that search engines read.

### 2.2 Cart and checkout

- **Cart** — lists everything the customer has added, with quantities and a
  running total. They can change quantities, remove items, and enter a **coupon
  code** for a discount. Because the free-delivery threshold depends on the
  delivery region (and the customer's city isn't known yet in the cart), the cart
  and mini-cart show a plain **"free delivery on bigger orders — your exact
  threshold shows at checkout"** note instead of a single number or a progress
  bar to a possibly-wrong figure. Below that sits the same **estimated delivery
  time** shown on the product page, and a **"You may also like"** row suggesting
  bestsellers (excluding what's already in the bag) to encourage add-ons.
- **Checkout** — the customer enters their delivery details (name, phone, email,
  full address), sees the shipping cost, and chooses how to pay. A short
  reassurance strip (authentic products, cash on delivery, 7-day returns) sits
  by the **Place Order** button. Only at checkout — once the province is
  selected — does the shopper see the **exact, region-correct** delivery charge
  and free-delivery threshold for their zone, so the promise is never wrong for
  their area. Free delivery is earned on the merchandise subtotal (before any
  discount code), so applying a coupon never strips a free-delivery promise the
  customer has already qualified for.

### 2.3 Ways to pay

Which options appear depends on what you've enabled in **Settings → Payments**:

- **Cash on Delivery (COD)** — the customer pays the courier when the parcel
  arrives. No online payment.
- **Bank transfer** — the customer transfers the amount to one of your store
  bank/wallet accounts (shown to them at checkout and on the thank-you page).
  You confirm the order once the money arrives.
- **JazzCash / Easypaisa** — Pakistani mobile wallets; the customer is taken to
  the wallet's payment page and back.
- **Card** — Visa/Mastercard payment.

Every order gets a unique **order number** (for example `YP-A1B2C3`).

### 2.4 After placing an order

- The customer lands on a **thank-you page** showing the order number and a
  simple progress timeline. For bank-transfer orders, the transfer instructions
  are shown here.
- Guest buyers also see a **"Save your details for next time"** card here:
  their email is already filled in from the order, so creating an account is
  just choosing a password. After they confirm the email link, the order (and
  any earlier guest orders with the same email) appears in their new account
  automatically. Signed-in buyers, and guests whose email already has an
  account (they're pointed to Sign in instead), don't see the signup form.
- They receive an **order confirmation email**.
- They can check progress anytime at the **Track page** (`/track`) by entering
  their order number and phone — no login needed. Once the order ships, the
  tracking number and courier link appear there. The **Track your order**
  button in the confirmation email opens the page with both fields pre-filled
  and runs the lookup automatically, so a single tap from the inbox shows
  status with no typing.

### 2.5 Customer accounts

Customers can shop as guests or create an account. A signed-in customer has:

- **My Orders** — their full order history, with status and tracking. Orders
  they placed as a guest with the same email are linked automatically. Each
  order has a one-tap **Buy again** button that drops the same items back into
  the cart. Lines whose product has since gone out of stock are dropped at
  the same time, and a small note under the button calls out anything that
  was skipped.
- **Addresses** — saved delivery addresses for faster checkout.
- **Rewards** — loyalty points earned from purchases, redeemable as a discount.
- **Profile** — their personal details and password.

### 2.6 Returns

On a **delivered** order, the customer can choose **Request a Return**, select
which items and give a reason. The request lands in your admin **Returns** queue
for you to approve or reject.

### 2.7 Reviews and the newsletter

- **Reviews** — a signed-in customer can leave a star rating and review on a
  product. It only appears publicly once you approve it in the admin. You can
  also **reply publicly** to any live review from admin → Reviews; the reply
  appears under the review as *"Response from Yellow Pink"* with its date —
  answering a complaint publicly shows every future shopper you look after
  customers.
- **Newsletter** — customers can subscribe via the footer sign-up form or the
  prompt shown after a purchase.

### 2.8 Getting in touch

A **floating "Chat on WhatsApp" button** sits in the bottom-right corner of
every page — one tap opens WhatsApp with a greeting pre-filled, so shoppers can
reach you live without leaving the site. It appears automatically once your
store number is set (Settings → Profile → store phone / WhatsApp).

The **Contact** page (linked in the footer) offers WhatsApp and a **contact
form**. A customer fills in their name, email, an optional subject, and their
message; on submit it's saved to the store and the owner is emailed a copy.
Staff then read and reply under **Admin → Messages**
([section 3.2](#32-the-sections)), where each customer's messages and your
replies are threaded into one conversation — you reply from the admin and it
goes out from your store address by email, all kept on record. This is the
path for non-order questions now that there's no shared support mailbox.

**Inbound email (optional).** Emails sent *directly* to your store address
(e.g. `hello@yellowpink.pk`) can also be funnelled into **Admin → Messages**
so they're answered in the same place — those rows carry an **Email** tag. It
uses **Resend** (already powering the store's outgoing email), so there's no
new provider to sign up for. One-time setup by whoever manages the domain:

1. **Resend → Domains** → enable receiving for `yellowpink.pk` and add the
   **MX record** it shows to your DNS.
2. **Resend → Webhooks** → add an endpoint for the **`email.received`** event
   pointing at `https://www.yellowpink.pk/api/inbound-email`, and copy its
   **signing secret** into the `RESEND_INBOUND_WEBHOOK_SECRET` Vercel
   environment variable, then redeploy.

Until that's done, only contact-form messages appear; direct emails are
unaffected. (`RESEND_API_KEY`, already set for sending, is reused to fetch the
message body.)

---

## 3. The admin panel — a tour

### 3.1 Signing in

Go to `/admin`. There are two kinds of login:

- **Owner** — signs in with the store password. The owner can see and do
  everything.
- **Staff** — sign in with their own email and password. Staff see only the
  sections their role allows (see [section 5](#5-team-roles--permissions)).

### 3.2 The sections

The left sidebar groups every area of the admin into six sections, ordered by
how often you'll need them — **Insights**, **Sell**, **Catalogue**,
**Customers**, **Marketing**, and **System** — so related tools sit together.
Here's what each link is for:

**Insights**

| Section | What it's for |
|---|---|
| **Dashboard** | Your command centre, laid out in the order a morning check actually happens — a **Today** row, a **Needs attention** queue, the Overview chart, quick stats and recent orders. Full breakdown in [Dashboard in detail](#dashboard-in-detail). |
| **Analytics** | Deeper performance data, organised as four question tabs — **Sales**, **Customers**, **Traffic** and **Funnels** — each opening with a computed "what stands out" reading. Full breakdown in [Analytics in detail](#analytics-in-detail). |
| **Finance** | Profit & loss for any period: revenue minus goods, delivery and payment-fee costs and your logged expenses, plus revenue breakdowns, ROAS and reconciliation tools. Full breakdown in [Finance in detail](#finance-in-detail). |
| **COD reconciliation** (a tab inside Finance) | The cash side of the business — outstanding, collected and in-transit COD money, with courier-manifest CSV exports. Covered in [Finance in detail](#finance-in-detail). |

**Sell** — day-to-day commerce operations

| Section | What it's for |
|---|---|
| **Orders** | Every order placed — saved-view tabs, sortable columns, split Payment/Fulfilment status chips, filters, CSV export and manual order entry. Full breakdown in [Orders in detail](#orders-in-detail). |
| **Products** | The catalogue — create, edit, publish, archive and delete products, with status tabs, column filters, bulk actions, per-row Duplicate and a CSV import/export round-trip. Full breakdown in [Products in detail](#products-in-detail). |
| **Inventory** | Stock levels. See low-stock items and adjust stock counts. Stock can never go below zero: if you remove more than is on hand, the adjustment is capped at zero, the ledger records the amount actually applied, and the page shows an amber warning telling you what was applied versus what you asked for. |
| **Returns** | Customer return requests and refund processing, with KPIs, status tabs and a three-step lifecycle (approve → receive & restock → refund). Full breakdown in [Returns in detail](#returns-in-detail). |
| **Vendors** | Your suppliers/fulfilment partners — commission rates that price orders automatically, headline balance cards, and payout settlement. Full breakdown in [Vendors in detail](#vendors-in-detail). |

**Catalogue** — how products are organised and presented

| Section | What it's for |
|---|---|
| **Collections** | Curated product groups, each with its own landing page (`/collection/<slug>`). **Manual** collections are a hand-picked, drag-ordered product list; **Smart** collections fill themselves from rules (e.g. *tag is viral* **and** *price ≤ 3000*) and stay current as products change. Set a title, description, hero image, SEO, and Draft/Published status. Draft collections are hidden from the storefront. |
| **Brands** | The brand pages (`/brand/<slug>`) — logo, description and SEO text for each brand you stock. **Search** by name or slug above the list, and the summary cards flag brands still needing a description, logo or hero image. |
| **Tags** | The tag vocabulary. Free-form labels (e.g. *viral*, *vegan*, *gift*) you attach to products for storefront filtering and curated edits. Create, rename (the storefront link stays stable), or delete a tag; deleting removes it from every product. The "N products" link jumps to the tagged products. |

**Customers** — the people you sell to and talk to

| Section | What it's for |
|---|---|
| **Customers** | Everyone who has bought from you — search, per-customer stats and order history, one-tap call/WhatsApp, and account deletion. Full breakdown in [Customers in detail](#customers-in-detail). |
| **Segments** | Customer groupings (e.g. high-spenders) for targeting and analysis. Each customer row links to their profile, and guests without an email are identified by their phone number so nobody drops out of the counts. |
| **Messages** | A threaded inbox for the storefront contact form and inbound email — reply by email straight from the thread, with order history in each conversation header. Full breakdown in [Messages in detail](#messages-in-detail). |
| **Reviews** | Moderate customer reviews, reply to them publicly, and seed reviews yourself. Full breakdown in [Reviews in detail](#reviews-in-detail). |

**Marketing** — content and campaigns

| Section | What it's for |
|---|---|
| **Coupons** | Discount codes — three types (Percent %, Fixed PKR, Free shipping), with limits, expiry and an on/off status pill. Full breakdown in [Coupons in detail](#coupons-in-detail). |
| **Blog** | Editorial posts shown in the storefront "Journal" and at `/blog`. Each post has an **Author** field for the byline (defaults to "Yellow Pink Editorial Team"); naming a real expert on health/beauty posts strengthens their search-engine trust signals. You can also attach a **Medical reviewer** (see below) to a health post, which adds a *"Medically reviewed by Dr. …"* byline and reviewer schema. |
| **Medical reviewers** (`/admin/reviewers`) | The panel of qualified doctors who medically review your health/supplement content — self-serve applications, approval, and their own reviewer dashboards. Full breakdown in [Medical reviewers in detail](#medical-reviewers-in-detail). |
| **Newsletter** | Compose and send newsletter emails. Manage the subscriber list directly — add, edit, unsubscribe, or resubscribe people. |

**System** — configuration and admin internals

| Section | What it's for |
|---|---|
| **Settings** | Store-wide configuration — see [section 6](#6-store-settings). |
| **Team** | Staff accounts and their roles. Owner only. |
| **Activity log** | The audit trail — every staff action (saves, deletes, status changes, sign-ins) with who did it and when. Owner only. |
| **Email log** | A record of every email the system has sent, each labelled by type (Order confirmation, Shipped, Abandoned cart, Newsletter, and so on) so you can see at a glance what went out. Open rates shown here are approximate, see [Email log in detail](#email-log-in-detail). |
| **Broken links** | Every URL on the store that returned a **404**, with one-click redirects, an ignore option and a daily digest of new breakages. Full breakdown in [Broken links in detail](#broken-links-in-detail). |
| **Indexing** | Search-engine indexing status and tools — see which pages have been submitted to Google/Bing and resubmit after big content changes. |

### Dashboard in detail

Your command centre, laid out in the order a morning check actually happens.

- **Today row** — opens the page: sales, orders, average order value (and visitors once Google Analytics is connected) for the current day, each with a 14-day mini-trend and a comparison pill against **the same weekday last week** (the fairest daily baseline; an early-morning "down" is normal since it compares against last week's full day).
- **Needs attention** — directly below, a card listing everything waiting on a human: payment-pending orders stuck over 24 hours and unconfirmed orders over 3 days old (red), plus return requests awaiting approval, unread customer messages, and reviews awaiting moderation (amber). Each row deep-links to the filtered list so you can clear it in one click; the card hides when there's nothing to clear.
- **Overview chart** — interactive: sales/orders/AOV/sessions over 7/30/90 days vs the previous period.
- **Quick-stat cards** — *Orders to fulfil* (jumps straight to the To fulfil tab), *Low stock items*, *New customers*.
- **Recent Orders** — with the same split Payment/Fulfilment chips as the orders list — plus low-stock alerts, order-status and top-product breakdowns.
- **Product finder quiz funnel** — starts, completions, emails captured, and most-recommended products — lives in a collapsed **More insights** section at the bottom; click to expand.

### Analytics in detail

Deeper performance data, organised as **four question tabs**:

- **Sales** (am I selling more?) — revenue/orders/AOV cards with mini-trends and change vs the previous window, the revenue chart, orders by status with links into the filtered list, and top products.
- **Customers** (who buys and do they return?) — unique customers, repeat-purchase rate, RFM segments, cohort retention.
- **Traffic** (is anyone finding us?) — the SEO trend, live **Search Console** and **Google Analytics 4** panels once you **Connect Google** in Settings → Integrations, and Core Web Vitals. Below those, an **on-site behaviour** block reads the rolling 7-day PostHog snapshot: top pages, top events & sources, a **device & browser** split (phone vs desktop, and which in-app browsers — Instagram/WhatsApp webviews — people arrive in), an **engagement** panel (pages per session, average session length, bounce rate) with the top **landing pages**, and a **Where visitors are** panel of the top cities and countries — the Pakistan-vs-international split that shows how much traffic can actually convert to COD. A final **Demand & product interest** block shows the top on-site **search terms** (what people type into the store search — a direct read on demand and catalogue gaps) and the **most-viewed products with their view→cart rate**, so a product pulling lots of views but no carts (a pricing/photo/description problem) is flagged for you to fix.
- **Funnels** (where do shoppers leak?) — the conversion funnel, funnel-by-source and funnel-by-device, top user journeys, weekly active users, and PostHog session recordings.

The Sales and Customers tabs open with a short **"what stands out"** strip — plain-language observations computed from the same window (e.g. *"Revenue is up 23% vs the prior 30 days"*, *"X alone drove 18% of this window's revenue"*) — so the numbers come with their own reading. The date-range pills (7/30/90 days, 1 year) apply across tabs.

### Finance in detail

Profit & loss for any period (7/30/90 days or all time): revenue from paid orders, minus **cost of goods** (COGS), delivery and payment-fee costs → gross profit, minus your logged expenses (ad spend + overheads) → **net profit and margin**.

**Where COGS comes from.** COGS comes from each order's **Acquisition cost / COGS**, which the system fills in **automatically the moment you select a fulfilment vendor on the order**: the vendor's commission % (set on the Vendors page) determines the goods cost — e.g. at 12.5% margin a PKR 2,000 order costs you PKR 1,750 — unless a product carries its own fixed **Vendor cost** or **Cost price** (Products → a product → *Vendor & sourcing*), which win for that item. The *Order costs* card on each order shows where its number came from ("Auto-filled from …" / "Entered manually") and you can always type the **actual** figure yourself — a manual value is never overwritten by a re-dispatch, and a **Recalculate from vendor rate** button restores the automatic one. Orders with no acquisition cost fall back to the old estimate: vendor items use the vendor cost from their settlement, and own-stock items use the product's **Cost price** — so set a cost price on own-stock products so their profit is real instead of showing as 100% margin.

On the page:

- **Revenue by payment method** — orders, revenue and gross profit per method (Cash on Delivery, Bank Transfer, JazzCash, etc.).
- **Revenue by account** — where payments actually landed once reconciled (with a count of orders still awaiting confirmation).
- **Orders in this period** — each order's total, costs, gross profit and margin (latest 100, filterable by payment method and exportable to **CSV**).
- **Awaiting payment confirmation** — flags non-COD orders not yet reconciled.
- **ROAS** (return on ad spend) by traffic source.
- **Expenses** — log ad spend and overheads in this table.

Enter each order's acquisition (goods), delivery and payment-fee cost on the order page (*Order costs*), where an **Order profit** summary then shows that order's net profit and margin. On each order you can also record **Payment received** — pick which of your configured accounts (Settings → Payments) the money landed in and the date; this feeds *Revenue by account* and the awaiting-confirmation count, and is for reconciliation only (it doesn't change the order status).

**COD reconciliation** — a tab inside Finance (switch between **Overview** and **COD reconciliation** with the tabs at the top of the page) — shows the cash side of the business at a glance:

- **Outstanding** — delivered COD orders waiting for you to confirm cash received.
- **Collected** — delivered and reconciled.
- **In transit** — still out for delivery: your expected cash to come.

Open any order to record the payment. Two CSV exports — **Download CSV** for the full active COD list (a courier/route manifest) and **To-collect only** for the outstanding subset — open cleanly in Excel.

### Orders in detail

Every order placed.

- **Saved-view tabs** across the top — *All · To fulfil · Unpaid · Shipped · Delivered · Cancelled* (plus a More… menu for the rarer statuses) — jump straight to the work: *To fulfil* is everything still yours to action, *Unpaid* is live orders whose payment you haven't reconciled yet.
- **Sort by any column** — click the *Order # / Date / Customer / Total* headers to sort (click again to flip direction, a third time to reset to newest-first; the arrows show the active direction), and on phones a **sort dropdown** sits above the order cards.
- **Two separate status chips** on each row, Shopify-style: **Payment** (Paid / COD — on delivery / Payment pending / Awaiting gateway / Failed / Refunded) and **Fulfilment** (Unfulfilled / Shipped / Delivered / Cancelled), plus the item count and the customer's city.
- **Filters** — by **date range** (Today / Last 7d / Last 30d / Last 90d / All time — "Today" is the calendar day in Pakistan time) and by search across order number, name, email or phone.
- **Age pills** — unfulfilled rows (pending / processing / payment_pending) get a coloured pill next to their date — amber when they've sat too long, red when they're at risk — so a stale order jumps out without reading every date.
- **Export CSV** — downloads the currently filtered list (needs the *Orders — View* permission; it tells you if there's nothing to export or the export fails).

Open an order to process it (see [section 4](#4-processing-a-sale--the-order-workflow)). With the *Orders — Delete* permission, an order page has a **Danger zone** to permanently delete that order (and its payment/shipment/settlement records) — useful for removing test orders; it can't be undone.

**Manual order entry.** A **+ New order** button (also in the Cmd K palette as "New order") opens manual order entry for orders taken over WhatsApp, phone, or DMs: search-and-add products (quantities and unit prices are editable, so an agreed special price is fine), enter the customer's delivery details, and the shipping charge is suggested from your shipping zones (editable — set it to 0 for free delivery) along with an optional manual discount. If a supplier will fulfil the order, pick them in **Fulfilled by vendor** — the form previews the estimated vendor cost and your margin from the vendor's commission %, and the created order gets its acquisition cost and settlement recorded automatically (nothing is sent to the vendor yet — use the order page's WhatsApp dispatch for that). Stock is reserved through the inventory ledger exactly like a storefront order, the order appears in the list marked as a manual order for reporting, and if you enter the customer's email you can tick a box to send them the standard confirmation email.

### Products in detail

The catalogue. Create, edit, publish, archive, and delete products; manage variants, images, an optional **short product video** (drag-drop or browse — MP4/WebM, max 30 MB; shown as a tap-to-play gallery slide), pricing, and descriptions. Saving a **new** product now lands you straight on its edit page (variants, tags and extra images are only editable there), with a note confirming it was created. Each product page also has a **Tags** box — type to add a free-form tag (creating it if new) or reuse an existing one.

- **Status tabs** across the top — *All · Published · Drafts · Archived*, each with a live count — let you see and manage draft vs live products at a glance (only Published items show on the storefront; Drafts are hidden until you publish them).
- **Column filters** sit beside them: search by name/brand, and filter by **category**, **brand**, **stock state** (in stock / low / out / externally managed), **tag**, and a **price range** — all combine, and the filtered view is shareable via the URL.
- **Bulk bar** — tick rows to reveal it: *Publish*, *Set draft*, *Archive*, set/clear tag, adjust price by %, or delete. Price and stock cells, and each row's status, are editable inline.
- **Duplicate** — every row has a Duplicate button that deep-copies the product (variants, tags, gallery images and related-product links included) into a new **draft** named "… (copy)" and opens it for editing — the fastest way to add a product that's similar to an existing one.
- **Export CSV / Import CSV** — the spreadsheet round-trip: Export downloads the whole catalogue (all statuses) as one file whose columns match the importer, so you can mass-edit prices, stock or statuses in Excel and re-import the same file — rows are matched by their `slug` column, so don't edit that column.

The product form has a **Status** field (Basics section): new products start as **Draft**, so nothing goes live — or gets submitted to search engines — until you switch it to *Published*. Deleting a product that has ever been ordered archives it instead of removing it, so order history and analytics keep the product's name.

There's also a **Packaging** field (Basics section) for genuine stock supplied without full retail packaging: choose **Standard (boxed)** for normal units, **Tester** for manufacturer perfume testers, or **Without box** for originals sold minus the box. Anything other than Standard shows a small badge on the product card *and* a clear, authenticity-first disclosure on the product page (e.g. *"Tester unit — 100% genuine, may arrive without the full retail box"*), and shoppers can filter by it on brand/collection pages. Products marked **Tester** automatically flow into the **Perfume Testers** collection (Admin → Collections) — that collection ships as a **Draft**, so publish it once you've flagged some tester stock and it will fill itself.

### Returns in detail

Customer return requests and refund processing, with KPIs (volume, refunded total, 90-day return rate) and most-returned products/reasons. **Status tabs** across the top (All · Pending · Approved · Received · Refunded · Rejected, with a count) jump straight to the queue you need. The sidebar shows a badge with the count of requests awaiting a decision.

The lifecycle:

1. **Approve** (set the refund amount and method) or **Reject** a pending request.
2. **Mark as received & restock** when the parcel arrives back — restores the items to stock and moves the order to *Returned*.
3. **Mark as refunded** once the money or store credit has actually gone out — moves the order to *Refunded*, so its revenue drops out of Finance/Analytics.

### Vendors in detail

Your suppliers/fulfilment partners. Add vendors with their **commission %** (the share of the sale price *you* keep) and settlement direction (who collects the customer's payment). The commission **applies automatically the moment you select the vendor on an order** (see [section 4, step 2](#4-processing-a-sale--the-order-workflow)): it computes the vendor cost and your margin, records the settlement, and auto-fills the order's acquisition cost with the same figure — no WhatsApp message required. A product can also name this vendor as its **default supplier** (product page → *Vendor & sourcing*), which groups Inventory reorder suggestions by vendor and makes order pages suggest them one-click.

The page opens with three headline cards — **Owed to you** (pending margin vendors are holding), **You owe** (vendor costs to pay out), and **Margin earned** across all payouts — and each vendor row shows their outstanding balance with a one-click **Settle all** (one bank transfer usually clears the whole balance; individual payouts can still be settled or reopened in the **Payouts** table below, which now shows each payout's date). Vendor phone numbers are one-tap **WhatsApp** links. If an order ever ends up assigned to a vendor without a payout recorded, an amber warning appears at the top naming the orders and how to rebuild them — in a healthy system you'll never see it.

### Customers in detail

Everyone who has bought from you. Each row carries a **Registered** badge (the shopper created an account) or a **Guest** badge (they checked out without one). Search by name, email or phone, and open any customer to see their orders and lifetime spend.

The customer page shows four stats — **Orders / Delivered / Total spend / Avg order** (total spend and average exclude cancelled, refunded, returned and payment-failed orders so they reflect realized revenue) — plus a tap-to-call phone link and a one-tap **WhatsApp** button that opens chat with a Yellow Pink greeting pre-filled.

Guests are grouped by email (a guest's repeat orders show as one customer); if a guest later signs up with the same email, their orders move under that account automatically. With the *Customers — Delete* permission, a registered customer's page has a **Danger zone** to permanently delete their account; their orders are kept (detached as guest orders) so revenue history stays intact. Guests have no account to delete — remove their orders individually instead.

### Messages in detail

A **threaded inbox** for the storefront **contact form** and **inbound email** (direct emails to your store address show an **Email** tag). Messages are grouped into **conversations by customer**, shown as a chat (their messages on the left, your replies on the right).

- **Order history at a glance** — each conversation's header shows how many orders the customer has placed, their lifetime total, and the latest order with its status (e.g. *3 orders · PKR 12,400 · last: YP-1042 (shipped)*), so you know who you're talking to before you reply; click it to open their filtered order list.
- **Reply right here** — the box at the bottom of a conversation sends your reply **from your store address via email**, and the reply is saved into the thread, so the whole exchange stays on record. When the customer replies, it threads back into the same conversation automatically.
- **Per-conversation actions** — **Mark read** / **Archive** / **Restore**, and a **search box** above the inbox finds a thread by customer name, email or subject.
- **Notifications** — the Messages menu item shows a pink badge with the unread count, and the bell notifies on new **incoming** messages (your own replies don't notify).

### Reviews in detail

Moderate customer reviews and talk back to them. The **Pending Approval** queue always sits at the top (the sidebar shows a badge with its count); below it, **All Reviews** is searchable (name or review text), filterable by **product** and **status**, and paginated — no more silent cap at the last 20. The search/product/status filters apply as you type — no Filter button.

On any live review, **Reply publicly** posts a *"Response from Yellow Pink"* that appears under the review on the product page (edit or clear it any time — saving an empty box removes it). You can also seed reviews yourself (migration / phoned-in feedback) via the **+ Add review** button in the page header.

### Coupons in detail

Discount codes — create, edit, set limits and expiry, and turn them on/off. Three types:

- **Percent %** — a percentage off the items.
- **Fixed PKR** — a set amount off.
- **Free shipping** — waives the delivery charge instead of discounting the items (no value needed).

If a create is rejected (missing value, duplicate code, …) the form keeps what you typed and shows the reason inline. Each coupon's status pill shows its one effective state — *Active*, *Inactive*, *Expired* or *Maxed out* — and clicking it toggles the coupon on/off.

### Medical reviewers in detail

Found at `/admin/reviewers`: the panel of real, qualified doctors who medically review your health/supplement content (the strongest E-E-A-T trust signal). Doctors **apply themselves** via the public form at `/medical-review-board/apply`; their applications appear here under **Pending applications** with the credentials and PMDC number they entered. **Verify the credentials, then Approve & invite** — that publishes their profile on the public [review board](/medical-review-board), provisions a passwordless (magic-link) sign-in, and emails them a link to their own **reviewer dashboard** (`/reviewer`), where they manage their profile and see the articles credited to them.

You can also add a reviewer manually, set a **default** reviewer (the fallback byline for health posts with no explicit reviewer), and reorder or hide the board. **Only approve genuine, consenting clinicians.**

### Broken links in detail

Every URL on the store that returned a **404**, captured automatically the moment a visitor or search-engine crawler hits it (aggregated per URL with a hit count, last-seen time, and where the click came from). For each one you can:

- **Add a redirect** — type where it should go and it's live within a minute, **no deploy**.
- **Ignore** it — a 404 for genuinely removed content is perfectly fine and doesn't hurt ranking.

You also get a **daily email digest** of any *new* broken links so nothing slips past.

### Email log in detail

A record of **every email the system sends** — to customers and to you. Each row shows the recipient, the subject, a plain-English **Type** (Order confirmation, Shipped, Delivered, Abandoned cart, Newsletter, Review request, and so on), the delivery status, and when it was sent. Search by recipient or subject, filter by status (Sent / Failed / Skipped), and page back through history.

- **Abandoned-cart reminders show up here too.** The store automatically emails shoppers who leave a full cart behind — a gentle nudge after an hour, another after a day, and a last-chance note (with a discount code) after three days. Every one is logged with the type **Abandoned cart**, and once a day the notification bell tells you how many went out, so you always know the recovery emails are working without digging through the log.
- **Open rates are approximate.** "Opened" is tracked by a tiny invisible image the mail app has to load, and many apps block or pre-load it (Apple Mail Privacy Protection, Gmail's image proxy, image-blocking). Real opens are almost always higher than shown, and some are counted automatically. Treat **Delivered** and **Clicked** as the dependable numbers and opens as a rough floor.

> **If a save fails, you'll be told.** Across the admin (products, variants,
> vendors, coupons, and bulk product actions), a save or delete that
> can't be completed shows a red banner or toast with the reason — the form
> never just clears silently. If you see one of these messages repeatedly,
> copy the text and share it with your developer.

> **Jump anywhere with one keystroke.** Press **Cmd K** (Mac) or **Ctrl K**
> (Windows / Linux) from any admin page to open the command palette — start
> typing the name of a section ("orders", "settings", "cod") and press Enter
> to go there. Press **?** to see the full list of keyboard shortcuts.

---

## 4. Processing a sale — the order workflow

This is the core day-to-day task. When an order comes in, open **Orders**, find
it (new ones show a red count badge on the Orders menu item), and click it to
open the **order detail page**. From there:

**Step 1 — Confirm with the customer.**
Tap the **WhatsApp** button at the top of the order. It opens WhatsApp with a
branded confirmation message to the customer, pre-filled with their order
number, itemised products, total and payment method, and delivery address, and
it asks them to reply to confirm the details are correct. Once they confirm,
click **Mark customer-confirmed** to record it.

The email field is optional at checkout, and email is the only *automatic*
channel — so when a customer skipped it, the order page's Customer card shows
an amber **"No email — this customer receives no automatic updates"** note.
That order gets no confirmation or shipping emails at all; the WhatsApp button
above is their only update channel, so don't skip it for these orders.

**Step 2 — Assign a vendor (if you fulfil through one).**
In the *Confirmation & vendor* section, pick the vendor in **Fulfilled by
vendor**. **The selection itself does the money work, immediately**: the
order's **goods cost** is computed from the vendor's commission % (or a
product's fixed *Vendor cost* / *Cost price* where set), the **settlement**
(vendor cost, your margin, who owes whom) is recorded, and the same figure is
auto-filled into the order's *Acquisition cost / COGS* — a toast confirms the
amount, and the *Order costs* card labels it "Auto-filled from …" so you can
see the basis. The dropdown starts at **"No vendor (own stock)"** until you
assign one, and switching back to it removes the settlement and an auto-filled
cost again. If the order's products name a **default supplier** (set on the
product page under *Vendor & sourcing*), the picker suggests them with a
one-click **Set as fulfilment vendor** button. If you've already typed a cost
by hand, assigning a vendor leaves it alone (the toast says so); use
**Recalculate from vendor rate** on the costs card to apply the automatic
figure. Once a vendor is assigned, a ready-to-send **WhatsApp** message with
the items and delivery address appears — sending it is just the messaging
step, recording the "sent" timestamp; the money side is already done.

**Step 3 — Book the shipment.**
In the *Shipment* section, record the courier and tracking number. If a courier
has an API connection set up, a one-click "book pickup" button is available;
otherwise enter the courier and tracking number manually. Either way you can
also type the optional **Courier charge (PKR)** — what the courier bills you
for this parcel — and it is saved as the order's *Delivery cost* for Finance
(if a delivery cost is already recorded, the form shows it instead; change it
in *Order costs*). Booking (either way)
automatically moves the order to **Shipped** and emails the customer their
shipping notification with the tracking number — the confirmation under the
form says so ("Order marked shipped + customer emailed"), and you don't need
to change the status by hand in Step 4. An order that is already Shipped or
Delivered is left alone and the customer is not emailed twice.

**Step 4 — Move the order through its statuses.**
Use the **Update Order** control — at the **top-right of the order page**, next
to the payment summary, so it sits beside the status badge it changes — to move
the order's status as it progresses:

- **Order received** → the order is placed and awaiting preparation.
- **Preparing** → you're packing/preparing it.
- **Shipped** → it's handed to the courier.
- **Delivered** → the customer has received it.
- **Cancelled** → the order won't be fulfilled.

Each change is recorded in the order's **timeline** along with who made it
(the owner or the staff member's email), and the customer is emailed
automatically at the key steps (for example, a shipping email with their
tracking number when you mark the order *Shipped*). Bulk status changes from
the Orders list send the same emails — marking twenty orders *Delivered* from
the bulk bar notifies all twenty customers, exactly as if you'd updated each
order individually.

**Step 5 — Settle with the vendor (if used).**
If the order went to a vendor, a settlement summary shows the vendor cost, your
margin, and who owes whom — all derived automatically from the vendor's
commission % (see Step 2). Mark it **settled** on the Vendors page once that
payment is done.

**The rest of the order page** also shows the customer's details (with a
"repeat customer" badge and lifetime spend if applicable), the shipping address,
the items, the full status timeline, a payment summary, and a **Print Invoice**
button. The customer's phone is a tap-to-call link, the email is a `mailto:`
link, and the shipping address has an **Open in Maps ↗** link that opens
Google Maps with the address pre-filled — handy when handing off to a courier
or sanity-checking a delivery zone. If a customer reports they didn't get the
order confirmation email, the email field has a **Resend confirmation email**
button right next to it (gated on Orders — Manage); the resend is recorded in
the Activity log.

> **Tip:** cancelling an order — from the order page or via the bulk bar on the
> Orders list — automatically returns its items to stock. Because of that (and
> because the customer is emailed), both cancel paths ask you to confirm first.

---

## 5. Team, roles & permissions

The **owner** has unrestricted access (and appears pinned at the top of the
Members list — the owner signs in with the store admin password, not a staff
account). Everyone else is a **staff member** with a login, managed under
**Team** (owner only). The page has two tabs: **Members** and **Roles**.

- Each staff member is given a **role** — a named bundle of permissions — or a
  custom set of permissions chosen individually. The permission checklist is
  grouped exactly like the admin sidebar (Insights / Sell / Catalogue /
  Customers / Marketing / System) and each permission lists which sidebar
  sections it unlocks, so what you tick is what they see.
- **Built-in roles** now do exactly what their descriptions say: **Manager**
  (everything except Finance, Settings and System tools), **Customer support**
  (view/manage orders, view customers, returns, messages — no deletes),
  **Inventory** (view/edit products, no deletes), **Marketer** (blog,
  newsletter, coupons, reviews, sales + traffic analytics).
- The Members list shows each person's **2FA** status and **last sign-in**.
  After signing in, staff land on the first section they can actually open —
  not on a restricted dashboard.
- **Reset Password** signs the person out everywhere immediately and issues a
  temporary password they must replace at their next login. **Reset 2FA**
  (shown when they have 2FA on) clears their authenticator so they can re-enrol
  — use it when a phone is lost. **Deactivate** blocks their login instantly
  while keeping their history in the activity log.
- Deleting a role never strips anyone's access: members holding it keep the
  same permissions as a "Custom" set. The Roles tab shows how many members each
  role has before you touch it.

To add someone: **Team → Add Staff Member**, enter their name and email, pick a
role, and save. They receive a temporary password to sign in with; they're
required to set their own password on first login.

---

## 6. Store settings

**Settings** (`/admin/settings`) splits into eight focused sub-pages, each
reachable from the left rail. Open Settings and the rail shows where to go for
what — pick a page, edit, hit **Save changes** at the bottom.

| Sub-page | What it controls |
|---|---|
| **Store profile** (`/admin/settings/profile`) | Store name, currency, contact email and phone, and links to your social profiles (used in the footer and for search-engine data). |
| **Branding & theme** (`/admin/settings/branding`) | Brand colours (pink, yellow, ink) and the **Seasonal Theme** — a one-switch makeover (palette, motif, hero) for Eid, Christmas, etc. |
| **Homepage** (`/admin/settings/homepage`) | The big **Homepage Hero** (wording, buttons, image), the store-wide **Sale** on/off switch, and the thin **Announcement Bar** at the top of every page. The hero's **Trusted-brand logos row** is a visual picker: click real brand logos (pulled from the Brands page, ranked by how many products each brand has) to add or remove them, with a live preview of exactly what will show — no more typing brand names and hoping the spelling matches. |
| **Shipping & tax** (`/admin/settings/shipping`) | An **Offer free shipping** master switch, a **default fallback** rate + free-shipping threshold (used only when an address matches no zone), tax rate, and the **shipping zones** — the real engine. Each zone carries the **provinces it covers** (tick-boxes), the **rate you charge**, **your courier cost**, a **free-delivery threshold**, and estimated days. Checkout picks the zone automatically from the customer's province and charges that zone's rate; each zone's free threshold is applied on its own. When you set a rate **below your cost**, the editor shows a **live red margin warning** so you never quietly under-price a region. The current setup (from your Lahore origin): **Zone 1 Punjab & Islamabad — Rs 250, free over 5,000**; **Zone 2 Sindh & KPK — Rs 350, free over 7,000**; **Zone 3 Balochistan/AJK/Gilgit-Baltistan — Rs 450, free over 10,000**. The master switch and thresholds flow through the whole site — product page, cart, mini-cart, checkout and the Shipping Policy page (which renders a live zone table) — so nothing shows a stale number. |
| **Payments** (`/admin/settings/payments`) | Turn each payment method on or off, and manage the bank/wallet accounts shown to customers paying by transfer. |
| **Loyalty** (`/admin/settings/loyalty`) | How customers earn and redeem loyalty points, and the **refer-a-friend** rewards (points to the referrer, a first-order discount to the friend). Referral links now work end-to-end: when someone arrives on a `?ref=<code>` link the code is remembered for 90 days and, once they place their first order while signed in, it is stamped onto their profile so the referrer is paid out when that order is delivered. |
| **Notifications** (`/admin/settings/notifications`) | Two channels. **Push notifications on your phone** — install the admin as an app (your browser offers **Install app**; on iPhone use Safari's *Share → Add to Home Screen*), then press **Enable on this device**: every admin alert (new order, payment failed, low stock, new review, return request) arrives instantly as a phone notification, and tapping it opens the right admin page. Enable it on as many devices as you like; the device list shows who added each one, and **Send a test notification** proves the pipe works. **Email recipients** — add staff email addresses and pick which alerts each receives — **New orders** (every order, immediately) and **Broken links (404s)** (daily digest of newly-broken URLs). If nobody is configured for an event, the alert falls back to the `OWNER_EMAIL` env var so existing behaviour is unchanged. |
| **Integrations** (`/admin/settings/integrations`) | Live status for every third-party service the store uses — Resend (email), PostHog, Sentry, Upstash, JazzCash, Easypaisa, Search Console, Meta Pixel, WhatsApp. Each card shows whether its env vars are set and (for analytics services) when data last synced. Secret values are never displayed. This is also where you paste the **Search Console** and **Meta (Facebook/Instagram) domain-verification** codes — the latter is required in Meta Business Manager before you can run conversion ads. Medical reviewers are managed on the **Medical Review Board** (Marketing → Medical Review Board), not here — that's the single place to add doctors, set a default, and assign them per article. Finally, **Connect Google — live data & indexing**: once a Google Cloud OAuth app is set up (one-time; the card walks you through enabling the Search Console + GA4 APIs and the redirect URI to register), click **Connect Google account** to sign in. It auto-links your Search Console property and GA4 property, and a **Submit sitemap to Google** button (re)submits your full sitemap so Google re-crawls every page. *(Note: Google has no API to force-index individual pages — submitting the sitemap is the supported, scalable way to push pages for indexing; Google still decides what and when.)* |

Saved changes apply to the storefront within a few minutes (storefront pages
are cached for speed).

> **Note on banners.** The storefront has one banner: the thin
> **announcement bar** at the top of every page, managed in
> **Settings → Homepage** (message, colour, on/off). There is no separate
> campaigns/promos section.

---

## 7. Marketing & acquisition

The store is technically ready to advertise — the pieces below are already built
and live. What's left is operational: connecting the accounts and running
campaigns. Once traffic is flowing, the **Analytics → Customers & Traffic** tab
(funnel by source, funnel by device) shows what's working.

### Product feeds (Google Shopping & Meta/Instagram Shop)

Two always-up-to-date product feeds are published automatically — no manual
export. They refresh hourly from your live catalogue (published products with an
image).

| Channel | Feed URL | Where to submit it |
|---|---|---|
| **Google Shopping** | `https://www.yellowpink.pk/feeds/google-merchant.xml` | Google **Merchant Center** → Products → Feeds → add a *scheduled fetch* feed (daily is fine) |
| **Meta (FB/IG) Shop** | `https://www.yellowpink.pk/feeds/meta-catalog.xml` | Meta **Commerce Manager** → Catalog → Data sources → *Use a data feed* (scheduled) |

Each item carries title, description, price (with sale price when on offer),
availability, brand, image, and a valid Google product category. Products with no
brand set, or no photo, are weaker in Shopping — fill those in on the product
page for best results.

### Measuring ad spend (attribution & ROAS)

So the **Funnel by source** widget can credit revenue to the channel that earned
it, every campaign link you create **must be UTM-tagged**. Add these to the
destination URL:

```
https://www.yellowpink.pk/product/<slug>?utm_source=facebook&utm_medium=cpc&utm_campaign=spring-sale
```

- `utm_source` — where it ran: `facebook`, `instagram`, `google`, `tiktok`, …
- `utm_medium` — the type: `cpc` (paid), `social`, `email`, …
- `utm_campaign` — your name for the campaign: `spring-sale`, `eid-2026`, …

The store captures these on arrival, keeps them through the visit, and stamps
them onto the order, so paid orders are traceable back to the campaign. Meta's
ad **Pixel** also fires the standard events (ViewContent, AddToCart,
InitiateCheckout, Purchase) once `NEXT_PUBLIC_META_PIXEL_ID` is set in the
hosting environment and the visitor accepts marketing cookies.

For the most accurate ad measurement, two more (optional) settings:

- **Meta Conversions API** — set `META_CAPI_ACCESS_TOKEN` (a secret, generated
  in Meta Events Manager) and the server will send the Purchase event directly
  to Meta. This is measured even when the browser Pixel is blocked, and it's the
  **only** purchase signal for JazzCash/Easypaisa orders (the shopper completes
  payment off-site, so the browser never fires it). It's automatically deduped
  with the Pixel using the order number.
- **Google Ads** — set `NEXT_PUBLIC_GOOGLE_ADS_ID` (`AW-…`) to switch on
  remarketing audiences, and add `NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL` to
  record purchases as a Google Ads conversion. (GA4 already gets every commerce
  event via `NEXT_PUBLIC_GA_MEASUREMENT_ID`.)

All of these live in the hosting environment variables — see `.env.example` for
the exact names and where to find each value.

### Discount codes in ad links

Any campaign link can carry a coupon that **auto-applies** for the shopper —
add `&coupon=CODE` to the URL (e.g.
`…/product/relief-sun?utm_source=instagram&utm_medium=cpc&utm_campaign=eid&coupon=EID20`).
The code is validated and applied to their cart automatically and sticks all the
way to checkout, so the ad's promised discount is already in place — no "enter
code" friction. Create the code first under **Coupons** (it must be active);
`?discount=` and `?code=` work as aliases. Eligibility (minimum order, per-user
limits) is still enforced at checkout. Pair it with the UTM tags above and the
**Funnel by source** widget shows how each campaign converts.

### AI assistants (ChatGPT etc.)

A small but growing slice of visitors already arrive from AI assistants. The site
publishes an `llms.txt` summary and structured product data to help them
recommend the store accurately — nothing to do here, but it's worth keeping
product descriptions clear and factual since that's what these tools read.

---

## 8. Reference

### Order statuses

| Status | Meaning |
|---|---|
| Awaiting payment | Card or bank-transfer order placed; we're waiting for payment to clear before preparation begins. |
| Payment failed | Card or bank-transfer payment attempt failed; the order will not be prepared until payment succeeds or the customer is contacted. |
| Order received | Order placed and paid (or COD); ready to start preparation. |
| Preparing | Being packed / prepared. |
| Shipped | Handed to the courier; customer emailed with tracking. |
| Delivered | Received by the customer. |
| Cancelled | Will not be fulfilled; stock is returned. |
| Returned | Customer returned the order after delivery. |
| Refunded | Money has been returned to the customer (typically follows Returned or Cancelled). |

These are the labels shown throughout the admin (the order list, filters, the order page, the quick-action buttons on a mobile order card, and the customer's order history) — all driven from one shared set so they never disagree.

### Glossary

- **Order number** — the customer-facing code for an order, e.g. `YP-A1B2C3`.
- **Variant** — a specific version of a product, such as a shade or size.
- **Vendor** — a supplier or fulfilment partner an order can be dispatched to.
- **Settlement** — the money owed between you and a vendor for an order.
- **Coupon** — a discount code a customer enters at checkout.
- **Segment** — a saved group of customers used for targeting.
- **Permission** — a capability that controls which admin sections a staff
  member can use.

### Search Console, Analytics & Merchant Center

Three Google products work together to give you traffic, conversion, and
shopping data. They're one-time setups — once each is wired you don't touch
them again.

**Search Console (organic search visibility)**

1. Open Search Console → *Add property* → **Domain** → enter `yellowpink.pk`,
   follow the DNS TXT verification it gives you.
2. Once verified, go to **Sitemaps**, paste `https://www.yellowpink.pk/sitemap.xml`,
   click **Submit**. The status should change to *Success* within minutes.
3. To speed up indexing of new products, use **URL Inspection** at the top:
   paste any product URL → *Request indexing*. Google crawls it within a few
   days instead of the usual few weeks.
4. The dashboard's *Products* and *Merchant listings* tiles show counts of
   pages Google has validated, not your full catalogue. Numbers grow as
   Google crawls; the sitemap submission above is what drives that.

**Automatic search-engine indexing (built in)**

You don't have to manually "Request indexing" for every page — the store pings
search engines for you through two channels:

- **IndexNow** (Bing, Yandex, Naver) — works out of the box, nothing to set up.
- **Google Indexing API** — optional. It stays off until you add a Google Cloud
  service-account key (env var `GOOGLE_INDEXING_CREDENTIALS`) and add that
  service account as an *Owner* in Search Console. Until then, Google still
  discovers pages via the sitemap above.

How it's used:

- **Automatic** — whenever you publish or edit a product or a blog post, its
  URL is submitted automatically.
- **Per page** — the product and blog editors have a **Submit to index** button
  to re-send a single page on demand.
- **Whole site** — the Blog list page has a **Resubmit all to index** button
  that sends the entire live catalogue and blog to IndexNow in one go.

A small toast confirms each submission and shows which channels accepted it.
(Note: Google's direct API has a small daily quota and officially targets
job/event pages, so the "resubmit all" button uses IndexNow only; Google is
pinged per page on publish.)

**Blog management API (for automation / AI content pipelines)**

Besides the admin editor, the journal can be managed programmatically over a
small HTTP API — handy for bulk imports, a publishing schedule, or an AI
content pipeline that drafts and posts articles. It's **off until you set a
token**, so it can never be left open by accident.

1. Generate a long random token (e.g. `openssl rand -hex 32`).
2. In Vercel → Project → Settings → Environment Variables, add
   `BLOG_API_TOKEN` = that value for Production, and redeploy.
3. Every request must send the header `Authorization: Bearer <token>`. While the
   variable is unset, the endpoints return `503`.

Endpoints (base `https://www.yellowpink.pk/api/blog`):

| Method & path | What it does |
|---|---|
| `GET /api/blog` | List posts, newest first. Filters: `?category=`, `?featured=true`, `?q=` (title/excerpt search), `?limit=` (max 100), `?offset=`. |
| `POST /api/blog` | Create a post. JSON body: `title`, `slug`, `excerpt`, `category` required; optional `body`, `image_url`, `author`, `read_time`, `featured`, `date` (defaults to today). |
| `GET /api/blog/{id-or-slug}` | Fetch one post. |
| `PATCH /api/blog/{id-or-slug}` | Update any subset of fields. |
| `DELETE /api/blog/{id-or-slug}` | Delete a post. |

To attach a **featured image**, set `image_url` to a hosted URL. If your
automation has the image as a file, upload it first via `POST /api/media`
(same `Authorization: Bearer` token; send `multipart/form-data` with a `file`
field — JPG/PNG/WebP/AVIF, up to 5 MB). It returns `{ "url": "…" }`; pass that
back as the post's `image_url`. This keeps the whole flow API-only — no admin
session needed.

Posts created or edited this way go live immediately and are auto-submitted to
the search engines, exactly like the admin editor. A duplicate slug returns
`409`; invalid fields return `422` with details.

**Google Analytics 4 (visitor behaviour)**

1. In GA4, *Admin* → *Property* → *Data Streams* → *Add stream* → *Web*. Use
   `https://www.yellowpink.pk` as the stream URL.
2. Copy the *Measurement ID* (looks like `G-XXXXXXXXXX`).
3. In Vercel → Project → Settings → Environment Variables, add
   `NEXT_PUBLIC_GA_MEASUREMENT_ID` = `G-XXXXXXXXXX` for Production. Redeploy.
4. Visit the storefront, accept analytics cookies on the banner, browse a few
   pages. Within ~60s, GA4 → *Reports* → *Realtime* should show one user.
5. (Recommended) link GA4 to Search Console: GA4 *Admin* → *Product links* →
   *Search Console links* → *Link*. Lets GA4 show landing-page queries.

The site already fires GA4's e-commerce events automatically — `view_item`,
`add_to_cart`, `begin_checkout`, `purchase`, `search`, `sign_up` — so you'll
see funnel and revenue data without any extra setup.

**Google Merchant Center (free Shopping listings)**

1. Sign up at merchants.google.com. Target country: Pakistan, currency: PKR.
2. *Products* → *Feeds* → *Add primary feed* → choose **Scheduled fetch** →
   feed URL `https://www.yellowpink.pk/feeds/google-merchant.xml` → daily.
3. After the first fetch, Merchant Center will flag any items it can't accept
   (usually missing images or descriptions). Fix those products' fields in
   the admin Products page; the next daily fetch picks the corrections up.

The feed is generated automatically from your published catalogue — any
product you publish, change the price of, or take out of stock will reflect
in Merchant Center within 24 hours of the next fetch.

### Meta (Facebook & Instagram) and TikTok Shops

Your catalogue is also published as a **Meta-format product feed** at
`https://www.yellowpink.pk/feeds/meta-catalog.xml`. The same feed powers the
Facebook Shop, the Instagram Shop, and catalog (Advantage+) ads — and TikTok's
catalog too. It updates automatically from your published products, exactly
like the Google feed.

**Facebook & Instagram Shop (Meta Commerce Manager)**

1. Go to **commerce.facebook.com** → create a **Catalog** (type: *E-commerce*)
   for Yellow Pink, inside your Business account.
2. **Catalog → Data sources → Add items → Use a data feed → Scheduled feed.**
   Paste `https://www.yellowpink.pk/feeds/meta-catalog.xml`, set the currency to
   **PKR** and a daily refresh. The first import lists your products; Meta flags
   any it can't accept (usually a missing image) — fix those in admin Products.
3. Connect the catalog to your **Facebook Page** and **Instagram professional
   account** under **Commerce Manager → Shops** to open the Shop. (Instagram
   Shopping needs Meta's account review — allow a few days.)
4. Once live, you can tag products in posts/stories and run **catalog ads**
   against the same feed.

**TikTok**

In **TikTok Ads Manager → Assets → Catalog**, create a catalog and add the same
feed URL (`/feeds/meta-catalog.xml`) as a scheduled data feed — TikTok reads the
same format. (A full TikTok *Shop* is a separate seller application; the catalog
above is what you need for TikTok catalog ads.)

> **Tracking your ads.** Conversion pixels (Meta/TikTok) and ad-spend/ROAS
> reporting are set up separately — see your developer. Once a Meta Pixel ID is
> added, Instagram/Facebook ads can optimise for and measure purchases.

### Who to contact

For storefront or admin issues that this manual doesn't cover, contact the
store owner.

---

## 9. What's new

<!-- Convention: when user-facing behaviour changes, prepend a bullet under today's date (create the date heading if needed). Keep bullets bold-led and factual. -->

A dated history of user-facing changes, newest first.

### 9 July 2026

- **Search and cart panels now close when you go back.** On phones, opening the search panel (or the slide-out cart) and then swiping back — or pressing the browser's back button — used to leave the panel stuck open on top of the previous page. Both now close automatically the moment the page changes, however the navigation happened.

### 8 July 2026

- **Real brand logos in the homepage hero — picked visually.** The hero's "Authentic stock from" row now shows the brands' actual logos in a smooth, auto-scrolling strip (it pauses when hovered, and never wraps onto a second line no matter how many brands you pick). In **Settings → Homepage** the old comma-separated text box is replaced by a **visual logo picker**: a grid of every brand that has a logo uploaded on the Brands page, ranked by product count — click to add or remove, with a live preview of the exact row that will ship. A brand picked without a logo on file falls back to its name in text.
- **Blog sorting that visibly works.** The Journal's sort control is now a proper labelled dropdown with four options — **Newest first, Oldest first, Quickest read, Longest read** — replacing a bare two-option select that was easy to miss and whose reorder was often invisible (most articles are 8–10 minutes, so "Quickest read" barely changed page one). The current choice always shows on the button, and the open menu checkmarks it.
- **No more header "pop-in" on page load.** The site header used to appear a beat after the rest of the page (with a visible jump) because its placeholder reserved no space while the page loaded. The placeholder is now the full header itself, so pages render with the header already in place — the only thing that changes after load is the active nav item lighting up.

- **Vendors can now deliver their own orders.** Each vendor in **Settings → Vendors** has a **"Vendor delivers"** switch and a **delivery fee** field. When it's on (NB Sons / Nazirs Group is set this way — they ship their own orders), the order page **skips TCS booking** and shows a note that the vendor delivers directly; the vendor's delivery fee (currently **0 — no extra charge**) is recorded as that order's delivery cost, so Finance never charges an NB Sons order the TCS estimate. For every other vendor nothing changes: they bring stock to you and you book the courier as usual. When NB Sons starts billing for delivery, enter the fee and it flows into the order cost + shipping margin automatically.
- **Refused / returned deliveries are now tracked and counted as a loss.** When a customer refuses a COD parcel or it's returned to origin, the order now automatically flips to **Returned** as tracking syncs (previously it stayed stuck on "Shipped" no matter how often you synced — a courier-status bug where "Out For Delivery" was misread as "Delivered" and a return never advanced the order). A returned order also **stops counting as revenue** in Finance and instead shows up under **Finance → Shipping recovery** as a red **"Returned / refused deliveries (loss)"** line — the courier still bills us for the failed round trip, so that cost is surfaced as the loss it is rather than hidden.
- **Actual TCS delivery costs now sync automatically.** The daily courier job now also pulls TCS's real per-consignment billing (delivery charge + GST, including failed/return legs) onto each order, so the shipping-margin and returned-loss figures run on **real courier costs**, not just the typical-cost estimate — no manual clicking needed (the Finance → "Sync actual delivery costs from TCS" button still works on demand). Requires your **`TCS_CUSTOMER_NO`** to be set (see `docs/TCS-SETUP.md`); until it is, estimates are used.
- **Free-delivery wording no longer promises a single "over Rs 5,000".** Because free delivery now kicks in at a different order value in each zone (Rs 5,000 in Punjab, higher elsewhere), stating one number before we know the customer's city was wrong for most of the country. Every pre-address surface was reworded to a plain **"free delivery on bigger orders — exact amount shown at checkout"**: the announcement bar no longer mentions free delivery at all (it now reads "Authentic imported beauty & wellness · Cash on delivery nationwide"), the mini-cart's and cart's number-chasing progress bars were replaced with that note, the product page's Shipping & Returns text dropped the fixed figure, and the AI/`llms.txt` and staff WhatsApp canned replies were updated to match. The **exact, region-correct** threshold and delivery charge still appear at checkout once the province is chosen (and the FAQ still explains the Punjab-vs-other-regions split), so nothing over-promises for a shopper's area.
- **Zone-based shipping that stops the losses.** Delivery is now charged by destination region instead of one flat rate that lost money on far-off orders. Three zones (from your Lahore origin): **Zone 1 — Punjab & Islamabad (Rs 250, free over 5,000)**, **Zone 2 — Sindh & KPK (Rs 300, free over 7,000)**, **Zone 3 — remote areas: Balochistan, AJK, Gilgit-Baltistan (Rs 400, free over 10,000)**. Checkout picks the zone automatically from the customer's province, and each zone's free-delivery threshold is set high enough that a free order still covers the courier bill. Settings → Shipping now lets you **assign provinces to each zone**, set each zone's **rate, your courier cost, and free-delivery threshold**, and shows a **live margin warning** in red the moment a rate is set below what TCS bills you — so under-pricing can't slip through. (Heads-up: your previous change of the flat rate to 250 hadn't actually taken effect — the active zone's own rate was still 200 — which is part of why shipping was losing money; that's now fixed and zone-driven.) The whole site was reconciled to match: the **Shipping Policy page now shows a live zone/rate table** (it can never go stale when you change rates), the **FAQ** no longer says "flat rate," and the **cart** shows "from PKR …, final charge by city at checkout" instead of a flat number.
- **TCS booking is live and verified.** The TCS integration was tested end-to-end against the live courier API — creating a real consignment, tracking it, and cancelling it all succeeded. Once your TCS credentials are set (now including a **username + password** for the ecom login, alongside the bearer token — see `docs/TCS-SETUP.md`), the **"Book pickup via TCS"** button on an order creates the consignment automatically and marks it shipped. (One small caveat: on this TCS account the label endpoint returns the PDF directly rather than a link, so the in-admin "Print label" link may not show yet — print the AWB from the TCS portal using the consignment number in the meantime.)
- **Google Search results: product availability fixed.** Google Search Console flagged product listings as missing the "availability" field. Storefront listing pages (shop, brand, collection, tag, K-Beauty, homepage) now include in-stock / out-of-stock in their product structured data, so products stay eligible for rich results with price + availability in Search.
- **Analytics Traffic tab — a real behaviour dashboard.** Below Search & discovery, the Traffic tab now reads much more from PostHog: **device & browser** (phone vs desktop, and which in-app browsers — Instagram/WhatsApp webviews — people arrive in), an **engagement** panel (pages per session, average session length, bounce rate) with the **landing pages** sessions actually start on, a **Where visitors are** panel of top cities/countries (the Pakistan-vs-international split, so you can see how much traffic can convert to COD), and a **Demand & product interest** block showing the top on-site **search terms** and the **most-viewed products with their view→cart rate** — a product pulling lots of views but no carts (a pricing/photo/copy problem) is flagged for you to act on. These populate after the next analytics refresh.
- **Sentry errors ranked by who they hurt.** The dashboard's error widget now leads with **top issues by impact** — how many real people each error affected — instead of just the most recent, tags brand-**new** issues (first seen in the last 24h), and shows the affected-people count on each row, so triage starts with what's actually costing you customers.
- **Mobile/PWA card overflow fixed.** On phones, some cards on the Dashboard and the Analytics Traffic/Funnels tabs could push past the screen edge; the admin now stays within the viewport on every width.
- **Courier status in your dashboard.** Each order's Shipment panel now shows the **courier scan history** — the granular timeline the courier reports (picked up → in transit → out for delivery → delivery attempted / refused → delivered), with timestamps — and the **Orders list has a new "Courier" column** so you can see every order's live delivery state at a glance, the way the courier's own portal does. (This fills in automatically once the courier API is connected and tracking syncs; until then it reads "no scans yet.")
- **TCS: print labels, pull real delivery costs, full scan history.** Booking a TCS pickup now also fetches the **consignment label PDF** — a "Print label (PDF)" link appears on the order's Shipment panel to stick on the parcel. With your TCS customer number set, **Finance → Shipping recovery → "Sync actual delivery costs from TCS"** pulls TCS's billing ledger and writes the *real* courier charge onto each order, so the shipping-margin numbers become actuals instead of estimates. Customer tracking now shows TCS's full scan history (arrived at facility → out for delivery → delivered), not just the final delivery record. Setup + the new customer-number key are in `docs/TCS-SETUP.md`.
- **See your shipping margin.** You keep charging the flat delivery rate, but now the admin shows what each delivery actually costs you vs what you charged, so the saving is explicit. Set your **"Typical delivery cost per order"** in Settings → Shipping (internal only, never shown to customers); every order then shows a **Shipping margin** line (charged − delivery cost = what you kept, or the free-shipping subsidy in red), and Finance gains a **Shipping recovery** panel totalling charged vs delivery cost across the period. Orders where you haven't recorded the exact courier charge use your typical-cost figure as an estimate; the courier-charge box on the shipment form is now prefilled with it so the real number is easy to capture.
- **TCS shipping wired end-to-end.** Once the TCS API keys are set (see `docs/TCS-SETUP.md`), you can book a TCS pickup from an order and it gets a consignment number automatically. Every shipped order now shows a **"Sync tracking now"** button (Admin → Orders → the order → Shipment) to pull the latest TCS scans on demand, and — importantly — the **shipped and delivered emails to the customer now fire automatically** whenever tracking advances (previously they only sent if a staffer changed the status by hand, so courier-detected deliveries went silent). Customers also get a clickable **"Open courier page"** link on their account order history, not just the public track page.

### 6 July 2026

- **"Without box" / tester products can now be listed honestly.** Products have a new **Packaging** setting — *Standard (boxed)*, *Tester*, or *Without box* — for genuine stock supplied without full retail packaging. Anything non-standard shows a badge on the product card and a clear, authenticity-first note on the product page (so the customer knows exactly what they're getting before they buy), and can be filtered on brand/collection pages. Fragrance **testers** auto-populate a new **Perfume Testers** collection — its own landing page aimed at the ~1,500/month Pakistani searches for "perfume tester" — which ships as a Draft; publish it once you've flagged some tester stock.
- **Richer Google structured data across the store.** Every product now declares its condition (New) alongside price, availability, shipping and returns, and the **collection, category, brand, tag and homepage** listings now carry proper per-product structured data (name, image, brand, price) instead of bare links, so those pages are eligible for Google's product-list / carousel results, not just the individual product pages. (All 175 live products were confirmed to have complete image, brand, description, price and category data feeding the markup.)
- **Medical reviewers now match articles by topic, not guesswork.** Instead of the old keyword guessing, there's a fixed list of health **topics** (Women's health, Fertility & conception, PCOS & hormonal health, Skincare, Sun protection, Sleep/stress & brain, and so on). Each doctor ticks the topics they can review (in the admin editor and their own profile portal), and each blog post gets a **Health topic** picker. Assigning a reviewer then becomes a direct match, the post's topic points straight to the doctors who cover it, so the "Medically reviewed by" suggestion is accurate instead of approximate (you still confirm every assignment). Existing doctors were auto-seeded from what we already know (their listed topics + specialty, e.g. a gastroenterologist now covers "Gut & digestion"), and existing articles were auto-tagged with a topic from their category and title.
- **Search demand: two new views — "shown but not bought" and demand by brand/category.** A **Searched, shown products, but rarely bought** section surfaces terms that DO return products yet whose searchers seldom go on to buy (a price / imagery / stock / trust problem on what they land on), with a buy-through rate per term. And a **Demand by brand & category** section rolls your on-site searches up to the brands and categories you stock, so you can see which ranges shoppers hunt for by name and decide what to feature or restock.
- **Bestseller badges and homepage rails are now data-driven.** The "Bestseller" badge used to be a pure manual toggle. Now there are two signals: your manual **Bestseller** pin still works as an override (great for a launch you want to push), and a new automatic **Popular** badge appears on whatever is genuinely in the top demand tier, recomputed nightly from real product views, add-to-carts and units sold. The homepage also splits into two demand-driven rails, **Best Sellers** (ranked by what's actually bought, your pins leading) and **Trending Now** (recent views + add-to-carts, catching momentum before sales land), instead of one blended "Popular" strip. Both refresh automatically every night; a product whose interest fades drops off on its own.
- **Analytics → Traffic now has a working time filter and a cleaner layout.** The 7 / 30 / 90-day / 1-year range picker now applies to the Traffic tab, driving the SEO-trend chart, Search Console, Google Analytics and Core Web Vitals cards together (previously each was locked to its own fixed window). The tab is also organised into labelled sections, **Search & discovery**, **Site performance** and **On-site behaviour**, so it reads as a dashboard instead of a stack of cards. (The on-site pages/events cards keep their rolling 7-day snapshot and say so, since that data is cached daily.)
- **Product shipping is now stated correctly in Google's data.** Each product's structured data was declaring free shipping on everything; it now shows the real cost, free over the free-shipping threshold, otherwise the flat rate, so the shipping shown in Google matches what a shopper actually pays. Also recovered two old fertility URLs that were 404ing (they now redirect to the right guide/product).
- **Search demand now has a time-range toggle, trend lines, and CSV export.** A **7 / 30 / 60 / 90-day** switch at the top changes the on-site window (it was fixed at 60 days). Every on-site row gets a small **Trend** sparkline showing whether that search is rising or fading over the window, so you can tell a one-off spike from real, growing demand. And an **Export CSV** button downloads the on-site list (term, searches, people, products shown, trend) for procurement or sharing. A note: the on-site numbers are pulled **live** every time you open the page (no manual refresh needed); the Google/Search Console figures update once a day.

### 5 July 2026

- **Search synonyms — fix "no results" caused by wording, not stock.** A lot of empty searches aren't missing products, they're vocabulary gaps: someone types "vit c" but the range says "Vitamin C", or "sunblock" instead of "sunscreen". Search demand now has a **Search synonyms** panel (and a **+ Synonym** button on every no-result row) where you map the searched word to the wording that actually finds products. The storefront search then quietly searches your wording instead, so those shoppers land on results instead of a dead end. It takes effect immediately, no deploy, and applies everywhere search runs (the header search box and the Shop page).
- **Search demand is now one-click actionable.** Every row in the report (a searched term with no products, a thin result, or a Google query you rank just off page 1) now has an **+ Product** and/or **+ Guide** button. Clicking it opens a brand-new product or blog-post editor with the searched term already filled in, so you go straight from "people want this" to a half-started draft. The buttons respect permissions — a read-only analyst still sees the numbers, just without the create buttons.
- **Email log now says what each email actually is.** The **Type** column showed only "transactional" or "batch" (a delivery setting, not a description). Every email now carries a plain-English type — Order confirmation, Shipped, Delivered, Cancelled, Abandoned cart, Newsletter, Review request, Welcome, and so on — so you can see at a glance what the store has been sending. Existing history was relabelled too.
- **You're now told when abandoned-cart reminders go out.** The store quietly emails shoppers who leave a full cart (after an hour, a day, and three days with a discount). Those sends are logged as **Abandoned cart** in the email log, and once a day the notification bell posts a running tally ("N cart-reminder emails sent today"), so you know the recovery flow is working without hunting for it.
- **Open rates now flagged as approximate.** Email "opens" rely on the mail app loading a hidden pixel, which Apple Mail Privacy Protection, Gmail and image-blockers routinely defeat or inflate — so the number was never exact. The email log now says so plainly and points you to **Delivered** and **Clicked** as the numbers you can trust.
- **New “Search demand” page (Marketing → Search demand).** One place to see what people search for and where you’re not meeting it. Three things: **on-site searches that returned no products** (your clearest stock-or-create shopping list), searches that returned only one or two matches, and **Google queries you already rank for but just off page 1** (winnable with a content or internal-link push) plus page-1 pages with weak click-through. It reads the same daily Search Console data as the dashboard and your own site-search box (last 60 days). Also fixed the site search so it logs the term someone actually meant instead of every keystroke, so this report (and analytics) are clean.
- **The homepage “Popular Right Now” rail is now demand-driven.** It used to be whatever you manually flagged as a bestseller (then padded with recent stock). It now orders by a daily popularity score built from what shoppers actually do — product views and add-to-carts (from analytics) plus real units sold (from orders) over a trailing window. Your manual **Bestseller** flag still wins and leads the rail, so you keep full override; the score just orders everything underneath it. It refreshes every night, and a product whose interest fades drops off automatically. Wellness and K-Beauty keep their own dedicated homepage sections, so a makeup-heavy popular rail never squeezes them out.
- **Supplement guides get an internal-linking boost.** Our wellness buyer guides (prenatal, PCOS, fertility, moringa, and so on) rank for the right searches but sit too deep in Google to get clicks. Two changes concentrate more of the site's own link authority on them: the guides now cross-link each other as one health cluster (a fertility guide points to the PCOS and prenatal guides, not to unrelated recent posts), and wellness **category pages now show a “Guides worth reading” block** linking down to them. This is a nudge that compounds over weeks, not an overnight jump.
- **Supplement pages now carry real customer reviews.** Our own NB Sons wellness range had zero reviews on the site, which is the main reason interested shoppers looked but didn't buy. We imported the genuine customer reviews those same products already have on the NB Sons store — 30 reviews across 19 products — shown honestly labelled **“via NB Sons”** (no fake “Verified purchase” badge, since they weren't bought here). Star ratings now show on those product cards and pages. To stay within Google's rules, these imported reviews power the on-page stars but are kept out of the Google rich-snippet data (which must be reviews left on our own site). Complaints purely about NB Sons' own delivery were left out, as they're about a different shop's service, not the product.
- **Supplement pages got a trust panel.** Wellness product pages now show a short reassurance block (genuine & sealed, stored correctly, clear expiry dates) and an **“Ask before you buy”** WhatsApp button, because supplements are a considered purchase and many first-time buyers want to ask a question before ordering. Cosmetics/makeup pages are unchanged.
- **Category-page FAQ alignment fixed.** The “frequently asked” block on category pages was pinned hard to the left edge, out of line with the rest of the page (worst on mobile); it now sits in the normal page column.
- **WhatsApp clicks are now measured.** Every “Chat / Order on WhatsApp” button on the storefront now routes through a tracked redirect before opening WhatsApp, so the number of people choosing to order via WhatsApp (a big slice of Pakistani shopping that was previously invisible) shows up as a **WhatsApp clicks** figure on **Analytics → Sources**. Nothing changes for the shopper. As a side benefit, this also stopped SEO crawlers from mis-flagging the WhatsApp link as “broken” hundreds of times.
- **Review booster — guests who review now get a thank-you discount code.** Signed-in customers already earn loyalty points when a review is approved, but guests (who review with just an email) couldn’t hold points, so they got nothing. Now, when you approve a guest’s review, they’re automatically emailed a one-time discount code — a legitimate nudge to leave reviews and come back to buy. Configure it in **Settings → Loyalty**: turn it on/off, set the discount % (default 10%) and how long the code stays valid (default 60 days). Codes are single-use and locked to the reviewer’s email. It never double-rewards a signed-in customer.
- **See where your sales actually come from — new “Sources” tab in Analytics.** It reads the source captured on every order (the tagged link, the referring site, or “Untagged / Direct” when there was none) and shows revenue and order count per source, plus breakdowns by campaign and by first-page-landed-on. A headline card shows what share of revenue is still untagged so you know how much you’re flying blind.
- **New “Link builder” under Marketing.** Generate tagged links for Instagram bio, WhatsApp, stories, campaigns and more, with one-click channel presets and a copy button. Use these instead of your plain store link and each visit — and each sale — becomes traceable in the Sources tab. Written for non-technical use, with a short “why tag links” playbook alongside.
- **Daily / Weekly / Monthly revenue view.** The Sales revenue chart now has a Daily · Weekly · Monthly switch, so you can zoom from day-by-day detail out to monthly trend without losing your place.
- **Funnels tab now explains itself** — a plain-language “how to read this” note ties the behaviour funnel (browse → buy) to the new Sources tab (where the money starts) and the Link builder (how to make traffic traceable).

### 4 July 2026

- **New pages now nudge Google automatically** — publishing a blog post or product already pinged Bing/Yandex instantly; it now also re-submits your sitemap to Google (via the connected Search Console account) so new URLs get pulled into Google's crawl queue without anyone clicking anything. It's debounced to at most once every few hours, so a burst of publishing costs a single submit. The manual **Settings → Integrations → "Submit sitemap to Google"** button still works for an on-demand nudge. (Behind the scenes, error monitoring also now filters out noise from in-app browsers like Instagram/Facebook, so the error dashboard only shows real issues.)
- **Two new buyer guides on the blog** — targeting searches Pakistani shoppers make but the site wasn't answering: *"Kojic Acid in Pakistan: Soaps, Creams & How to Fade Pigmentation Safely"* and *"Best Sunscreen in Pakistan 2026: SPF Guide + Top Picks"*. Both are medically reviewed, follow the house style, link to the relevant products we stock (kojic → the Anti-Melasma cream; sunscreen → Beauty of Joseon, SKIN1004, CeraVe, DRMTLGY), and cross-link the existing skincare guides so the whole cluster reinforces itself. The sunscreen guide is the new hub the existing oily-skin and tinted-sunscreen posts point up to.
- **Footer "My Account" now goes straight to the right place** — signed-out visitors go directly to the sign-in page instead of bouncing through a redirect (this also cleared a site-wide temporary-redirect warning flagged on every page in the monthly Semrush crawl).
- **Coupons cleaned up and made far more capable** — the 11 leftover WordPress-import codes (never redeemed here) were removed, and **WELCOME10 was restored**: it had been deleted while the signup popup and welcome email still advertised it, so new subscribers were being promised a code checkout rejected. It can no longer be deleted from admin (deactivate it instead — the popup, footer signup and welcome email now automatically stop promising the discount when it's inactive, and always show its live percentage/minimum). Creating/editing a coupon now also supports **uses-per-customer limits, a maximum order cap, email or whole-domain restrictions, limiting a coupon to (or excluding) specific products, and an internal note** — all enforced at checkout, and campaign links like `?coupon=CODE` continue to auto-apply.
- **The system now suggests the right medical reviewer** — in the blog post editor, a hint under "Medically reviewed by" recommends the board member whose specialties match the article (e.g. fertility posts → the fertility specialist) with the reason, one click to accept. A new **Review Board → Article assignments** page runs the same matcher across every existing article, grouping the ones whose assignment disagrees with the specialty match for a per-post decision. Assignments always need your click — the byline is a claim about who actually reviewed the article.
- **Activity log grew up** — reliable first of all: staff-action entries were written in a way the hosting platform could silently drop, so some actions never appeared; every entry now lands. The page itself gains the standard view-tabs with live counts (All / Customers / Staff / Owner / System), search-as-you-type across event, email and record id, a time-range filter (24h / 7d / 30d), and readable change details instead of raw JSON.
- **Email log caught up with the other lists** — the same view-tabs with counts (All / Sent / Failed / Skipped), search-as-you-type across recipient and subject, and a Transactional vs Batch type filter.
- **Team page "Last sign-in" now tells the truth** — it showed "Never" for everyone because the timestamp write raced the login redirect and always lost; fixed, and existing staff were backfilled from their real activity history.
- **Cart adds can no longer be lost to a fast page change** — the cart (and wishlist) now save to the browser *before* anything is drawn on screen, so tapping "Add to Cart" and immediately moving to another page can no longer drop the item (previously a rare timing window, most likely on slower phones).
- **"Discover" menu on desktop** — the desktop header keeps its clean row (Makeup, Skincare, Wellness, Sale…) and gains one **Discover** dropdown holding Collections, Brands, K-Beauty, Find Your Match and Blog, so every destination is reachable on desktop without cluttering the bar. (Phones keep the full drawer menu.)
- **Duplicate listings consolidated** — "Tinted Sunscreen Moisturizer 3-in-1 SPF 46" was the same product as **DRMTLGY Universal Tinted Moisturizer SPF 46** (identical copy, name swapped) and "NARS Light Reflecting Foundation Mont Blanc" duplicated a shade already sold inside the 33-shade NARS foundation listing. Both duplicates are archived and their links redirect to the kept listings — neither had any orders, reviews or search rankings, so nothing was lost. *One check for you: the two DRMTLGY listings had different prices (Rs 1,999 vs Rs 3,950) — the kept listing sells at Rs 3,950; adjust in admin if the promo price was the intended one.*
- **Images can no longer break site-wide** — every image is optimised through a free image CDN (measured ~5× smaller, ~3× faster); if that service ever has an outage, images now automatically fall back to the original copies on our own storage, so the worst case is slower photos, never missing ones.
- **Admin lists all speak one filter language** — Segments, Reviews, Customers and Newsletter now use the same underline view-tabs as Orders (with live counts), and the Brands search filters as you type instead of needing Enter.
- **Collection pages got a proper toolbar** — a collection page now shows a product count, a **Sort** control (Featured / price / name), **category chips** to narrow within the collection, and **pagination** instead of dumping every product in one endless grid — the same shopping controls as the main Shop page.
- **Customer counts now match everywhere** — the Customers list counts a buyer's orders the same way the order page does (by account, email *and* phone), so a registered customer's guest-checkout orders roll up under their account instead of vanishing or showing as a separate guest; the list totals now reconcile exactly with Analytics.
- **Every product now has a brand** — the last products missing a brand were filled in (NB Sons supplements, OGX, DRMTLGY, and house-label items), so brand filtering, brand pages and search data are complete.
- **Storefront & data clean-up** — the quiz's *Sun protection* answer now returns your actual SPF products (it pointed at an empty "Sunscreens" category and gave generic picks); the **All brands** page lists every brand in one A–Z run (a third used to restart mid-alphabet); product **share previews** (WhatsApp/Facebook) use a resized image so the thumbnail loads reliably; and stale prices baked into a few product descriptions/search snippets (CeraVe bundle, Argivital, Stevoice, Puratin) were corrected to match the real price. The remaining hotlinked product photos on live products were re-hosted to our own storage so they can't break. Broken-link and indexing tools now also recognise old `/products/…` and `/collections/…` style URLs.
- **Admin logs paginated** — the Activity log and Email log now page through history instead of capping at a few hundred rows on one giant scroll, so older entries stay reachable.
- **Admin data & reporting accuracy** — Customers spend/counts, the Returns rate, COD "Delivered" dates, dashboard trend pills, ad-spend/ROAS, top-products ranking and coupon totals all now read correctly and agree across pages (details below).
- **Admin polish** — reviewer, tag and vendor actions now confirm with a toast; the manual's contents sidebar sticks and tracks your place; payment methods only appear at checkout when their gateway is set up; and settings-permission staff can manage shipping zones and notification recipients.
- **Team & access roles revamped** — the Team page now has **Members** and **Roles** tabs. Members show their **2FA status** and **last sign-in**; the owner account is pinned at the top so it's visible. **Reset Password now signs the person out everywhere instantly** (previously their live session survived up to 10 hours) and forces them to set a new password at next login; a new **Reset 2FA** button un-locks a staffer who lost their phone. Built-in roles were corrected to match their descriptions — *Customer support* no longer silently carries delete rights and now includes Messages. The permission checklist mirrors the sidebar exactly and each permission says which sections it unlocks. Two new permissions: **Vendors** (vendor money no longer rides on order permissions) and **System tools** (Email log / Broken links / Indexing, no longer bundled with Settings) — everyone who had access yesterday still has it. Deleting a role keeps its members' access instead of stripping them to nothing, and staff now land on a page they can actually open after login instead of a restricted dashboard.
- **Payment options can't dead-end customers anymore** — checkout now offers JazzCash, Easypaisa and Card **only when the gateway is actually configured**; previously a ticked-but-unconfigured method let a customer pick it and then fail at payment. Settings → Payments shows a live status chip next to each gateway method ("Gateway configured" / "Not configured — hidden at checkout") so you can see at a glance why a method isn't appearing.
- **Customers page money now matches Analytics/Segments** — order counts and "Spent" on the Customers list (and its CSV export) previously counted cancelled and unpaid gateway orders and full refunded totals, overstating spend; they now use the same rule as everywhere else (cancelled/unpaid excluded, refunds count as zero).
- **Admin search boxes no longer swallow typing** — pausing mid-search (e.g. typing a name, stopping, then continuing) on Orders, Products, Reviews, Messages, Inventory, Customers, Blog, Indexing or Broken links used to silently drop the rest of what you typed; search fields now keep focus and your text.
- **Staff with "Store settings" can manage shipping zones & notification recipients** — these save buttons previously failed with an error unless you were the owner, despite the permission promising them.
- **Checkout points at what's missing** — on phones, tapping *Place Order* with a required field empty now scrolls to and highlights the first missing field with a clear message (previously nothing visibly happened). Product photo galleries no longer stretch pages sideways on phones, and blog page titles in Google/social shares now show the full headline instead of cutting off mid-sentence.

### 3 July 2026

- **Admin app + phone notifications** — the admin is now an **installable app**: your browser offers *Install app* (iPhone: Safari → *Share → Add to Home Screen*), and the install banner keeps returning until you install it. Once installed, turn on **push notifications** in Settings → Notifications ("Enable on this device"): new orders, payment failures, low stock, new reviews and return requests reach your phone **instantly** — no more waiting on email — and tapping a notification opens the right admin page. The **storefront's** own install prompt now shows only to returning visitors, and only once ever (installing or dismissing it ends it for good). This manual was also restructured — the change history you're reading replaced a single unreadable paragraph, and the reader gained the contents sidebar with search.
- **Vendor payouts fixed + upgraded** — outstanding vendor balances were showing empty because payout rows silently failed to record (a database column was missing in production); the missing piece is applied, **all affected orders' payouts are rebuilt** (your pending balance now shows correctly), and the recording path now reports failures instead of swallowing them. The Vendors page gained three headline cards (Owed to you / You owe / Margin earned), a per-vendor **Settle all** button, payout dates, one-tap WhatsApp links, and an automatic warning if any vendor order is ever missing its payout. "Recalculate from vendor rate" on an order now also rebuilds its payout row so the ledger can't drift from the cost.
- **Sortable order columns + broken links fixed** — the Orders list's *Order # / Date / Customer / Total* column headers now sort on click with direction arrows (phones get a sort dropdown above the cards), Products' sort headers use the same modern control, and table rows highlight on hover. All 33 logged **broken links** were fixed live: old duplicate product URLs now redirect to the live products, dead tag pages to matching shop categories, and the rest reviewed.
- **Admin-wide design sweep + customer counting fix** — every remaining admin section now speaks the same visual language as the new Dashboard/Orders: stat tiles across Customers, Inventory, Returns, Brands, Finance, COD reconciliation, Email log, Broken links and Indexing use the standard KPI card (accent bar + big number — Finance's Revenue card now carries a mini-trend); statuses everywhere (stock levels, returns, vendor payouts, collections, brands, reviews, messages, email log, activity log, team) use the soft dot-chips from the Orders list; Finance opens with its own "what stands out" strip (net margin, ROAS, awaiting-confirmation total, biggest expense category) and its date pills now keep your payment-method filter; **Returns** gained status tabs (All · Pending · Approved · Received · Refunded · Rejected) with a count; **Brands** gained search; **Messages** gained a thread search box; **Reviews** filters apply as you type and "+ Add review" moved to the page header; COD reconciliation's outstanding table stacks into cards on phones so the amount and Record action are visible; Segments links every customer row to their profile; stray text-glyph icons were replaced with proper icons or removed. Also **customer counting fixed** — a guest who skips the optional email at checkout is now identified by their phone number, so Unique customers, repeat-purchase rate, segments and cohorts count every real customer (previously such guests were dropped from the counts entirely).
- **All clocks on Pakistan time** — every date and time shown anywhere in the system (order lists and timelines, analytics chart labels, inventory/audit logs, customer order history and tracking, review dates) now renders in **Pakistan Standard Time** regardless of where the server runs; previously, server-rendered timestamps could display up to 5 hours behind — e.g. an order placed at 02:30 showed the previous day.
- **Analytics question-tabs** — the Analytics page is reorganised into four tabs that each answer one question: **Sales** (revenue/orders/AOV with change-vs-previous-window pills and mini-trends, revenue chart, orders-by-status that links into the filtered Orders list, top products), **Customers** (unique/repeat, segments, cohort retention), **Traffic** (SEO trend, Search Console, GA4, Core Web Vitals, top pages/events) and **Funnels** (conversion funnel, by source/device, user journeys, session recordings); the Sales and Customers tabs open with a computed **"what stands out"** strip that reads the numbers for you.
- **Dashboard command centre** — the admin Dashboard now opens with a **Today** row (sales, orders, average order value — and visitors once GA4 is connected — each with a 14-day mini-trend and a comparison against the same weekday last week); the **Needs attention** card moved to the top and now also lists **unread customer messages** and **reviews awaiting moderation** alongside stuck payments, stale orders and pending returns (red = money/orders at risk, amber = routine queue work); **Recent Orders** moved up and adopted the split Payment/Fulfilment chips; and the quiz funnel was tucked into a collapsed "More insights" section. Analytics adopted the same KPI-card and date-range controls as the Dashboard, with per-metric mini-trends on the Revenue/Orders/AOV cards.
- **Shopify-style Orders workspace** — the Orders list now has **saved-view tabs** (All · To fulfil · Unpaid · Shipped · Delivered · Cancelled, plus a More… menu), **separate Payment and Fulfilment status chips** on every row (so "am I paid?" and "has it shipped?" each get their own answer), an item-count column, and the customer's city under their name; the CSV export follows whichever view is active. The order page's item list now shows **product thumbnails** so packing can be verified at a glance.
- **Storefront design-quality pass** — a screenshot-driven design review of every storefront page at phone + desktop widths, then fixes: the **mobile product-page sticky buy bar** no longer collapses its Add-to-cart button (a flex sizing bug); product-card **Add to cart** moved below the packshot as a magenta outline button on phones (was a black pill covering the image) with a hover-reveal on desktop; oversized mobile product titles clamped; the duplicated "Why this product earns a spot" trust band removed (the buy-box chips stay); the empty-reviews box collapsed to one line; **cart/checkout empty states** unified ("Your bag is empty" in the brand serif with a proper bag icon, and the dead-end "View cart" link replaced with "Shop bestsellers"); the **quiz landing** redesigned (icon panels, hover affordance); **Brands** is a compact 2-column grid on phones (was ~40 screens of scrolling) with branded monogram tiles for imageless brands; k-beauty brand grid rebalanced; **Track Order** restyled to the house header/button pattern with a contact help-link; contact page heading/cards unified; the **footer link columns collapse into accordions on phones**, and the pre-footer marquee now cycles value props instead of repeating the store name; announcement-bar underline no longer swallows the comma and the banner copy was shortened to fit one line on phones; the floating WhatsApp button is smaller, ringed, and hidden on the Contact page.
- **No-email order flag** — the order page's Customer card now shows an amber **"No email — this customer receives no automatic updates"** note when the buyer skipped the optional email field at checkout, since email is the only automated channel; such orders must be confirmed via the WhatsApp button.
- **Admin polish round** — the **order page is re-laid-out in two columns**: customer, address, items and the fulfilment steps (confirmation → vendor → shipment) on the left, with **Update Order and the payment cards in a right-hand rail at the top**, so changing a status no longer means scrolling past every cost card; costs, profit, notes and the timeline follow below. The **sidebar now badges Returns** (requests awaiting a decision) **and Reviews** (awaiting moderation), joining Orders and Messages, so morning triage is visible at a glance. **Reviews** gained the standard toolkit — search, product + status filters, pagination (the list previously stopped silently at the latest 20 approved) — and a **public reply**: respond to any live review and it appears on the product page as "Response from Yellow Pink" (the dormant WP-era reply column was removed in favour of this).
- **Vendor selection fix** — on the order page, **picking the vendor in "Fulfilled by vendor" now applies the economics immediately** (settlement + auto acquisition cost, with a confirming toast); previously only sending the WhatsApp message did, and with a single vendor the dropdown always *looked* selected even when the order had none — it now starts at "No vendor (own stock)" until you assign one, and clearing it removes the settlement and an auto-filled cost. The product page's vendor field is clarified as **Default supplier**: it groups Inventory reorder suggestions and makes order pages (and the manual-order form) suggest that vendor one-click when the order's items are sourced from them — it never assigns a vendor to an order by itself; the per-product **Vendor cost** field now works without naming a supplier.
- **Admin quality round** — navigation & catalog workflow: the **sidebar is re-organised into six frequency-ordered groups** — Insights · Sell · Catalogue · Customers · Marketing · System — with Coupons filed under Marketing, Messages and Reviews under Customers, Email log under System, and **COD reconciliation now a tab inside Finance** (Overview / COD reconciliation at the top of the page) instead of a separate sidebar item; "Review Board" is renamed **Medical reviewers**; the **Cmd K** palette mirrors the same groups. Products gained a per-row **Duplicate** action — deep-copies a product (variants, tags, gallery images, related links) into a new draft named "… (copy)" and opens it for editing — and an **Export CSV** button that downloads the whole catalogue in the same column layout the importer accepts, completing the spreadsheet round-trip for mass repricing/restocks (rows match by `slug`; exported `status` and `track_inventory` columns are honoured on re-import, and an import without those columns leaves them untouched). Saving a **new product** now lands on its edit page — where variants, tags and images live — instead of bouncing back to the list; and the **Messages** inbox shows each customer's order history in the thread header — order count, lifetime value, and the latest order with status — linking to their filtered order list.

### 2 July 2026

- **Unified vendor & cost model** — **the order's vendor now determines its cost — automatically**. Dispatching an order to a vendor (the WhatsApp button) computes the goods cost from the vendor's commission % (or a product's fixed *Vendor cost* / *Cost price* when set), writes the settlement **and** auto-fills the order's **Acquisition cost / COGS** with the same figure, so Finance and the vendor payout always agree; the *Order costs* card now shows where the number came from — "Auto-filled from *NB Sons @ 12.5% margin*", "Entered manually", or a prompt when unknown — a manually typed cost is never overwritten by a re-dispatch, and a **Recalculate from vendor rate** button re-derives the auto figure on demand. **Manual orders** can be marked *Fulfilled by vendor* at entry — pick the vendor, see the estimated cost + your margin live, and the order is created with its settlement and auto cost already recorded. Booking a shipment (API **or** manual tracking) now takes an optional **Courier charge (PKR)** that lands straight in the order's *Delivery cost* (an already-recorded charge is never overwritten).
- **Feedback & fulfilment round** — booking a shipment — one-click API pickup **or** a manually entered tracking number — now automatically marks the order **Shipped** and emails the customer their tracking (once; an already-shipped order is never re-emailed), with a confirmation under the booking form; **bulk status changes** from the Orders list now send the same customer emails as single updates; saving *Order costs*, *Payment received* or *Internal notes* on an order — and deleting an order, customer or blog post — now confirms with a toast (errors show too, instead of the page silently doing nothing); a failed **blog-post save** (e.g. duplicate URL slug) keeps everything you typed, including the body, and the editor warns before you leave with unsaved changes; the **coupon create form** keeps your input and shows the error inline instead of clearing; an expired or maxed-out coupon now shows one clear status — *Expired* / *Maxed out* — rather than also claiming to be Active; order-status badge colours are now identical across the dashboard, Orders list, filter pills, order page and customer page; and the Returns 90-day return-rate shows its formula on hover.
- **Hardening** — newsletter campaigns and the admin CSV exports — Orders, Finance orders, COD manifest — now cover the **whole** list instead of silently stopping at the first 1,000 rows; and the public quiz email capture, doctor-application form and broken-link logger are now rate-limited against abuse — someone re-submitting very rapidly sees a polite "too many attempts, try again in a few minutes" message, normal use is unaffected.
- **Manual orders** — a **+ New order** button in admin → Orders lets you key in WhatsApp/phone orders — product search, editable prices, suggested shipping, optional discount and confirmation email, with stock reserved like any storefront order.
- **Promos removed** — removed the **Promos** admin section and the storefront **promo strip** entirely — neither was ever used. The one remaining banner is the thin **announcement bar**, managed in **Settings → Homepage**.
- **Post-purchase accounts** — the thank-you page now offers guest buyers a one-field **"Save your details for next time"** account signup — email pre-filled from the order, past guest orders linked automatically after confirmation.
- **Internal-linking round** — product pages gained a **"From the blog"** row showing journal articles that feature the product; the footer gained a **Collections** column listing the top published collections; and blog articles now automatically turn mentions of any shop product into a link to its product page — capped per article so posts stay readable.
- **Audit fixes, round 4** — deleting a **vendor** no longer wipes its payout/settlement history — the payout rows are kept and the supplier is shown as "(deleted)"; deleting a **brand** or **collection** now reports a real error instead of always claiming success; **product, brand and collection edits — and CSV imports — now show on the live storefront straight away** instead of taking up to five minutes to appear; **CSV product import** now actually saves the rows (it was silently importing nothing), and a WooCommerce export whose *Sale price* column is blank keeps the product's regular price instead of importing it at 0; and saving a manual collection's products is now atomic, so a failed save can no longer empty the live collection.
- **Audit fixes, round 3** — refer-a-friend links now work — a `?ref=<code>` link is remembered and credited to the referrer on the friend's first delivered order; the doctor **reviewer dashboard** now lists the articles credited to each reviewer instead of showing an empty list; and customer-submitted product reviews can no longer self-approve or fake a "verified purchase" — they always enter the moderation queue unapproved.
- **Audit fixes, round 2** — the Orders **Export CSV** button works again and reports errors instead of silently doing nothing; the order page's **Delete order** button works again; bulk-cancelling orders now restocks their items just like a single cancel, and cancelling (single or bulk) asks for confirmation first; **Resend confirmation email** now reports when the email couldn't actually be sent; returns gained the final **Mark as refunded** step, and the linked order now moves to *Returned* / *Refunded* automatically; the Returns 90-day return-rate can no longer exceed 100%; Finance no longer counts unpaid awaiting-payment orders as revenue and recognises ad-spend categories regardless of letter case; deleting an expense asks for confirmation; the dashboard's Orders-by-Status chart covers every status so its percentages add up, greets you in Pakistan time, and payment methods show friendly names — JazzCash instead of "jazzcash" — everywhere in the admin; the order timeline now shows **who** made each status change.
- **Audit fixes, first round (earlier the same day)** — new products now start as **Draft** via a Status field on the product form; products with order history are archived on delete instead of removed; a failed product save no longer clears the form; added the **Free shipping** coupon type; the Promos list shows paused/scheduled promos again, validates that the end date is after the start date, and confirms saves with a green banner; stock adjustments that would go below zero now warn and record only the applied amount; admin nav icons switched to crisp inline SVGs; and the cookie banner no longer covers the admin panel.

### 26 June 2026

- **Products management upgrades** — added admin Products status tabs — All/Published/Drafts/Archived with live counts — plus working column filters (category, brand, stock state, tag, price range) and a bulk "Set draft" action, for easier draft-vs-live management; staged the full Golden Pearl skincare/haircare range as draft products.
- **Medical review consolidated + self-serve board** — consolidated medical reviewers onto the Medical Review Board — retired the old store-wide reviewer field in Settings — and added a self-serve Medical Review Board: doctors apply, you approve, they get a magic-link dashboard.
- **Connect Google** — OAuth sign-in that auto-links Search Console + GA4, submits the sitemap for indexing, and renders live GSC + GA4 panels on the Analytics page.
- **Find Your Match quiz** — a product-recommendation quiz with PostHog/Sentry instrumentation and a dashboard funnel.
- **Dropship simplification** — removed Subscribe & Save and the stock-alert automation to suit the dropship model.
- **Storefront & tooling additions** — a Broken links 404 monitor with one-click redirects + daily digest, a floating WhatsApp chat button, optional short product videos in the PDP gallery, the contact-page redesign, and keyword-led SEO meta across the storefront.
