export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { OrderStatusForm } from '@/components/admin/OrderStatusForm';
import type { Order, CartItem, OrderStatus } from '@/types';

const fmt = (n: number) => `Rs ${n.toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const payLabel: Record<string, string> = { cod: 'Cash on Delivery', card: 'Card Payment', bank: 'Bank Transfer' };

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { data: order } = await supabase.from('orders').select('*').eq('id', id).single();
  if (!order) notFound();

  const o = order as Order;
  const items = (o.items ?? []) as CartItem[];
  const currentStatus = (o.status ?? 'pending') as OrderStatus;

  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };
  const dl: React.CSSProperties = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', margin: 0 };
  const dt: React.CSSProperties = { fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 };
  const dd: React.CSSProperties = { fontSize: '0.875rem', color: '#111827', margin: 0 };

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
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
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
        {/* Customer */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Customer</h2>
          <dl style={dl}>
            <dt style={dt}>Name</dt>
            <dd style={dd}>{o.first_name} {o.last_name}</dd>
            <dt style={dt}>Phone</dt>
            <dd style={dd}>{o.phone}</dd>
            {o.email && <><dt style={dt}>Email</dt><dd style={dd}>{o.email}</dd></>}
          </dl>
        </div>

        {/* Shipping */}
        <div style={section}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipping Address</h2>
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
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order Items</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Product', 'Brand', 'Variant', 'Price', 'Qty', 'Subtotal'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
              <span>Total</span>
              <span style={{ color: '#ec4899' }}>{fmt(o.total)}</span>
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
