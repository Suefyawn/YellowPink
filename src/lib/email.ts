// ============================================================================
// Transactional email via Resend. Phase 1.4.
//
// Every send is best-effort and never throws, email failure must not break
// an order placement or any other commit. Add new templates by exporting a
// `send<Thing>Email` function; keep the HTML inline (no JSX runtime cost on
// server actions).
//
// Required env:
//   RESEND_API_KEY  , server-only
//   OWNER_EMAIL     , where internal notifications go (new orders, low stock)
//   EMAIL_FROM      , verified Resend "from" address (default: orders@yellowpink.pk)
// ============================================================================

import { Resend } from 'resend';
import * as Sentry from '@sentry/nextjs';
import { log } from './logger';
import { stripEmoji } from './text';
import { supabaseAdmin } from './supabase';
import { SITE_URL } from './seo';
import { getRecipientsForEvent } from './notification-recipients';
import { getWelcomeOffer } from './offers';
import { courierTrackingUrl } from '@/lib/couriers/profiles';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// OWNER_EMAIL stays as the fallback recipient and as a reply-to address on
// outgoing customer mail. Active fan-out for new-order alerts now goes
// through notification_recipients; this env var only kicks in when
// nobody is configured (or the lookup fails).
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'sooviaan@gmail.com';
const FROM = process.env.EMAIL_FROM ?? 'Yellow Pink Orders <orders@yellowpink.pk>';
// SITE_URL is shared with the SEO helpers (lib/seo) so the logo image and
// every link in an email resolve to the same live origin. A broken logo in
// the inbox was the old local fallback pointing at the legacy WP domain.
// Resend free tier is 100 emails/day. Batch/marketing mail stops claiming
// slots at this cap so transactional order emails keep their headroom.
export const RESEND_DAILY_BATCH_CAP = 90;
// Hard ceiling on a single Resend API call, keeps a stalled request from
// hanging the caller (e.g. the newsletter send loop) forever.
const SEND_TIMEOUT_MS = 12000;
// Hard ceiling on the best-effort Supabase calls in the send path (the
// quota-claim RPC and the email_log insert). Without it, a stalled DB call
// could hang an email send, and a newsletter blast, indefinitely, which
// is exactly the admin-UI freeze the post-launch QA flagged.
const DB_TIMEOUT_MS = 8000;
const BRAND_PINK = '#E8487F';
const BRAND_YELLOW = '#F7C948';
const PAPER = '#FAF6EE';
const INK = '#111827';
const INK_700 = '#374151';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

// Logo URL, Resend lets us link to any public image. Using the same flower
// mark that the live site uses as its favicon so the email feels on-brand
// from the inbox preview onward.
const LOGO_URL = `${SITE_URL}/icon-192.png`;

