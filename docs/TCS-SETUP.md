# TCS courier integration — setup & operation

The store has a complete TCS (Pakistan) integration built in — API booking,
label-less consignment creation, live status tracking, and cancel — plus a
manual fallback for any courier. **The code is done; TCS goes live the moment
the credentials below are set in Vercel.** Until then, the booking form falls
back to manual tracking-number entry and everything else keeps working.

## 1. Get TCS API credentials

Ask your TCS account manager for **TCS Envio / COD API access**. They issue
either:

- **A pre-issued Bearer token** (recommended — the "Bearer Token for API Access"
  email; a long-lived JWT), or
- **A client id + secret** pair (legacy OAuth; the adapter exchanges it for a
  short-lived token automatically).

You'll also need your **TCS account number**, **cost-centre code**, and your
**pickup address + city code** (TCS's `/setup/areacode` lists city codes; e.g.
`KHI` for Karachi, `LHR` for Lahore).

## 2. Set the environment variables (Vercel → Project → Settings → Environment Variables)

Required (all deployments):

| Var | Example | Notes |
|-----|---------|-------|
| `TCS_BASE_URL` | `https://ociconnect.tcscourier.com` | prod; UAT is `https://devconnect.tcscourier.com` |
| `TCS_TCS_ACCOUNT` | `1234567` | your TCS account number |
| `TCS_COST_CENTER_CODE` | `KHI-001` | assigned by TCS |
| `TCS_SHIPPER_NAME` | `Yellow Pink` | printed on the label |
| `TCS_SHIPPER_ADDRESS` | `Shop 1, …` | pickup address |
| `TCS_SHIPPER_CITY_CODE` | `KHI` | TCS city code |
| `TCS_SHIPPER_CITY_NAME` | `Karachi` | printed on the label |
| `TCS_SHIPPER_MOBILE` | `03001234567` | pickup contact |
| `TCS_SERVICE_CODE` | `O` | optional; defaults to `O` (Overnight) |

Auth — set **one** of:

- `TCS_BEARER_TOKEN` (the pre-issued JWT), **or**
- `TCS_CLIENT_ID` + `TCS_CLIENT_SECRET`.

Optional (unlocks payment/COD reconciliation):

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

Booking now also fetches the consignment **label PDF** from TCS's CN-print
endpoint (`/ecom/api/print/label`) and stores it on the shipment. The order's
Shipment panel shows a **"Print label (PDF)"** link — stick that on the parcel.

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
