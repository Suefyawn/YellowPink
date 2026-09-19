// ============================================================================
// Vercel Cron entry point, fires staged abandoned-cart reminders.
//
// Schedule (every 15 min) configured in vercel.json:
//   { "crons": [{ "path": "/api/cron/abandoned-cart", "schedule": "*/15 * * * *" }] }
//
// Vercel adds the header `Authorization: Bearer <CRON_SECRET>` when calling
// scheduled routes; we verify it matches the env var so the endpoint can't be
// triggered by random web traffic.
//
// Reminder tiers:
//   tier 1, first email after 1 hour of inactivity
//   tier 2, second email after 24 hours
//   tier 3, last-chance email with discount code after 72 hours
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendAbandonedCartEmail, sendAbandonedCartStaffAlert } from '@/lib/email';
import { checkRecoveryCoupon, type RecoveryCoupon } from '@/lib/recovery-coupon';
import type { CartItem } from '@/types';
import { cronAuthorized } from '@/lib/cron-auth';

interface AbandonedCart {
  id: string;
  email: string;
  cart_items: CartItem[];
  subtotal: number;
  restore_token: string;
  reminder_tier: number;
  last_emailed_at: string | null;
  last_activity_at: string;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yellowpink.pk';
// The tier-3 code, like the WhatsApp queue's, is looked up in the coupons
// table before it is promised. Until 15 Sep this defaulted to 'COMEBACK10', a
// coupon that has never existed, so the last-chance email closed by sending a
// hesitating shopper back to checkout with a code that would be rejected
// there. COMEBACK15 is the coupon actually created for this, on 14 July 2026.
// The percentage is read off the coupon row rather than configured separately,
// so the two can no longer drift apart.
const TIER_3_DISCOUNT_CODE = process.env.ABANDONED_CART_DISCOUNT_CODE ?? 'COMEBACK15';

const ONE_HOUR_MS = 60 * 60 * 1000;
const ONE_DAY_MS  = 24 * ONE_HOUR_MS;

function nextTier(now: number, c: AbandonedCart): 1 | 2 | 3 | null {
  const sinceActivity = now - new Date(c.last_activity_at).getTime();
  const sinceLastEmail = c.last_emailed_at ? now - new Date(c.last_emailed_at).getTime() : Infinity;
  if (c.reminder_tier === 0 && sinceActivity > ONE_HOUR_MS) return 1;
  if (c.reminder_tier === 1 && sinceLastEmail > ONE_DAY_MS - ONE_HOUR_MS) return 2;
  if (c.reminder_tier === 2 && sinceLastEmail > 2 * ONE_DAY_MS) return 3;
  return null;
}

export async function GET(req: NextRequest) {
  if (!(cronAuthorized(req))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const cutoff = new Date(Date.now() - ONE_HOUR_MS).toISOString();
  const { data, error } = await sb
    .from('abandoned_carts')
    .select('id, email, cart_items, subtotal, restore_token, reminder_tier, last_emailed_at, last_activity_at')
    .eq('recovered', false)
    // Phone-only captures (shopper never typed an email) can't get reminder
    // emails; they surface in admin → Customers → Abandoned for a WhatsApp
    // nudge instead.
    .not('email', 'is', null)
    .lt('reminder_tier', 3)
    .lt('last_activity_at', cutoff)
    .limit(500);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const now = Date.now();
  const candidates = ((data ?? []) as AbandonedCart[])
    .map(c => ({ c, tier: nextTier(now, c) }))
    .filter((x): x is { c: AbandonedCart; tier: 1 | 2 | 3 } => x.tier !== null);

  let sent = 0;
  const errors: string[] = [];

  const tier3Coupon = (c: AbandonedCart) =>
    checkRecoveryCoupon(couponRow as RecoveryCoupon | null, Number(c.subtotal) || 0);

  // One lookup per run, reused for every tier-3 candidate below.
  const { data: couponRow } = await sb
    .from('coupons')
    .select('code, active, value, min_order, expires_at, starts_at, max_uses, used_count')
    .ilike('code', TIER_3_DISCOUNT_CODE)
    .maybeSingle();

  // Tier-1 fires immediately; tier-2/3 cluster on the same cart row so process
  // one cart at a time to avoid racing the update.
  for (const { c, tier } of candidates) {
    const restoreUrl = `${SITE_URL}/cart?restore=${c.restore_token}`;
    try {
      await sendAbandonedCartEmail({
        email:        c.email,
        items:        c.cart_items.map(i => ({ name: i.name, brand: i.brand ?? undefined, variant: i.variant_label ?? i.variant ?? undefined, qty: i.qty, price: i.price })),
        total:        c.subtotal,
        restore_url:  restoreUrl,
        tier,
        // Checked against this cart's subtotal, so a coupon with a minimum
        // order value is never promised to a cart that cannot use it. An
        // unusable coupon sends the email with no discount rather than a
        // broken one.
        discount_code: tier === 3 ? (tier3Coupon(c).code ?? undefined) : undefined,
        discount_pct:  tier === 3 ? (tier3Coupon(c).percent ?? undefined) : undefined,
      });
      const { error: upErr } = await sb
        .from('abandoned_carts')
        .update({ reminder_tier: tier, last_emailed_at: new Date().toISOString() })
        .eq('id', c.id);
      if (upErr) errors.push(`update cart ${c.id}: ${upErr.message}`);
      sent++;
    } catch (err) {
      errors.push(`cart ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Staff alert pass (event 'cart.abandoned') ─────────────────────────────
  // One internal email per abandoned cart, on the first cron run after the
  // shopper goes quiet, to everyone subscribed in Settings → Notifications
  // (Tanya + owner). That used to say "~1 hour", which is what the cutoff
  // below asks for but not what shoppers get: every job here runs inside the
  // single daily /api/cron/daily entry (Vercel's free plan caps cron entries),
  // so the alert lands whenever 09:00 UTC next comes round. Measured on the
  // four carts lost in the 30 days to 15 Sep: 3.0, 4.0, 15.8 and 16.6 hours.
  // Splitting this back onto its own schedule is the self-hosting upgrade path
  // already noted at the top of the daily route.
  // Unlike the customer reminders above this INCLUDES phone-only captures —
  // those shoppers can never receive a reminder email, so the personal
  // WhatsApp nudge this alert enables is the only recovery path. Deduped via
  // admin_alerted_at (migration 800); alert failures never fail the cron.
  let staffAlerts = 0;
  {
    const { data: alertRows } = await sb
      .from('abandoned_carts')
      .select('id, first_name, email, phone, cart_items, subtotal, last_activity_at')
      .eq('recovered', false)
      .is('admin_alerted_at', null)
      .lt('last_activity_at', cutoff)
      .limit(100);
    for (const c of (alertRows ?? []) as Array<{ id: string; first_name: string | null; email: string | null; phone: string | null; cart_items: CartItem[]; subtotal: number }>) {
      try {
        await sendAbandonedCartStaffAlert({
          first_name: c.first_name,
          email: c.email,
          phone: c.phone,
          subtotal: Number(c.subtotal) || 0,
          items: (Array.isArray(c.cart_items) ? c.cart_items : []).map(i => ({
            name: i.name, brand: i.brand ?? undefined, variant: i.variant_label ?? i.variant ?? undefined, qty: i.qty, price: i.price,
          })),
        });
        const { error: alertUpErr } = await sb
          .from('abandoned_carts')
          .update({ admin_alerted_at: new Date().toISOString() })
          .eq('id', c.id);
        if (alertUpErr) errors.push(`alert stamp ${c.id}: ${alertUpErr.message}`);
        staffAlerts++;
      } catch (err) {
        errors.push(`staff alert ${c.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // Owner notification: the owner asked to be told when the automated
  // cart-reminder emails go out. One rolling notification per day (deduped on
  // entity_id) whose body reflects the day's running total, so the 15-min cron
  // can't spam the bell feed. Best-effort: a notification failure must never
  // fail the cron or re-send emails.
  if (sent > 0) {
    try {
      const dayKey = new Date().toISOString().slice(0, 10);
      const dedupKey = `abandoned_cart:${dayKey}`;
      const { count: dayTotal } = await sb
        .from('email_log')
        .select('id', { count: 'exact', head: true })
        .eq('category', 'Abandoned cart')
        .eq('status', 'sent')
        .gte('created_at', `${dayKey}T00:00:00.000Z`);
      const total = dayTotal ?? sent;
      const body = `${total} cart-reminder email${total === 1 ? '' : 's'} sent to customers today. These recover carts left behind after an hour, a day, and three days.`;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const notifs = sb.from('admin_notifications') as any;
      const { data: existing } = await notifs.select('id').eq('entity_id', dedupKey).limit(1);
      if (existing && existing.length > 0) {
        await notifs.update({ title: 'Cart reminder emails sent', body }).eq('entity_id', dedupKey);
      } else {
        await notifs.insert({
          kind: 'abandoned_cart',
          title: 'Cart reminder emails sent',
          body,
          link: '/admin/emails?q=cart',
          entity_id: dedupKey,
        });
      }
    } catch {
      /* notification is best-effort */
    }
  }

  return NextResponse.json({ ok: true, scanned: data?.length ?? 0, sent, staffAlerts, errors });
}