// ─── Primitives ─────────────────────────────────────────────────────────────
// Race a promise against a timeout so a stalled call can't block the caller
// forever. Used for the best-effort Supabase calls in the send path.
function withTimeout<T>(promise: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out`)), ms),
    ),
  ]);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

function money(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

// Build the unsubscribe link for a given recipient. Marketing emails (the
// newsletter sender) MUST pass the recipient's email; transactional emails
// (order confirmation, etc.) should NOT, they're not opt-in.
function unsubscribeFooter(recipient?: string): string {
  if (!recipient) return '';
  // Import lazily inside the function to avoid a top-level dep that would
  // force email.ts into the edge bundle.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { unsubscribeUrl } = require('./unsubscribe-token') as typeof import('./unsubscribe-token');
  const url = unsubscribeUrl(SITE_URL, recipient);
  return `
    <br/>
    <a href="${url}" style="color:${MUTED}">Unsubscribe</a>
    ·
    <a href="${SITE_URL}/privacy" style="color:${MUTED}">Privacy</a>`;
}

interface ShellOpts {
  /** Marketing-mail recipient, adds the unsubscribe link to the footer.
   *  Leave undefined for transactional mail (order confirmations etc.). */
  marketingRecipient?: string;
}

function shell(inner: string, opts: ShellOpts = {}): string {
  return `
<div style="background:${PAPER};padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:560px;margin:0 auto;color:${INK};background:#fff;border-radius:8px;overflow:hidden;border:1px solid ${LINE}">
    <!-- Branded header: cream band with the live-site flower mark + wordmark.
         The yellow stripe along the top is a subtle nod to the brand palette
         that survives even when an email client strips background images. -->
    <div style="height:4px;background:${BRAND_YELLOW}"></div>
    <div style="padding:20px 28px;background:${PAPER};display:flex;align-items:center;gap:12px;border-bottom:1px solid ${LINE}">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td style="vertical-align:middle;padding-right:12px">
          <img src="${LOGO_URL}" width="36" height="36" alt="" style="display:block;border:0" />
        </td>
        <td style="vertical-align:middle">
          <span style="font-family:Georgia,serif;font-size:22px;font-weight:500;color:${INK};letter-spacing:-0.3px">Yellow Pink</span>
        </td>
      </tr></table>
    </div>
    <div style="padding:28px;line-height:1.55;font-size:15px;color:${INK_700}">${inner}</div>
    <div style="padding:18px 28px 22px;border-top:1px solid ${LINE};color:${MUTED};font-size:12px;line-height:1.6">
      <strong style="color:${INK}">Yellow Pink</strong> · Delivering nationwide across Pakistan<br/>
      <a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline">${SITE_URL.replace(/^https?:\/\//, '')}</a> ·
      <a href="${SITE_URL}/track" style="color:${MUTED};text-decoration:underline">Track an order</a> ·
      <a href="${SITE_URL}/page/contact" style="color:${MUTED};text-decoration:underline">Contact us</a>${unsubscribeFooter(opts.marketingRecipient)}
    </div>
  </div>
</div>`.trim();
}

// The Resend SDK's `emails.send` returns `{ data, error }` and only throws on
// transport/network failures. Validation errors, including the "domain not
// verified" / "invalid from address" failure modes, arrive on `result.error`
// and were silently swallowed by the old try/catch. We now surface every
// failure to Sentry with stable tags so the alert rule for
// `tags[resend_domain_unverified]:true` can fire before customers report
// missing order emails.
export function fromDomain(from: string): string {
  const angled = from.match(/<[^@]+@([^>]+)>/);
  if (angled) return angled[1];
  const bare = from.match(/@([^\s]+)/);
  return bare ? bare[1] : 'unknown';
}

// Append a row to email_log for every send attempt. Best-effort, a logging
// failure must never break (or slow to the point of failing) an email send.
// `resend_id` ties the row to later Resend webhook events (delivered/opened).
async function recordEmailLog(
  opts: { to: string | string[]; subject: string; kind?: 'transactional' | 'batch'; category?: string },
  status: 'sent' | 'failed' | 'skipped',
  extra: { resendId?: string | null; error?: string } = {},
): Promise<void> {
  try {
    await withTimeout(
      supabaseAdmin().from('email_log').insert({
        recipient: Array.isArray(opts.to) ? opts.to.join(', ') : opts.to,
        subject: opts.subject,
        kind: opts.kind ?? 'transactional',
        category: opts.category ?? null,
        status,
        resend_id: extra.resendId ?? null,
        error: extra.error ? extra.error.slice(0, 500) : null,
      }),
      DB_TIMEOUT_MS,
      'email_log insert',
    );
  } catch {
    /* logging is best-effort */
  }
}

async function send(opts: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  /** Override the default verified `from` (e.g. send support replies from the
   *  store's hello@ address rather than orders@). Domain must be verified. */
  from?: string;
  /** 'batch' mail (cron digests, marketing) yields once the daily Resend
   *  free-tier budget is nearly spent. Defaults to 'transactional', which
   *  always sends, order confirmations must never be dropped. */
  kind?: 'transactional' | 'batch';
  /** Human-readable email type for the admin email log ("Order confirmation",
   *  "Shipped", "Abandoned cart", …). `kind` is the throttling class; this is
   *  what the merchant actually reads in the Type column. */
  category?: string;
}): Promise<boolean> {
  if (!resend) {
    log.warn('email.skip', { reason: 'RESEND_API_KEY not set', to: opts.to, subject: opts.subject });
    await recordEmailLog(opts, 'skipped', { error: 'RESEND_API_KEY not set' });
    return false;
  }
  // Free-tier guard: claim a slot in today's send budget. Fails open, a
  // quota-check error must never block an email from going out.
  try {
    const { data: allowed } = await withTimeout(
      supabaseAdmin().rpc('claim_email_send' as never, {
        p_kind: opts.kind ?? 'transactional',
        p_cap: RESEND_DAILY_BATCH_CAP,
      } as never),
      DB_TIMEOUT_MS,
      'claim_email_send',
    );
    if (allowed === false) {
      log.warn('email.skipped_quota', { to: opts.to, subject: opts.subject });
      await recordEmailLog(opts, 'skipped', { error: 'Daily send cap reached' });
      return false;
    }
  } catch {
    /* fail open */
  }
  try {
    // Cap the Resend call so a hung network request can't stall the caller
    // indefinitely (a newsletter blast would otherwise freeze the admin UI).
    const sendCall = resend.emails.send({
      from: opts.from ?? FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    // If the timeout wins the race, the original call still settles later,     // swallow a late rejection so it isn't flagged as unhandled.
    sendCall.catch(() => {});
    const result = await Promise.race([
      sendCall,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Resend send timed out')), SEND_TIMEOUT_MS),
      ),
    ]);
    if (result.error) {
      const errName = result.error.name;
      const errMsg = result.error.message ?? '';
      // The Resend API uses several distinct error names for the
      // "from-domain isn't verified" condition; collapse them into a single
      // tag so the alert filter stays simple.
      const domainUnverified =
        errName === 'invalid_from_address' ||
        /not\s+verified|unverified|domain/i.test(errMsg);
      log.error('email.send_failed', {
        to: opts.to, subject: opts.subject, errName, errMsg,
        statusCode: result.error.statusCode,
      });
      Sentry.captureMessage(`Resend ${errName}: ${errMsg}`, {
        level: 'error',
        tags: {
          email_send_failed: 'true',
          resend_error_name: errName,
          resend_domain_unverified: domainUnverified ? 'true' : 'false',
          from_domain: fromDomain(FROM),
        },
        extra: { to: opts.to, subject: opts.subject, statusCode: result.error.statusCode },
      });
      await recordEmailLog(opts, 'failed', { error: `${errName}: ${errMsg}` });
      return false;
    }
    log.info('email.sent', { to: opts.to, subject: opts.subject, id: result.data?.id });
    await recordEmailLog(opts, 'sent', { resendId: result.data?.id });
    return true;
  } catch (err) {
    log.error('email.send_failed', { to: opts.to, subject: opts.subject, err });
    Sentry.captureException(err, {
      tags: { email_send_failed: 'true', resend_error_name: 'transport_error', from_domain: fromDomain(FROM) },
      extra: { to: opts.to, subject: opts.subject },
    });
    await recordEmailLog(opts, 'failed', { error: (err as Error).message });
    return false;
  }
}

// ─── Templates ──────────────────────────────────────────────────────────────
interface OrderItemLine { name: string; qty: number; price: number; brand?: string; variant?: string }
interface OrderSummary {
  order_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  province?: string;
  total: number;
  items: OrderItemLine[];
  pay_method: string;
}

function renderItemsTable(items: OrderItemLine[]): string {
  return `
<table style="width:100%;border-collapse:collapse;margin:16px 0">
  <thead><tr style="background:#f9fafb;text-align:left">
    <th style="padding:8px;font-size:13px;color:${MUTED}">Item</th>
    <th style="padding:8px;font-size:13px;color:${MUTED};text-align:right">Qty</th>
    <th style="padding:8px;font-size:13px;color:${MUTED};text-align:right">Price</th>
  </tr></thead>
  <tbody>
    ${items.map(i => `
      <tr style="border-top:1px solid #f3f4f6">
        <td style="padding:8px;font-size:14px">${escapeHtml((i.brand ? i.brand + ' ' : '') + i.name)}${i.variant ? ` <span style="color:${MUTED}">· ${escapeHtml(i.variant)}</span>` : ''}</td>
        <td style="padding:8px;font-size:14px;text-align:right">${i.qty}</td>
        <td style="padding:8px;font-size:14px;text-align:right">${money(i.price * i.qty)}</td>
      </tr>`).join('')}
  </tbody>
</table>`;
}

// ─── 1. Internal: new order (for the merchant) ──────────────────────────────
export async function sendNewOrderEmail(order: OrderSummary): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">New order, ${escapeHtml(order.order_number)}</h2>
    <p style="margin:0 0 4px"><strong>Customer:</strong> ${escapeHtml(stripEmoji(order.first_name))} ${escapeHtml(stripEmoji(order.last_name))}</p>
    <p style="margin:0 0 4px"><strong>Phone:</strong> ${escapeHtml(order.phone)}</p>
    <p style="margin:0 0 4px"><strong>City:</strong> ${escapeHtml(order.city)}${order.province ? `, ${escapeHtml(order.province)}` : ''}</p>
    <p style="margin:0 0 12px"><strong>Payment:</strong> ${escapeHtml(order.pay_method.toUpperCase())}</p>
    ${renderItemsTable(order.items)}
    <p style="margin:16px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(order.total)}</strong></p>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/orders" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ Open in admin</a></p>
  `);
  const recipients = await getRecipientsForEvent('order.new');
  await send({
    to: recipients,
    subject: `New order ${order.order_number}, ${money(order.total)}`,
    html,
    category: 'Order alert',
  });
}

