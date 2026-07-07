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

## 4. What the customer sees

- Tracking number + courier + a **"Open courier page →"** deep link on both
  `/track` (guest, order# + phone) and `/account/orders` (logged-in).
- Automatic **shipped** and **delivered** emails with the tracking number.

## 5. Not included (deliberately, this phase)

- **WhatsApp/SMS** dispatch updates — both are paid channels; skipped for now.
  The thank-you page / FAQ copy that promises SMS/WhatsApp should be softened to
  "email" until a channel is funded (tracked separately).
- **Printable AWB/label capture** — the `shipments.raw_label_url` plumbing
  exists but TCS's `booking/create` response doesn't return a label URL; print
  labels from the TCS portal for now.
- **COD remittance reconciliation** — matching TCS's collected-cash file back to
  orders is a later phase.
