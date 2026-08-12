# Automated WhatsApp order confirmations — setup

The code is written and deployed. It stays completely dormant until the
environment variables below are set, so nothing changes for customers until
you finish these steps.

What it does once live: seconds after any order is placed, the customer gets
a WhatsApp message with their order number and total, and two buttons —
**Confirm order** and **Cancel order**. A Confirm tap marks the order
confirmed automatically (the same field staff tick by hand today) and rings
the admin bell. A Cancel tap only rings the bell; a human decides.

## What this costs

Meta bills per 24-hour "conversation", not per message. Pakistan utility
templates are roughly **PKR 4–12 per order** at current rates. One message
per order is the intended volume. Meta publishes current rates at
<https://developers.facebook.com/docs/whatsapp/pricing>.

## Step 1 — Meta Business setup (owner)

1. Go to <https://business.facebook.com> and make sure Yellow Pink has a
   Business account. Complete **Business Verification** (Settings → Business
   info). Meta asks for a business registration document and a utility bill
   or bank letter; approval typically takes 1–3 working days.
2. Go to <https://developers.facebook.com/apps> → **Create App** → type
   **Business**. Name it "Yellow Pink Orders".
3. In the app, **Add product → WhatsApp → Set up**.

## Step 2 — Phone number

You need a number that is **not** currently active in the normal WhatsApp or
WhatsApp Business phone app. Once a number joins the Cloud API it can no
longer be used in those apps.

- Best option: buy a **new SIM** for automated messages, and keep your
  existing number for the human conversations staff have today.
- In WhatsApp → API Setup, click **Add phone number**, verify by SMS/call,
  and set the display name (must match your business name).

Copy the **Phone number ID** shown on the API Setup page. It is a long
number, and it is *not* the phone number itself.

## Step 3 — Permanent access token

The token shown on the API Setup page expires in 24 hours. Get a permanent
one:

1. business.facebook.com → **Settings → Users → System Users** → Add.
   Name "yellowpink-api", role **Admin**.
2. **Add Assets** → your app → toggle **Full control**.
3. **Generate new token** → select your app → permissions
   `whatsapp_business_messaging` and `whatsapp_business_management` →
   **Never expires**.
4. Copy the token. Meta shows it exactly once.

## Step 4 — Message template

WhatsApp → **Manage templates** → Create template.

- Name: `order_confirmation`
- Category: **Utility** (do *not* pick Marketing; it costs more and can be
  blocked by user settings)
- Language: English

Body — paste exactly this, so the variables line up with the code:

```
Hi {{1}}, thanks for shopping with Yellow Pink!

We've received your order {{2}} for {{3}}.

Please confirm so we can pack and dispatch it.
```

Sample values for Meta's review: `Ayesha`, `YP-4EZ30H965`, `PKR 5,336`.

Buttons → **Quick reply**, add two, in this order:

1. `Confirm order`
2. `Cancel order`

Submit. Approval is usually under an hour, occasionally a day. If it is
rejected, the reason is almost always category (choose Utility) or a
variable at the very start/end of the body (our text avoids that).

## Step 5 — Environment variables (Vercel)

Project → Settings → Environment Variables. Add all of these, then redeploy:

| Variable | Value |
|---|---|
| `WHATSAPP_PHONE_NUMBER_ID` | from Step 2 |
| `WHATSAPP_ACCESS_TOKEN` | from Step 3 |
| `WHATSAPP_VERIFY_TOKEN` | any random string you invent, e.g. `yp-wa-8f3kd92`; you retype it in Step 6 |
| `WHATSAPP_TEMPLATE_ORDER_CONFIRM` | `order_confirmation` (only needed if you named it differently) |
| `WHATSAPP_TEMPLATE_LOCALE` | `en` (only if your template language differs) |

## Step 6 — Webhook

WhatsApp → **Configuration** → Webhook → Edit:

- Callback URL: `https://www.yellowpink.pk/api/webhooks/whatsapp`
- Verify token: the exact `WHATSAPP_VERIFY_TOKEN` string from Step 5
- Click **Verify and save** (this must go green; if it does not, the env var
  is missing or the deploy has not finished)
- Then **Manage** → subscribe to the **messages** field. This is what
  delivers the button taps.

## Step 7 — Tell me, and I will test it

Once the above is done, say so and I will place a real test order, confirm
the message arrives, tap Confirm, and verify the order flips to confirmed
with the bell notification — end to end, before any customer sees it.

## Notes and limits

- **24-hour window.** Meta only allows free-form replies within 24 hours of
  the customer's own last message. Our automatic "Thank you, confirmed"
  reply is inside that window (their tap opens it), so it is fine. Staff
  messaging a customer days later must use an approved template.
- **Nothing breaks if Meta is down.** Sending is best-effort; a failure is
  logged to `whatsapp_messages` with the error, and the order, the email and
  the thank-you page are unaffected.
- **The existing free wa.me buttons stay.** The thank-you page and admin
  buttons that open a chat manually are unchanged and cost nothing; this
  automation runs alongside them.