// ─── 1a1. Internal: abandoned checkout alert (for staff) ───────────────────
// Fired by the abandoned-cart cron ~1 hour after a shopper with contact
// details goes quiet — including phone-only captures the customer reminder
// emails can never reach. Carries a one-tap WhatsApp link so Tanya (or
// whoever subscribes to the event) can follow up personally while the
// intent is still warm.
export async function sendAbandonedCartStaffAlert(cart: {
  first_name?: string | null;
  email?: string | null;
  phone?: string | null;
  subtotal: number;
  items: Array<{ name: string; brand?: string; variant?: string; qty: number; price: number }>;
}): Promise<void> {
  const phoneDigits = (cart.phone ?? '').replace(/\D+/g, '');
  const waNumber = phoneDigits.startsWith('0') ? `92${phoneDigits.slice(1)}` : phoneDigits;
  const waText = encodeURIComponent(
    `Assalam o alaikum${cart.first_name ? ` ${cart.first_name}` : ''}! Yellow Pink se, aap ka cart abhi bhi mehfooz hai. Koi sawal ho to bata dein, order complete karne mein madad kar dein?`,
  );
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Abandoned checkout, ${money(cart.subtotal)}</h2>
    <p style="margin:0 0 4px"><strong>Shopper:</strong> ${escapeHtml(cart.first_name?.trim() || 'No name given')}</p>
    ${cart.phone ? `<p style="margin:0 0 4px"><strong>Phone:</strong> ${escapeHtml(cart.phone)}</p>` : ''}
    ${cart.email ? `<p style="margin:0 0 12px"><strong>Email:</strong> ${escapeHtml(cart.email)}</p>` : ''}
    ${renderItemsTable(cart.items)}
    <p style="margin:16px 0 0;text-align:right;font-size:16px"><strong>Cart value: ${money(cart.subtotal)}</strong></p>
    ${cart.email ? `<p style="margin:12px 0 0;color:${MUTED};font-size:13px">Automatic reminder emails are also going to the shopper.</p>` : `<p style="margin:12px 0 0;color:${MUTED};font-size:13px">Phone-only capture: no automatic reminder reaches this shopper, a personal WhatsApp is the only follow-up.</p>`}
    ${waNumber.length >= 11 ? `<p style="margin:20px 0 0"><a href="https://wa.me/${waNumber}?text=${waText}" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ WhatsApp the shopper</a></p>` : ''}
    <p style="margin:8px 0 0"><a href="${SITE_URL}/admin/abandoned" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ Open Abandoned checkouts in admin</a></p>
  `);
  const recipients = await getRecipientsForEvent('cart.abandoned');
  await send({
    to: recipients,
    subject: `Abandoned checkout, ${money(cart.subtotal)}${cart.first_name ? `, ${cart.first_name.trim()}` : ''}`,
    html,
    category: 'Abandoned cart alert',
  });
}

// ─── 1a2. Internal: weekly store health report (for the merchant) ───────────
// One Monday-morning digest of the week that was: orders vs last week, the
// shopper funnel, which storefront sections earn their clicks, abandoned
// checkouts, review supply, and Google indexing state. Sections whose data
// source was unreachable render a quiet "not available" line — the report
// always ships. Data assembled by lib/weekly-report.ts.
export async function sendWeeklyReportEmail(report: import('./weekly-report').WeeklyReport): Promise<void> {
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const delta = (now: number, prev: number): string => {
    if (prev === 0 && now === 0) return '';
    if (prev === 0) return ` <span style="color:#15803d">(new)</span>`;
    const d = ((now - prev) / prev) * 100;
    const col = d >= 0 ? '#15803d' : '#dc2626';
    const arrow = d >= 0 ? '▲' : '▼';
    return ` <span style="color:${col}">${arrow} ${Math.abs(Math.round(d))}%</span>`;
  };
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 8px;font-size:14px;color:${MUTED}">${label}</td><td style="padding:6px 8px;font-size:14px;text-align:right">${value}</td></tr>`;
  const section = (title: string, inner: string) =>
    `<h3 style="margin:22px 0 8px;font-size:15px;color:${INK}">${title}</h3>${inner}`;
  const table = (rows: string) =>
    `<table style="width:100%;border-collapse:collapse;background:#f9fafb;border-radius:6px">${rows}</table>`;
  const na = `<p style="margin:0;color:${MUTED};font-size:13px">Data not available this week.</p>`;

  const o = report.orders;
  const ordersHtml = o ? table(
    row('Orders', `<strong>${o.count}</strong>${delta(o.count, o.prevCount)}`)
    + row('Revenue', `<strong>${money(o.revenue)}</strong>${delta(o.revenue, o.prevRevenue)}`)
    + row('Average order', money(o.aov))
    + (o.codShare != null ? row('Cash on delivery', pct(o.codShare)) : '')
    + (o.cancelled > 0 ? row('Cancelled', String(o.cancelled)) : '')
    + (o.topProducts.length ? row('Top sellers', o.topProducts.map(p => `${escapeHtml(p.name)} ×${p.units}`).join('<br/>')) : '')
    + (o.bySource.length ? row('Order sources', o.bySource.map(s => `${escapeHtml(s.source)}: ${s.count}`).join('<br/>')) : '')
  ) : na;

  const f = report.funnel;
  const funnelHtml = f ? table(
    row('Product views', `${f.viewItem}${delta(f.viewItem, f.prevViewItem)}`)
    + row('Added to cart', `${f.addToCart}${delta(f.addToCart, f.prevAddToCart)}`)
    + row('Reached checkout', `${f.beginCheckout}${delta(f.beginCheckout, f.prevBeginCheckout)}`)
    + row('Purchased', `${f.purchase}${delta(f.purchase, f.prevPurchase)}`)
    + (f.buyNowShare != null ? row('Buy Now share of adds', pct(f.buyNowShare)) : '')
    + (f.topLists.length ? row('Most-clicked sections', f.topLists.map(l => `${escapeHtml(l.list)}: ${l.clicks}`).join('<br/>')) : '')
  ) : na;

  const a = report.abandoned;
  const r = report.reviews;
  const opsHtml = (a || r) ? table(
    (a ? row('Abandoned checkouts', `${a.created} started · ${a.recovered} recovered`) : '')
    + (r ? row('Reviews', `${r.newThisWeek} new · <strong>${r.pendingApproval} awaiting approval</strong>`) : '')
  ) : na;

  const idx = report.indexing;
  const idxHtml = idx && idx.length
    ? table(idx.map(i => row(escapeHtml(i.state), String(i.pages))).join(''))
    : na;

  const html = shell(`
    <h2 style="margin:0 0 4px;font-size:18px">Weekly store report</h2>
    <p style="margin:0 0 8px;color:${MUTED};font-size:13px">${escapeHtml(report.periodLabel)}</p>
    ${section('Sales', ordersHtml)}
    ${section('Shopper funnel', funnelHtml)}
    ${section('Follow-ups', opsHtml)}
    ${section('Google indexing', idxHtml)}
    <p style="margin:22px 0 0"><a href="${SITE_URL}/admin" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ Open the admin dashboard</a></p>
  `);
  await send({
    to: OWNER_EMAIL,
    subject: `Weekly report · ${report.periodLabel}${o ? ` · ${o.count} orders, ${money(o.revenue)}` : ''}`,
    html,
    category: 'Weekly report',
  });
}

