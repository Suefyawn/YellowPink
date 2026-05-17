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

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'sooviaan@gmail.com';
const FROM = process.env.EMAIL_FROM ?? 'Yellow Pink Orders <orders@yellowpink.pk>';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://yellowpink.pk';
const BRAND_PINK = '#E8487F';
const INK = '#111827';
const MUTED = '#6b7280';

// ─── Primitives ─────────────────────────────────────────────────────────────
function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!)
  );
}

function money(n: number): string {
  return `PKR ${n.toLocaleString()}`;
}

function shell(inner: string): string {
  return `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;color:${INK};background:#fff">
  <div style="padding:24px 24px 0;border-bottom:1px solid #e5e7eb">
    <h1 style="margin:0 0 16px;font-family:Georgia,serif;font-size:24px;color:${BRAND_PINK};letter-spacing:-0.5px">Yellow Pink</h1>
  </div>
  <div style="padding:24px">${inner}</div>
  <div style="padding:16px 24px 24px;border-top:1px solid #e5e7eb;color:${MUTED};font-size:12px">
    Yellow Pink · Pakistan ·
    <a href="${SITE_URL}" style="color:${MUTED}">${SITE_URL.replace(/^https?:\/\//, '')}</a>
  </div>
</div>`.trim();
}

async function send(opts: { to: string | string[]; subject: string; html: string; replyTo?: string }) {
  if (!resend) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('[email] RESEND_API_KEY not set; skipping send to', opts.to, '—', opts.subject);
    }
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
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[email] send failed', err);
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
  `);
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
  `);
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

// ─── 10. Owner: low-stock alert (background job) ────────────────────────────
export async function sendLowStockAlertEmail(args: { products: { name: string; brand: string; stock: number; slug: string }[] }) {
  if (!args.products.length) return;
  const rows = args.products.map(p =>
    `<tr><td style="padding:6px 8px;font-size:14px">${escapeHtml(p.brand)} ${escapeHtml(p.name)}</td>
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
