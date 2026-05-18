// ============================================================================
// Transactional email via Resend. Phase 1.4.
//
// Every send is best-effort and never throws — email failure must not break
// an order placement or any other commit. Add new templates by exporting a
// `send<Thing>Email` function; keep the HTML inline (no JSX runtime cost on
// server actions).
//
// Required env:
//   RESEND_API_KEY   — server-only
//   OWNER_EMAIL      — where internal notifications go (new orders, low stock)
//   EMAIL_FROM       — verified Resend "from" address (default: orders@yellowpink.pk)
// ============================================================================

import { Resend } from 'resend';
import { log } from './logger';
import { brandPlusName } from './product-display';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'sooviaan@gmail.com';
const FROM = process.env.EMAIL_FROM ?? 'Yellow Pink Orders <orders@yellowpink.pk>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yellowpink.pk';
const BRAND_PINK = '#E8487F';
const BRAND_YELLOW = '#F7C948';
const PAPER = '#FAF6EE';
const INK = '#111827';
const INK_700 = '#374151';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';

// Logo URL — Resend lets us link to any public image. Using the same flower
// mark that the live site uses as its favicon so the email feels on-brand
// from the inbox preview onward.
const LOGO_URL = `${SITE_URL}/icon-192.png`;

// ─── Primitives ─────────────────────────────────────────────────────────────
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
// (order confirmation, etc.) should NOT — they're not opt-in.
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
  /** Marketing-mail recipient — adds the unsubscribe link to the footer.
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
      <strong style="color:${INK}">Yellow Pink</strong> · Karachi · Lahore · Islamabad<br/>
      <a href="${SITE_URL}" style="color:${MUTED};text-decoration:underline">${SITE_URL.replace(/^https?:\/\//, '')}</a> ·
      <a href="${SITE_URL}/track" style="color:${MUTED};text-decoration:underline">Track an order</a> ·
      <a href="${SITE_URL}/page/contact" style="color:${MUTED};text-decoration:underline">Contact us</a>${unsubscribeFooter(opts.marketingRecipient)}
    </div>
  </div>
</div>`.trim();
}

async function send(opts: { to: string | string[]; subject: string; html: string; replyTo?: string }) {
  if (!resend) {
    log.warn('email.skip', { reason: 'RESEND_API_KEY not set', to: opts.to, subject: opts.subject });
    return;
  }
  try {
    await resend.emails.send({
      from: FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });
    log.info('email.sent', { to: opts.to, subject: opts.subject });
  } catch (err) {
    log.error('email.send_failed', { to: opts.to, subject: opts.subject, err });
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
    <h2 style="margin:0 0 12px;font-size:18px">New order — ${escapeHtml(order.order_number)}</h2>
    <p style="margin:0 0 4px"><strong>Customer:</strong> ${escapeHtml(order.first_name)} ${escapeHtml(order.last_name)}</p>
    <p style="margin:0 0 4px"><strong>Phone:</strong> ${escapeHtml(order.phone)}</p>
    <p style="margin:0 0 4px"><strong>City:</strong> ${escapeHtml(order.city)}${order.province ? `, ${escapeHtml(order.province)}` : ''}</p>
    <p style="margin:0 0 12px"><strong>Payment:</strong> ${escapeHtml(order.pay_method.toUpperCase())}</p>
    ${renderItemsTable(order.items)}
    <p style="margin:16px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(order.total)}</strong></p>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/orders" style="color:${BRAND_PINK};text-decoration:none;font-weight:600">→ Open in admin</a></p>
  `);
  await send({
    to: OWNER_EMAIL,
    subject: `New order ${order.order_number} — ${money(order.total)}`,
    html,
  });
}

// ─── 2. Customer: order confirmation ────────────────────────────────────────
export async function sendOrderConfirmationEmail(args: OrderSummary & { email: string }): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Thanks for your order, ${escapeHtml(args.first_name)}!</h2>
    <p style="margin:0 0 16px;color:${INK};line-height:1.5">
      We've received your order <strong>${escapeHtml(args.order_number)}</strong> and will start preparing it shortly.
      You'll get an email when it ships.
    </p>
    ${renderItemsTable(args.items)}
    <p style="margin:8px 0 0;text-align:right;font-size:16px"><strong>Total: ${money(args.total)}</strong></p>
    <p style="margin:20px 0 0">
      <a href="${SITE_URL}/track" style="display:inline-block;padding:10px 18px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Track your order</a>
    </p>
  `);
  await send({
    to: args.email,
    subject: `Order ${args.order_number} confirmed — Yellow Pink`,
    html,
  });
}

// ─── 3. Customer: payment received (for card/jazzcash/easypaisa flows) ──────
export async function sendPaymentReceivedEmail(args: { email: string; first_name: string; order_number: string; total: number; method: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Payment received</h2>
    <p>Hi ${escapeHtml(args.first_name)} — we've received your ${escapeHtml(args.method)} payment of <strong>${money(args.total)}</strong> for order <strong>${escapeHtml(args.order_number)}</strong>.</p>
    <p>We're now preparing your order for shipment.</p>
  `);
  await send({ to: args.email, subject: `Payment received — ${args.order_number}`, html });
}

// ─── 4. Customer: shipped ────────────────────────────────────────────────────
export async function sendShippedEmail(args: { email: string; first_name: string; order_number: string; tracking_number?: string; courier?: string }) {
  const trackInfo = args.tracking_number
    ? `<p>Your tracking number: <strong style="font-family:monospace">${escapeHtml(args.tracking_number)}</strong>${args.courier ? ` (${escapeHtml(args.courier)})` : ''}</p>`
    : '';
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Your order is on its way 🚚</h2>
    <p>Hi ${escapeHtml(args.first_name)} — your order <strong>${escapeHtml(args.order_number)}</strong> just shipped.</p>
    ${trackInfo}
    <p style="margin:20px 0 0">
      <a href="${SITE_URL}/track" style="display:inline-block;padding:10px 18px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Track shipment</a>
    </p>
  `);
  await send({ to: args.email, subject: `Shipped — ${args.order_number}`, html });
}

// ─── 5. Customer: delivered ─────────────────────────────────────────────────
export async function sendDeliveredEmail(args: { email: string; first_name: string; order_number: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Delivered 🎉</h2>
    <p>Hi ${escapeHtml(args.first_name)} — your order <strong>${escapeHtml(args.order_number)}</strong> has been delivered. We hope you love it!</p>
    <p>Got a minute? <a href="${SITE_URL}/account/orders" style="color:${BRAND_PINK}">Leave a review</a> — it really helps other shoppers.</p>
  `);
  await send({ to: args.email, subject: `Delivered — ${args.order_number}`, html });
}

// ─── 6. Customer: cancelled ─────────────────────────────────────────────────
export async function sendCancelledEmail(args: { email: string; first_name: string; order_number: string; reason?: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Order cancelled</h2>
    <p>Hi ${escapeHtml(args.first_name)} — order <strong>${escapeHtml(args.order_number)}</strong> has been cancelled.</p>
    ${args.reason ? `<p>Reason: ${escapeHtml(args.reason)}</p>` : ''}
    <p>If you didn't request this, reply to this email and we'll look into it.</p>
  `);
  await send({ to: args.email, subject: `Cancelled — ${args.order_number}`, html, replyTo: OWNER_EMAIL });
}

// ─── 7. Customer: welcome (post-signup) ─────────────────────────────────────
export async function sendWelcomeEmail(args: { email: string; first_name?: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Welcome to Yellow Pink${args.first_name ? `, ${escapeHtml(args.first_name)}` : ''}</h2>
    <p>We're glad you're here. Take a look at <a href="${SITE_URL}/shop" style="color:${BRAND_PINK}">what's new</a>, or <a href="${SITE_URL}/blog" style="color:${BRAND_PINK}">read our edit</a> for routines and reviews.</p>
  `, { marketingRecipient: args.email });
  await send({ to: args.email, subject: 'Welcome to Yellow Pink', html });
}

// ─── 8. Staff: temp password ────────────────────────────────────────────────
export async function sendStaffTempPasswordEmail(args: { email: string; name: string; tempPassword: string }) {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Your Yellow Pink admin access</h2>
    <p>Hi ${escapeHtml(args.name)} — your temporary password is:</p>
    <p style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-radius:6px;font-family:monospace;font-size:18px"><strong>${escapeHtml(args.tempPassword)}</strong></p>
    <p>Log in at <a href="${SITE_URL}/admin" style="color:${BRAND_PINK}">${SITE_URL}/admin</a> and change it right away from your profile page.</p>
  `);
  await send({ to: args.email, subject: 'Yellow Pink admin access', html });
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
    ? `Hi${args.first_name ? ` ${escapeHtml(args.first_name)}` : ''} — you left some things in your cart. They're still here whenever you're ready.`
    : args.tier === 2
    ? `Just a friendly nudge — your cart's still waiting. Tap the button below to pick up where you left off.`
    : `Last chance — your cart's about to expire.${args.discount_code ? ` Use code <strong>${escapeHtml(args.discount_code)}</strong> for ${args.discount_pct ?? 10}% off when you complete your order.` : ''}`;

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
      ? `Last chance — your cart is about to expire`
      : args.tier === 2
      ? `Still thinking it over? Your cart's waiting`
      : `You left some things in your cart`,
    html,
  });
}

// ─── 10. Customer: back-in-stock ────────────────────────────────────────────
export async function sendBackInStockEmail(args: {
  email: string;
  product_name: string;
  product_url: string;
  image_url?: string;
}): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">It's back in stock!</h2>
    <p>The product you asked us to watch is now available again:</p>
    <p style="margin:14px 0"><strong>${escapeHtml(args.product_name)}</strong></p>
    ${args.image_url ? `<img src="${escapeHtml(args.image_url)}" alt="${escapeHtml(args.product_name)}" style="max-width:280px;border-radius:8px;border:1px solid #e5e7eb"/>` : ''}
    <p style="margin:24px 0 0">
      <a href="${escapeHtml(args.product_url)}" style="display:inline-block;padding:12px 24px;background:${BRAND_PINK};color:#fff;text-decoration:none;border-radius:6px;font-weight:600">Shop now →</a>
    </p>
    <p style="margin:16px 0 0;color:${MUTED};font-size:12px">Stock moves fast — finish your order soon if you don't want to miss it.</p>
  `);
  await send({ to: args.email, subject: `Back in stock: ${args.product_name}`, html });
}

// ─── 11.5. Customer: newsletter welcome ─────────────────────────────────────
// Fires immediately after a newsletter signup succeeds. Sets expectations
// (one email a fortnight, what's in it), confirms the email is on file, and
// gives a frictionless way to back out via the unsubscribe footer link.
export async function sendNewsletterWelcomeEmail(args: { email: string; source: string }): Promise<void> {
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:20px;color:${INK};font-family:Georgia,serif;font-weight:500">You're in 💌</h2>
    <p style="margin:0 0 14px">Thanks for joining the Yellow Pink list. Here's what you can expect:</p>
    <ul style="margin:0 0 20px;padding-left:20px;color:${INK_700}">
      <li style="margin-bottom:6px"><strong>One email a fortnight</strong> — we never blast.</li>
      <li style="margin-bottom:6px">New drops, restock alerts, and a tightly-edited offer or two.</li>
      <li style="margin-bottom:6px">Pakistan-specific routine tips from our editorial team.</li>
    </ul>
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
    subject: 'Welcome to Yellow Pink — your fortnightly edit starts here',
    html,
  });
}

// ─── 11. Owner: low-stock alert (background job) ────────────────────────────
export async function sendLowStockAlertEmail(args: { products: { name: string; brand: string; stock: number; slug: string }[] }) {
  if (!args.products.length) return;
  const rows = args.products.map(p =>
    `<tr><td style="padding:6px 8px;font-size:14px">${escapeHtml(brandPlusName(p.brand, p.name))}</td>
         <td style="padding:6px 8px;font-size:14px;text-align:right">${p.stock}</td></tr>`
  ).join('');
  const html = shell(`
    <h2 style="margin:0 0 12px;font-size:18px">Low stock alert</h2>
    <p>${args.products.length} product${args.products.length === 1 ? '' : 's'} dropped below the 5-unit threshold:</p>
    <table style="width:100%;border-collapse:collapse;margin-top:12px">${rows}</table>
    <p style="margin:20px 0 0"><a href="${SITE_URL}/admin/products" style="color:${BRAND_PINK};font-weight:600">→ Restock now</a></p>
  `);
  await send({ to: OWNER_EMAIL, subject: `Low stock — ${args.products.length} item${args.products.length === 1 ? '' : 's'}`, html });
}