// ─── 1b. Internal: new contact-form message (for the merchant) ──────────────
// hello@yellowpink.pk has no inbox, so the storefront contact form writes to
// the contact_messages table and forwards here. replyTo is the customer's own
// address, so the owner can reply straight from their mailbox. Goes to the
// order-notification recipients (owner + any configured staff).
export async function sendContactMessageEmail(args: {
  name: string;
  email: string;
  subject?: string | null;
  message: string;
}): Promise<void> {
  const subjectLine = args.subject?.trim();
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">New contact message</h2>
    <p style="margin:0 0 4px"><strong>From:</strong> ${escapeHtml(stripEmoji(args.name))}</p>
    <p style="margin:0 0 4px"><strong>Email:</strong> <a href="mailto:${escapeHtml(args.email)}" style="color:${BRAND_PINK};text-decoration:none">${escapeHtml(args.email)}</a></p>
    ${subjectLine ? `<p style="margin:0 0 4px"><strong>Subject:</strong> ${escapeHtml(subjectLine)}</p>` : ''}
    <div style="margin:16px 0;padding:14px 16px;background:#f9fafb;border-radius:8px;white-space:pre-wrap;line-height:1.55;font-size:14px;color:${INK}">${escapeHtml(args.message)}</div>
    <p style="margin:16px 0 0;color:${MUTED};font-size:13px">Reply directly to this email to respond to ${escapeHtml(stripEmoji(args.name))}.</p>
    <p style="margin:16px 0 0"><a href="${SITE_URL}/admin/messages" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ Open in admin</a></p>
  `);
  const recipients = await getRecipientsForEvent('order.new');
  await send({
    to: recipients,
    replyTo: args.email,
    subject: `New message from ${args.name}${subjectLine ? `, ${subjectLine}` : ''}`,
    html,
    category: 'Contact message',
  });
}

// Owner's reply to a customer, sent from Admin → Messages. Sent from the
// store support address (keeps the thread on hello@) with replyTo pointing
// back there, so the customer's reply returns to the inbound webhook and
// threads into the same conversation. Returns whether the send succeeded so
// the caller can avoid recording a reply that never went out.
export async function sendCustomerReplyEmail(args: {
  to: string;
  customerName?: string | null;
  subject: string;
  body: string;
  from?: string;
  replyTo?: string;
}): Promise<boolean> {
  const name = args.customerName?.trim();
  const greeting = name ? `Hi ${escapeHtml(stripEmoji(name))},` : 'Hi,';
  const html = shell(`
    <p style="margin:0 0 14px;font-size:14px;color:${INK}">${greeting}</p>
    <div style="margin:0 0 16px;white-space:pre-wrap;line-height:1.6;font-size:14px;color:${INK_700}">${escapeHtml(args.body)}</div>
    <p style="margin:18px 0 0;color:${MUTED};font-size:13px">— The Yellow Pink team</p>
  `);
  return send({ to: args.to, subject: args.subject, html, from: args.from, replyTo: args.replyTo, category: 'Customer reply' });
}

// ─── 2. Customer: order confirmation ────────────────────────────────────────
/** Returns true when Resend accepted the email; false when the send was
 *  skipped (no API key, daily cap) or rejected. Checkout callers fire and
 *  forget, but the admin "Resend confirmation" button surfaces the result. */
export async function sendOrderConfirmationEmail(
  args: OrderSummary & {
    email: string;
    /** Bank-transfer orders: the store's accounts + admin instructions, so
     *  the customer has the payment details in their inbox and not only on
     *  the thank-you page they may have closed. */
    bankAccounts?: import('@/types').BankAccount[];
    bankNotes?: string;
  },
): Promise<boolean> {
  const isBank = args.pay_method === 'bank' && (args.bankAccounts?.length ?? 0) > 0;
  const bankBlock = isBank
    ? `
    <div style="margin:20px 0 0;padding:14px 16px;border:1px solid #fde68a;background:#fffbeb;border-radius:8px">
      <p style="margin:0 0 8px;font-weight:600;color:#92400e">To complete your order, transfer ${money(args.total)} to one of these accounts:</p>
      ${(args.bankAccounts ?? []).map(a => `
        <p style="margin:0 0 8px;font-size:14px;line-height:1.5">
          <strong>${escapeHtml(a.label)}</strong><br/>
          ${escapeHtml(a.title)}<br/>
          Account: <strong style="font-family:monospace">${escapeHtml(a.number)}</strong>
          ${a.iban ? `<br/>IBAN: <span style="font-family:monospace">${escapeHtml(a.iban)}</span>` : ''}
        </p>`).join('')}
      <p style="margin:8px 0 0;font-size:13px;color:${INK}">Use <strong>${escapeHtml(args.order_number)}</strong> as the payment reference and send us the receipt (WhatsApp or reply to this email). We prepare your order as soon as the payment is confirmed.</p>
      ${args.bankNotes ? `<p style="margin:8px 0 0;font-size:13px;color:${MUTED}">${escapeHtml(args.bankNotes)}</p>` : ''}
    </div>`
    : '';
  const introLine = isBank
    ? `We've received your order <strong>${escapeHtml(args.order_number)}</strong>. It will be prepared as soon as your bank transfer is confirmed — the details are below.`
    : `We've received your order <strong>${escapeHtml(args.order_number)}</strong> and will start preparing it shortly.
      You'll get an email when it ships.`;
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Thanks for your order, ${escapeHtml(stripEmoji(args.first_name))}!</h2>
    <p style="margin:0 0 16px;color:${INK};line-height:1.5">${introLine}</p>
    ${renderItemsTable(args.items)}
    <p style="margin:8px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(args.total)}</strong></p>
    ${bankBlock}
    <p style="margin:20px 0 0">
      <a href="${SITE_URL}/track?order=${encodeURIComponent(args.order_number)}${args.phone ? `&phone=${encodeURIComponent(args.phone)}` : ''}" style="display:inline-block;padding:10px 18px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Track your order</a>
    </p>
  `);
  return send({
    to: args.email,
    subject: `Order ${args.order_number} confirmed, Yellow Pink`,
    html,
    category: 'Order confirmation',
  });
}

// ─── 3. Customer: payment received (for card/jazzcash/easypaisa flows) ──────
export async function sendPaymentReceivedEmail(args: { email: string; first_name: string; order_number: string; total: number; method: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Payment received</h2>
    <p>Hi ${escapeHtml(stripEmoji(args.first_name))}, we've received your ${escapeHtml(args.method)} payment of <strong>${money(args.total)}</strong> for order <strong>${escapeHtml(args.order_number)}</strong>.</p>
    <p>We're now preparing your order for shipment.</p>
  `);
  await send({ to: args.email, subject: `Payment received, ${args.order_number}`, html, category: 'Payment received' });
}

