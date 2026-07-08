# Daraz integration — onboarding checklist

Goal: list the Yellow Pink catalogue on **Daraz Pakistan** and (phase 2) pull
Daraz orders into this admin, via the **Daraz Open Platform API**.

This is the runway. Nothing in the codebase talks to Daraz yet — the API build
starts once the credentials in **Phase 3** exist (they can't be created from the
app side; they come from your seller + developer accounts).

> Exact button labels / URLs on Daraz change from time to time; the flow below
> is the stable shape. Where a step says "typically", confirm in the live UI.

---

## Phase 0 — Seller account (Daraz Seller Center)
- [ ] Create a seller account at **sellercenter.daraz.pk**.
- [ ] Business details: shop name (**Yellow Pink**), owner **CNIC**, **NTN** if registered.
- [ ] **Bank account** (title + IBAN) for COD/settlement payouts.
- [ ] **Pickup address** + **return address**.
- [ ] Contact phone + email.
- [ ] Complete **KYC / verification** and wait for account approval.
- [ ] Set the **shop profile** — logo, banner, description.
- [ ] Check category eligibility: **beauty & personal care** is open; **health
      supplements** may need extra documentation/approval — sort this early since
      NB Sons is a big part of the catalogue.

## Phase 1 — Open Platform app (needed for the API)
- [ ] Register a developer account at **open.daraz.com.pk**.
- [ ] Create an **app** → this yields an **App Key** and **App Secret**.
- [ ] Set the app's **callback / redirect URL** (I'll give you the exact URL when
      we build; a placeholder like `https://www.yellowpink.pk/api/daraz/callback`
      is fine to start).
- [ ] Request the API scopes we need: **Product**, **Order**, **Logistics**,
      **Seller/Shop**. (Some scopes need Daraz approval — request early.)

## Phase 2 — Authorize your shop to the app
- [ ] Complete the one-time **OAuth consent** that links your Seller Center shop
      to the app.
- [ ] Capture the resulting **access token** + **refresh token** (+ their expiry).
      The refresh token is long-lived; the code auto-refreshes the access token.

## Phase 3 — Hand these to me (I store them as Vercel env vars, never in code)
- [ ] `DARAZ_APP_KEY`
- [ ] `DARAZ_APP_SECRET`
- [ ] `DARAZ_ACCESS_TOKEN`
- [ ] `DARAZ_REFRESH_TOKEN`
- [ ] Region = **PK** (fixed; noted here for completeness).

## Phase 4 — What I build once the creds exist (product push first)
1. **API client** — request signing (HMAC-SHA256), token store + auto-refresh,
   error handling. No-op/clear error when unconfigured.
2. **Category + attribute mapping** — map our categories → Daraz's category tree
   and fill each category's **required attributes** (Daraz is strict here; this is
   the most hands-on step and we'll do it together, per category).
3. **Product push** — create/update Daraz listings from our catalogue: name,
   brand, price, stock, images, description, package weight, SKU.
4. **Stock + price sync** — a cron keeps Daraz in step with our DB so we don't
   oversell across channels.
5. **Order import** — pull Daraz orders into this admin so fulfilment + finance
   stay unified, respecting the vendor self-delivery model (an NB Sons Daraz order
   routes to NB Sons, no TCS booking).

---

## Data readiness (storefront side — already done)
- [x] **Package weight** on every product (≤ 500 g) — Daraz requires it per listing.
- [x] **Brand** on every product (no blanks) — needed for the product identifier.
- [x] **Descriptions** present on all published products.
- [x] **Images** present on all published products.
- [ ] **Category → Daraz category** mapping — needs a pass together (Phase 4.2).
- [ ] **Per-category required attributes** (Daraz-specific, e.g. formulation,
      skin type, net weight) — filled during Phase 4.2.

## Notes
- Start Phase 0 now; Phases 1–2 can run in parallel once the seller account is
  approved. The API build (Phase 4) is blocked only on Phase 3 credentials.
- Supplements: keep any import/compliance docs handy — Daraz sometimes asks for
  them before approving health-category listings.
