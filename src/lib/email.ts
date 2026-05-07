import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const OWNER_EMAIL = process.env.OWNER_EMAIL ?? 'sooviaan@gmail.com';

export async function sendNewOrderEmail(order: {
  order_number: string;
  first_name: string;
  last_name: string;
  phone: string;
  city: string;
  province?: string;
  total: number;
  items: Array<{ name: string; qty: number; price: number }>;
  pay_method: string;
}) {
  if (!resend) return; // silently skip if no API key

  const itemRows = order.items
    .map(i => `<tr><td style="padding:4px 8px">${i.name}</td><td style="padding:4px 8px;text-align:right">x${i.qty}</td><td style="padding:4px 8px;text-align:right">PKR ${(i.price * i.qty).toLocaleString()}</td></tr>`)
    .join('');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
      <h2 style="color:#E8487F">New Order — ${order.order_number}</h2>
      <p><strong>Customer:</strong> ${order.first_name} ${order.last_name}</p>
      <p><strong>Phone:</strong> ${order.phone}</p>
      <p><strong>City:</strong> ${order.city}${order.province ? `, ${order.province}` : ''}</p>
      <p><strong>Payment:</strong> ${order.pay_method.toUpperCase()}</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <thead><tr style="background:#f9fafb"><th style="padding:6px 8px;text-align:left">Item</th><th style="padding:6px 8px">Qty</th><th style="padding:6px 8px;text-align:right">Price</th></tr></thead>
        <tbody>${itemRows}</tbody>
        <tfoot><tr style="border-top:2px solid #e5e7eb"><td colspan="2" style="padding:8px;font-weight:700">Total</td><td style="padding:8px;text-align:right;font-weight:700">PKR ${order.total.toLocaleString()}</td></tr></tfoot>
      </table>
      <p style="color:#6b7280;font-size:0.875rem">Yellow Pink Admin</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: 'Yellow Pink Orders <orders@yellowpink.pk>',
      to: OWNER_EMAIL,
      subject: `New Order ${order.order_number} — PKR ${order.total.toLocaleString()}`,
      html,
    });
  } catch {
    // don't let email failure break order placement
  }
}