// ─── 4. Customer: shipped ────────────────────────────────────────────────────
export async function sendShippedEmail(args: { email: string; first_name: string; order_number: string; tracking_number?: string; courier?: string }) {
  // Direct courier deep-link when the courier is recognised (TCS, Leopards,
  // …) — vendor-shipped parcels arrive with the vendor's courier + number
  // and the customer should be able to jump straight to that courier's
  // tracking page, not only to our /track. Unknown couriers (vendor rider,
  // "Other") just skip the link; the number + name still show.
  const directUrl = args.tracking_number ? courierTrackingUrl(args.courier, args.tracking_number) : null;
  const trackInfo = args.tracking_number
    ? `<p>Your tracking number: <strong style="font-family:monospace">${escapeHtml(args.tracking_number)}</strong>${args.courier ? ` (${escapeHtml(args.courier)})` : ''}${directUrl ? ` — <a href="${directUrl}" style="color:${BRAND_PINK};font-weight:600">track it on the ${escapeHtml(args.courier ?? 'courier')} site</a>` : ''}</p>`
    : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Your order is on its way</h2>
    <p>Hi ${escapeHtml(stripEmoji(args.first_name))}, your order <strong>${escapeHtml(args.order_number)}</strong> just shipped.</p>
    ${trackInfo}
    <p style="margin:20px 0 0">
      <a href="${SITE_URL}/track" style="display:inline-block;padding:10px 18px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Track shipment</a>
    </p>
  `);
  await send({ to: args.email, subject: `Shipped, ${args.order_number}`, html, category: 'Shipped' });
}

// ─── 5. Customer: delivered ─────────────────────────────────────────────────
export async function sendDeliveredEmail(args: { email: string; first_name: string; order_number: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Delivered</h2>
    <p>Hi ${escapeHtml(stripEmoji(args.first_name))}, your order <strong>${escapeHtml(args.order_number)}</strong> has been delivered. We hope you love it!</p>
    <p>Got a minute? <a href="${SITE_URL}/account/orders" style="color:${BRAND_PINK}">Leave a review</a>, it really helps other shoppers.</p>
  `);
  await send({ to: args.email, subject: `Delivered, ${args.order_number}`, html, category: 'Delivered' });
}

// ─── 6. Customer: cancelled ─────────────────────────────────────────────────
export async function sendCancelledEmail(args: { email: string; first_name: string; order_number: string; reason?: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Order cancelled</h2>
    <p>Hi ${escapeHtml(stripEmoji(args.first_name))}, order <strong>${escapeHtml(args.order_number)}</strong> has been cancelled.</p>
    ${args.reason ? `<p>Reason: ${escapeHtml(args.reason)}</p>` : ''}
    <p>If you didn't request this, reply to this email and we'll look into it.</p>
  `);
  await send({ to: args.email, subject: `Cancelled, ${args.order_number}`, html, replyTo: OWNER_EMAIL, category: 'Cancelled' });
}

// ─── 7. Customer: welcome (post-signup) ─────────────────────────────────────
export async function sendWelcomeEmail(args: { email: string; first_name?: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Welcome to Yellow Pink${args.first_name ? `, ${escapeHtml(stripEmoji(args.first_name))}` : ''}</h2>
    <p>We're glad you're here. Take a look at <a href="${SITE_URL}/shop" style="color:${BRAND_PINK}">what's new</a>, or <a href="${SITE_URL}/blog" style="color:${BRAND_PINK}">read our edit</a> for routines and reviews.</p>
  `, { marketingRecipient: args.email });
  await send({ to: args.email, subject: 'Welcome to Yellow Pink', html, kind: 'batch', category: 'Welcome' });
}

// ─── 8. Staff: temp password ────────────────────────────────────────────────
export async function sendStaffTempPasswordEmail(args: { email: string; name: string; tempPassword: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Your Yellow Pink admin access</h2>
    <p>Hi ${escapeHtml(args.name)}, your temporary password is:</p>
    <p style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-radius:6px;font-family:monospace;font-size:18px"><strong>${escapeHtml(args.tempPassword)}</strong></p>
    <p>Log in at <a href="${SITE_URL}/admin" style="color:${BRAND_PINK}">${SITE_URL}/admin</a> and change it right away from your profile page.</p>
  `);
  await send({ to: args.email, subject: 'Yellow Pink admin access', html, category: 'Staff access' });
}

// ─── 8.5. Medical Review Board: doctor applications ─────────────────────────
// Owner alert when a doctor applies to join the review board.
export async function sendReviewerApplicationEmail(args: {
  name: string; email: string; credentials?: string | null; specialty?: string | null;
  pmdc_number?: string | null; profile_url?: string | null;
}): Promise<void> {
  const row = (label: string, value?: string | null) =>
    value ? `<tr><td style="padding:4px 10px 4px 0;color:${MUTED};font-size:13px">${label}</td><td style="padding:4px 0;font-size:13px">${escapeHtml(value)}</td></tr>` : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">New Medical Review Board application</h2>
    <p>A clinician has applied to review your health content. Verify their credentials before approving.</p>
    <table style="margin:14px 0;border-collapse:collapse">
      ${row('Name', args.name)}
      ${row('Email', args.email)}
      ${row('Credentials', args.credentials)}
      ${row('Specialty', args.specialty)}
      ${row('PMDC #', args.pmdc_number)}
      ${row('Profile', args.profile_url)}
    </table>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/reviewers" style="color:${BRAND_PINK};font-weight:600">→ Review &amp; approve</a></p>
  `);
  const recipients = await getRecipientsForEvent('order.new');
  await send({ to: recipients, subject: `Reviewer application, ${args.name}`, html, kind: 'batch', category: 'Reviewer application' });
}

