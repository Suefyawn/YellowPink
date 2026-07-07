// ============================================================================
// TEMPORARY TCS self-test route. Exercises the live TCS adapter end-to-end
// against the credentials configured in this deployment: auth → create a test
// consignment → fetch its label → track it → cancel it (cleanup).
//
// Safety:
//   - Gated by a one-time token (?token=…); 403 without it.
//   - The booking step is UAT-only: refuses unless TCS_BASE_URL points at
//     devconnect (so it can never create a real consignment in production).
//   - Always attempts to cancel the test consignment it created.
//
// DELETE THIS FILE once TCS is verified. It is not referenced anywhere else.
// ============================================================================
import { NextResponse } from 'next/server';
import { tcs } from '@/lib/couriers/tcs';
import { configuredAdapterIds } from '@/lib/couriers';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TOKEN = '81a15cb993efc8d40d6f64fd2a7e39ba';

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('token') !== TOKEN) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const baseUrl = process.env.TCS_BASE_URL ?? '(unset)';
  const isUat = /devconnect/i.test(baseUrl);
  const steps: Array<Record<string, unknown>> = [];

  // ── Step 0: configuration ────────────────────────────────────────────────
  const configured = tcs.isConfigured();
  steps.push({
    step: 'config',
    baseUrl,
    isUat,
    isConfigured: configured,
    adapterIds: configuredAdapterIds(),
    authMode: process.env.TCS_BEARER_TOKEN
      ? 'bearer-token'
      : (process.env.TCS_CLIENT_ID && process.env.TCS_CLIENT_SECRET)
        ? 'client-id-secret'
        : 'none',
    hasCustomerNo: Boolean(process.env.TCS_CUSTOMER_NO),
    // Non-secret shipper values, so we can eyeball what was configured.
    shipper: {
      tcsAccount: process.env.TCS_TCS_ACCOUNT ?? null,
      costCenter: process.env.TCS_COST_CENTER_CODE ?? null,
      cityCode: process.env.TCS_SHIPPER_CITY_CODE ?? null,
      cityName: process.env.TCS_SHIPPER_CITY_NAME ?? null,
      serviceCode: process.env.TCS_SERVICE_CODE ?? '(default O)',
    },
  });

  if (!configured) {
    return NextResponse.json(
      { ok: false, summary: 'TCS adapter reports NOT configured — env vars missing on this deployment.', steps },
      { status: 200 },
    );
  }

  if (!isUat) {
    return NextResponse.json(
      { ok: false, summary: 'Refusing to run the booking test against a non-UAT base URL. Set TCS_BASE_URL to devconnect first.', steps },
      { status: 200 },
    );
  }

  // ── Step 1: book a synthetic test consignment ────────────────────────────
  const stamp = Date.now().toString().slice(-6);
  const bookRes = await tcs.book({
    orderNumber: `SELFTEST-${stamp}`,
    consignee: {
      firstName: 'Selftest',
      lastName: 'Customer',
      phone: '03001234567',
      email: 'selftest@example.com',
      address1: 'House 1, Test Street, Gulshan-e-Iqbal',
      city: 'Karachi',
      countryCode: 'PK',
    },
    weightKg: 0.5,
    pieces: 1,
    codAmount: 1000,
    currency: 'PKR',
    items: [{ description: 'Self-test item', quantity: 1, weightKg: 0.5, unitPrice: 1000 }],
    remarks: 'Automated TCS integration self-test — please ignore',
  });
  const booked = 'ok' in bookRes && bookRes.ok === true;
  const cn = booked ? bookRes.trackingNumber : null;
  steps.push({ step: 'book', ok: booked, trackingNumber: cn, result: bookRes });

  // ── Step 2–4: only if we got a consignment ───────────────────────────────
  if (cn) {
    if (tcs.label) {
      const labelRes = await tcs.label(cn);
      steps.push({ step: 'label', ok: 'ok' in labelRes && labelRes.ok === true, result: labelRes });
    }
    const trackRes = await tcs.track(cn);
    steps.push({ step: 'track', ok: 'ok' in trackRes && trackRes.ok === true, result: trackRes });

    // ── Step 5: cleanup — cancel the test consignment ──────────────────────
    const cancelRes = await tcs.cancel(cn);
    steps.push({ step: 'cancel(cleanup)', ok: 'ok' in cancelRes && cancelRes.ok === true, result: cancelRes });
  }

  // ── Step 6: payment ledger (only if TCS_CUSTOMER_NO is set) ───────────────
  if (tcs.payment && process.env.TCS_CUSTOMER_NO) {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const payRes = await tcs.payment(fmt(from), fmt(to));
    steps.push({ step: 'payment(30d)', ok: 'ok' in payRes && payRes.ok === true, result: payRes });
  }

  return NextResponse.json({ ok: booked, summary: booked ? 'Booking round-trip succeeded.' : 'Booking failed — see steps.', steps }, { status: 200 });
}
