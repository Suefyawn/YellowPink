# Owner to-do — things only you can finish

**Last updated:** 2026-09-04

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

## 8. Bing Webmaster Tools (5 minutes, unlocks the Bing card on Analytics)
- [ ] Go to **bing.com/webmasters**, sign in, choose **Import from Google Search
      Console** (uses the Google connection you already have; no meta tag needed).
      If you prefer the tag route, paste the `msvalidate.01` content value into
      **Admin → Settings → Integrations → Bing Webmaster Tools, verification code**.
- [ ] In Bing Webmaster Tools: **Settings → API access → Generate API key**. Copy it.
- [ ] In Vercel: **Project → Settings → Environment Variables** → add
      `BING_WEBMASTER_API_KEY` = the key (Production), then **Redeploy**.
- [ ] Next morning (or after **Refresh** on Analytics), the **Bing search** card
      fills in. IndexNow already submits every new page to Bing without the key;
      the key adds Bing's own submission channel and the reporting.

## 8b. Microsoft Clarity API token — ✅ DONE (15 Sep 2026)
Token generated and set; the card is reading live numbers. First reading:
**27.8% of sessions are quickbacks** (open a page, immediately go back),
7.4% dead clicks, no rage clicks and no script errors.
- [x] Token generated at clarity.microsoft.com → Settings → Data export.
- [x] `CLARITY_API_TOKEN` set in the server environment.
- [x] The **On-page frustration** card on **Analytics → Traffic** is populated.
- [ ] Worth knowing: the token is read-only, the API returns only the **last 3
      days** (there is no longer history to request), and the quota is **10
      calls per project per day** — the daily analytics refresh spends one.

## 8c. Move off Vercel onto your own server (about an hour)
The code side is finished and merged; what is left needs a person with a credit
card and an hour. **`docs/SERVER-SETUP.md` is written for someone who has never
touched a server** — which provider to rent from and what it costs, how to make
an SSH key on Windows or Mac, how to log in, and then one command that does the
rest.
- [ ] Rent a machine. **Hetzner CX22, Singapore, about €4/month** is the
      straightforward choice (~75% cheaper than Vercel Pro). **Oracle Cloud
      Always Free** in Mumbai or Hyderabad is PKR 0 forever and a bigger
      machine, but its free capacity is often unavailable and you may have to
      retry over a few days.
- [ ] `sudo bash provision.sh yellowpink.pk` on the new box. It stops once to
      have you paste the settings from Vercel into `/etc/yellowpink.env`, then
      carries on by itself.
- [ ] Test it over the real domain using your computer's hosts file, **before**
      moving DNS. The checklist is in the guide; it includes placing a real
      test order.
- [ ] Move DNS, leave Vercel running alongside it.
- [ ] Cancel Vercel only after the new box has served a full day **including
      one successful daily cron run** (`tail -50 /var/log/yellowpink-cron.log`).

## 8d. The eight hair products are LIVE — two things need checking today
Published 15 Sep on the owner's instruction, because
`/blog/best-shampoo-in-pakistan` is the store's single biggest entry point
(216 visitors/30d) and the store had zero published shampoos. Hair Care went
from 5 products to 13, and the Routine Finder's dandruff branch is open again.

They went live WITHOUT two things that normally come first, so these are now
urgent rather than optional:
- [ ] **Check the prices.** They are extrapolated from your own per-brand bands
      (`docs/HAIR-CATALOGUE-DRAFTS-2026-09-14.md` marks every one
      "Unconfirmed"), not from supplier cost. CeraVe 6,500 · La Roche-Posay
      6,900 · OGX 2,250–2,450. On cash on delivery a wrong price is lost
      margin or a cancelled order.
- [ ] **Check you can actually supply them.** All eight are `external` stock
      mode, so they never show as sold out and can always be ordered. An
      order you cannot fulfil feeds the 32% COD cancellation rate.
- [ ] **Get the photographs.** They render as a branded monogram tile until
      then, which is tidy but converts worse than a photograph. The
      distributor request email is in `docs/PRODUCT-IMAGES.md`.
- [ ] Still in Draft on purpose: Olaplex No.3 and The Ordinary hair serum (not
      shampoo or conditioner), and the six Set and Touch shampoos (cheap local
      lines, excluded by the imported-only directive).

## 9. From the 4 Sep 2026 audit (`docs/AUDIT-2026-09-04.md`)
- [ ] **Supabase → Authentication → Settings:** turn on **Leaked password
      protection** (checks sign-up passwords against HaveIBeenPwned). One
      toggle; nothing else changes.
- [ ] **WhatsApp order confirmations** have never sent (the automated
      Confirm/Cancel message needs the Cloud API credentials). Four of the
      last seven cancellations were cash-on-delivery orders that came from
      ChatGPT; confirming them by message before dispatch is the cheapest fix.
- [ ] **Backlinks:** the site has one referring domain. Pick 5–10 prospects
      from Admin → Outreach and offer them the calculators / review board as a
      free resource to link to.
- [ ] **Semrush Position Tracking:** the project has no campaign. Optional;
      the twice-monthly ranking Routine already records positions.