// Doctor notification once the owner approves their application.
export async function sendReviewerApprovedEmail(args: { name: string; email: string }): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">You're approved, welcome to the board</h2>
    <p>Hi ${escapeHtml(args.name)}, thank you for joining the Yellow Pink Medical Review Board.</p>
    <p>You can now sign in to your reviewer dashboard to complete your profile and see the articles credited to you. We'll email you a one-time sign-in link each time, no password to remember.</p>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/reviewer/login" style="display:inline-block;padding:12px 24px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Sign in to your dashboard →</a></p>
    <p style="margin:16px 0 0;color:${MUTED};font-size:12px">Sign in at ${SITE_URL}/reviewer/login using this email address (${escapeHtml(args.email)}).</p>
  `);
  await send({ to: args.email, subject: 'Your Yellow Pink reviewer access', html, category: 'Reviewer approved' });
}

/** Nudge a reviewer to sign in and complete their public profile (photo, bio,
 *  specialty, experience, languages). Sent from the admin board when a profile
 *  is thin. The login itself is a one-time email link, no password. */
export async function sendReviewerProfileInviteEmail(args: { name: string; email: string }): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Please complete your reviewer profile</h2>
    <p>Hi ${escapeHtml(args.name)}, your profile on the Yellow Pink Medical Review Board is live, but a few details are still missing.</p>
    <p>A complete profile (a photo, a short bio, your specialty, years of experience and languages) builds trust with readers and shows your expertise clearly on the articles you review. It only takes a couple of minutes.</p>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/reviewer/login" style="display:inline-block;padding:12px 24px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Sign in and complete your profile →</a></p>
    <p style="margin:16px 0 0;color:${MUTED};font-size:12px">Sign in at ${SITE_URL}/reviewer/login using this email address (${escapeHtml(args.email)}). We send a one-time link each time, so there is no password to remember.</p>
  `);
  await send({ to: args.email, subject: 'Complete your Yellow Pink reviewer profile', html, category: 'Reviewer profile' });
}

// ─── 9. Customer: abandoned cart reminder ──────────────────────────────────
export async function sendAbandonedCartEmail(args: {
  email: string;
  first_name?: string;
  items: OrderItemLine[];
  total: number;
  restore_url: string;
  tier: 1 | 2 | 3;
  discount_code?: string;
  discount_pct?: number;
}): Promise<void> {
  const intro = args.tier === 1
    ? `Hi${args.first_name ? ` ${escapeHtml(stripEmoji(args.first_name))}` : ''}, you left some things in your cart. They're still here whenever you're ready.`
    : args.tier === 2
    ? `Just a friendly nudge, your cart's still waiting. Tap the button below to pick up where you left off.`
    : `Last chance, your cart's about to expire.${args.discount_code ? ` Use code <strong>${escapeHtml(args.discount_code)}</strong> for ${args.discount_pct ?? 10}% off when you complete your order.` : ''}`;

  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">${args.tier === 3 ? 'Last chance' : 'You left something behind'}</h2>
    <p style="margin:0 0 16px;color:${INK};line-height:1.5">${intro}</p>
    ${renderItemsTable(args.items)}
    <p style="margin:8px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(args.total)}</strong></p>
    <p style="margin:24px 0 0;text-align:center">
      <a href="${args.restore_url}" style="display:inline-block;padding:12px 24px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Resume your cart →</a>
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: args.tier === 3
      ? `Last chance, your cart is about to expire`
      : args.tier === 2
      ? `Still thinking it over? Your cart's waiting`
      : `You left some things in your cart`,
    html,
    kind: 'batch',
    category: 'Abandoned cart',
  });
}

// ─── 11.5. Customer: newsletter welcome ─────────────────────────────────────
// Fires immediately after a newsletter signup succeeds. Sets expectations
// (one email a fortnight, what's in it), confirms the email is on file, and
// gives a frictionless way to back out via the unsubscribe footer link.
export async function sendNewsletterWelcomeEmail(args: { email: string; source: string }): Promise<void> {
  const offer = await getWelcomeOffer();
  const minCopy = offer && offer.minOrder > 0 ? ` over PKR ${offer.minOrder.toLocaleString()}` : '';
  // No live welcome coupon (owner deactivated it in admin) → skip the gift
  // box rather than promise a code checkout would reject.
  const giftBox = offer ? `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 24px">
      <tr><td style="background:${PAPER};border:1px dashed ${BRAND_PINK};border-radius:10px;padding:20px 24px;text-align:center">
        <p style="margin:0 0 6px;color:${MUTED};font-size:12px;letter-spacing:0.08em;text-transform:uppercase">A little welcome gift</p>
        <p style="margin:0 0 4px;color:${INK};font-size:26px;font-weight:700;letter-spacing:0.06em;font-family:'Courier New',monospace">${escapeHtml(offer.code)}</p>
        <p style="margin:0;color:${INK_700};font-size:13px">${offer.pct}% off your first order${minCopy}. Apply it at checkout.</p>
      </td></tr>
    </table>` : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">You're in</h2>
    <p style="margin:0 0 14px">Thanks for joining the Yellow Pink list. Here's what you can expect:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:${INK_700}">
      <li style="margin-bottom:6px"><strong>One email a fortnight</strong>, we never blast.</li>
      <li style="margin-bottom:6px">New drops, restock alerts, and a tightly-edited offer or two.</li>
      <li style="margin-bottom:6px">Pakistan-specific routine tips from our editorial team.</li>
    </ul>
    ${giftBox}
    <p style="margin:0 0 24px;color:${INK_700}">
      Curious what we've already written? <a href="${SITE_URL}/blog" style="color:${BRAND_PINK};font-weight:600">Read the edit →</a>
    </p>
    <p style="margin:24px 0 0;text-align:center">
      <a href="${SITE_URL}/shop" style="display:inline-block;padding:12px 28px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600;letter-spacing:0.02em">Start shopping</a>
    </p>
    <p style="margin:24px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      You're getting this because <strong>${escapeHtml(args.email)}</strong> just signed up via the
      <strong>${escapeHtml(args.source)}</strong> form. Wasn't you? Use the unsubscribe link below to remove it.
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: 'Welcome to Yellow Pink, your fortnightly edit starts here',
    html,
    kind: 'batch',
    category: 'Newsletter welcome',
  });
}

