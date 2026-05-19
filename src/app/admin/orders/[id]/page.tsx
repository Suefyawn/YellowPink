export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { OrderStatusForm } from '@/components/admin/OrderStatusForm';
import { PrintInvoiceButton } from '@/components/admin/PrintInvoiceButton';
import { ShipmentBookingForm } from '@/components/admin/ShipmentBookingForm';
import { brandPlusName } from '@/lib/product-display';
import { configuredAdapterIds } from '@/lib/couriers';
import type { Order, CartItem, OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const payLabel: Record<string, string> = { cod: 'Cash on Delivery', card: 'Card Payment', bank: 'Bank Transfer' };

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: order } = await supabaseAdmin().from('orders').select('*').eq('id', id).single();
  if (!order) notFound();

  const o = order as Order;
  const items = (o.items ?? []) as CartItem[];
  const currentStatus = (o.status ?? 'pending') as OrderStatus;

  // Pull the most-recent shipment for this order so the booking form can
  // toggle into its "already shipped" state. Cheap query — one row max for
  // most orders. Couriers with a configured API adapter (env vars set) get
  // a "Book pickup" button; everything else falls back to manual entry.
  const { data: shipmentRow } = await supabaseAdmin()
    .from('shipments')
    .select('id, courier, tracking_number, status')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const apiAdapters = configuredAdapterIds();

  // Customer history block — lifetime orders + total spend for the same
  // (user_id OR phone OR email). Cheap query — admin-only view, no caching
  // needed. Excludes the current order from "previous" + "ltv" so the
  // merchant sees "this is their 3rd order" rather than counting the one
  // they're already looking at.
  const orFilters = [
    o.user_id ? `user_id.eq.${o.user_id}` : null,
    o.email ? `email.eq.${o.email}` : null,
    o.phone ? `phone.eq.${o.phone}` : null,
  ].filter(Boolean).join(',');
  let customerStats: { count: number; total: number; first: string | null } | null = null;
  if (orFilters) {
    const { data: history } = await supabaseAdmin()
      .from('orders')
      .select('id, total, status, created_at')
      .or(orFilters)
      .neq('status', 'cancelled');
    const rows = (history ?? []) as Array<{ id: string; total: number; status: string; created_at: string }>;
    const orderCount = rows.length;
    const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
    const first = rows.length > 0
      ? rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0].created_at)
      : null;
    customerStats = { count: orderCount, total, first };
  }

  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };
  const dl: React.CSSProperties = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', margin: 0 };
  const dt: React.CSSProperties = { fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 };
  const dd: React.CSSProperties = { fontSize: '0.875rem', color: '#111827', margin: 0 };

  return (
    <div style={{ padding: '32px 36px' }}>
      {/* Print styles */}
      <style>{`
        @media print {
          .adm-sidebar, .adm-topbar, .adm-overlay, .no-print { display: none !important; }
          .adm-main { margin-left: 0 !important; background: white !important; }
          #print-invoice { display: block !important; }
          .print-hide { display: none !important; }
        }
        #print-invoice { display: none; }
      `}</style>

      <div className="no-print print-hide" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <Link href="/admin/orders" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Orders</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
          {o.order_number}
        </h1>
        <span style={{
          padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600,
          background: (statusColors[currentStatus] ?? '#6b7280') + '20',
          color: statusColors[currentStatus] ?? '#6b7280',
          textTransform: 'capitalize',
        }}>
          {currentStatus}
        </span>
        {o.created_at && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 4 }}>{fmtDate(o.created_at)}</span>
        )}
        <div style={{ marginLeft: 'auto' }}>
          <PrintInvoiceButton />
        </div>
      </div>

      {/* Printable invoice */}
      <div id="print-invoice" style={{ fontFamily: 'sans-serif', color: '#111827', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '2px solid #111827', paddingBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
              <span style={{ color: '#E8487F' }}>Yellow</span>Pink
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>yellowpink.pk</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem' }}>{o.order_number}</div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>{o.created_at ? fmtDate(o.created_at) : ''}</div>
            <div style={{ marginTop: 6, padding: '2px 10px', display: 'inline-block', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, textTransform: 'capitalize', background: (statusColors[currentStatus] ?? '#6b7280') + '25', color: statusColors[currentStatus] ?? '#6b7280' }}>
              {currentStatus}
            </div>
          </div>
        </div>
        <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 8 }}>Bill To</div>
            <div style={{ fontWeight: 600 }}>{o.first_name} {o.last_name}</div>
            <div style={{ fontSize: '0.875rem', color: '#374151', marginTop: 4 }}>{o.phone}</div>
            {o.email && <div style={{ fontSize: '0.875rem', color: '#374151' }}>{o.email}</div>}
          </div>
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 8 }}>Ship To</div>
            <div style={{ fontSize: '0.875rem', color: '#374151' }}>{o.address}</div>
            <div style={{ fontSize: '0.875rem', color: '#374151' }}>{o.city}{o.province ? `, ${o.province}` : ''}{o.zip ? ` ${o.zip}` : ''}</div>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Item', 'Price', 'Qty', 'Total'].map(h => (
                <th scope="col" key={h} style={{ padding: '8px 0', textAlign: h === 'Price' || h === 'Qty' || h === 'Total' ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', fontSize: '0.875rem' }}>{brandPlusName(item.brand, item.name)}{item.variant ? ` — ${item.variant}` : ''}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', textAlign: 'right' }}>{fmt(item.price)}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' }}>{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginLeft: 'auto', maxWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span><span>{fmt(o.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: o.discount_amount && o.discount_amount > 0 ? 6 : 10 }}>
            <span style={{ color: '#6b7280' }}>Shipping</span><span>{o.shipping === 0 ? 'Free' : fmt(o.shipping)}</span>
          </div>
          {o.discount_amount != null && o.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 10 }}>
              <span style={{ color: '#15803d' }}>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}</span>
              <span style={{ color: '#15803d' }}>− {fmt(o.discount_amount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', borderTop: '2px solid #111827', paddingTop: 10 }}>
            <span>Total</span><span>{fmt(o.total)}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.8125rem', color: '#6b7280' }}>
            Payment: <strong style={{ color: '#374151' }}>{payLabel[o.pay_method] ?? o.pay_method}</strong>
          </div>
        </div>
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Customer */}
        <div style={section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Customer</h2>
            {customerStats && customerStats.count > 1 && (
              <span
                title={customerStats.first ? `First ordered ${new Date(customerStats.first).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })}` : undefined}
                style={{
                  fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  padding: '3px 9px', borderRadius: 20,
                  background: '#fdf2f8', color: '#9d174d', border: '1px solid #fbcfe8',
                }}
              >
                Repeat · {customerStats.count} orders
              </span>
            )}
          </div>
          <dl style={dl}>
            <dt style={dt}>Name</dt>
            <dd style={dd}>{o.first_name} {o.last_name}</dd>
            <dt style={dt}>Phone</dt>
            <dd style={dd}>{o.phone}</dd>
            {o.email && <><dt style={dt}>Email</dt><dd style={dd}>{o.email}</dd></>}
            {customerStats && (
              <>
                <dt style={dt}>Lifetime spend</dt>
                <dd style={dd}>
                  <strong style={{ color: '#16a34a' }}>{fmt(customerStats.total)}</strong>
                  <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: '0.75rem' }}>across {customerStats.count} order{customerStats.count !== 1 ? 's' : ''}</span>
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* Shipping */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipping address</h2>
          <dl style={dl}>
            <dt style={dt}>Address</dt>
            <dd style={dd}>{o.address}</dd>
            <dt style={dt}>City</dt>
            <dd style={dd}>{o.city}{o.province ? `, ${o.province}` : ''}</dd>
            {o.zip && <><dt style={dt}>ZIP</dt><dd style={dd}>{o.zip}</dd></>}
          </dl>
        </div>
      </div>

      {/* Order Items */}
      <div style={{ ...section, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order items</h2>
        <div className="adm-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Product', 'Brand', 'Variant', 'Price', 'Qty', 'Subtotal'].map(h => (
                <th scope="col" key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>{item.name}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{item.brand}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{item.variant ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', color: '#374151' }}>{fmt(item.price)}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', color: '#374151' }}>{item.qty}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Shipment booking — sits above the status update because most
          merchant workflows book a courier first, then mark the order
          shipped. */}
      <div style={{ ...section, marginTop: 12 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipment</h2>
        <ShipmentBookingForm
          orderId={o.id!}
          apiAdapters={apiAdapters}
          shipment={shipmentRow ? {
            id: shipmentRow.id as string,
            courier: shipmentRow.courier as string,
            tracking_number: shipmentRow.tracking_number as string,
            status: shipmentRow.status as string,
          } : null}
        />
      </div>

      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Order Status Management */}
        <div style={section}>
          <h2 style={{ margin: '0 0 20px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Update Order</h2>
          <OrderStatusForm
            orderId={o.id!}
            currentStatus={currentStatus}
            currentTracking={o.tracking_number ?? null}
          />
        </div>

        {/* Payment Summary */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Payment</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>Subtotal</span>
              <span>{fmt(o.subtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#6b7280' }}>Shipping</span>
              <span>{o.shipping === 0 ? 'Free' : fmt(o.shipping)}</span>
            </div>
            {o.discount_amount != null && o.discount_amount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: '#15803d' }}>
                  Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}
                </span>
                <span style={{ color: '#15803d' }}>− {fmt(o.discount_amount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
              <span>Total</span>
              <span style={{ color: '#C5286A' }}>{fmt(o.total)}</span>
            </div>
            <div style={{ marginTop: 4, fontSize: '0.8125rem', color: '#6b7280' }}>
              Method: <strong style={{ color: '#374151' }}>{payLabel[o.pay_method] ?? o.pay_method}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
