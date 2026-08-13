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
> **Last updated: 13 August 2026** — see [What's new](#9-whats-new) for the
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

- **Home page** — the landing page. It opens with a hero banner and trust bar,
  then (on phones) a tappable search field and a swipeable strip of the eight
  most-shopped destinations (New In, Best Sellers, Makeup, Skincare, Wellness,
  Value Sets, Under PKR 2,000, On Sale). Product rails follow: Featured, a
  **New In** rail of recently added products, Sale (when a sale is on), Best
  Sellers, and Trending. The Featured, Best Sellers, Trending and K-Beauty
  rails **rotate daily** — each day a different four products from a wider
  shortlist take the slots, so returning visitors see a fresh page without any
  manual re-curation. Further down come shop-by-category tiles plus a "Shop by
  category" row linking every category in the store, the latest blog posts,
  and a pre-footer **Order on WhatsApp** band. A dedicated **"Beauty starts
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
- **Routine Finder** (`/quiz`, in the main menu) — the shopper picks a path
  (skincare or wellness) and answers two questions. Skincare answers build a
  numbered routine (Cleanse → Treat → Moisturise → Protect) where each step
  is filled by matching the shopper's skin type and concern against the live
  catalogue's ingredients and descriptions, with a one-line reason under
  every pick and an alternate where one exists. Wellness answers build a
  supplement plan (a core pick plus supporting picks) the same way, and both
  paths link the matching buyer guides from the journal. Results are **saved
  to a shareable link** (`/quiz/r/<code>`) that survives refreshes and can be
  sent over WhatsApp; there's a one-tap **Add all picks to cart**, and the
  email option sends the shopper their actual picks with the reasons, the
  saved link and the welcome discount (which also adds them to the
  newsletter). Every step is tracked, and the **Dashboard** shows the quiz
  funnel (starts → completions → emails) and most-recommended products.
- **Free Tools** (`/tools`, in the main menu, the footer, and a homepage
  band) — a family of free, no-signup tools written in plain language for a
  layperson. All the maths runs in the browser; nothing personal is sent to
  the server. Each tool page answers the question first and then links the
  matching guides and, where it genuinely helps, one relevant product —
  value first, selling second. The set:
  - **Ovulation Calculator** (`/ovulation-calculator`) — best days to try
    for a baby, ovulation day, next period, earliest reliable test date.
  - **Pregnancy Calculator** (`/pregnancy-calculator`) — due date, current
    week and trimester, and the ultrasound/milestone dates.
  - **BMI Calculator** (`/bmi-calculator`) — weight check using the South
    Asian ranges that apply in Pakistan (overweight from 23), with the
    international scale shown for comparison.
  - **Calorie Calculator** (`/calorie-calculator`) — daily calories to
    lose / maintain / gain, plus a daily protein target.
  - The **Routine Finder** quiz also appears in the tools family.
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
- **Deals page** (`/deals`) — every product with a genuine discount, deepest
  discounts first, updated automatically as offers start and end. The header's
  **Sale** link now points here (it's a shareable, searchable page instead of a
  filter view).
- **Category pages** (`/category/hair-care`, `/category/womens-health`, …) —
  every product category has its own fast, shareable web address with an intro,
  the product grid (sort + pagination), a short FAQ, and, for health
  categories, links to matching buyer guides. Old `/shop?category=…` links
  redirect here automatically, and picking a category on the Shop page takes
  the shopper to that category's page.
- **Search overlay** — the header magnifying glass opens a full-width search
  panel. When the box is empty it shows the shopper's **Recent** searches as
  one-tap chips (the last 6, deduped), then Trending brands and Categories.
  Typing brings up live product results **and matching journal articles**
  ("From the journal"). If no products match, the panel shows matching
  articles instead of a dead end — someone searching a brand you don't stock
  (e.g. *Elevit*) lands on your alternatives guide. The full results page
  (`/shop?q=…`) shows the same matching articles below the product grid.
- **Product page** — each product has its images, price (and the crossed-out
  original price if it's on sale), description, ingredients, how-to-use, key
  benefits, FAQs, and its customer star rating. If a product has a **short
  video** (e.g. a makeup swatch), it appears as an extra slide in the image
  gallery with a play button — it **never autoplays** and only loads when the
  shopper taps play, so it doesn't slow the page. If the product comes in
  variants (e.g. shades), the customer picks one before adding to the cart. When
  a shipping zone has a delivery estimate configured, an **estimated delivery
  time** ("Delivery in X–Y working days · COD nationwide") shows by the
  Add-to-Cart button. Under Add to Cart sits a **Buy Now** button that adds
  the item and takes the shopper straight to checkout in one tap, skipping
  the cart entirely (their bag is untouched otherwise: anything already in
  it comes along to checkout as normal). Further down the page, a **"From the blog"** row shows
  up to three journal articles that feature the product (it appears
  automatically when a blog post links to the product, and stays hidden
  otherwise). Below the reviews, a **Questions & answers** section shows
  staff-answered customer questions about the product, plus an **"Ask a
  question"** form (name + question). Nothing a customer asks appears publicly
  until you answer and approve it in **Admin → Questions** — the shopper sees
  *"We'll publish your question once it's answered."*
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
- **Checkout** — a short, COD-first form: phone, full name, address and city
  are the only required fields (province and postal code sit behind an
  optional "More details" link; email is optional for COD and only required
  for online payments). On phones a **sticky bottom bar** keeps the live total
  and the Place Order button on screen the whole time the shopper is filling
  the form. When Cash on Delivery is selected the total reads **"To pay on
  delivery"** with a "pay nothing now" note, so a pay-later order never looks
  like an immediate charge. A short reassurance strip (authentic products,
  cash on delivery, 7-day returns) and a **WhatsApp help link** sit by the
  Place Order button. Only at checkout — once the province is selected — does
  the shopper see the **exact, region-correct** delivery charge and
  free-delivery threshold for their zone, so the promise is never wrong for
  their area. Free delivery is earned on the merchandise subtotal (before any
  discount code), so applying a coupon never strips a free-delivery promise
  the customer has already qualified for.

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

If a wallet or card payment **fails or is abandoned**, the customer is brought
back to checkout with a clear "payment unsuccessful" notice, their bag restored
exactly as it was, and a WhatsApp link in case money did leave their account —
they can retry immediately or switch to Cash on Delivery. (The failed attempt
stays on your Orders list as *Payment failed* for follow-up.)

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
- **Product questions** — any shopper (no account needed) can ask a question
  from a product page's **Questions & answers** section. The question goes to
  the admin **Questions** queue; once a staff member writes an answer and
  approves it, the question *and* answer publish together on that product
  page, credited to the asker's first name. Rejected questions are never
  shown.
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
| **Cash** | The cashbook: what the business actually holds, separate from profit. Record every real cash movement — stock bought from pocket, courier and platform fees, COD money the courier pays over, capital you put in or draw out — and the page keeps a running **Cash in hand** balance, a by-month in/out summary, and the full movement history with who recorded each entry. Deleting a mistaken entry is allowed and logged. |
| **COD reconciliation** (a tab inside Finance) | The cash side of the business — outstanding, collected and in-transit COD money, with courier-manifest CSV exports. Covered in [Finance in detail](#finance-in-detail). |

**Sell** — day-to-day commerce operations

| Section | What it's for |
|---|---|
| **Orders** | Every order placed — saved-view tabs, sortable columns, split Payment/Fulfilment status chips, filters, CSV export and manual order entry. Full breakdown in [Orders in detail](#orders-in-detail). |
| **Products** | The catalogue — create, edit, publish, archive and delete products, with status tabs, column filters, bulk actions, per-row Duplicate and a CSV import/export round-trip. Full breakdown in [Products in detail](#products-in-detail). |
| **Inventory** | Stock levels. See low-stock items and adjust stock counts. Every row shows a **Listing** chip (Live or Draft) beside the stock state, and a product you hold at zero reads **"Sold out, still selling"** unless it has opted into genuine sell-outs. Stock can never go below zero: if you remove more than is on hand, the adjustment is capped at zero, the ledger records the amount actually applied, and the page shows an amber warning telling you what was applied versus what you asked for. |
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
| **Win-back** | A ready-to-send WhatsApp outreach list of past buyers who haven't ordered in 90+ days. Edit the message template (placeholders fill in each customer's name, last product and your coupon code), then work down the list — **Open in WhatsApp** opens your own WhatsApp with the personalised message pre-typed, and each send is ticked off in a shared checklist so nobody gets messaged twice, even across staff members. The included shop link auto-applies the coupon and tags resulting orders as *whatsapp / winback* in **Analytics → Sources**. |
| **Abandoned** | Shoppers who started checkout (typed their phone number) but never placed the order, listed with their saved cart. **Open in WhatsApp** pre-types a personalised message (editable template + coupon) with a link that restores their cart; each send is recorded so nobody is messaged twice, and placing an order removes them from the list automatically. Complements the automatic reminder *emails*, which only reach shoppers who got as far as typing an email address. |
| **Messages** | A threaded inbox for the storefront contact form and inbound email — reply by email straight from the thread, with order history in each conversation header. Full breakdown in [Messages in detail](#messages-in-detail). |
| **Reviews** | Moderate customer reviews, reply to them publicly, and seed reviews yourself. Full breakdown in [Reviews in detail](#reviews-in-detail). |
| **Review asks** | A ready-to-work queue of orders delivered in the last 30 days. **Open in WhatsApp** pre-types a personal review request (same message as the order page's Ask-for-review button) with review links for what they bought and the reward points they'll earn. Each ask is recorded so nobody is nudged twice, and the queue shows whether the automatic review-request email also reached them. |
| **Questions** | Answer customer product questions before they publish on the product page. Full breakdown in [Questions in detail](#questions-in-detail). |

**Marketing** — content and campaigns

| Section | What it's for |
|---|---|
| **Coupons** | Discount codes — three types (Percent %, Fixed PKR, Free shipping), with limits, expiry and an on/off status pill. Full breakdown in [Coupons in detail](#coupons-in-detail). |
| **Blog** | Editorial posts shown in the storefront "Journal" and at `/blog`. Each post has an **Author** field for the byline (defaults to "Yellow Pink Editorial Team"); naming a real expert on health/beauty posts strengthens their search-engine trust signals. The editorial-team byline links to its own **author page** (`/author/yellow-pink-editorial`) with the team's bio and every article it has written — bylines that aren't in the site's author registry stay plain text (author pages are added by the development team, only for real authors). You can also attach a **Medical reviewer** (see below) to a health post, which adds a *"Medically reviewed by Dr. …"* byline and reviewer schema. An optional **SEO title** replaces the post title in Google results and link shares only (the article heading on the page is unchanged) — useful when the full headline is too long to display in search results; keep it under ~46 characters, "\| Yellow Pink" is appended automatically. |
| **Medical reviewers** (`/admin/reviewers`) | The panel of qualified doctors who medically review your health/supplement content — self-serve applications, approval, and their own reviewer dashboards. Full breakdown in [Medical reviewers in detail](#medical-reviewers-in-detail). |
| **Newsletter** | Compose and send newsletter emails, or **save an edition as a draft** and come back to it — drafts sit above the composer with Open and Delete buttons, and sending a draft moves it into the sent history. Manage the subscriber list directly — add, edit, unsubscribe, or resubscribe people. |
| **Outreach** | The backlink and press campaign desk. Pitch emails to bloggers, journalists and directories sit here as **editable drafts** until you approve each one — edit anything, then one click sends it from `hello@yellowpink.pk` under your name. When a prospect writes back, the reply lands **in the same thread** (a bell notification tells you), and you answer from the thread; no personal inbox is involved anywhere. Each prospect carries its score, pitch angle and contact details, and you record the outcome (link live / declined / no response) so the campaign's progress is measurable. Visible to staff with the new **Outreach** permission. |

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

Profit & loss for any period (7/30/90 days or all time): revenue from booked orders, minus **cost of goods** (COGS), delivery and payment-fee costs → gross profit, minus the **returned-deliveries loss** (courier round trips + sunk payment fees on refused parcels) and your logged expenses (ad spend + overheads) → **net profit and margin**. Memo lines under Revenue call out money not yet in hand and orders still awaiting customer confirmation; a memo under Delivery cost says how much of it is your typical-cost estimate rather than a recorded charge.

**Actual courier costs.** The Shipping recovery card shows **"Costs last synced from TCS"** and (for owners/order managers) the **Sync actual delivery costs** button with a 30/90/180-day look-back — it pulls TCS's billing ledger and replaces estimates with real charges, one audit entry per changed order. It needs `TCS_CUSTOMER_NO` in the server settings; if that's missing the page says so instead of showing a button that can't work, and a failing nightly sync rings the admin bell.

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
- **Export CSV / Import CSV** — the spreadsheet round-trip: Export downloads the whole catalogue (all statuses) as one file whose columns match the importer, so you can mass-edit prices, stock or statuses in Excel and re-import the same file — rows are matched by their `slug` column, so don't edit that column. The file includes a **`cost_price`** column, which makes costing a whole brand a single spreadsheet pass instead of hundreds of form saves — and Finance can only show real margin on own-stock items once it's filled. Leaving `cost_price`, `status` or `track_inventory` **blank keeps whatever the product already has**, so a sheet where you've only filled some rows never wipes the rest.

The product form has a **Status** field (Basics section): new products start as **Draft**, so nothing goes live — or gets submitted to search engines — until you switch it to *Published*. Deleting a product that has ever been ordered archives it instead of removing it, so order history and analytics keep the product's name.

**Sets & combos.** Products named like a bundle (combo, set, kit, duo, pack) — or any product that already has components — show a **Set contents & pricing** panel on their edit page. Add the individual products the set contains (with quantities); the panel then shows what the components cost separately, what the customer saves at the set price, and **our margin per set**. Costs come from each component's cost price — and where none is entered, the panel **derives the cost from the vendor's commission terms** (retail minus our commission, marked *derived* with a note), so commission vendors like NB Sons get real margins with no data entry. It warns loudly when the margin can't be verified (a component has neither a cost price nor commission terms), when the margin is below 15%, or when the set isn't actually cheaper than buying the items one by one. The same list powers the storefront's "What's Inside This Set" section and expands the set into a per-item packing list in vendor WhatsApp messages. A **Copy vendor explainer** button gives you the ready-to-send message that introduces the set to the vendor: their individual products, sold together at our discounted set price, their per-item billing unchanged.

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

**Customer free-delivery rule (per vendor).** Each vendor's Settlement terms editor (and the Add Vendor form) has a **"free ship ≥" / "Customer free delivery from (PKR)"** field. Set an amount and any basket whose items *from that vendor* total at least that much ships **free nationwide**, overriding the zone thresholds — this is how the NB Sons "free from Rs 1,999" match of their own store works, and you can now give any vendor its own threshold (or change NB Sons') without a developer. Leave it blank for no rule. The promise flows everywhere automatically: the product page's delivery line, the cart and mini-cart progress bar, checkout's quote, and the order pipeline's enforcement. Settings → Shipping lists all active vendor rules read-only so the whole delivery-pricing picture is on one screen.

### Customers in detail

Everyone who has bought from you. Each row carries a **Registered** badge (the shopper created an account) or a **Guest** badge (they checked out without one). Search by name, email or phone, and open any customer to see their orders and lifetime spend.

The customer page shows four stats — **Orders / Delivered / Total spend / Avg order** (total spend and average exclude cancelled, refunded, returned and payment-failed orders so they reflect realized revenue) — plus a tap-to-call phone link and a one-tap **WhatsApp** button that opens chat with a Yellow Pink greeting pre-filled.

A registered customer's page also shows a **Reward points** card — their current balance and lifetime points — and, with the *Customers — Edit* permission, a small **Adjust points** form: enter a positive or negative amount and a short reason to credit or deduct points on the spot. This is how you award the **Google review bonus** (Google can't tell the site who reviewed, so you grant it by hand once you see the review land), and it also covers goodwill credits and corrections. The adjustment appears on the customer's own rewards page as *"Manual adjustment"* and is recorded in the activity log.

Guests are grouped by email (a guest's repeat orders show as one customer); if a guest later signs up with the same email, their orders move under that account automatically. With the *Customers — Delete* permission, a registered customer's page has a **Danger zone** to permanently delete their account; their orders are kept (detached as guest orders) so revenue history stays intact. Guests have no account to delete — remove their orders individually instead.

### Messages in detail

A **threaded inbox** for the storefront **contact form** and **inbound email** (direct emails to your store address show an **Email** tag). Messages are grouped into **conversations by customer** and laid out like a mail app: a **thread list on the left** (unread threads bold with a pink dot, plus a preview of the last message) and the **open conversation on the right**, shown as a chat (their messages on the left, your replies on the right). On phones the panes become screens — the list first, then the conversation with a back link.

- **Order history at a glance** — each conversation's header shows how many orders the customer has placed, their lifetime total, and the latest order with its status (e.g. *3 orders · PKR 12,400 · last: YP-1042 (shipped)*), so you know who you're talking to before you reply; click it to open their filtered order list.
- **Reply right here** — the box at the bottom of a conversation sends your reply **from your store address via email**, and the reply is saved into the thread, so the whole exchange stays on record. When the customer replies, it threads back into the same conversation automatically.
- **Per-conversation actions** — **Mark read** / **Archive** / **Restore**, and a **search box** above the inbox finds a thread by customer name, email or subject.
- **Notifications** — the Messages menu item shows a pink badge with the unread count, and the bell notifies on new **incoming** messages (your own replies don't notify).

### Reviews in detail

Moderate customer reviews and talk back to them. The **Pending Approval** queue always sits at the top (the sidebar shows a badge with its count); below it, **All Reviews** is searchable (name or review text), filterable by **product** and **status**, and paginated — no more silent cap at the last 20. The search/product/status filters apply as you type — no Filter button.

On any live review, **Reply publicly** posts a *"Response from Yellow Pink"* that appears under the review on the product page (edit or clear it any time — saving an empty box removes it). You can also seed reviews yourself (migration / phoned-in feedback) via the **+ Add review** button in the page header.

**Ask for Google review** — approved **4–5★** reviews whose reviewer has a phone number on file get a green **Ask for Google review** button. It opens the reviewer's WhatsApp pre-filled with a roman-Urdu thank-you, your Google review link, and the extra-points offer (both set in **Settings → Loyalty → Google review bonus** — the button only appears once the link is saved there). The ask is deliberately limited to *already-approved, positive* on-site reviews: an unhappy on-site review can be handled privately in moderation, but a bad Google review is public and permanent — so never invite one. When the Google review shows up, award the bonus points from the customer's page (see [Customers in detail](#customers-in-detail)); the message asks them to reply once they've reviewed so you know to credit it.

### Questions in detail

Customer product questions, moderated the same way as reviews and gated by the
same **Reviews** staff permission. The **Awaiting an Answer** queue sits at the
top (the sidebar shows a badge with its count); each pending question shows the
product, the question, who asked and when, with an answer box right there —
write the public answer and press **Answer & approve** to publish the Q&A on
that product page (approving without an answer is refused: a published question
is never left hanging). **Reject** quietly drops a question (spam, duplicates,
things better handled in Messages); the customer is not notified either way.

Below the queue, **Published Q&As** lists everything currently live on product
pages, newest first — **Unpublish** pulls a Q&A off its product page
immediately. Both approve and reject are recorded in the Activity log.

Published Q&As appear in the product page's **Questions & answers** section
(question, your answer, the asker's first name and dates). Good answers do
double duty: they close the sale for the shopper who asked, and they're unique
product content search engines index — questions real customers ask are
exactly what other buyers search for.

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

**Two things happen before a visitor ever sees the 404 page.** First, if the address is a mangled version of a real one — an old WordPress `-copy` suffix, odd capitals, a stray `%20` from a badly pasted link — the store sends them straight to the correct page, but only when that exact page is genuinely live. Second, if it can't be repaired, the 404 page reads the address and shows **what the visitor was probably after**: matching products from the catalogue, the brand page if the address names a brand you stock, a shop search already filled in, and a WhatsApp link. Someone landing on a dead product link sees the nearest real products instead of a dead end.

Two deliberate limits worth knowing. The store will **not** guess its way between similar products — `beauty-cream` and `white-beauty-cream` are different tubs at different prices, so those are offered as suggestions for the shopper to pick from rather than jumped to automatically, which would quietly sell the wrong item. And the page still reports itself as a 404 to Google even though it now looks helpful: pretending a missing page exists is penalised by search engines, and it would also stop these URLs appearing in this report, which is how you find out about them at all.

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
in *Order costs*). What happens to the order depends on how you book:

- **Book pickup via the courier API** records the consignment as
  **Booked — awaiting pickup** and moves the order to **Preparing**. The order
  flips to **Shipped** and the customer gets their shipping email with the
  tracking number automatically when the courier's first pickup scan appears
  (the daily tracking sync picks it up; **Sync tracking now** on the order page
  fetches it immediately). The parcel is still on your shelf at booking time,
  so the customer is only told "shipped" once it's true.
- **Manual tracking entry** assumes you've already handed the parcel over
  (you're typing a consignment number the courier gave you), so it marks the
  order **Shipped** and emails the customer right away.

Either way you don't need to change the status by hand in Step 4, and an order
that is already Shipped or Delivered is left alone and never emailed twice.

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
| **Loyalty** (`/admin/settings/loyalty`) | How customers earn and redeem loyalty points, and the **refer-a-friend** rewards (points to the referrer, a first-order discount to the friend). Referral links now work end-to-end: when someone arrives on a `?ref=<code>` link the code is remembered for 90 days and, once they place their first order while signed in, it is stamped onto their profile so the referrer is paid out when that order is delivered. Also home to the **Google review bonus** — paste your Google Business review link and set the extra points; the Reviews page then offers an "Ask for Google review" button on approved 4–5★ reviews. |
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
| `POST /api/blog` | Create a post. JSON body: `title`, `slug`, `excerpt`, `category` required; optional `body`, `image_url`, `author`, `read_time`, `featured`, `seo_title` (short search-result title, max 60 chars), `date` (defaults to today). |
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

### 13 August 2026

- **A new shade no longer needs a developer.** The product page's Variants section used to offer only the shades and sizes that already existed; anything new meant a database edit. Now an **"+ Add value"** bar sits above the variant list: pick the attribute (Shade, Size, Form…), type the new value, and it immediately appears in every variant dropdown, with duplicates caught by name. And a product whose variants need a whole new axis can create the attribute itself (name plus first value) right where the old screen used to say to ask a developer.

- **A Cash page now tracks the actual money, separate from profit.** Finance tells you what the store *earned*; it never knew what you *hold* — stock is bought in bulk from pocket, fees go out in lumps, COD money arrives on the courier's schedule and your own capital moves in and out, none of which is profit or expense at that moment. **Admin → Cash** is the cashbook: pick what happened (stock purchase, courier fees, COD remittance, capital put in, and so on), enter the amount and date, and the page maintains a running **Cash in hand** figure plus a month-by-month in/out summary. Money-in versus money-out is decided by the category, so an entry can never be recorded backwards. To start, record what the business holds today as *Capital put in*, and the balance is real from that moment. Visible to anyone with the Finance permission.

- **The product form stops pretending a variant product has one stock number.** For a product with shades or sizes, the real stock lives on the variants — the storefront, checkout and Inventory all use the variants and ignore the parent counter — yet the form still showed an editable parent "Stock Quantity" that did nothing but mislead. Now, when a product has variants, that field becomes a read-only total ("328 across 33 variants") pointing you to the Variants section, and saving the form can no longer overwrite anything. The **Who holds this stock?** choice now clearly covers the variants too: mark a product vendor-held or uncounted and the per-variant stock boxes disappear as well, with the server refusing stray stock writes for those products.


- **A new Outreach desk runs the backlink campaign from inside the admin.** **Admin → Outreach** holds the pitch emails to Pakistani blogs, news desks, brands and directories that the backlink campaign produced. Each pitch is a **draft until you approve it**: open a prospect, edit the subject or body freely, and one click sends it from `hello@yellowpink.pk` signed with your name. When someone writes back, their reply threads into the same conversation (with a bell notification), and you answer from right there — replies are received by the store itself, so no personal email address appears anywhere in the campaign. Prospects carry a score and a specific pitch angle, and you log outcomes (link live / declined / no response) so the campaign's results are countable. A matching **Outreach** permission controls who on the team sees it. The research behind the prospect list lives in `docs/outreach/`.

- **The Inventory screen now says whether a product is actually on the storefront.** Every row in the stock table carries a **Listing** chip — **Live** for a published product, **Draft** otherwise — so a zero next to a draft (needs no action) can no longer be confused with a zero on a live listing (orders are being taken against goods not on the shelf). The Reorder needed panel flags drafts the same way. And because a live product now keeps selling past zero, the old red "Out of stock" badge was overstating: a product you hold at zero now reads **"Sold out, still selling"** unless you've ticked *Show as sold out when the count reaches zero*, in which case it still reads Out of stock, because for that product it truly is.

- **Mangled addresses of a second shape now recover too.** A relative link inside a page could produce addresses like `/product//product/f-lium-drops` — the single most-hit broken address from real visitors, pointing at a product that was live the whole time. Those now land on the right page instead of the 404.

- **In-browser translation no longer half-breaks.** Shoppers using Chrome's built-in page translation (typically English → Urdu) were having the translation requests blocked by the site's security policy — reported by live monitoring on 12 August. The translation endpoints are now allowed, so translated browsing works fully.

### 12 August 2026

- **A live product no longer goes out of stock on its own.** Your rule: if we don't have it, we'll source it, so a shopper should never meet a dead listing. When something you hold runs down to zero it **keeps selling** — no sold-out badge, no blocked checkout, and it stays in every shop rail and search result instead of vanishing. The count itself stays honest, so the item still shows in **Reorder needed** exactly when you need to act on it. Two deliberate details. Each product has a **Show as sold out when the count reaches zero** tickbox, off by default, for anything genuinely unrepeatable. And in Google's data the item is published as **on backorder** rather than "in stock" — still orderable and still shown in Shopping, but not a claim that it's on the shelf, which is what gets a Merchant Center account flagged.

- **You get told the moment something runs out.** Because running out is now invisible to the shopper, it has to be visible to you: the instant a sale takes the last unit of something you hold, a **push notification** goes to the admin devices and a bell entry lands in the admin, linking straight to Inventory. It fires once per sell-out, not on every subsequent order, and it doesn't fire for products marked as a genuine sell-out (those already show as unavailable, so nobody is caught out). The bell is visible to staff who can edit products, so whoever runs the catalogue sees it and a marketer doesn't. No email: this happens during normal trading and an inbox that cries wolf gets ignored.

- **Every stock change now appears in Movement history, and phone orders understand shades.** Five places used to change a stock number without leaving a trace: the product form, the inline edit on the Products list, the variant form, the CSV importer, and Duplicate. The number moved and the history said nothing, so "why does this say 12?" had no answer. All five now write through the ledger with your name, a reason and a note on each line ("Set on the product form", "Inline edit on the Products list", "Set by CSV import"). Duplicating a product now starts the copy at **zero** stock rather than inheriting the original's count, because copying a listing does not copy the goods. Separately, **New order** (the manual order screen for phone and WhatsApp sales) now lets you pick the actual shade or size. It used to check the parent product's number and ignore the shades entirely, so an order for 2 NARS foundations was refused as "need 2, have 1" while 328 units sat across 33 shades — and any order it did accept moved the wrong counter, which then went further wrong if the order was later cancelled. Searching a product with shades now lists them individually with each one's own price and count.

- **The stock figures on the books are now real, and only real.** Following the classification above, every published product that had no owner recorded was set to **vendor-held**, and every leftover count on a product nobody counts was cleared: **2,197 units across 101 rows**, parents and shades alike (Kiko Milano 255, Kryolan 110, Dior 80, NARS 80, Makeup Revolution 80, Tarte 70, PIXI 70 and the rest). Those numbers were left over from the old import and nothing maintained them, so the first inventory-value report would have counted stock you don't own. The whole catalogue now reports **240 units, on the 18 products you actually hold** — the only figure Finance should ever treat as inventory. Every clearance is an adjustment line in **Inventory → Movement history**. Nothing changed on the storefront: vendor-held products always sell regardless of count.

- **Every product now says who holds its stock.** The product form's single *Inventory managed externally* tickbox has become a three-way choice under **Who holds this stock?** — *We hold this stock* (counted here, checkout refuses an order once it runs out, and it carries an inventory value in Finance), *A vendor holds it* (their shelf and their count, always sellable, never decremented, worth nothing on our balance sheet), or *Don't count this one* (we sell it and deliberately keep no count). The old tickbox could not tell the middle case from the last one, which is why every vendor-supplied product was **invisible** on the Inventory screen while everything on the screen had no vendor at all. Today's split: 18 we hold, 100 vendor-held, 464 uncounted. That last number is the one worth working through — most of those are probably vendor-held with the vendor never recorded.

- **The Inventory screen stops burying the real movements.** Three changes. *Movement history* no longer leads with the one-off 19 May stock import, which was filling 155 of the 200 visible rows and pushing genuine sales and returns off the page (the **Import** chip still shows it). Archived products are out of the counts. And a new **Externally managed** tab lists the vendor-held products, which had no home before — their Stock column reads a dash rather than a number nobody maintains, so a vendor product can no longer look like an alarming red zero while it is selling perfectly well.

- **The invented stock numbers are gone.** 87 products were carrying a stock figure of exactly **50** that nobody ever counted — it came from a single bulk import on 19 May 2026 and was never touched again (a few had round-tripped through an order and a cancellation back to the same 50). Together they claimed **4,900 units** that may or may not exist, and on 21 of them that fictional number was the figure checkout was enforcing. All 87 are now set to **inventory managed externally** and their counts cleared to zero, ready for a real count. Every clearance is recorded in **Inventory → Movement history** as an adjustment reading "Cleared 2026-05-19 import seed value", so the correction explains itself instead of a number silently changing. **Nothing went off sale**: an externally-managed product always sells regardless of its count, which is exactly why the switch was made before the numbers were cleared. As you count each one, set its real figure and switch it back to counted stock.

- **A cancelled order no longer invents stock (and an import no longer destroys it).** Two inventory-counting bugs, found while auditing the stock system. First: cancelling an order credits its items back, which is correct for something you hold and count, but for a product marked *inventory managed externally* nothing was deducted at the sale in the first place — so the credit was inventing units. That was fixed for ordinary products on 1 August; it turns out the fix missed products sold by **shade or size**, where 20 live products were still exposed. It has now been closed for those too, and no bad data was created in the meantime. Second, and more dangerous: importing a product CSV **without** a stock column used to set every row it touched to zero, which would have taken 37 in-stock products off sale in one click with no record of what they had been. A blank stock cell now leaves the count alone, exactly like price and cost. Setting stock to zero has to be written as a real `0` in the cell.

- **A dead link now tries to become a sale.** Two changes. An address that is a mangled form of a real one (a WordPress `-copy` suffix, odd capitals, a stray `%20`) now sends the visitor straight to the right page, provided that page is genuinely live. And when the address can't be repaired, the 404 page reads it and shows what they were probably after: matching products, the brand page if the address names a brand we stock, a pre-filled shop search, and a WhatsApp link — instead of the same four bestsellers everyone got. Where the address matches nothing plausible (a bot probing `/wp-login.php`), the page is unchanged. The store deliberately does **not** guess between similar products, and the page still reports a 404 to Google — see [Broken links in detail](#broken-links-in-detail) for why both of those are on purpose.

- **Hello Hair is now its own brand, and both brand pages have real content.** 59 Hello Hair products (56 drafts plus the 3 already live) were filed under *Golden Pearl*, which is wrong for shoppers: "hello hair shampoo" is searched 1,300 times a month in Pakistan on its own. They now sit under **Hello Hair** at `/brand/hello-hair`, with the four shampoo trade packs moved out of *Moisturizers* into *Hair Care*. Both `/brand/golden-pearl` and `/brand/hello-hair` gained written brand pages with FAQs (how to spot a counterfeit Golden Pearl tub, which face wash suits which skin, which shampoo for hair fall), the same treatment the other priority brands got.

- **The Golden Pearl drafts are now findable instead of invisible.** All 344 of them arrived from the old site with generic slugs and brandless page titles — `/product/aloe-vera-gel` titled "Aloe Vera Gel, Price in Pakistan", competing against the whole internet for a term nobody shopping for Golden Pearl types. Every draft now carries the brand in its address and its search-result title ("Golden Pearl Aloe Vera Gel Price in Pakistan"), which is what the demand actually looks like: *golden pearl* 22,200 searches a month, *golden pearl cream* 6,600, *golden pearl face wash* 5,400. Also fixed along the way: eleven products whose address still described a different product they'd been copied from (a "Salon Glow Facial Kit" living at `/product/…skin-polishing-pack…`), four ALL-CAPS imported names, a "Shmapoo" typo, and a product name with "in Pakistan" stuffed into it.

- **Product costs can be filled in a spreadsheet.** The catalogue **Export CSV** now includes a `cost_price` column and the importer reads it back, so costing a whole brand is one export → fill → import instead of hundreds of individual form saves. Finance shows own-stock items at 100% margin until costs are entered, and the 344 Golden Pearl products currently have none. Blank cells are left alone rather than cleared, so a partly-filled sheet is safe to re-import.

- **The courier can no longer "book" a parcel that never reaches TCS.** Order YP-6WTC3EC7V was booked through the system on 11 August, showed a consignment number and "awaiting pickup", and sat unshipped for nine days — because the booking went to TCS's *test* environment, which accepts bookings and issues consignment numbers that exist nowhere in the real TCS account. Nothing on our side looked wrong. Now, if the courier settings point at a test environment, **API booking is switched off automatically** and the order page shows a red warning explaining why, with the fix. Staff book on the TCS portal and enter the tracking number in the Manual tab, exactly as before. The one thing that can no longer happen is a parcel silently going nowhere.

- **Automated WhatsApp order confirmations (needs Meta setup before it switches on).** Seconds after any order is placed, the customer receives a WhatsApp message with their order number and total and two buttons: **Confirm order** and **Cancel order**. Tapping Confirm marks the order confirmed automatically — the same tick staff apply by hand today, so dispatch readiness, the unconfirmed-order escalation and the COD refusal flag all keep working, they just no longer wait for someone to be awake. The customer immediately gets a "thank you, confirmed" reply. Tapping Cancel never cancels anything on its own: it rings the admin bell so a person decides, and reassures the customer that the team will follow up. Every message is logged with its delivery status and the customer's reply. This is the paid Meta channel and costs roughly PKR 4–12 per order; it stays completely dormant until the credentials are configured, and the existing free "chat on WhatsApp" buttons are unchanged. Setup walkthrough: `docs/WHATSAPP-SETUP.md`.

### 11 August 2026

- **Every order now gets an instant confirmation path, even at 3am.** Order YP-4EZ30H965 exposed a gap: the customer gave no email, staff were asleep, and nothing from us reached them. The flow now adapts to the order. **Customer gave an email** (about 4 in 5 orders): the confirmation email goes out instantly, tells them our team will WhatsApp them to confirm before dispatch, and carries an optional "Confirm on WhatsApp" button; the thank-you page says the same ("confirmation email sent → our WhatsApp is coming → delivery") with the WhatsApp button offered as an optional speed-up, not a required step. **No email given**: the thank-you page leads with the green "Confirm your order on WhatsApp" button (pre-types "Confirming my order YP-XXX"), because the customer's own message is the only instant channel — they start the thread at any hour and staff wake up to a warm chat. Checkout also shows a one-line nudge under the optional email field; the field stays optional, no new friction.

- **Prices in articles and landing pages can no longer go stale.** Content authors write `[[price:product-slug]]` instead of typing a price; the page renders the product's current catalogue price automatically. Works in blog posts, brand pages, collection pages and their FAQs (including what Google reads). All brand-page prices already use tokens. Background: the 11 August price audit changed 146 prices and left ~70 quoted figures wrong across the blog, some showing a third of the real price; that class of problem is now structurally impossible wherever tokens are used.

- **Collection pages can carry an article and FAQs too.** The same two fields added to brands are now on Admin → Collections → edit: **Page content (HTML)** and **FAQs** (`Q:` / `A:` lines). Use this to build a hub page for a category people search for, rather than only merchandising products. The first is **Pregnancy & Ovulation Tests** at `/collection/pregnancy-tests`, which groups every test we stock with a how-to-choose guide, when-to-test advice and FAQs.

- **Prices quoted inside blog posts are kept in step with the catalogue.** After a bulk price change, any post quoting an old price is corrected so a shopper never reads one price and finds another at checkout. If you change prices yourself, search the journal for the old figure, or ask and it can be swept automatically.

- **Brand pages can now carry a full article and FAQs.** Admin → Brands → edit a brand gains two new fields: **Page content (HTML)**, a long-form section rendered under the product grid on the public brand page, and **FAQs**, typed as alternating `Q:` / `A:` lines. FAQs appear as an expandable list on the page and are sent to Google as FAQ structured data, so they can show directly in search results. Use this to build out pages for brand names people search (the Saeed Ghani page shipped with the feature as the first example). Products link with `/product/<slug>`; keep claims factual, the page speaks for the store.

### 10 August 2026

- **Refused-delivery flags now have teeth — without touching checkout.** When a confirmed COD order is marked **Returned**, the customer's phone number *and* email are automatically flagged. Checkout is deliberately untouched (no blocked orders, no hidden options, nothing that could cost a sale): the flag works at dispatch instead. A new COD order from a flagged customer rings the admin bell ("collect advance payment before dispatching"), and the order page shows an amber **"Refused-delivery flag"** card telling staff to take bank/JazzCash payment before booking the courier, with a **Remove flag** button for judgment calls (a courier's failed attempt isn't the customer's fault). The flag clears itself the moment any later order of theirs is **Delivered** — one successful delivery restores normal COD. Matching uses the normalized phone (0300…, +92300…, 92300… all match) and lowercased email, so a changed SIM alone doesn't dodge the flag.

- **A gentle refusal deterrent, sent only after a customer confirms.** COD refusals are where losses come from, so confirmed customers now hear — softly — that refused parcels cost the store the full courier round trip and that such addresses get **flagged** — future orders from a flagged address must be paid in advance, COD is no longer offered to it (deliberately not "blacklisted": the customer can still order, just prepaid). Three placements: a new **"Send thanks + delivery note (WhatsApp)"** button on the order page that appears once an order is marked confirmed (Roman Urdu, same voice as the confirmation ask — the ask itself is unchanged so the note can never discourage a YES); one sentence on the **Track Order** page while a COD parcel is still on its way; and a line added to the **COD FAQ**. Nothing appears at checkout or before confirmation.

- **NB Sons products now offer the same size, form and flavour choices as the brand's own store.** Eight products gained a picker on their product page, priced exactly at NB Sons list: SimZee Zinc Syrup (60ml Rs 180 / 120ml Rs 350), Simrid (Syrup Rs 250 / Drops Rs 225), CALIN-G (Syrup Rs 420 / Tablets Rs 690), Multiflux (Syrup Rs 530 / Tablets Rs 890), Ferosim (Syrup Rs 450 / Tablets Rs 495), Citowit (Syrup Rs 880 / Tablets Rs 1,550), Calosent (Orange / Lemon / Mango, Rs 350 each) and S-Lyte ORS (Lemon / Orange, Rs 299 each). Shoppers who wanted the other pack size or form no longer have to leave the store. The weekly parity check now compares each option against the brand's matching option, so these can never trigger a false "priced below vendor" alarm.
- **Finance respects flat vendor margins.** Orders holding a flat-commission vendor's products (like Nazirs Group / NB Sons at 35%) now show their real cost and margin in Finance even before dispatch — the P&L derives the cost from the vendor's commission instead of showing an unknown margin when the product has no per-unit cost recorded.

- **Price-parity alerts no longer compare different pack sizes.** The weekly NB Sons parity check emailed a false alarm: our SimZee Zinc Syrup **60ml** (PKR 180) flagged against their **120ml** listing (PKR 350), because the fallback matcher paired products by brand name alone. The checker now reads pack sizes and strengths out of both product names (60ml, 120ml, 20mg and so on) and refuses to compare listings whose stated sizes differ — those show up in the "unmatched" count instead. No price was changed; the 60ml at PKR 180 was never below NB Sons's price for the same product.

### 9 August 2026

- **Online payments (JazzCash / card) ready to switch on, and gateway payments now mark themselves paid.** The JazzCash checkout integration (customers pay by JazzCash wallet or debit/credit card on JazzCash's own secure page, with automatic confirmation) was verified against the official JazzCash documentation and hardened: transaction timestamps now use Pakistan time as the gateway expects, transaction references can no longer collide when two shoppers check out in the same second, and the signature scheme was pinned down so JazzCash can't reject our requests over an ambiguity in their spec. When a gateway confirms a payment, the order now automatically shows **Paid** in admin (with "JazzCash gateway" as who confirmed it) instead of sitting amber "Payment pending" until someone marked it by hand — cash-on-delivery reconciliation stays manual, exactly as before. To go live, add the three JazzCash merchant credentials to the server settings (see Settings → Integrations, which shows what's missing) and the JazzCash / Card options appear at checkout on their own.

- **SEO rankings page: charts, segment tags and a Refresh now button.** Marketing → SEO rankings now opens with two daily-trend charts (Google impressions and clicks over the last 28 days, hover any point for the exact day), a colour bar showing where all tracked keywords sit (Top 3 / positions 4–10 / page 2 / 21–100 / not ranking), and a "Climbing / Slipping" panel naming the biggest Google position movers in the window. Every tracked keyword now carries a segment tag (skincare, supplements, contraception, women's health and so on — the same tags as the Semrush Position Tracking campaign), and a tag chip row filters the table to one segment. Keywords within striking distance of page 1 (positions 5–20) are flagged with an amber badge, and buy-intent phrases ("price in pakistan", "best …") with a green one. A freshness line shows when Google data was last pulled, with a **Refresh now** button that fetches fresh Search Console numbers on the spot instead of waiting for the nightly update.
- **The COD tab now shows TCS's own word on whether it paid you.** The nightly cost sync (and the Finance sync button) also reads the courier's COD payout ledger and stamps each order with TCS's claim. On COD reconciliation, every outstanding order gains a **"TCS payout"** column: a green "Paid out (date)" chip means the courier says the cash was remitted, so check your bank statement and hit Record; "not yet" means TCS is still holding it, and a chip that stays green for days without the money landing is your cue to chase TCS. Recording payment stays a manual, bank-confirmed step on the order page; the chip is the courier's claim, never an automatic confirmation.
- **Finance answers "where is my cash" and "how was July".** The COD tab now opens with a four-stage cash pipeline (Booked awaiting confirmation → In transit with the courier → Delivered, cash to confirm → In the bank), with vendor-held money shown separately; a pending COD order's cash finally has a stage instead of sitting in no bucket. The overview gains a **Returns impact** card (count, return rate of parcels that reached a customer, GMV lost, cash cost), a **"Vendors owe you PKR X"** banner linking to the Vendors page, and on All time a **By month** table (revenue, costs, returns loss, net per calendar month in Pakistan time) so July vs August is one glance. Filter quality-of-life: switching between Overview and COD reconciliation keeps your selected range and payment method; new **Today** and **This month** range presets (Pakistan-time); the top KPI row swaps the always-zero Ad spend tile for **"Cash not in hand yet"**; the P&L notes when no expenses are logged; and saving a back-dated expense now lands you on a view where the new row is actually visible.
- **Finance's numbers are now honest, and the TCS cost sync can finally work.** The "Sync actual delivery costs from TCS" button had never once succeeded — it needs your TCS customer number (`TCS_CUSTOMER_NO`) in the server settings, which was never set, and both the button and the nightly job failed silently. Now: the Finance page says plainly when the sync isn't configured (and shows **"Costs last synced: … / never"**), a failed nightly sync rings the admin bell, the button gained a **30/90/180-day look-back** (default 180, so old consignments and return legs backfill on the first real run), and every synced cost writes an audit entry per order. The profit numbers were also corrected: orders with no recorded courier charge now use your typical-cost estimate in the P&L (marked "estimated") instead of counting as zero cost; the **returned-deliveries loss (courier round trip + sunk payment fees) is now actually subtracted from Net profit** instead of only being displayed; orders with no product cost anywhere show margin "—" with a callout instead of a fake 100%; the revenue line is labelled "booked orders" with an "awaiting customer confirmation" memo for unconfirmed COD; and a vendor-delivered return is labelled as such rather than shown as a suspicious zero. Staff without the Orders — Manage permission no longer see (or crash on) the sync button.
- **TCS API bookings are now actually usable end to end.** The missing piece was the label: TCS sends it as a direct PDF download, which the system couldn't handle, so API bookings produced a consignment number with nothing to print — the rider would fill a manual CN slip, the parcel travelled under that different number, and the API booking never tracked (the 28 July double-booking). Three fixes: a **Print label (PDF)** button on every API-booked shipment that fetches the label fresh from TCS at click time; a **Fix tracking number** option on the shipment panel for when a parcel did go out under a different CN (old scan history clears, the change is audit-logged); and a **watchdog** that rings the admin bell if a booking still has no courier scan after 36 hours, so a stuck pickup can't sit unnoticed. The booking flow itself is unchanged: book via API, print the label, hand the parcel over with that label.

### 8 August 2026

- **Tapping "Add to Cart" before picking a shade now helps instead of ignoring you.** On products with shades or sizes, the Add to Cart and Buy Now buttons used to sit greyed-out until a choice was made, and on phones that meant taps that did nothing (one shopper tapped 40 times before finding the picker). Now any tap scrolls straight to the shade picker, highlights it, and says in words what still needs choosing.
- **Search now forgives typos.** "la rouch" finds La Roche-Posay, "beuty" finds the beauty ranges, and "eye patches" shows the closest eye-care products we stock. Misspelled searches used to show an empty "No results" screen.
- **Product pages load faster on repeat visits.** The server now serves a saved copy of product pages for up to a week while quietly refreshing in the background, so the slow first-load most shoppers were hitting (4+ seconds on phones) becomes a near-instant load for everyone after the day's first visitor. Price and stock edits still appear within about 5 minutes.
- **Google indexing checks got their own daily slot.** The job that asks Google "is this page indexed yet?" was squeezed to ~6 pages a day behind other nightly jobs; it now runs on its own schedule and covers ~50 pages daily, newest posts first, so new articles' indexing problems surface in days instead of weeks.
- **Duplicate multivitamin guide removed.** Two posts competed for the same Google search; the older one now permanently redirects to the newer, and the Centrum comparison post got a sharper title. One-time SEO cleanup, no action needed.

### 7 August 2026

- **"Shop by brand" on the homepage is now a moving carousel, trending brands first.** The brand logos glide in a smooth continuous loop (it pauses the moment you hover or tap-hold, and every logo stays clickable). The order is no longer fixed: the brands with the most real shopper activity this week (from the same nightly scores that power Best Sellers and Trending) lead the row, so the carousel always opens with what's currently moving. You still choose which brands appear; visitors who prefer reduced motion get a plain swipeable row instead.
- **The Dashboard's Quick Answers panel now shows the recommendation funnel.** Each answer's row gained a "Product clicks" column (how many times its result-page suggestion was clicked in the last 7 days), a "Most-clicked recommendations" list names the exact products shoppers tapped and which answer sent them, and the footer adds two running totals: recommendation clicks, and visitors who clicked a recommendation and then purchased. The new Fertility Quiz is also counted in the panel's traffic numbers now. Same refresh cadence as the other analytics panels.

### 5 August 2026

- **Checkout rebuilt for phones and correct delivery pricing.** The address form now asks for the **province first** (a one-tap dropdown): the exact delivery charge and arrival estimate for that zone appear immediately, before the shopper types anything else — this also permanently fixes the undercharging that happened whenever a smaller town wasn't in the city list. The city field's ugly browser dropdown is replaced with a proper in-store suggestion list that filters to the chosen province. Shoppers can change quantities or remove items right in the order summary (with a confirmation if it's the last item), phones get a collapsed order summary at the top of the form plus a smarter bottom bar that shows any error at the exact moment of ordering, and the whole page renders correctly on dark-mode phones (native menus used to appear black). Under the hood the Place Order button can no longer get stuck: a failed rate-limit check, a lost connection or a delivery-price change now each explain themselves and recover, and a double-submitted order can never be placed twice.
- **No more emoji icons on the storefront.** The lock, ticks and package symbols on checkout and product pages are now proper brand-styled icons that match the rest of the site on every device.

- **Every Quick Answer now suggests the right next step for that exact result.** A calculation's outcome picks one gentle recommendation from the live catalogue: the Fertile Days Finder suggests the ovulation combo kit (or pregnancy strips when the dates say the period looks late, or the cycle guide when cycles are irregular); the Due Date Finder suggests folate in the first trimester and the prenatal combo after; the weight and calorie checks point to the calorie tool or protein where it genuinely fits. One suggestion per result, never a shelf. Clicks are tracked so the Dashboard's Quick Answers panel can show which results turn into orders.
- **New Fertility Quiz at /fertility-quiz.** Four questions, no personal details, and the answer pattern points to the most useful next step: better timing, a hormonal (PCOS) check, the male side, or a full fertility workup after a year. Each result explains itself in plain language, links the right guides, and appears with the other Quick Answers across the site.
- **Homepage: "Just landed" moved below the demand-ranked rails.** New arrivals have no sales history by definition, so the premium slot under Featured now goes to the sale and the demand-ranked rails (Best Sellers, Trending); new arrivals show further down as freshness for returning shoppers.

### 4 August 2026

- **The cart's free-delivery bar now knows about brand thresholds.** When everything in the cart is from a brand with its own free-delivery deal (like NB Sons over Rs 1,999), the "Add PKR X more" nudge counts toward that brand's threshold instead of the storewide one — a Rs 1,490 NB Sons basket now correctly says "Add PKR 509 more", not "Add PKR 3,510 more", with a note that the brand ships free nationwide over its threshold. Mixed carts keep the storewide number so the promise stays unambiguous.

- **Traffic sources on the Analytics page are finally real.** The funnel, its by-source and by-device slices, and the top-referrers panel previously branded every visitor "direct" (they read a tracking field this site never captured, and the funnel only counted people who entered via the homepage — which organic visitors rarely do). All four now count unique sessions from whatever page a visitor lands on, attributed to the site that sent them. First honest reading: Google is already the number-two source with real purchases, and ChatGPT, Bing and Facebook all send measurable traffic. Numbers refresh with the next analytics update.

- **The homepage is now systematically merchandised, and you can see why.** Every product rail runs on one engine with a one-sentence rule: Featured shows your flagged products taking daily turns (in stock only now); Best Sellers shows up to two of your pins first, then the genuine top sellers weighted toward recent sales; Trending shows real shopper momentum (and never a rotated-out best seller); On Sale shows the deepest live discounts (minimum 10%); New In shows the newest arrivals not already placed above; K-Beauty caps at two products per brand; the Wellness rail rotates the most-engaged products. No product ever appears in two rails, and the demand-driven rails always get first claim. A new **Admin → Homepage preview** page (linked from the Dashboard) shows today's exact tiles with each product's reason.
- **A "Merchandising health" card on the Dashboard.** It warns when something is genuinely broken (a sold-out product holding a pin, the sale section on with nothing qualifying, a post missing its hero image, the score refresh not having run in 48 hours) and quietly advises on the rest (a featured post older than 60 days, pins with no shopper activity, extra best-seller pins beyond the two slots). It nags, never blocks.
- **Featuring a blog post is now exclusive and fresh.** Ticking "Featured" on a post automatically unfeatures every other (16 posts silently carried the flag; only the newest ever showed). The blog hero is the featured post while it's under 60 days old, then falls back to the newest post; the hero no longer repeats as the first grid card; and the homepage journal row always leads with the same hero, so the two surfaces can never disagree. Featured changes now appear on the site immediately instead of within an hour.
- **SEO rankings: an "All queries explorer".** A new collapsed section at the bottom of Marketing → SEO rankings lists every search Google has ever shown the site for (lifetime impressions, clicks, most recent position, last seen), not just the tracked list and the top opportunities. Search it, filter to "With clicks" / "Top 10" / "Untracked", sort, and track any query with one click. Tracked and brand queries are labelled.

- **Three new free tools, and tools are now easy to find.** A Pregnancy Calculator (due date, current week, scan dates), a BMI Calculator using the South Asian ranges that actually apply in Pakistan, and a Calorie Calculator (daily needs plus a protein target) join the Ovulation Calculator. All tools now live on one **Free Tools page** (`/tools`, with the Routine Finder quiz), linked from the main menu, the footer and a new homepage band, so visitors can actually discover them instead of needing a direct link. Every tool is written in plain language, runs entirely in the visitor's browser, and links the relevant guides, with at most one gentle product suggestion where it genuinely fits.
- **Checkout now offers the seasonal sale code, one tap to apply.** While a seasonal sale window is open (like the Azadi Sale's AZADI14), the coupon box at checkout shows "Sale code AZADI14 is running — tap to apply it" whenever no coupon is applied. Nothing is applied automatically (owner decision: the shopper chooses); the tap validates and applies the code exactly like typing it would. Built after a real order came through at full price on day two of the live sale because the code only appeared in the announcement bar.
- **Quick Answers usage now shows on the Dashboard.** Under "More insights" the new Quick Answers panel shows, for the last 7 days: each answer's page views, visitors, completed calculations and the share of visitors who actually used it, plus how many people used an answer and then went on to purchase. Data comes from the analytics refresh, so it updates on the same cadence as the other traffic panels.
- **Sticky bars and floating buttons no longer pile up over the footer.** On product pages (and blog posts with a buy bar), the sticky add-to-cart bar now slides away once you reach the footer, and the footer reserves space for the WhatsApp bubble, so footer links are always readable and tappable on phones. The footer also gained a dedicated Quick Answers column instead of overloading the Company list.
- **Orders nobody confirms now get a second, sharper reminder.** An order still unconfirmed after 3 days now triggers its own notification (admin bell + phone push): try the customer one last time on WhatsApp or by phone, and if there is still no answer, cancel the order from the order page so the stock frees up. Nothing is cancelled automatically — a person always makes that call. This joins the existing day-one "confirm it" nudge; shipping unconfirmed parcels is where returns come from.

### 3 August 2026

- **Abandoned-checkout alerts now wait 20 minutes.** Previously the bell and phone push fired the instant a shopper finished the contact step of checkout, so anyone who went on to pay triggered a false "Abandoned checkout" alert seconds before their "New order" alert. The alert now fires only when a checkout has sat untouched for 20 minutes, checked every 10 minutes, so a completed purchase never makes an abandoned-cart sound. The daily reminder emails to shoppers and the staff digest are unchanged.

### 2 August 2026

- **The seasonal theme settings are now one clear control.** Settings → Branding was confusing (a manual switch, a separate scheduled-event block, and two places to pick a theme). It is now a single card: a status line that says exactly what the storefront is doing right now (live, scheduled for later, or off), one Theme picker (Eid, Sale, Christmas, Easter, Independence Day — any of them can now be scheduled, not just Independence Day), and one "When does it run?" choice: Off, On now (also handy for previewing), or Scheduled with start and end times in Pakistan time. The announcement-bar message and coupon fields sit right below and apply whenever the theme is active; leave the message blank for no bar. The two switches can no longer contradict each other, and a scheduled window always wins while it is open. Under the hood the timed flip is now checked on the shopper's device clock as well, so the palette, bar and hero all change together right on time even on cached pages.
- **Independence Day theme, scheduled and self-managing.** The store dresses up for 14 August automatically: from 10 August to the night of 15 August (Pakistan time), the storefront switches to a Pakistan-green palette with a crescent-and-star motif, a green announcement bar advertises the Azadi Sale with coupon code **AZADI14** (14% off storewide, already created on the Coupons page, expires by itself), and the homepage hero becomes the Azadi Sale banner. When the window ends, everything reverts on its own — nothing to take down. Control it in **Settings → Branding → Seasonal theme → Scheduled event window**: change the dates, the bar message or the displayed code, or set the event to Off. The manual seasonal switch above it still works as before for Eid, Christmas and the like (Independence Day is now also in that season list for manual use). To preview before the 10th, set the start date to today, look at the storefront, then set it back.
- **21 St. Ives products prepared as drafts.** The full St. Ives range from the brand's site (5 face scrubs including the two BHA acne ones, the watermelon lip scrub, 8 body washes, 6 hand & body lotions, and the collagen face moisturizer jar) is listed with full descriptions, images, categories and estimated prices, saved as drafts. Review the price on each product page and press Publish when confirmed — nothing shows on the storefront until then.

### 1 August 2026

- **A search that misses now suggests products instead of dead-ending.** When a storefront search finds nothing (or under four products), the page now shows up to eight suggestions under the results: the closest matches on the words in the query first, then whatever shoppers are buying most right now (from the live demand score). This matters most for shoppers arriving from ChatGPT, which links them to search pages for brands the store may not stock; they now land on real products instead of an empty grid. The `/search` web address itself (which the store never had, but ChatGPT links to anyway) also now forwards straight to the shop with the search applied.
- **Returned and cancelled orders now show an honest payment status.** The orders list and dashboard no longer label a returned COD parcel "COD — on delivery" (no one is paying for a parcel that came back). A dead order that was never paid now reads **Not collected**; one that WAS paid before it died reads **Paid — refund due** until you refund the customer and set the order to Refunded. On the order page, the Payment received card on a returned/cancelled order now says there is nothing to collect instead of offering the "Mark received" form — with a fold-out for the one real exception, a COD parcel paid at the door and returned afterwards, where the courier still remits the cash.

### 31 July 2026

- **Audit long tail closed.** The remaining lower-severity audit findings are fixed: archived orders are now invisible to coupons impact, win-back, review requests, stuck-payment alerts, the sidebar badge, customer detail metrics, messages context, the returns rate, tracking polls and the Analytics status chart (searches still find them, labelled "archived"). Win-back and customer metrics zero returned orders like refunded. Failed online payments put reserved stock back automatically. Cancel/return restocks skip untracked products, matching how stock is taken at checkout. Referral rewards pay exactly once per referred friend even across return cycles. Disabling 2FA now genuinely requires the account password. Win-back/abandoned template edits require the settings permission, and vendor-collected COD orders' payment card points to the Vendors page instead of inviting a wrong reconciliation.
- **One set of money rules, everywhere — platform audit sweep.** A deep audit found the revenue and return rules were enforced on some screens but not others; all of it is now consistent. Courier scans that mark a parcel returned now settle the books the same way the manual Returned button does (voided vendor payouts, zeroed unearned margin, return fees, restock), and so does receiving a customer return. The Monday weekly report now uses the same revenue definition as the dashboard and Finance. Customer lifetime-value, segments and the customers export no longer count bounced parcels as spend or include archived orders. Storefront best-sellers and the top-products table only count orders that really sold. The dashboard's "COD cash in transit" and Finance's unrecorded-payments lists no longer count vendor-collected COD as your cash; those orders sit in their own "settles via Vendors" bucket.
- **COD reconciliation now shows only the store's own cash.** Archived orders and vendor-collected COD (where the vendor delivers and keeps the cash, like Nazirs Group) no longer appear as "outstanding" — that money settles on the Vendors page, and a note on the COD page says how many orders live there instead. The weekly reconcile reminders skip vendor-collected orders for the same reason. The CSV export matches.
- **Vendor orders now carry the vendor's tracking number, and the system chases it.** When a vendor ships an order with their own courier, enter their tracking number on the order page (Shipment → Manual; pick the courier, or choose Other and type the service's name). Entering it is what marks the order Shipped and emails the customer their tracking link. If a vendor-dispatched order sits a day without a tracking number, you and the managers get a reminder to collect it from the vendor, so no parcel travels invisibly.
- **Returns now settle correctly by vendor model.** When you mark an order Returned, the system works out who actually holds the goods and money. A self-stocked vendor who ships their own parcels (like Nazirs Group): the refused parcel went back to their shelf, so any pending payout is voided and no product cost is recorded — nobody owes anybody. A vendor you buy from and ship yourself: what you paid them stands as a real payable (that money bought stock, not a loss), the unearned margin is zeroed, and the items go back into your inventory automatically. Your own stock: items restock the same way. In every case the only true loss on a return is the courier's round trip, which Finance already shows on its own line. If a self-delivering vendor bills you for that failed round trip, set "Return fee they charge us" in their settings: each return then records the fee as the order's delivery cost (so Finance counts the loss) and as a pending payable to the vendor on the Vendors page. Don't know what they'll bill until later? Leave the fee blank: when the actual bill arrives, any manager opens the returned order and types the amount into Order costs → Delivery cost — the vendor payable updates to match automatically (and a payout already marked settled is never rewritten). The Vendors page integrity banner also stopped flagging self-stocked vendors' returned orders as "missing payouts" — for those, no payout is the correct state.
- **The homepage and footer now push shoppers to brand pages.** A new "Shop by brand" section on the homepage and a "Popular brands" footer column link straight to the brand pages customers search for by name (Saeed Ghani, Rivaj UK, Conatural, Christine and more), and the brand logos in the homepage hero are now clickable. Brand shoppers get a direct route in, and the extra internal links help those pages climb Google for high-volume brand searches.
- **Vendors page: a per-vendor performance table.** Above the payout queue you now see each supplier's full trading picture: orders, delivered vs returned, sales value, vendor cost, your margin (amount and percent), unsettled balance and last order date. Use it to judge which vendor relationships earn their keep.
- **Every vendor now has its own page.** Click a vendor's name in the performance table to open it: date-filtered KPIs (all time, 30/90 days or a year), every order with its payout state, a pending-payouts list you can settle right there (one row or all at once), the vendor's full settings (name, phone, commission, who collects payment, delivery fee, free-delivery threshold, notes), the products sourced from them, and a Download CSV button that exports exactly the window you are viewing, ready for a settlement call. The products table also carries **per-product vendor pricing**: when a supplier quotes you a different price on a specific product, type it in the Vendor price column and save. That price then drives the acquisition cost and payout on future dispatches of that product, overriding the vendor's blanket commission (blank = commission applies). The margin column shows what you would keep at today's retail price and where the number comes from.
- **COD orders now get a one-tap WhatsApp confirmation before dispatch.** On any cash-on-delivery order page (Confirmation and vendor section), "Send WhatsApp confirmation" opens WhatsApp with a ready-to-send Roman Urdu message: the customer's name, order number, items, total and a request to reply YES. When they reply, tap "Customer said yes, mark confirmed". Unconfirmed COD orders wear an amber "Unconfirmed" chip in the orders list, and the daily reminders now chase the right step: an unconfirmed order gets a "confirm it" nudge, a confirmed one that hasn't moved gets a "start preparing" nudge. Confirm before you dispatch: refused COD parcels cost the courier round trip, and July's returns all came from unconfirmed orders.
- **Orders can now be archived, and the 12 old WordPress imports have been.** Archiving (order page → Archive) is for orders that are history rather than real trading records: legacy imports, tests, duplicates. An archived order keeps its data and status but disappears from order lists, the dashboard, Finance, Analytics and the daily reminders; find them under Orders → More… → Archived, and unarchive any time. This replaces the earlier interim step where the 12 stuck WordPress-era orders were closed as delivered: the WordPress imports are archived, except the five fulfilled through Nazirs Group (NB Sons), which stay active because their vendor settlements are still unpaid.
- **Google rankings now live in the admin: Marketing → SEO rankings.** Twice a month (the 1st and 15th) an automated check pulls yellowpink.pk's Google positions for the tracked keywords from the Semrush Pakistan index and saves a snapshot. The page shows each keyword's monthly search volume, current position (green when it reaches page one) and movement since the previous check, plus which page ranks. Positions come from Semrush's monthly Pakistan crawl, so read it as a trend line; Search Console remains the source of truth for actual clicks.
- **SEO rankings page upgraded into a working rank tracker.** Summary tiles show tracked keywords, Top 3 / Page 1 / Page 2 counts and 28-day clicks at a glance. Each keyword row now pairs the Semrush position with live Search Console data — real Google position, clicks and impressions for the last 28 days, plus a daily-position trend line (green when it improved over the window, red when it slipped). You can **search, filter by position bucket** (Top 3, Page 1, Page 2, 21–100, not ranking) **and sort** by volume, position, movement or clicks. **You control the keyword list**: add a keyword in the box under the table (it joins the next 1st/15th check automatically) or click ✕ to stop tracking one. An **"Untracked queries Google already shows you for"** section lists real searches from Search Console that aren't tracked yet, sorted by impressions, each with a one-click **Track** button — this is where new keyword ideas come from now.
- **Bank-transfer orders now carry the payment details everywhere the customer looks.** The confirmation email for a bank order now includes your account details, the order number as the payment reference, and a note to send the receipt; the Track Order page re-shows the accounts for any unpaid bank order (before, they appeared once on the thank-you page and were gone if the tab closed). Once you record the payment on the order page, everything proceeds as normal.
- **Every blog article now invites readers to the skin quiz.** A small card after each article's FAQ links to the two minute quiz. The quiz already converts readers into carts at many times the site rate; it was just never surfaced where the traffic is. The homepage band is unchanged.
- **Books cleaned: the 12 stuck WordPress-era orders are closed and the returned-order vendor receivable is voided.** The legacy imports that sat in "Order received" since early 2025 are marked delivered (with no side effects: no reward points were minted and no review emails will go out), so open-order views and KPIs now reflect reality. The Rs 1,267 vendor settlement against the returned order YP-8MDK8JSS4 was removed with an audit-log record; the 6 genuine pending settlements (Rs 4,932 owed to you) remain for you to settle when the transfer arrives.
- **The system now tells you the next step for every order, so nothing gets missed.** The order workflow's follow-ups no longer live in anyone's memory: once a day the system checks every active order and posts a notification (admin bell + phone push) for anything still owed — an order awaiting customer confirmation for over a day, a confirmed order not dispatched, a shipment 5+ days without delivery, a delivered order missing its courier charge or product cost (which silently breaks the profit numbers), a COD payout not reconciled after a week, a returned order whose costs or vendor payout were never sorted, and vendor settlements pending past two weeks. Each nudge appears once per order per step (dismissing it doesn't nag again) and links straight to the order. The "New order" notification itself now says the next step too: confirm with the customer, then mark it Preparing.
- **Redeeming reward points now actually lowers what the rider collects.** Before, checkout showed a points-reduced total but the order kept the full amount: the courier collected the full price AND the points were deducted, so the first customer to redeem would have paid twice. A redemption is now recorded as a payment on the order (like gift cards), and courier bookings collect the order total minus everything already paid. This also fixes the same hidden problem for gift-card-paid orders.
- **You and Tanya now get alerted when a shopper abandons a checkout.** The moment a checkout with contact details is captured, a notification hits the admin bell (and phone push if enabled). About an hour after the shopper goes quiet, an email goes to everyone subscribed to "Abandoned checkouts" in Settings → Notifications (Tanya and the owner are set up already) with the cart contents and a one-tap WhatsApp link, including phone-only shoppers the automatic reminder emails can never reach.
- **Booking a courier for an unconfirmed order now asks you to confirm first.** July's returns were overwhelmingly parcels shipped without customer confirmation, and returns ate 46% of the month's order value. Booking a pickup on an order still in Pending now shows a warning and requires a "book anyway" tick; the intended flow is confirm on WhatsApp, mark the order Preparing, then book. Manual tracking entry (used after a parcel is already handed over) is not affected.
- **A broken Google connection now announces itself.** When the Search Console/Analytics token stops refreshing (this is what silently froze all Google data on July 29), a notification appears in the admin bell with a link to re-connect, once per outage instead of never. If Google keeps disconnecting every week, the OAuth app is still in "Testing" mode in Google Cloud Console; publish it to production there and the connection stops expiring.
- **Returned and cancelled orders now show their true loss, not a phantom profit.** The Order profit card on an order's page used the order total as revenue no matter what happened to the order, so a returned COD parcel with its costs recorded still displayed a healthy net profit. For cancelled, returned, refunded and payment-failed orders the card now shows Amount collected: Rs 0, counts the recorded costs as a sunk **Net loss**, and explains it in a red note (with a reminder to reduce COGS if the goods went back into stock or the vendor credited the return). The Finance page's monthly P&L already treated these orders correctly; the per-order card just disagreed with it.
- **Referred shoppers can actually place their discounted first order again.** The July 29 database update that added NB Sons free shipping accidentally removed the rule that accepts a referral discount at order time, so anyone arriving through a friend's referral link saw "10% off your first order" at checkout and then got an error when they pressed Place Order. The rule is restored, and a permanent test now guards it so future database changes can't silently drop it again. Nobody was affected in practice (no referral orders were attempted in the window), but with 79 customers holding referral codes it was a loaded trap.
- **Checkout fills in the province automatically from the city.** The July 25 short-form checkout hid the Province field behind an optional toggle, and since nobody opened it, every order arrived without a province and was quoted the cheapest zone's delivery rate (a Sindh/KPK order was undercharged Rs 100, farther regions Rs 200, and delivery estimates were wrong). The form stays short: the province is now derived from the required City field for all major cities (including spellings like "Dgkhan"), a hand-picked province is never overridden, and the optional toggle still works for small towns the list doesn't know.
- **The in-article buy bar now appears for readers who jump.** The mobile sticky buy bar on blog guides only appeared after scrolling past the product module continuously; readers who tapped a table-of-contents link (jumping straight past it) never saw it. It now tracks scroll position directly, so it appears for jumpers too.
- **Vendor free-delivery thresholds are now yours to manage in admin.** The "free delivery from Rs X" rule that used to be a database-only setting for NB Sons is now an editable field on every vendor: **Vendors → Settlement terms → "free ship ≥"** (also on the Add Vendor form), and **Settings → Shipping** shows all active vendor rules in one read-only list. Change a threshold and the product-page promise, cart progress bar, checkout quote and server-side enforcement all follow immediately — no developer needed.
- **Blog guides now sell the product they review.** The small product card inside blog posts grew into a proper buy module: the guide's main product gets a bigger image, its star rating, a one-line description, price, and an Add to Cart button; other mentioned products keep compact rows. On phones, a slim bar with the product pins to the bottom of the screen once the reader scrolls past the module, so a convinced reader can add to cart from anywhere in a long article (dismissible with the ×). Rolled out because analytics showed blog posts are the store's biggest traffic source but almost all readers were leaving without touching a product.
- **The NB Sons free-delivery promise is now kept everywhere — a gap let one order be overcharged.** Order YP-ET8YOUQ76 (Rs 3,500 of NB Sons product, well over the Rs 1,999 threshold) was billed Rs 250 delivery: products added to the bag from a shop/collection grid tile (rather than the product page) were missing the supplier link the rule keys on, so checkout quoted the normal rate — and the order pipeline only blocked *under*charges, letting the overcharge through. Three layers are fixed: grid-tile adds now carry the supplier link; checkout re-checks every bag against the live product catalogue (so bags saved in a customer's browser before today also qualify); and the order pipeline itself now charges Rs 0 whenever the store's own rules say delivery is free, even if a stale page quotes otherwise. The cart and mini-cart also now show "You've unlocked FREE delivery" (and a Rs 0 delivery estimate) when the NB Sons rule qualifies, instead of asking the shopper to add more. *One follow-up for you: YP-ET8YOUQ76 is still in Processing with the extra Rs 250 in its COD total — either edit the order's delivery charge to 0 in admin before booking the courier, or refund/discount the Rs 250 after delivery, and mention it to the customer.*

### 28 July 2026

- **NB Sons items now ship free from Rs 1,999, matching the brand's own store.** A shopper cancelled an order of two M-Sol sachets (Rs 2,300) because nbsons.com free-ships above Rs 1,999 while our zone thresholds start at Rs 5,000, making the identical basket Rs 250 cheaper at the source. Now, when the NB Sons items in a basket total Rs 1,999 or more, shipping is free for that order regardless of zone (the rest of the catalog keeps the normal zone thresholds). The product pages carry the promise ("Free delivery when your NB Sons items total PKR 1,999 or more"), checkout applies it automatically, and the rule lives on the vendor record, so a different threshold or another vendor's rule is a one-field change.
- **Verify API-booked consignments in Envio before handing the parcel over.** On July 28 the TCS API accepted a booking and returned a consignment number that never appeared in TCS's own Envio dashboard; the parcel had to be re-booked manually under a different CN. Until TCS explains this, the booking confirmation in admin now asks you to check the CN in Envio (Tracking CN) right after booking — if it isn't there, cancel the shipment in admin and book manually in Envio, then paste the real CN using manual entry. Please also raise the mismatched CN with your TCS account rep.
- **"Sync tracking now" tells you when TCS has nothing yet.** Previously, if TCS hadn't uploaded any scans for a consignment (their tracking often lags the physical pickup by a few hours), the button said "Already up to date" — which read as if tracking were synced when the courier had actually published nothing. It now shows an amber note saying TCS has no scan data yet, including TCS's own reply, and suggests confirming the CN with your account rep if it stays empty more than a day after pickup.
- **The newsletter composer can save drafts.** An edition can now be written, saved, and reviewed before sending: drafts appear above the composer with Open and Delete buttons, and sending a draft promotes it into the sent history instead of duplicating it. The first Fortnightly Edit is waiting there as a draft — open it, adjust anything you like, and press send.
- **Product pages stay fast between visits.** Product pages were being re-rendered from scratch whenever one sat unvisited for over five minutes, which made the first click on a quiet product noticeably slow. They now stay cached for an hour, and anything that actually changes a product page — an admin edit, or a customer order reducing stock — refreshes it immediately, so the speed comes without ever showing stale stock.
- **The Monday weekly report now actually arrives.** The weekly health report and the NB Sons price-parity check used to run at the very end of the nightly maintenance queue, and the eight jobs ahead of them used up the whole time budget every Monday, so neither ever ran. They now have their own dedicated Monday slot (about 3pm Pakistan time) with a fresh time budget. The first report lands next Monday; this week's numbers were compiled by hand in the meantime.

- **Booking a courier pickup no longer tells the customer "shipped" before it's true.** Booking via the courier API (TCS) now records the consignment as **Booked — awaiting pickup** and moves the order to **Preparing**; the order becomes **Shipped** and the customer gets the shipping email automatically at the courier's first real pickup scan (or immediately via **Sync tracking now**). Previously the shipped email went out the second you clicked Book, even though the parcel was still on the shelf — and a cancelled booking left the order stuck on Shipped. Manual tracking-number entry still marks the order Shipped right away, since that's used after handing the parcel over.

### 26 July 2026

- **The Indexing watch list now cleans up after itself.** When a tracked page stops existing at its old address (a renamed article, a retired product), the nightly indexing check now notices and removes it from the list instead of asking Google about it every night forever. Pages that redirect or 404 can never become "indexed", so they were quietly wasting the daily Google check quota that live pages need.
- **Blog posts can carry a separate search-result title.** The blog editor gained an **SEO title** field: what Google and link shares display can now be a short, complete phrase while the article keeps its full headline on the page. Concise search titles were written for all 200 articles whose headline was too long to display in full, so they no longer cut off mid-sentence in Google.

### 25 July 2026

- **A weekly report now lands in your inbox every Monday.** One email summarizes the week: orders and revenue against the week before, average order value, COD share, top sellers, where orders came from, the shopper funnel (views → carts → checkouts → purchases), which storefront sections got the most clicks, abandoned checkouts and how many were recovered, new reviews plus how many await approval, and Google indexing status. Sections whose data source is unreachable show "not available" instead of blocking the email. It goes to the owner address; staff can trigger it any time by opening `/api/cron/weekly-report?force=1` with the cron key.
- **The nightly maintenance run can no longer be killed by one slow job.** Each of the nightly jobs (courier sync, review requests, indexing check, and the rest) now gets its own time limit, so a slow external API costs that one job instead of silently cancelling everything after it — the cause of the recent missed-run alerts. The run also logs how long each job took, so a slow night is diagnosable.

### 24 July 2026

- **Blog readers can now buy without leaving the article.** The "Recommended in this guide" card near the top of each post gained a one-tap **Add** button (shade/size products route to their product page to pick options) and a cash-on-delivery/returns line, so the roughly half of all visitors who land on a blog post can put the reviewed product in their bag on the spot. Sold-out products no longer appear on the card.
- **Checkout trimmed to the COD minimum, with the commit button always in reach.** The form now asks for four things: phone, full name (one field instead of first/last), address and city. Province and postal code moved behind an optional "More details" link, and email moved below the address and stays optional for COD. On phones a sticky bottom bar shows the live total and Place Order while the shopper fills the form (the button used to sit a full screen below it), the keyboard no longer pops up the moment the page opens, and a WhatsApp help link sits at the decision point. For COD orders the total is labelled "To pay on delivery" with a "pay nothing now" note. Orders still store first and last name separately, so nothing changes in admin, emails or courier bookings.
- **Shop, product and cart pages tuned for phones.** The shop and category pages compress their header on phones so products appear on the first screen, the first row of product photos loads instantly instead of fading in after the page boots, the filter panel gains a pinned **"Show N products"** button (and no longer hides behind the site header or cookie banner), and filter chips, sort and page numbers meet the 44px touch size. Product pages put the photo and Add to Cart inside the first phone screen, move **customer reviews and Q&A up above the recommendation rails**, and the bottom buy bar now offers **Buy Now** next to Add to Cart. The slide-out cart got a clearer footer: a delivery line (FREE or the from-rate) above the total, one big Checkout button with the COD/returns promise under it, View Cart demoted to a small link, and the old static "free sample" note replaced by a real one-tap **"Goes well with your order"** suggestion. Collection pages shrink their photo hero on phones, and the homepage hero photo now uses a taller, face-friendly crop on phones instead of a thin strip. Also fixed: "Frequently bought together" no longer offers shade/size products it can't add correctly, and no longer repeats products already shown in "Pairs well with".
- **Homepage rebuilt around what converts.** The order now runs hero, trust bar, a tappable search field (phones), a swipeable strip of the eight most-shopped destinations, then nothing but product rails (Featured, the new **New In** rail, Sale when active, Best Sellers, Trending) before any editorial content. The announcement bar is on with the WELCOME10 first-order offer, the hero's main button leads to Best Sellers, the hero image is tappable, and the brand logo marquee no longer shows on phones. Trending only appears when products have real momentum, so it can't duplicate New In. The pre-footer "As featured in" press strip (which implied coverage we don't have) was replaced with an **Order on WhatsApp** band, and the floating WhatsApp button now shows its "Chat with us" label on phones. Product cards across the site gained a **New** badge for products added in the last 30 days, and card clicks are now measured per section so the next homepage change can be judged on data. The Featured, Best Sellers, Trending and K-Beauty rails also **rotate daily**: each rail draws its four tiles from a wider shortlist and picks a different mix every day (Pakistan time), so regular visitors stop seeing the same static page.
- **Single products now sell their sets.** When a product belongs to a value set, its page says so twice: a one-line nudge under the buy buttons ("Also in [set] · save 18%") and a "Better Value In A Set" section showing the set with the crossed-out separate total and the saving. Both link to the set's page. Products whose set saves less than 1% stay quiet. The homepage "Combos & Bundles" collection was also repaired: its rule matched a tag no product carried, so it had been empty; every set is now tagged and the rule also matches the bundle categories, so the collection fills itself. A "Nails" category was added under Makeup for the new nail products.

### 23 July 2026

- **Sets and combos now know what's inside them.** Bundle products (the NB Sons combos and any future set) carry a structured list of their component products. Three things flow from it: **product pages** show a "What's Inside This Set" section listing each component with its individual price and the money saved at the set price; the **vendor WhatsApp message** on an order expands any set into a per-item packing list (with a note that the set is our own arrangement of the vendor's individual products and their per-item billing is unchanged); and the **product edit page** gains a "Set contents & pricing" panel. That panel shows each component's retail price and vendor cost, the customer's saving, and **our margin — with loud warnings** when the margin can't be verified (a component has no cost price on file), when it falls below 15%, or when the set isn't actually cheaper than buying the items separately. A **Copy vendor explainer** button produces the ready-to-send roman-Urdu message that introduces the set to the vendor so the arrangement is always stated the same, correct way. To see real margins, enter each component's **Cost price** (what the vendor bills per unit) on its product form.
- **NB Sons price parity is now watched automatically.** The arrangement with NB Sons is parity on singles: their individual products are never listed below their own store price, and discounts live only in sets. A weekly check (Mondays) compares our catalogue against nbsons.com and emails the owner if any single of ours has drifted below their list, with both prices and a link to their listing. A clean week sends nothing. (The first manual run of this audit found and fixed 7 underpriced singles, synced 8 stale price mentions in guides and search snippets, and nudged two set prices so every NB Sons set clears a 15% margin.)
- **Bundle margins compute themselves for commission vendors.** Where a component has no cost price entered, the pricing panel now derives its cost from the vendor's commission terms (retail minus our commission) and marks it *derived*. With NB Sons on 35% commission, all 12 combo sets show verified margins immediately — every one lands between 20% and 35%. An entered cost price always overrides the derived value.

### 22 July 2026

- **Review asks become a queue instead of a memory exercise.** A new **Customers → Review asks** page lists every order delivered in the last 30 days with a one-tap WhatsApp review request (review links + reward points pre-filled). Asks are recorded so nobody is nudged twice. Previously the WhatsApp ask existed only as a button inside each order page, so it depended on remembering to visit each delivered order; phone-only customers (who get no automated review email) were easy to miss entirely.
- **Abandoned checkouts get a WhatsApp follow-up queue.** The store now saves a checkout the moment the shopper types their **phone number** (previously only an email triggered this), so COD shoppers who stop early are no longer lost. A new **Customers → Abandoned** page lists them with their saved cart; **Open in WhatsApp** pre-types a personalised message (editable template + coupon) with a link that restores their cart. Sends are recorded so nobody is messaged twice, placing an order removes them automatically, and shoppers who also left an email keep receiving the automatic reminder emails as before.
- **Delivery date in the mobile buy bar.** The sticky bar that follows shoppers down a product page now shows "Get it by [dates] · COD nationwide" next to the price, so the arrival date is visible at the moment they tap Add to Cart or Buy Now.

### 19 July 2026

- **Buy Now on product pages.** A one-tap **Buy Now** button now sits under *Add to Cart* on every in-stock product: it adds the item and goes straight to checkout, skipping the cart for the shopper who wants just that one thing. Anything already in the bag comes along to checkout as usual, and *Add to Cart* keeps working exactly as before.
- **The cookie bar no longer interrupts checkout.** The consent prompt used to slide up over the address form a moment after checkout loaded on phones. It now never shows on the checkout page; shoppers see it on the next regular page instead.

### 16 July 2026

- **Birthday rewards removed — and profile saving fixed.** The birthday-points feature (date-of-birth field on the customer Profile page, "Birthday points" in Settings → Loyalty, automatic points on the customer's birthday) has been removed. It never worked: the database column it depended on was missing, which also silently **broke saving any profile change** (name or phone) since 9 July — that's fixed by the removal. The rewards page no longer mentions a birthday bonus.

### 14 July 2026

- **The quiz became a real Routine Finder.** Instead of showing six loosely-related products, the quiz now builds a numbered skincare routine (Cleanse → Treat → Moisturise → Protect) or a supplement plan, matching the shopper's answers against actual product ingredients, with the reason stated under every pick. Results are saved to a shareable link, can be added to the cart in one tap, link the relevant buyer guides, and the email option now sends the shopper's actual picks instead of a generic welcome mail.
- **Site search now finds your articles too.** The header search and the full results page surface matching journal guides alongside products ("From the journal"), and a search with no product matches shows the relevant guides instead of a dead "No results" screen. First beneficiary: shoppers searching *elevit* now get the Elevit-alternatives guide plus the prenatal products it recommends (via a new search synonym).
- **Win back lapsed customers over WhatsApp.** New **Admin → Customers → Win-back** page lists every past buyer with a phone number who hasn't ordered in 90+ days. Tune the message template and coupon once, then tap **Open in WhatsApp** on each row — your own WhatsApp opens with a personalised message (name, what they bought last, the coupon, and a shop link that applies the code automatically) ready to send. A shared "messaged" checklist keeps the whole team from double-messaging anyone, and the resulting orders are attributed under **Analytics → Sources**.
- **Customers can ask questions on product pages.** Every product page now has a **Questions & answers** section under the reviews: shoppers ask with just a name and their question, and nothing shows publicly until staff answer and approve it in the new **Admin → Questions** queue (sidebar badge shows how many are waiting; approving *requires* an answer, and a published Q&A can be unpublished any time). Published Q&As show the question, your answer, the asker's first name and dates — real buyer questions, answered, right where the next buyer is deciding.
- **The editorial byline now has its own page.** "By Yellow Pink Editorial Team" on blog posts links to a new author page (`/author/yellow-pink-editorial`) with an honest description of how the journal is written and medically reviewed, plus the full list of the team's articles. Old WordPress `/author/…` links resolve sensibly (known author → the page, unknown → a proper 404 you can redirect from Broken links).

### 10 July 2026

- **Dashboard, sharper morning read.** The home page gains one-tap **quick actions** (New order / Add product / Coupons / New post, each shown only to staff with that permission); the Today cards now show **yesterday's numbers** underneath so early mornings aren't a wall of zeros; a new **"COD cash in transit"** card totals the cash your couriers are carrying on shipped COD orders (tap through to those orders); and Top Products gained product photos with each row linking to the product.
- **Doctors are no longer counted as customers.** Approving a medical reviewer creates a sign-in account for their reviewer dashboard — and the system was treating those accounts as shoppers: they appeared in admin → Customers, inflated the "New customers" number, and even collected signup welcome points. Reviewer accounts are now excluded from every customer surface, and the mistakenly-granted welcome points were removed.

### 9 July 2026

- **The activity log folds repeats.** A burst of the same event — a newsletter import, a signup rush — no longer fills the page with identical rows: runs of three or more collapse into one line with a count (\u201cNewsletter signup \u00d7 42\u201d) and a time range; click *show all* to expand every entry with its time, account and link.
- **Vendor terms read as a sentence, edit on demand.** The Vendors list no longer crams a five-control form into every row — each vendor's settlement terms now read as plain text (“35% kept · we collect · delivers to customer”) with an **Edit** button that expands the form only when you need it, and collapses again on save.
- **Peek at an order without leaving the list.** Hovering an order row now reveals a **Peek** button that slides in a side panel with everything you usually open the order for — customer and address with tap-to-call and WhatsApp, the items with thumbnails, totals and payment method — while your place in the list (scroll, filters, selection) stays put. Esc or the backdrop closes it; **Open full order** jumps to the detail page.
- **One button language across the admin.** Buttons now follow a single grammar — pink for a page's main action, white-outline for everything else, and a quiet red outline (filling red only on hover) for destructive actions. This replaces the mix the admin had grown: solid green Approves, a navy Redirect, black pills, and three-colour Edit/Deactivate/Delete rows on Team. Reviews, Returns, Team, Broken links, manual orders and every Delete button system-wide now match.
- **Empty screens now tell you what to do.** Where the admin used to show a lone gray sentence (Indexing or search analytics not yet connected, an empty email log, the assignments queue, a new manual order with no items), it now shows a proper empty state: an icon, a plain-language explanation of what will appear there, and a button to the connecting step where there is one.
- **Admin controls look like one product now.** Every dropdown across the admin (filters, forms, per-row status pickers) shares one clean style with a proper chevron instead of the browser's default control, checkboxes and radios are brand-pink everywhere, and every field shows a consistent pink focus ring when you tab into it. Small fixes along the way: the Team table's "Last sign-in" header no longer wraps to three lines, and the Customers page's active-filter ring is brand pink instead of blue.
- **Google review bonus — asked at the right moment.** Customers can now be offered **extra reward points for reviewing Yellow Pink on Google** — but only after their on-site review is approved and positive. Set your Google review link and the bonus points in **Settings → Loyalty → Google review bonus**; the Reviews page then shows an **"Ask for Google review"** WhatsApp button on approved **4–5★** reviews (never on pending or low-rated ones — an unhappy on-site review can be resolved privately, a bad Google review is permanent). The message thanks them in roman-Urdu, shares the Google link and the points offer, and asks them to reply once done. Award the points from the customer's page, which now shows a **Reward points card with a manual adjust form** (balance + lifetime, credit or deduct with a reason — also handy for goodwill credits and corrections).
- **One-tap review ask on WhatsApp.** On a **delivered** order's page, a new **"Ask for review"** button (next to the WhatsApp button) opens the customer's chat pre-filled with a friendly roman-Urdu message: thanks for the order, a request to leave a quick review, the **live reward-points incentive** (whatever Settings → Loyalty → "Approved review points" currently says), and direct links to each purchased product's review form. The automatic review-request email still goes out 3–30 days after delivery — this is the personal follow-up for customers who never check email.
- **Admin search that finds your data.** Press **⌘K / Ctrl+K** anywhere in admin — or click the new search box in the top bar — and type an order number, a customer's name or phone, or a product name to jump straight to it. Previously the palette only found pages; now it searches live orders, products and customers (respecting each staffer's permissions). Old WordPress-era orders also got their broken item thumbnails repaired (they pointed at the deleted wp-content folder) and their brand columns corrected.
- **Referred friends now really get their first-order discount.** The rewards page has always told customers "friends you refer get {X}% off their first order" — but nothing ever applied it. Now, when someone opens a customer's share link (`?ref=CODE`) and checks out for the first time, the discount appears automatically in the order summary (labelled "Referral discount") and is enforced server-side: valid code only, genuinely their first order (matched by account, email *and* phone), no self-referrals, and it never stacks with a coupon (the coupon wins). The percentage is configurable in **Settings → Loyalty → Referee discount**. Also fixed along the way: none of the 79 existing customer accounts had ever been assigned a referral code (the generator only ran for new signups), so every rewards page showed "—" instead of a shareable code — all backfilled.
- **Product photos can now be zoomed.** Tapping a product photo opens it fullscreen where customers can pinch, double-tap or scroll-wheel to zoom in (up to 4×) and drag to pan — the way shoppers verify seals, batch codes and ingredient panels before committing to a cash-on-delivery order.
- **Phone visitors finally see the welcome offer.** The "{X}% off your first order" signup popup was desktop-only, so most visitors never saw it. Phones now get a slim, dismissible bar at the bottom of the screen (after ~25 seconds) — tapping "Get my code" opens the same signup form. Same politeness rules: never on checkout, dismissing hides it for 30 days, subscribers never see it again.
- **The homepage "Real shoppers" section now tells the truth.** Its stat strip and three review cards were hardcoded samples ("2,400+ reviews", "50k+ orders", invented reviewers) — under a headline promising "no paid reviews". Both now come live from the database: the real average rating and review count (rounded *down*), your real brand count, the actual returns window, and three genuine top-rated customer reviews (best-rated, substantial, one brand each). If real data ever gets too thin, the section hides instead of padding with fiction.
- **Shopping nudges that reduce buying friction.** The cart and mini-cart now show a live **free-delivery progress bar** ("Add PKR 800 more for FREE delivery") instead of vague copy; product pages show **concrete arrival dates** ("Get it by Sat 12 – Wed 16 Jul", Sundays skipped) instead of "2–5 working days"; a **percentage-off badge** appears next to the crossed-out price on the product page (previously only on grid tiles); products with real sales history show an honest **"120+ sold"** line (from actual order data, rounded down so it never overstates); and the mobile sticky buy bar shows **which shade is selected**, so shoppers don't scroll back up to check before tapping Add.
- **Card payments now actually reach the payment page.** Choosing "Credit / Debit Card" at checkout previously placed the order but skipped the payment step entirely — the order sat in *Awaiting payment* and the customer was never charged. Card orders now hand off to JazzCash's hosted page (where card entry lives), exactly like wallet payments. No real orders were affected.
- **The "How to earn" list can't lie anymore.** The rewards page's earn values (welcome bonus, review points, referral reward, points per PKR) were hard-coded — changing them in Settings → Loyalty updated what customers *earned* but not what the page *said*. The list now reads the live settings.
- **Wishlist joined the account hub**, so saved products are reachable from My Account, not just the header icon. And two dead controls were removed from Settings → Shipping: the tax rate and tax-inclusive toggles were never read by checkout or reports (Pakistani retail prices are tax-inclusive); they'd return only alongside a real tax computation.
- **Shade products can no longer fail or oversell at checkout.** Two long-standing defects in the order pipeline hit products sold in shades: (1) if a shade's price differed from the product's base price, every checkout of that shade was rejected with a mismatch error — one product was completely unbuyable; (2) stock was counted against the product as a whole rather than the specific shade, so a popular shade could oversell while the counter said fine, and cancellations drifted the two counts apart. Orders now price and count stock per shade, the product-level counter moves in lockstep (so "sold out" badges stay truthful), and every affected product's counters were reconciled. *One to know: the Milk Makeup jelly tint shades had been entered at Rs 1,699 while the product sells at Rs 4,500 — the old bug is the only reason nothing sold at the wrong price; the shades are corrected to Rs 4,500 (adjust in admin if a promo price was intended).*
- **A failed wallet/card payment no longer strands the customer.** Previously, when a JazzCash/Easypaisa/card payment failed or was abandoned, the customer was dropped on an **empty** checkout page with no explanation — their bag had been cleared on the way to the gateway. They now come back to a clear "payment unsuccessful" notice with their bag restored exactly as it was (including any coupon), ready to retry or switch to Cash on Delivery, plus a WhatsApp link in case money left their account. Confirmation emails and the shade name on them were also tightened up: emails now include the shade the customer picked, and a "confirmed" email can no longer be sent if the order didn't actually flip to confirmed.
- **The "Added ✓" button tells the truth.** Tapping *Add to Cart* on a sold-out shade (or when your bag already holds all remaining stock) used to flash "Added ✓" and open the cart while adding nothing. The button now only confirms when something was genuinely added.
- **Two tap-blockers on phones fixed.** The cookie-consent bar no longer covers the sticky *Add to Cart* bar on product pages (they now stack), and the decorative logo watermark in the footer no longer swallows taps on the newsletter *Join* button.
- **Search and cart panels now close when you go back.** On phones, opening the search panel (or the slide-out cart) and then swiping back — or pressing the browser's back button — used to leave the panel stuck open on top of the previous page. Both now close automatically the moment the page changes, however the navigation happened.
- **Small storefront polish.** The phone menu now sizes itself to the *visible* screen (its bottom links could previously hide behind the browser's address bar); collection, brand and tag pages show an instant loading placeholder instead of a blank screen while their products load; and all brand logos are now served from our own storage, so another site's outage can never blank the logo strip.

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