// ─── 11.5a. Customer: Routine Finder results ────────────────────────────────
// Sends the shopper's ACTUAL quiz picks (grouped by routine step, with the
// per-pick reason) plus a link to their saved result. The welcome offer is
// folded in because the quiz signup also subscribes them to the newsletter;
// one action, one email.
export async function sendQuizResultsEmail(args: {
  email: string;
  headline: string;
  code: string;
  items: { name: string; brand: string; price: number; slug: string; why: string; section: string }[];
}): Promise<void> {
  const offer = await getWelcomeOffer();
  const resultUrl = `${SITE_URL}/quiz/r/${encodeURIComponent(args.code)}`;
  const rows = args.items.map(it => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${LINE}">
        <p style="margin:0 0 2px;color:${MUTED};font-size:11px;letter-spacing:0.06em;text-transform:uppercase">${escapeHtml(it.section)}</p>
        <a href="${SITE_URL}/product/${encodeURIComponent(it.slug)}" style="color:${INK};font-weight:600;text-decoration:none">${escapeHtml(it.brand ? `${it.brand} ${it.name}` : it.name)}</a>
        <p style="margin:2px 0 0;color:${INK_700};font-size:13px">${escapeHtml(it.why)}</p>
      </td>
      <td style="padding:10px 0;border-bottom:1px solid ${LINE};text-align:right;white-space:nowrap;vertical-align:top">
        <strong>${money(it.price)}</strong>
      </td>
    </tr>`).join('');
  const giftBox = offer ? `
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0 0">
      <tr><td style="background:${PAPER};border:1px dashed ${BRAND_PINK};border-radius:10px;padding:18px 22px;text-align:center">
        <p style="margin:0 0 4px;color:${MUTED};font-size:12px;letter-spacing:0.08em;text-transform:uppercase">Welcome gift</p>
        <p style="margin:0 0 4px;color:${INK};font-size:24px;font-weight:700;letter-spacing:0.06em;font-family:'Courier New',monospace">${escapeHtml(offer.code)}</p>
        <p style="margin:0;color:${INK_700};font-size:13px">${offer.pct}% off your first order. Apply it at checkout.</p>
      </td></tr>
    </table>` : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">${escapeHtml(args.headline)}</h2>
    <p style="margin:0 0 16px;color:${INK_700};line-height:1.5">Here are your picks from the Routine Finder, saved so you can come back to them any time.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse">${rows}</table>
    ${giftBox}
    <p style="margin:24px 0 0;text-align:center">
      <a href="${resultUrl}" style="display:inline-block;padding:12px 28px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">View your saved routine</a>
    </p>
    <p style="margin:20px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      You are getting this because <strong>${escapeHtml(args.email)}</strong> asked for quiz results on yellowpink.pk.
      This also added you to our fortnightly newsletter; the unsubscribe link below removes you instantly.
    </p>
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: `${args.headline}, saved for you`,
    html,
    kind: 'batch',
    category: 'Quiz results',
  });
}

// ─── 11.5b. Newsletter broadcast (admin-composed campaign) ──────────────────
// Turns the merchant's plain-text newsletter body into branded HTML: blank
// lines split paragraphs, bare URLs become links. One call per recipient so
// the daily-cap guard in send() applies and addresses aren't leaked to each
// other.
function newsletterBodyToHtml(body: string): string {
  return body
    .trim()
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => {
      const linked = escapeHtml(p).replace(
        /(https?:\/\/[^\s<]+)/g,
        url => `<a href="${url}" style="color:${BRAND_PINK};font-weight:600">${url}</a>`,
      );
      return `<p style="margin:0 0 14px;color:${INK_700};line-height:1.6">${linked.replace(/\n/g, '<br/>')}</p>`;
    })
    .join('');
}

export async function sendNewsletterBroadcastEmail(args: {
  email: string;
  subject: string;
  body: string;
}): Promise<boolean> {
  const html = shell(newsletterBodyToHtml(args.body), { marketingRecipient: args.email });
  return send({ to: args.email, subject: args.subject, html, kind: 'batch', category: 'Newsletter' });
}

// ─── 11.7. Customer: post-delivery review request ──────────────────────────
// Fired by the daily cron a few days after an order is delivered. Asks the
// customer to review what they bought, linking each product straight to its
// PDP review form.
export async function sendReviewRequestEmail(args: {
  email: string;
  first_name?: string;
  order_number: string;
  products: { name: string; slug: string; image_url?: string | null }[];
  /** Loyalty points granted per approved review, named explicitly in the
   *  email when > 0 (a concrete "earn 25 points" reads far stronger than a
   *  vague "earn points" and is what actually lifts review volume). */
  rewardPoints?: number;
}): Promise<void> {
  if (args.products.length === 0) return;
  const pts = Math.max(0, Math.floor(args.rewardPoints ?? 0));

  const rows = args.products.map(p => `
    <tr>
      <td style="padding:8px 12px 8px 0;width:56px">
        ${p.image_url
          ? `<img src="${escapeHtml(p.image_url)}" alt="${escapeHtml(p.name)}" width="56" height="56" style="border-radius:8px;border:1px solid #e5e7eb;object-fit:cover"/>`
          : ''}
      </td>
      <td style="padding:8px 0;font-size:14px;color:${INK}">${escapeHtml(p.name)}</td>
      <td style="padding:8px 0;text-align:right">
        <a href="${SITE_URL}/product/${encodeURIComponent(p.slug)}#reviews"
           style="color:${BRAND_PINK};font-weight:600;font-size:13px;text-decoration:none;white-space:nowrap">Write a review →</a>
      </td>
    </tr>`).join('');

  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">How did it go?</h2>
    <p style="margin:0 0 14px">Hi ${escapeHtml(args.first_name ?? 'there')}, your order <strong>${escapeHtml(args.order_number)}</strong> landed a few days ago, so you've had a chance to try it out.</p>
    <p style="margin:0 0 18px">A quick, honest review helps other shoppers in Pakistan choose well, and it only takes a minute.</p>
    <table role="presentation" style="width:100%;border-collapse:collapse;margin:0 0 8px">${rows}</table>
    ${pts > 0 ? `
    <p style="margin:18px 0 0;padding:12px 16px;background:#fdf2f8;border:1px solid #fbcfe8;border-radius:10px;color:#9d174d;font-size:14px;font-weight:600">
      ★ Earn ${pts} loyalty points for each approved review, our thank-you for sharing.
    </p>` : `
    <p style="margin:22px 0 0;color:${MUTED};font-size:12px;line-height:1.5">
      Approved reviews earn loyalty points, a small thank-you for sharing.
    </p>`}
  `, { marketingRecipient: args.email });
  await send({
    to: args.email,
    subject: `How was your order ${args.order_number}?`,
    html,
    kind: 'batch',
    category: 'Review request',
  });
}

