# Owner to-do — things only you can finish

**Last updated:** 2026-06-21

These are the steps that need *your* accounts, domain/DNS access, or business
decisions — the code side is done and live. Roughly in priority order.

## 1. Connect Google (Analytics + Search Console) — ✅ DONE
The wiring is built — IDs pasted in **Admin → Settings → Integrations → Connect
Google**. Both verified live on the site (2026-06-21).
- [x] **GA4:** Measurement ID `G-7T3LNCVZZ0` firing on the storefront.
- [x] **Search Console:** verification meta tag live; property verified.
- [x] **Sitemap** `sitemap.xml` submitted in Search Console.
- [ ] _Over the next few days, check GSC → Pages/Indexing to confirm Google is
      crawling, and GA4 → Realtime to confirm traffic is recording._

## 2. Google Merchant Center (products on Google Shopping, free)
Feed is ready: `https://www.yellowpink.pk/feeds/google-merchant.xml` (299
products, drafts excluded).
- [ ] Create account at merchants.google.com (country Pakistan, currency PKR).
- [ ] Claim the website (reuses Search Console verification — do #1 first).
- [ ] Set up **Shipping** (free listings require it).
- [ ] **Products → Feeds → Add primary feed → Scheduled fetch** → paste the feed
      URL → daily schedule.
- [ ] Enable **free listings** ("Surfaces across Google").
- [ ] Clear disapprovals — likely "missing GTIN": set **identifier exists = no**
      for own-label/local items.
- _Not needed: the Merchant API / API diagnostics — the feed covers everything._

## 3. Meta (Instagram/Facebook) shopping
- [ ] Connect the feed `https://www.yellowpink.pk/feeds/meta-catalog.xml` in
      **Meta Commerce Manager** → Catalog → Data sources → scheduled feed.

## 4. WhatsApp + inbound email
- [ ] **WhatsApp header button:** set `NEXT_PUBLIC_WHATSAPP_NUMBER` in Vercel env
      (your `store_phone` is saved, but the header button reads this env var).
- [ ] **Inbound email to `hello@`** (optional, capture replies in Admin →
      Messages) — uses **Resend** (no new provider): in Resend, enable
      **receiving** for `yellowpink.pk` and add the **MX record** to DNS; add a
      Resend **webhook** for the `email.received` event pointing at
      `https://www.yellowpink.pk/api/inbound-email`, and copy its signing secret
      into `RESEND_INBOUND_WEBHOOK_SECRET` in Vercel, then redeploy.

## 5. The 35 catalogue-gap product drafts
They're prepped with real product, brand, market price **and image** — hidden
until you publish. See `docs/catalogue-gaps.csv` for supplier + price per item.
- [ ] Source the ones you want to stock.
- [ ] In **Admin → Products**: set **your** retail price (current values are
      market references — add your margin), confirm stock, add any better photo,
      then **Publish**.
- [ ] (Optional) swap the **probiotics** image — the brand master was low-res.

## 6. Social profiles
- [x] **Instagram** linked (`@yellowpink.pk`).
- [ ] Send me your **Facebook / TikTok / YouTube / X / Pinterest** handles (or
      add them in **Admin → Settings → Store profile → Social media**). They'll
      appear in the footer + Google `sameAs` automatically.

## 7. SEO follow-ups (optional, growth)
- [ ] Re-run the **Semrush Site Audit** to refresh the score (the broken-image /
      canonical / orphaned-page issues are already fixed in code).
- [ ] Set up **rank tracking** for the target keyword set (see
      `docs/SEO-KEYWORDS.md`).
- [ ] Consider stocking the catalogue gaps + the launch blog posts already
      published to capture that demand.
