'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

const STATUS_STEPS: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

const statusMessages: Record<string, string> = {
  pending:    'Your order has been received and is awaiting processing.',
  processing: 'We\'re preparing your items for shipment.',
  shipped:    'Your order is on its way! Check the tracking number below.',
  delivered:  'Your order has been delivered. Enjoy your products!',
  cancelled:  'This order was cancelled.',
};

export default function TrackPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim()) return;
    setError('');
    setOrder(null);
    setLoading(true);
    const sb = getBrowserClient();
    const { data } = await sb.from('orders').select('*').eq('order_number', orderNumber.trim().toUpperCase()).single();
    if (!data) {
      setError('No order found with that number. Please check and try again.');
    } else {
      setOrder(data as Order);
    }
    setLoading(false);
  };

  const status = order?.status ?? 'pending';
  const stepIdx = STATUS_STEPS.indexOf(status as OrderStatus);
  const isCancelled = status === 'cancelled';

  return (
    <div className="container" style={{ padding: '64px var(--side)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 500, margin: '0 0 8px', letterSpacing: '-0.025em' }}>Track Order</h1>
        <p style={{ color: 'var(--ink-500)', margin: '0 0 40px', fontSize: '1rem' }}>
          Enter your order number to check the status of your shipment.
        </p>

        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, marginBottom: 40 }}>
          <input
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            placeholder="e.g. YP-A1B2C3"
            style={{
              flex: 1, padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 10,
              fontFamily: 'monospace', fontSize: '1rem', color: 'var(--ink-900)', outline: 'none',
              background: 'white', boxSizing: 'border-box',
            }}
          />
          <button type="submit" disabled={loading} style={{
            padding: '12px 24px', background: loading ? '#f9a8d4' : 'var(--brand-pink)',
            color: 'white', border: 'none', borderRadius: 10,
            fontSize: '0.9375rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
          }}>
            {loading ? '…' : 'Track'}
          </button>
        </form>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#dc2626', marginBottom: 32 }}>
            {error}
          </div>
        )}

        {order && (
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid var(--line)', overflow: 'hidden', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <div style={{ padding: '24px 28px', background: 'var(--cream)', borderBottom: '1px solid var(--line)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.25rem', color: 'var(--ink-900)', marginBottom: 4 }}>{order.order_number}</div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--ink-500)' }}>
                    {order.first_name} {order.last_name} · {fmt(order.total)}
                  </div>
                </div>
                <span style={{
                  padding: '6px 16px', borderRadius: 20, fontSize: '0.875rem', fontWeight: 700, textTransform: 'capitalize',
                  background: (statusColors[status] ?? '#6b7280') + '20',
                  color: statusColors[status] ?? '#6b7280',
                }}>
                  {status}
                </span>
              </div>
            </div>

            <div style={{ padding: '28px' }}>
              <p style={{ margin: '0 0 28px', fontSize: '0.9375rem', color: 'var(--ink-700)' }}>
                {statusMessages[status]}
              </p>

              {!isCancelled && (
                <div style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', position: 'relative', paddingTop: 4 }}>
                    {STATUS_STEPS.map((step, i) => (
                      <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                        {i < STATUS_STEPS.length - 1 && (
                          <div style={{ position: 'absolute', top: 10, left: '50%', right: '-50%', height: 2, background: i < stepIdx ? 'var(--brand-pink)' : '#e5e7eb', zIndex: 0 }} />
                        )}
                        <div style={{ width: 22, height: 22, borderRadius: '50%', background: i <= stepIdx ? 'var(--brand-pink)' : 'white', border: `2px solid ${i <= stepIdx ? 'var(--brand-pink)' : '#d1d5db'}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                          {i < stepIdx && <span style={{ color: 'white', fontSize: '0.625rem', fontWeight: 700 }}>✓</span>}
                          {i === stepIdx && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: i <= stepIdx ? 'var(--brand-pink)' : '#9ca3af', fontWeight: i === stepIdx ? 700 : 400, textTransform: 'capitalize', textAlign: 'center' }}>{step}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {order.tracking_number && (
                <div style={{ padding: '14px 18px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, marginBottom: 24, fontSize: '0.9375rem' }}>
                  <span style={{ color: '#0369a1', fontWeight: 600 }}>Tracking number: </span>
                  <span style={{ fontFamily: 'monospace', color: '#0c4a6e', fontWeight: 700 }}>{order.tracking_number}</span>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)', marginBottom: 10 }}>Items ordered</div>
                {(order.items ?? []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '4px 0', color: 'var(--ink-700)' }}>
                    <span>{item.brand} {item.name} × {item.qty}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: '0.875rem', color: 'var(--ink-500)' }}>
          Have an account?{' '}
          <Link href="/account/orders" style={{ color: 'var(--brand-pink)', fontWeight: 600, textDecoration: 'none' }}>
            View all your orders →
          </Link>
        </div>
      </div>
    </div>
  );
}