// Review booster: thank a guest reviewer with a one-time discount code once
// their review is approved (registered users earn loyalty points instead — see
// src/lib/review-reward.ts). Transactional, not marketing: it's a direct
// thank-you for an action they took, so no unsubscribe footer.
export async function sendReviewRewardEmail(args: {
  email: string;
  code: string;
  percent: number;
  days: number;
  productName?: string;
}): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">Thank you for your review! 🌸</h2>
    <p style="margin:0 0 14px">Your review${args.productName ? ` of <strong>${escapeHtml(args.productName)}</strong>` : ''} is now live, and it genuinely helps other shoppers in Pakistan choose well.</p>
    <p style="margin:0 0 16px">As a small thank-you, here's <strong>${args.percent}% off</strong> your next order:</p>
    <div style="margin:0 0 18px;padding:16px;background:#fdf2f8;border:1px dashed #f472b6;border-radius:12px;text-align:center">
      <div style="font-size:12px;color:${MUTED};letter-spacing:0.08em;text-transform:uppercase;margin-bottom:6px">Your code</div>
      <div style="font-size:24px;font-weight:800;letter-spacing:0.12em;color:${BRAND_PINK};font-family:ui-monospace,Menlo,monospace">${escapeHtml(args.code)}</div>
    </div>
    <p style="margin:0 0 20px;text-align:center">
      <a href="${SITE_URL}/shop" style="display:inline-block;padding:11px 22px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:8px;font-weight:600">Shop now →</a>
    </p>
    <p style="margin:0;color:${MUTED};font-size:12px;line-height:1.6">
      Apply the code at checkout. One use, valid for ${args.days} days. Thanks for being part of Yellow Pink 💛
    </p>
  `);
  await send({ to: args.email, subject: `Your ${args.percent}% thank-you code inside 🌸`, html, category: 'Review reward' });
}

// ─── 11b. Owner: stuck-payment alert (background job) ───────────────────────
// Orders that started an online payment but never completed sit in
// `payment_pending` indefinitely, invisible unless someone scans the orders
// list. This digest surfaces them so the owner can cancel or follow up before
// the customer re-pays and gets double-charged.
export async function sendStuckPaymentsAlertEmail(args: {
  orders: { order_number: string; total: number; pay_method: string; customer: string; hoursOld: number }[];
}) {
  if (!args.orders.length) return;
  const rows = args.orders.map(o =>
    `<tr><td style="padding:6px 8px;font-size:14px">${escapeHtml(o.order_number)}</td>
         <td style="padding:6px 8px;font-size:14px">${escapeHtml(o.customer)}</td>
         <td style="padding:6px 8px;font-size:14px">${escapeHtml(o.pay_method)}</td>
         <td style="padding:6px 8px;font-size:14px;text-align:right">PKR ${o.total.toLocaleString()}</td>
         <td style="padding:6px 8px;font-size:14px;text-align:right">${o.hoursOld}h</td></tr>`
  ).join('');
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Payments stuck pending</h2>
    <p>${args.orders.length} order${args.orders.length === 1 ? '' : 's'} have been waiting on an online payment for over 2 hours, the customer likely abandoned the gateway or it timed out. Check before they re-pay (and get double-charged), then cancel or follow up.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <tr><th align="left" style="padding:6px 8px;font-size:12px;color:#6b7280">Order</th><th align="left" style="padding:6px 8px;font-size:12px;color:#6b7280">Customer</th><th align="left" style="padding:6px 8px;font-size:12px;color:#6b7280">Method</th><th align="right" style="padding:6px 8px;font-size:12px;color:#6b7280">Total</th><th align="right" style="padding:6px 8px;font-size:12px;color:#6b7280">Age</th></tr>
      ${rows}
    </table>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/orders?status=payment_pending" style="color:${BRAND_PINK};font-weight:600">→ Review pending payments</a></p>
  `);
  await send({ to: OWNER_EMAIL, subject: `Action needed, ${args.orders.length} payment${args.orders.length === 1 ? '' : 's'} stuck pending`, html, kind: 'batch', category: 'Stuck payments' });
}

// Price-parity alert: our arrangement with NB Sons is that their individual
// products are never sold below their own store price (discounts live only
// in bundles). The weekly cron compares catalogs and this alert names any
// single of ours that has drifted below their list.
export async function sendPriceParityAlertEmail(args: {
  vendor: string;
  items: { name: string; slug: string; ourPrice: number; theirPrice: number; theirHandle: string }[];
}) {
  if (!args.items.length) return;
  const rows = args.items.map(i =>
    `<tr><td style="padding:6px 8px;font-size:14px"><a href="${SITE_URL}/product/${escapeHtml(i.slug)}" style="color:#111">${escapeHtml(i.name)}</a></td>
         <td style="padding:6px 8px;font-size:14px;text-align:right;color:#dc2626;font-weight:600">PKR ${i.ourPrice.toLocaleString()}</td>
         <td style="padding:6px 8px;font-size:14px;text-align:right">PKR ${i.theirPrice.toLocaleString()}</td>
         <td style="padding:6px 8px;font-size:13px"><a href="https://nbsons.com/products/${escapeHtml(i.theirHandle)}" style="color:${BRAND_PINK}">their listing →</a></td></tr>`
  ).join('');
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(args.vendor)} price parity broken</h2>
    <p>${args.items.length} individual product${args.items.length === 1 ? ' is' : 's are'} priced below what ${escapeHtml(args.vendor)} charges on their own store. The arrangement is parity on singles, discounts only in bundles — raise ours or confirm the change with the vendor.</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <tr><th align="left" style="padding:6px 8px;font-size:12px;color:#6b7280">Product</th><th align="right" style="padding:6px 8px;font-size:12px;color:#6b7280">Ours</th><th align="right" style="padding:6px 8px;font-size:12px;color:#6b7280">Theirs</th><th align="left" style="padding:6px 8px;font-size:12px;color:#6b7280"></th></tr>
      ${rows}
    </table>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/products?vendor=nb" style="color:${BRAND_PINK};font-weight:600">→ Open products</a></p>
  `);
  await send({ to: OWNER_EMAIL, subject: `Price parity: ${args.items.length} product${args.items.length === 1 ? '' : 's'} below ${args.vendor} list price`, html, kind: 'batch', category: 'Price parity' });
}

// Broken-link (404) digest, the daily cron passes only NEW, unresolved misses
// (already deduped per-path), so this just renders. No-op when the list is
// empty, so a clean day is silent.
export async function sendBrokenLinksDigestEmail(args: {
  items: { path: string; hit_count: number; last_referer: string | null; is_bot: boolean }[];
}) {
  if (!args.items.length) return;
  const rows = args.items.map(i => {
    const src = i.last_referer ? escapeHtml(i.last_referer) : (i.is_bot ? 'crawler' : 'direct / unknown');
    return `<tr>
      <td style="padding:6px 8px;font-size:13px;font-family:monospace">${escapeHtml(i.path)}</td>
      <td style="padding:6px 8px;font-size:13px;text-align:right">${i.hit_count}</td>
      <td style="padding:6px 8px;font-size:12px;color:#6b7280">${src}</td>
    </tr>`;
  }).join('');
  const n = args.items.length;
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">${n} new broken link${n === 1 ? '' : 's'} (404)</h2>
    <p>${n === 1 ? 'A URL' : 'These URLs'} started returning 404, a visitor or crawler hit a dead link.
       Review and one-click redirect any that should point somewhere:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">
      <tr><th style="text-align:left;padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase">Path</th>
          <th style="text-align:right;padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase">Hits</th>
          <th style="text-align:left;padding:6px 8px;font-size:11px;color:#6b7280;text-transform:uppercase">Source</th></tr>
      ${rows}
    </table>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/broken-links" style="color:${BRAND_PINK};font-weight:600">→ Review &amp; fix in admin</a></p>
    <p style="margin:12px 0 0;font-size:12px;color:#9ca3af">A 404 for genuinely removed content is fine to ignore, this digest just makes sure none slip past you.</p>
  `);
  const recipients = await getRecipientsForEvent('seo.broken_links');
  await send({ to: recipients, subject: `${n} new broken link${n === 1 ? '' : 's'} on the store`, html, kind: 'batch', category: 'Broken links' });
}
