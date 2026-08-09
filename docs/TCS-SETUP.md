# TCS courier integration — setup & operation

The store has a complete TCS (Pakistan) integration built in — API booking,
consignment creation, live status tracking, and cancel — plus a manual fallback
for any courier. **Verified live end-to-end against production (book → track →
cancel) on 7 July 2026.** If the credentials below are absent the booking form
falls back to manual tracking-number entry and everything else keeps working.

## 0. How TCS auth actually works (important)

TCS's COD API uses **two credentials together** on the transactional endpoints:

1. A **gateway JWT** — sent as the `Authorization: Bearer …` header on every
   call. This is the pre-issued "Bearer Token" (or minted from a client
   id+secret). On its own it only unlocks read-only setup APIs.
2. An **ecom access token** — the adapter mints this from a **username +
   password** at `/ecom/api/authentication/token`, then sends it in the request
   body (`accesstoken`). Booking / cancel / label / payment reject the call with
   *"Invalid access token"* without it.

So you need **both** the Bearer token **and** the username/password. (Tracking
needs only the Bearer token.)

> **Environment gotcha:** a production token/login is rejected on the UAT
> sandbox (`devconnect`) as *"Invalid Bearer token. Mismatch configuration."*
> and vice-versa. Point `TCS_BASE_URL` at the environment your credentials were
> issued for. TCS may issue production credentials directly (no UAT phase).

## 1. Get TCS API credentials

Ask your TCS account manager for **TCS Envio / COD API access**. You need:

- A **Bearer token** (the "Bearer Token for API Access" email; a long-lived
  JWT) — or a **client id + secret** pair the adapter can exchange, and
- A **username + password** for the ecom API (`/ecom/api/authentication/token`).

Plus your **TCS account** (alphanumeric, e.g. `LGEC21048`), your **cost-centre
code**, and your **pickup city code**. Tips for the last two:

- **City code** is TCS's own 3-letter code, **not** the airport IATA code —
  Lahore is `LHE` (not `LHR`), Karachi is `KHI`, Islamabad `ISB`. Wrong code →
  booking fails with *"Invalid Origin City."*
- **Cost-centre code** must be one registered to your account (e.g. `001`).
  Wrong code → *"No Cost Center found."* TCS's Cost Center Inquiry API lists
  yours.

## 2. Set the environment variables (Vercel → Project → Settings → Environment Variables)

Required (all deployments):

| Var | Example | Notes |
|-----|---------|-------|
| `TCS_BASE_URL` | `https://ociconnect.tcscourier.com` | prod; UAT is `https://devconnect.tcscourier.com` — must match where your creds were issued |
| `TCS_TCS_ACCOUNT` | `LGEC21048` | your TCS account (alphanumeric) |
| `TCS_COST_CENTER_CODE` | `001` | a cost-centre registered to your account |
| `TCS_SHIPPER_NAME` | `Yellow Pink` | printed on the label |
| `TCS_SHIPPER_ADDRESS` | `House 842, Allama Iqbal Town` | pickup address |
| `TCS_SHIPPER_CITY_CODE` | `LHE` | TCS city code (not airport IATA) |
| `TCS_SHIPPER_CITY_NAME` | `Lahore` | printed on the label |
| `TCS_SHIPPER_MOBILE` | `03001234567` | pickup contact (11 digits, 03…) |
| `TCS_SERVICE_CODE` | `O` | optional; defaults to `O` (Overnight) |

Auth — set the header-token credential (**one** of):

- `TCS_BEARER_TOKEN` (the pre-issued JWT), **or**
- `TCS_CLIENT_ID` + `TCS_CLIENT_SECRET`.

…**and** the ecom login (**both required** for booking):

| Var | Notes |
|-----|-------|
| `TCS_USERNAME` | TCS Envio API username |
| `TCS_PASSWORD` | TCS Envio API password |

**Required for the Finance cost sync** (booking works without it, but the
"Sync actual delivery costs" button and the nightly cost reconcile can never
run until it is set — the Finance page shows a "not configured" hint):

| Var | Notes |
|-----|-------|
| `TCS_CUSTOMER_NO` | your TCS customer number — enables pulling the real per-consignment delivery charge + COD ledger from TCS's Payment Detail API (Finance → "Sync actual delivery costs from TCS"). |

If any required var is missing the adapter reports "not configured" and the UI
stays on manual entry — it never errors out.

## 3. Live status updates

Two mechanisms keep an order's status current once shipped:

1. **Daily sync cron** — `/api/cron/daily` (09:00 UTC, via `vercel.json`) fans
   out to `/api/cron/courier-sync`, which polls TCS for every non-terminal
   shipment and appends scan events. *Note:* it runs **once daily** because the
   Vercel cron schedule has a single daily entry (Hobby-plan cadence). Moving to
   hourly needs a Pro plan + an hourly cron entry.
2. **On-demand "Sync tracking now"** — a button on each shipped order in
   Admin → Orders → (order) → Shipment. Pulls the latest TCS scans immediately;
   use it to confirm a delivery or chase a stuck parcel without waiting for the
   cron.
3. **Webhook (optional)** — `POST /api/couriers/webhook` accepts push events if
   TCS (or a middleware) can call it. Set `COURIER_WEBHOOK_SECRET` and have the
   caller send `Authorization: Bearer <secret>`. Fails closed if unset.

When any of these advances a shipment to **delivered** (or first marks it
shipped), the customer is emailed automatically — the shipped/delivered email
now fires on the transition regardless of whether a human or the sync triggered
it. (This was previously only sent from manual admin actions.)

## 4. Printable label / AWB

After booking, the adapter also calls TCS's CN-print endpoint
(`/ecom/api/print/label`). When TCS returns a label **URL**, it's stored on the
shipment and the order's Shipment panel shows a **"Print label (PDF)"** link.

Note: on the production account tested, the print endpoint **streams the PDF
bytes directly** (no URL), so the in-admin link may not appear — label fetch is
best-effort and a miss never blocks the booking. Until the streaming-PDF proxy
route lands (a small fast-follow), print the AWB from the **TCS Envio portal**
using the consignment number shown on the order. The consignment is fully
created either way.

## 5. Actual delivery cost + COD reconciliation

With `TCS_CUSTOMER_NO` set, **Finance → Shipping recovery → "Sync actual
delivery costs from TCS"** pulls TCS's Payment Detail ledger (last 30 days) and
writes the **real courier charge (+ GST)** onto each matching order's
`delivery_cost`. That turns the shipping-margin figures from an estimate into
actuals. (The COD payment status is read too; full COD cash-remittance
reconciliation into payment records is the next step — currently the sync
updates the cost side.)

## 6. What the customer sees

- Tracking number + courier + a **"Open courier page →"** deep link on both
  `/track` (guest, order# + phone) and `/account/orders` (logged-in).
- Automatic **shipped** and **delivered** emails with the tracking number.
- Live scan history (Arrived at facility → Out for delivery → Delivered) now
  reads TCS's full `checkpoints` timeline, not just the delivery record.

## 7. Not included (deliberately, this phase)

- **WhatsApp/SMS** dispatch updates — both are paid channels; skipped for now.
  The thank-you page / FAQ copy that promises SMS/WhatsApp should be softened to
  "email" until a channel is funded (tracked separately).
- **Auto-scheduled payment reconciliation** — the "Sync actual delivery costs"
  run is manual (a button) today; wiring it into the daily cron and marking COD
  cash received on `orders` is the next increment.
- **City-code resolution** (`/ecom/api/setup/citylistbycountry`) and **reverse
  pickups** (`/ecom/api/booking/reverse`, for returns/RTO) are available in the
  API and can be added next.
