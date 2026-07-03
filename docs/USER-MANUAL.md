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
> *Last updated: 3 July 2026 (Sortable order columns — the Orders list's *Order # / Date / Customer / Total* column headers now sort on click with direction arrows (phones get a sort dropdown above the cards), Products' sort headers use the same modern control, table rows highlight on hover, and all 33 logged **broken links** were fixed live: old duplicate product URLs now redirect to the live products, dead tag pages to matching shop categories, and the rest reviewed. Earlier: Admin-wide design sweep — every remaining admin section now speaks the same visual language as the new Dashboard/Orders: stat tiles across Customers, Inventory, Returns, Brands, Finance, COD reconciliation, Email log, Broken links and Indexing use the standard KPI card (accent bar + big number — Finance's Revenue card now carries a mini-trend); statuses everywhere (stock levels, returns, vendor payouts, collections, brands, reviews, messages, email log, activity log, team) use the soft dot-chips from the Orders list; Finance opens with its own "what stands out" strip (net margin, ROAS, awaiting-confirmation total, biggest expense category) and its date pills now keep your payment-method filter; **Returns** gained status tabs (All · Pending · Approved · Received · Refunded · Rejected) with a count; **Brands** gained search; **Messages** gained a thread search box; **Reviews** filters apply as you type and "+ Add review" moved to the page header; COD reconciliation's outstanding table stacks into cards on phones so the amount and Record action are visible; Segments links every customer row to their profile; stray text-glyph icons were replaced with proper icons or removed. Also: **customer counting fixed** — a guest who skips the optional email at checkout is now identified by their phone number, so Unique customers, repeat-purchase rate, segments and cohorts count every real customer (previously such guests were dropped from the counts entirely). Earlier: All clocks on Pakistan time — every date and time shown anywhere in the system (order lists and timelines, analytics chart labels, inventory/audit logs, customer order history and tracking, review dates) now renders in **Pakistan Standard Time** regardless of where the server runs; previously, server-rendered timestamps could display up to 5 hours behind — e.g. an order placed at 02:30 showed the previous day. Also: Analytics question-tabs — the Analytics page is reorganised into four tabs that each answer one question: **Sales** (revenue/orders/AOV with change-vs-previous-window pills and mini-trends, revenue chart, orders-by-status that links into the filtered Orders list, top products), **Customers** (unique/repeat, segments, cohort retention), **Traffic** (SEO trend, Search Console, GA4, Core Web Vitals, top pages/events) and **Funnels** (conversion funnel, by source/device, user journeys, session recordings); the Sales and Customers tabs open with a computed **"what stands out"** strip that reads the numbers for you. Also: Dashboard command centre — the admin Dashboard now opens with a **Today** row (sales, orders, average order value — and visitors once GA4 is connected — each with a 14-day mini-trend and a comparison against the same weekday last week), the **Needs attention** card moved to the top and now also lists **unread customer messages** and **reviews awaiting moderation** alongside stuck payments, stale orders and pending returns (red = money/orders at risk, amber = routine queue work), **Recent Orders** moved up and adopted the split Payment/Fulfilment chips, and the quiz funnel was tucked into a collapsed "More insights" section. Analytics adopted the same KPI-card and date-range controls as the Dashboard, with per-metric mini-trends on the Revenue/Orders/AOV cards. Earlier: Shopify-style Orders workspace — the Orders list now has **saved-view tabs** (All · To fulfil · Unpaid · Shipped · Delivered · Cancelled, plus a More… menu), **separate Payment and Fulfilment status chips** on every row (so "am I paid?" and "has it shipped?" each get their own answer), an item-count column, and the customer's city under their name; the CSV export follows whichever view is active. The order page's item list now shows **product thumbnails** so packing can be verified at a glance. Earlier: storefront design-quality pass — a screenshot-driven design review of every storefront page at phone + desktop widths, then fixes: the **mobile product-page sticky buy bar** no longer collapses its Add-to-cart button (a flex sizing bug); product-card **Add to cart** moved below the packshot as a magenta outline button on phones (was a black pill covering the image) with a hover-reveal on desktop; oversized mobile product titles clamped; the duplicated "Why this product earns a spot" trust band removed (the buy-box chips stay); the empty-reviews box collapsed to one line; **cart/checkout empty states** unified ("Your bag is empty" in the brand serif with a proper bag icon, and the dead-end "View cart" link replaced with "Shop bestsellers"); the **quiz landing** redesigned (icon panels, hover affordance); **Brands** is a compact 2-column grid on phones (was ~40 screens of scrolling) with branded monogram tiles for imageless brands; k-beauty brand grid rebalanced; **Track Order** restyled to the house header/button pattern with a contact help-link; contact page heading/cards unified; the **footer link columns collapse into accordions on phones**, and the pre-footer marquee now cycles value props instead of repeating the store name; announcement-bar underline no longer swallows the comma and the banner copy was shortened to fit one line on phones; the floating WhatsApp button is smaller, ringed, and hidden on the Contact page. Also earlier: no-email order flag — the order page's Customer card now shows an amber **"No email — this customer receives no automatic updates"** note when the buyer skipped the optional email field at checkout, since email is the only automated channel; such orders must be confirmed via the WhatsApp button. Earlier: admin polish round — the **order page is re-laid-out in two columns**: customer, address, items and the fulfilment steps (confirmation → vendor → shipment) on the left, with **Update Order and the payment cards in a right-hand rail at the top**, so changing a status no longer means scrolling past every cost card; costs, profit, notes and the timeline follow below. The **sidebar now badges Returns** (requests awaiting a decision) **and Reviews** (awaiting moderation), joining Orders and Messages, so morning triage is visible at a glance. **Reviews** gained the standard toolkit — search, product + status filters, pagination (the list previously stopped silently at the latest 20 approved) — and a **public reply**: respond to any live review and it appears on the product page as "Response from Yellow Pink" (the dormant WP-era reply column was removed in favour of this). Also earlier today — vendor selection fix — on the order page, **picking the vendor in "Fulfilled by vendor" now applies the economics immediately** (settlement + auto acquisition cost, with a confirming toast); previously only sending the WhatsApp message did, and with a single vendor the dropdown always *looked* selected even when the order had none — it now starts at "No vendor (own stock)" until you assign one, and clearing it removes the settlement and an auto-filled cost. The product page's vendor field is clarified as **Default supplier**: it groups Inventory reorder suggestions and makes order pages (and the manual-order form) suggest that vendor one-click when the order's items are sourced from them — it never assigns a vendor to an order by itself; the per-product **Vendor cost** field now works without naming a supplier. Earlier the same day — admin quality round — navigation & catalog workflow: the **sidebar is re-organised into six frequency-ordered groups** — Insights · Sell · Catalogue · Customers · Marketing · System — with Coupons filed under Marketing, Messages and Reviews under Customers, Email log under System, and **COD reconciliation now a tab inside Finance** (Overview / COD reconciliation at the top of the page) instead of a separate sidebar item; "Review Board" is renamed **Medical reviewers**; the **Cmd K** palette mirrors the same groups. Products gained a per-row **Duplicate** action — deep-copies a product (variants, tags, gallery images, related links) into a new draft named "… (copy)" and opens it for editing — and an **Export CSV** button that downloads the whole catalogue in the same column layout the importer accepts, completing the spreadsheet round-trip for mass repricing/restocks (rows match by `slug`; exported `status` and `track_inventory` columns are honoured on re-import, and an import without those columns leaves them untouched). Saving a **new product** now lands on its edit page — where variants, tags and images live — instead of bouncing back to the list. The **Messages** inbox shows each customer's order history in the thread header — order count, lifetime value, and the latest order with status — linking to their filtered order list.). Previous update: 2 July 2026 (unified vendor & cost model: **the order's vendor now determines its cost — automatically**. Dispatching an order to a vendor (the WhatsApp button) computes the goods cost from the vendor's commission % (or a product's fixed *Vendor cost* / *Cost price* when set), writes the settlement **and** auto-fills the order's **Acquisition cost / COGS** with the same figure, so Finance and the vendor payout always agree; the *Order costs* card now shows where the number came from — "Auto-filled from *NB Sons @ 12.5% margin*", "Entered manually", or a prompt when unknown — a manually typed cost is never overwritten by a re-dispatch, and a **Recalculate from vendor rate** button re-derives the auto figure on demand. **Manual orders** can be marked *Fulfilled by vendor* at entry — pick the vendor, see the estimated cost + your margin live, and the order is created with its settlement and auto cost already recorded. Booking a shipment (API **or** manual tracking) now takes an optional **Courier charge (PKR)** that lands straight in the order's *Delivery cost* (an already-recorded charge is never overwritten). Also in this round — feedback & fulfilment: booking a shipment — one-click API pickup **or** a manually entered tracking number — now automatically marks the order **Shipped** and emails the customer their tracking (once; an already-shipped order is never re-emailed), with a confirmation under the booking form; **bulk status changes** from the Orders list now send the same customer emails as single updates; saving *Order costs*, *Payment received* or *Internal notes* on an order — and deleting an order, customer or blog post — now confirms with a toast (errors show too, instead of the page silently doing nothing); a failed **blog-post save** (e.g. duplicate URL slug) keeps everything you typed, including the body, and the editor warns before you leave with unsaved changes; the **coupon create form** keeps your input and shows the error inline instead of clearing; an expired or maxed-out coupon now shows one clear status — *Expired* / *Maxed out* — rather than also claiming to be Active; order-status badge colours are now identical across the dashboard, Orders list, filter pills, order page and customer page; and the Returns 90-day return-rate shows its formula on hover. Earlier the same day — hardening: newsletter campaigns and the admin CSV exports — Orders, Finance orders, COD manifest — now cover the **whole** list instead of silently stopping at the first 1,000 rows; and the public quiz email capture, doctor-application form and broken-link logger are now rate-limited against abuse — someone re-submitting very rapidly sees a polite "too many attempts, try again in a few minutes" message, normal use is unaffected. Manual orders: a **+ New order** button in admin → Orders lets you key in WhatsApp/phone orders — product search, editable prices, suggested shipping, optional discount and confirmation email, with stock reserved like any storefront order. Simplification: removed the **Promos** admin section and the storefront **promo strip** entirely — neither was ever used. The one remaining banner is the thin **announcement bar**, managed in **Settings → Homepage**. Post-purchase accounts: the thank-you page now offers guest buyers a one-field **"Save your details for next time"** account signup — email pre-filled from the order, past guest orders linked automatically after confirmation. Internal-linking round: product pages gained a **"From the blog"** row showing journal articles that feature the product; the footer gained a **Collections** column listing the top published collections; and blog articles now automatically turn mentions of any shop product into a link to its product page — capped per article so posts stay readable. Audit fixes, round 4: deleting a **vendor** no longer wipes its payout/settlement history — the payout rows are kept and the supplier is shown as "(deleted)"; deleting a **brand** or **collection** now reports a real error instead of always claiming success; **product, brand and collection edits — and CSV imports — now show on the live storefront straight away** instead of taking up to five minutes to appear; **CSV product import** now actually saves the rows (it was silently importing nothing), and a WooCommerce export whose *Sale price* column is blank keeps the product's regular price instead of importing it at 0; and saving a manual collection's products is now atomic, so a failed save can no longer empty the live collection). Round 3: refer-a-friend links now work — a `?ref=<code>` link is remembered and credited to the referrer on the friend's first delivered order; the doctor **reviewer dashboard** now lists the articles credited to each reviewer instead of showing an empty list; and customer-submitted product reviews can no longer self-approve or fake a "verified purchase" — they always enter the moderation queue unapproved). Round 2: the Orders **Export CSV** button works again and reports errors instead of silently doing nothing; the order page's **Delete order** button works again; bulk-cancelling orders now restocks their items just like a single cancel, and cancelling (single or bulk) asks for confirmation first; **Resend confirmation email** now reports when the email couldn't actually be sent; returns gained the final **Mark as refunded** step, and the linked order now moves to *Returned* / *Refunded* automatically; the Returns 90-day return-rate can no longer exceed 100%; Finance no longer counts unpaid awaiting-payment orders as revenue and recognises ad-spend categories regardless of letter case; deleting an expense asks for confirmation; the dashboard's Orders-by-Status chart covers every status so its percentages add up, greets you in Pakistan time, and payment methods show friendly names — JazzCash instead of "jazzcash" — everywhere in the admin; the order timeline now shows **who** made each status change). Earlier the same day (audit fixes: new products now start as **Draft** via a Status field on the product form; products with order history are archived on delete instead of removed; a failed product save no longer clears the form; added the **Free shipping** coupon type; the Promos list shows paused/scheduled promos again, validates that the end date is after the start date, and confirms saves with a green banner; stock adjustments that would go below zero now warn and record only the applied amount; admin nav icons switched to crisp inline SVGs; cookie banner no longer covers the admin panel). Previous update: 26 June 2026 (added admin Products status tabs — All/Published/Drafts/Archived with live counts — plus working column filters (category, brand, stock state, tag, price range) and a bulk "Set draft" action, for easier draft-vs-live management; staged the full Golden Pearl skincare/haircare range as draft products; consolidated medical reviewers onto the Medical Review Board — retired the old store-wide reviewer field in Settings; added Connect Google — OAuth sign-in that auto-links Search Console + GA4, submits the sitemap for indexing, and renders live GSC + GA4 panels on the Analytics page; added a Find Your Match product-recommendation quiz with PostHog/Sentry instrumentation and a dashboard funnel; added a self-serve Medical Review Board — doctors apply, you approve, they get a magic-link dashboard; removed Subscribe & Save and the stock-alert automation to suit the dropship model; added a Broken links 404 monitor with one-click redirects + daily digest, a floating WhatsApp chat button, optional short product videos in the PDP gallery, the contact-page redesign, and keyword-led SEO meta across the storefront).*

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
  code** for a discount. The free-shipping progress bar is followed by the same
  **estimated delivery time** shown on the product page. Below the items a
  **"You may also like"** row suggests bestsellers (excluding what's already in
  the bag) to encourage add-ons.
- **Checkout** — the customer enters their delivery details (name, phone, email,
  full address), sees the shipping cost, and chooses how to pay. A short
  reassurance strip (authentic products, cash on delivery, 7-day returns) sits
  by the **Place Order** button. The free-shipping threshold shoppers see in the
  cart, mini-cart and checkout all come from one shared setting, so they always
  agree. Free shipping is earned on the merchandise subtotal (before any
  discount code), so applying a coupon never strips a free-shipping promise the
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
| **Dashboard** | Your command centre, laid out in the order a morning check actually happens. A **Today** row opens the page — sales, orders, average order value (and visitors once Google Analytics is connected) for the current day, each with a 14-day mini-trend and a comparison pill against **the same weekday last week** (the fairest daily baseline; an early-morning "down" is normal since it compares against last week's full day). Directly below, a **Needs attention** card lists everything waiting on a human: payment-pending orders stuck over 24 hours and unconfirmed orders over 3 days old (red), plus return requests awaiting approval, unread customer messages, and reviews awaiting moderation (amber). Each row deep-links to the filtered list so you can clear it in one click; the card hides when there's nothing to clear. Then the interactive **Overview** chart (sales/orders/AOV/sessions over 7/30/90 days vs the previous period), quick-stat cards (*Orders to fulfil* — jumps straight to the To fulfil tab —, *Low stock items*, *New customers*), **Recent Orders** with the same split Payment/Fulfilment chips as the orders list, low-stock alerts, order-status and top-product breakdowns. The **Product finder quiz** funnel (starts, completions, emails captured, most-recommended products) now lives in a collapsed **More insights** section at the bottom — click to expand. |
| **Analytics** | Deeper performance data, organised as **four question tabs**: **Sales** (am I selling more? — revenue/orders/AOV cards with mini-trends and change vs the previous window, the revenue chart, orders by status with links into the filtered list, top products), **Customers** (who buys and do they return? — unique customers, repeat-purchase rate, RFM segments, cohort retention), **Traffic** (is anyone finding us? — the SEO trend, live **Search Console** and **Google Analytics 4** panels once you **Connect Google** in Settings → Integrations, Core Web Vitals, top pages/events), and **Funnels** (where do shoppers leak? — the conversion funnel, funnel-by-source and funnel-by-device, top user journeys, weekly active users, and PostHog session recordings). The Sales and Customers tabs open with a short **"what stands out"** strip — plain-language observations computed from the same window (e.g. *"Revenue is up 23% vs the prior 30 days"*, *"X alone drove 18% of this window's revenue"*) — so the numbers come with their own reading. The date-range pills (7/30/90 days, 1 year) apply across tabs. |
| **Finance** | Profit & loss for any period (7/30/90 days or all time): revenue from paid orders, minus **cost of goods** (COGS), delivery and payment-fee costs → gross profit, minus your logged expenses (ad spend + overheads) → **net profit and margin**. COGS comes from each order's **Acquisition cost / COGS**, which the system fills in **automatically the moment you select a fulfilment vendor on the order**: the vendor's commission % (set on the Vendors page) determines the goods cost — e.g. at 12.5% margin a PKR 2,000 order costs you PKR 1,750 — unless a product carries its own fixed **Vendor cost** or **Cost price** (Products → a product → *Vendor & sourcing*), which win for that item. The *Order costs* card on each order shows where its number came from ("Auto-filled from …" / "Entered manually") and you can always type the **actual** figure yourself — a manual value is never overwritten by a re-dispatch, and a **Recalculate from vendor rate** button restores the automatic one. Orders with no acquisition cost fall back to the old estimate: vendor items use the vendor cost from their settlement, and own-stock items use the product's **Cost price** — so set a cost price on own-stock products so their profit is real instead of showing as 100% margin. A **Revenue by payment method** table breaks down orders, revenue and gross profit per method (Cash on Delivery, Bank Transfer, JazzCash, etc.); a **Revenue by account** table shows where payments actually landed once reconciled (with a count of orders still awaiting confirmation); an **Orders in this period** table lists each order's total, costs, gross profit and margin (latest 100, filterable by payment method and exportable to **CSV**); and an **Awaiting payment confirmation** list flags non-COD orders not yet reconciled. Also shows **ROAS** (return on ad spend) by traffic source. Log ad spend and overheads in the **Expenses** table here; enter each order's acquisition (goods), delivery and payment-fee cost on the order page (*Order costs*), where an **Order profit** summary then shows that order's net profit and margin. On each order you can also record **Payment received** — pick which of your configured accounts (Settings → Payments) the money landed in and the date; this feeds *Revenue by account* and the awaiting-confirmation count, and is for reconciliation only (it doesn't change the order status). |
| **COD reconciliation** (a tab inside Finance) | The cash side of the business at a glance: **Outstanding** (delivered COD orders waiting for you to confirm cash received), **Collected** (delivered and reconciled), and **In transit** (still out for delivery — your expected cash to come). Open any order to record the payment. Two CSV exports — **Download CSV** for the full active COD list (a courier/route manifest) and **To-collect only** for the outstanding subset — open cleanly in Excel. Switch between **Overview** and **COD reconciliation** with the tabs at the top of the Finance page. |

**Sell** — day-to-day commerce operations
| Section | What it's for |
|---|---|
| **Orders** | Every order placed. **Saved-view tabs** across the top — *All · To fulfil · Unpaid · Shipped · Delivered · Cancelled* (plus a More… menu for the rarer statuses) — jump straight to the work: *To fulfil* is everything still yours to action, *Unpaid* is live orders whose payment you haven't reconciled yet. **Sort by any column** — click the *Order # / Date / Customer / Total* headers to sort (click again to flip direction, a third time to reset to newest-first; the arrows show the active direction), and on phones a **sort dropdown** sits above the order cards. Each row shows **two separate status chips**, Shopify-style: **Payment** (Paid / COD — on delivery / Payment pending / Awaiting gateway / Failed / Refunded) and **Fulfilment** (Unfulfilled / Shipped / Delivered / Cancelled), plus the item count and the customer's city. Also filter by **date range** (Today / Last 7d / Last 30d / Last 90d / All time — "Today" is the calendar day in Pakistan time) and by search across order number, name, email or phone. Unfulfilled rows (pending / processing / payment_pending) get a coloured **age pill** next to their date — amber when they've sat too long, red when they're at risk — so a stale order jumps out without reading every date. An **Export CSV** button downloads the currently filtered list (needs the *Orders — View* permission; it tells you if there's nothing to export or the export fails). Open an order to process it. With the *Orders — Delete* permission, an order page has a **Danger zone** to permanently delete that order (and its payment/shipment/settlement records) — useful for removing test orders; it can't be undone. A **+ New order** button (also in the Cmd K palette as "New order") opens **manual order entry** for orders taken over WhatsApp, phone, or DMs: search-and-add products (quantities and unit prices are editable, so an agreed special price is fine), enter the customer's delivery details, and the shipping charge is suggested from your shipping zones (editable — set it to 0 for free delivery) along with an optional manual discount. If a supplier will fulfil the order, pick them in **Fulfilled by vendor** — the form previews the estimated vendor cost and your margin from the vendor's commission %, and the created order gets its acquisition cost and settlement recorded automatically (nothing is sent to the vendor yet — use the order page's WhatsApp dispatch for that). Stock is reserved through the inventory ledger exactly like a storefront order, the order appears in the list marked as a manual order for reporting, and if you enter the customer's email you can tick a box to send them the standard confirmation email. |
| **Products** | The catalogue. Create, edit, publish, archive, and delete products; manage variants, images, an optional **short product video** (drag-drop or browse — MP4/WebM, max 30 MB; shown as a tap-to-play gallery slide), pricing, and descriptions. Saving a **new** product now lands you straight on its edit page (variants, tags and extra images are only editable there), with a note confirming it was created. Each product page also has a **Tags** box — type to add a free-form tag (creating it if new) or reuse an existing one. **Status tabs** across the top — *All · Published · Drafts · Archived*, each with a live count — let you see and manage draft vs live products at a glance (only Published items show on the storefront; Drafts are hidden until you publish them). **Column filters** sit beside them: search by name/brand, and filter by **category**, **brand**, **stock state** (in stock / low / out / externally managed), **tag**, and a **price range** — all combine, and the filtered view is shareable via the URL. Tick rows to reveal the **bulk bar**: *Publish*, *Set draft*, *Archive*, set/clear tag, adjust price by %, or delete. Price and stock cells, and each row's status, are editable inline. Every row also has a **Duplicate** button — it deep-copies the product (variants, tags, gallery images and related-product links included) into a new **draft** named "… (copy)" and opens it for editing, the fastest way to add a product that's similar to an existing one. **Export CSV / Import CSV** complete the spreadsheet round-trip: Export downloads the whole catalogue (all statuses) as one file whose columns match the importer, so you can mass-edit prices, stock or statuses in Excel and re-import the same file — rows are matched by their `slug` column, so don't edit that column. The product form has a **Status** field (Basics section): new products start as **Draft**, so nothing goes live — or gets submitted to search engines — until you switch it to *Published*. Deleting a product that has ever been ordered archives it instead of removing it, so order history and analytics keep the product's name. |
| **Inventory** | Stock levels. See low-stock items and adjust stock counts. Stock can never go below zero: if you remove more than is on hand, the adjustment is capped at zero, the ledger records the amount actually applied, and the page shows an amber warning telling you what was applied versus what you asked for. |
| **Returns** | Customer return requests and refund processing, with KPIs (volume, refunded total, 90-day return rate) and most-returned products/reasons. **Status tabs** across the top (All · Pending · Approved · Received · Refunded · Rejected, with a count) jump straight to the queue you need. The sidebar shows a badge with the count of requests awaiting a decision. The lifecycle: **Approve** (set the refund amount and method) or **Reject** a pending request; **Mark as received & restock** when the parcel arrives back (restores the items to stock and moves the order to *Returned*); then **Mark as refunded** once the money or store credit has actually gone out (moves the order to *Refunded*, so its revenue drops out of Finance/Analytics). |
| **Vendors** | Your suppliers/fulfilment partners. Add vendors with their **commission %** (the share of the sale price *you* keep) and settlement direction (who collects the customer's payment). The commission **applies automatically the moment you select the vendor on an order** (see [section 4, step 2](#4-processing-a-sale--the-order-workflow)): it computes the vendor cost and your margin, records the settlement, and auto-fills the order's acquisition cost with the same figure — no WhatsApp message required. A product can also name this vendor as its **default supplier** (product page → *Vendor & sourcing*), which groups Inventory reorder suggestions by vendor and makes order pages suggest them one-click. Track what you owe or are owed in the **Payouts** table and mark settlements settled. |

**Catalogue** — how products are organised and presented
| Section | What it's for |
|---|---|
| **Collections** | Curated product groups, each with its own landing page (`/collection/<slug>`). **Manual** collections are a hand-picked, drag-ordered product list; **Smart** collections fill themselves from rules (e.g. *tag is viral* **and** *price ≤ 3000*) and stay current as products change. Set a title, description, hero image, SEO, and Draft/Published status. Draft collections are hidden from the storefront. |
| **Brands** | The brand pages (`/brand/<slug>`) — logo, description and SEO text for each brand you stock. **Search** by name or slug above the list, and the summary cards flag brands still needing a description, logo or hero image. |
| **Tags** | The tag vocabulary. Free-form labels (e.g. *viral*, *vegan*, *gift*) you attach to products for storefront filtering and curated edits. Create, rename (the storefront link stays stable), or delete a tag; deleting removes it from every product. The "N products" link jumps to the tagged products. |

**Customers** — the people you sell to and talk to
| Section | What it's for |
|---|---|
| **Customers** | Everyone who has bought from you. Each row carries a **Registered** badge (the shopper created an account) or a **Guest** badge (they checked out without one). Search by name, email or phone, and open any customer to see their orders and lifetime spend. The customer page shows four stats — **Orders / Delivered / Total spend / Avg order** (total spend and average exclude cancelled, refunded, returned and payment-failed orders so they reflect realized revenue) — plus a tap-to-call phone link and a one-tap **WhatsApp** button that opens chat with a Yellow Pink greeting pre-filled. Guests are grouped by email (a guest's repeat orders show as one customer); if a guest later signs up with the same email, their orders move under that account automatically. With the *Customers — Delete* permission, a registered customer's page has a **Danger zone** to permanently delete their account; their orders are kept (detached as guest orders) so revenue history stays intact. Guests have no account to delete — remove their orders individually instead. |
| **Segments** | Customer groupings (e.g. high-spenders) for targeting and analysis. Each customer row links to their profile, and guests without an email are identified by their phone number so nobody drops out of the counts. |
| **Messages** | A **threaded inbox** for the storefront **contact form** and **inbound email** (direct emails to your store address show an **Email** tag). Messages are grouped into **conversations by customer**, shown as a chat (their messages on the left, your replies on the right). Each conversation's header shows the customer's **order history at a glance** — how many orders, their lifetime total, and the latest order with its status (e.g. *3 orders · PKR 12,400 · last: YP-1042 (shipped)*) — so you know who you're talking to before you reply; click it to open their filtered order list. **Reply right here** — the box at the bottom of a conversation sends your reply **from your store address via email**, and the reply is saved into the thread, so the whole exchange stays on record. When the customer replies, it threads back into the same conversation automatically. Per-conversation **Mark read** / **Archive** / **Restore**, and a **search box** above the inbox finds a thread by customer name, email or subject. The Messages menu item shows a pink badge with the unread count, and the bell notifies on new **incoming** messages (your own replies don't notify). |
| **Reviews** | Moderate customer reviews and talk back to them. The **Pending Approval** queue always sits at the top (the sidebar shows a badge with its count); below it, **All Reviews** is searchable (name or review text), filterable by **product** and **status**, and paginated — no more silent cap at the last 20. On any live review, **Reply publicly** posts a *"Response from Yellow Pink"* that appears under the review on the product page (edit or clear it any time — saving an empty box removes it). You can also seed reviews yourself (migration / phoned-in feedback) via the **+ Add review** button in the page header, and the search/product/status filters apply as you type — no Filter button. |

**Marketing** — content and campaigns
| Section | What it's for |
|---|---|
| **Coupons** | Discount codes — create, edit, set limits and expiry, and turn them on/off. Three types: **Percent %** (a percentage off the items), **Fixed PKR** (a set amount off), and **Free shipping** (waives the delivery charge instead of discounting the items — no value needed). If a create is rejected (missing value, duplicate code, …) the form keeps what you typed and shows the reason inline. Each coupon's status pill shows its one effective state — *Active*, *Inactive*, *Expired* or *Maxed out* — and clicking it toggles the coupon on/off. |
| **Blog** | Editorial posts shown in the storefront "Journal" and at `/blog`. Each post has an **Author** field for the byline (defaults to "Yellow Pink Editorial Team"); naming a real expert on health/beauty posts strengthens their search-engine trust signals. You can also attach a **Medical reviewer** (see below) to a health post, which adds a *"Medically reviewed by Dr. …"* byline and reviewer schema. |
| **Medical reviewers** (`/admin/reviewers`) | The panel of real, qualified doctors who medically review your health/supplement content (the strongest E-E-A-T trust signal). Doctors **apply themselves** via the public form at `/medical-review-board/apply`; their applications appear here under **Pending applications** with the credentials and PMDC number they entered. **Verify the credentials, then Approve & invite** — that publishes their profile on the public [review board](/medical-review-board), provisions a passwordless (magic-link) sign-in, and emails them a link to their own **reviewer dashboard** (`/reviewer`), where they manage their profile and see the articles credited to them. You can also add a reviewer manually, set a **default** reviewer (the fallback byline for health posts with no explicit reviewer), and reorder or hide the board. **Only approve genuine, consenting clinicians.** |
| **Newsletter** | Compose and send newsletter emails. Manage the subscriber list directly — add, edit, unsubscribe, or resubscribe people. |

**System** — configuration and admin internals
| Section | What it's for |
|---|---|
| **Settings** | Store-wide configuration — see [section 6](#6-store-settings). |
| **Team** | Staff accounts and their roles. Owner only. |
| **Activity log** | The audit trail — every staff action (saves, deletes, status changes, sign-ins) with who did it and when. Owner only. |
| **Email log** | A record of every email the system has sent (order emails, newsletters, etc.). |
| **Broken links** | Every URL on the store that returned a **404**, captured automatically the moment a visitor or search-engine crawler hits it (aggregated per URL with a hit count, last-seen time, and where the click came from). For each one you can **add a redirect** — type where it should go and it's live within a minute, **no deploy** — or **ignore** it (a 404 for genuinely removed content is perfectly fine and doesn't hurt ranking). You also get a **daily email digest** of any *new* broken links so nothing slips past. |
| **Indexing** | Search-engine indexing status and tools — see which pages have been submitted to Google/Bing and resubmit after big content changes. |

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

The **owner** has unrestricted access. Everyone else is a **staff member** with
a login, managed under **Team** (owner only).

- Each staff member is given a **role** — a named bundle of permissions (for
  example a support role, a marketing role, an inventory role) — or a custom
  set of permissions chosen individually.
- **Permissions** decide which admin sections that person can open. A staff
  member only sees the sections their permissions allow; anything else shows an
  "Access restricted" page.
- Deactivating a staff member blocks their login while keeping their history in
  the activity log.

To add someone: **Team → Add Staff Member**, enter their name and email, pick a
role, and save. They receive a temporary password to sign in with and change.

---

## 6. Store settings

**Settings** (`/admin/settings`) splits into eight focused sub-pages, each
reachable from the left rail. Open Settings and the rail shows where to go for
what — pick a page, edit, hit **Save changes** at the bottom.

| Sub-page | What it controls |
|---|---|
| **Store profile** (`/admin/settings/profile`) | Store name, currency, contact email and phone, and links to your social profiles (used in the footer and for search-engine data). |
| **Branding & theme** (`/admin/settings/branding`) | Brand colours (pink, yellow, ink) and the **Seasonal Theme** — a one-switch makeover (palette, motif, hero) for Eid, Christmas, etc. |
| **Homepage** (`/admin/settings/homepage`) | The big **Homepage Hero** (wording, buttons, image, brand logos), the store-wide **Sale** on/off switch, and the thin **Announcement Bar** at the top of every page. |
| **Shipping & tax** (`/admin/settings/shipping`) | An **Offer free shipping** master switch, the default shipping rate (the fallback) and free-shipping threshold, tax rate, and per-zone overrides — add named zones (e.g. Karachi, Lahore, Remote) with their own rate, free-shipping threshold, and estimated delivery days. The threshold and the on/off switch flow through the **whole site at once** — the product page, cart progress bar, mini-cart, checkout estimate and the charged shipping all read the same setting, so changing the number (or turning free shipping off entirely) updates everywhere with no stale copy. |
| **Payments** (`/admin/settings/payments`) | Turn each payment method on or off, and manage the bank/wallet accounts shown to customers paying by transfer. |
| **Loyalty** (`/admin/settings/loyalty`) | How customers earn and redeem loyalty points, and the **refer-a-friend** rewards (points to the referrer, a first-order discount to the friend). Referral links now work end-to-end: when someone arrives on a `?ref=<code>` link the code is remembered for 90 days and, once they place their first order while signed in, it is stamped onto their profile so the referrer is paid out when that order is delivered. |
| **Notifications** (`/admin/settings/notifications`) | Add as many staff email addresses as you like and pick which alerts each one receives — **New orders** (every order, immediately) and **Broken links (404s)** (daily digest of newly-broken URLs). If nobody is configured for an event, the alert falls back to the `OWNER_EMAIL` env var so existing behaviour is unchanged. |
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
