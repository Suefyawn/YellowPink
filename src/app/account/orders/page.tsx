'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const fmtDate = (s: string) => new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

const statusColors: Record<string, string> = {
  pending: '#f59e0b', processing: '#3b82f6', shipped: '#8b5cf6', delivered: '#10b981', cancelled: '#ef4444',
};

const STATUS_STEPS: OrderStatus[] = ['pending', 'processing', 'shipped', 'delivered'];

export default function AccountOrdersPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!user) return;
    const sb = getBrowserClient();
    sb.from('orders').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setOrders((data ?? []) as Order[]); setFetching(false); });
  }, [user, loading, router]);

  if (loading || fetching) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading orders…</div>;
  }

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>My Orders</h1>
        </div>

        {orders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 24px' }}>
            <div style={{ fontSize: '3rem', marginBottom: 16, opacity: 0.3 }}>◎</div>
            <p style={{ color: 'var(--ink-500)', marginBottom: 24 }}>No orders yet</p>
            <Link href="/shop" style={{ padding: '10px 24px', background: 'var(--brand-pink)', color: 'white', borderRadius: 8, textDecoration: 'none', fontWeight: 600, fontSize: '0.9375rem' }}>
              Start shopping
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {orders.map(o => {
              const status = o.status ?? 'pending';
              const stepIdx = STATUS_STEPS.indexOf(status as OrderStatus);
              const isCancelled = status === 'cancelled';
              const isExpanded = expanded === o.id;

              return (
                <div key={o.id} style={{ background: 'white', borderRadius: 12, border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <div
                    onClick={() => setExpanded(isExpanded ? null : o.id!)}
                    style={{ padding: '20px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: '1rem', color: 'var(--ink-900)', marginBottom: 4 }}>{o.order_number}</div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)' }}>{o.created_at ? fmtDate(o.created_at) : ''} · {fmt(o.total)}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                        background: (statusColors[status] ?? '#6b7280') + '20',
                        color: statusColors[status] ?? '#6b7280',
                      }}>
                        {status}
                      </span>
                      <span style={{ color: 'var(--ink-400)', fontSize: '0.875rem' }}>{isExpanded ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div style={{ borderTop: '1px solid var(--line)', padding: '20px 24px' }}>
                      {/* Progress tracker */}
                      {!isCancelled && (
                        <div style={{ marginBottom: 24 }}>
                          <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
                            {STATUS_STEPS.map((step, i) => (
                              <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: i === 0 ? 'flex-start' : i === STATUS_STEPS.length - 1 ? 'flex-end' : 'center', position: 'relative' }}>
                                {i < STATUS_STEPS.length - 1 && (
                                  <div style={{ position: 'absolute', top: 10, left: i === 0 ? '50%' : 0, right: i === STATUS_STEPS.length - 2 ? '50%' : 0, height: 2, background: i < stepIdx ? 'var(--brand-pink)' : '#e5e7eb', zIndex: 0 }} />
                                )}
                                <div style={{ width: 20, height: 20, borderRadius: '50%', background: i <= stepIdx ? 'var(--brand-pink)' : 'white', border: `2px solid ${i <= stepIdx ? 'var(--brand-pink)' : '#d1d5db'}`, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
                                  {i <= stepIdx && <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }} />}
                                </div>
                                <div style={{ fontSize: '0.6875rem', color: i <= stepIdx ? 'var(--brand-pink)' : '#9ca3af', fontWeight: i === stepIdx ? 700 : 400, textTransform: 'capitalize', textAlign: 'center' }}>{step}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {o.tracking_number && (
                        <div style={{ marginBottom: 16, padding: '10px 14px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, fontSize: '0.875rem' }}>
                          <span style={{ color: '#0369a1', fontWeight: 600 }}>Tracking: </span>
                          <span style={{ fontFamily: 'monospace', color: '#0c4a6e' }}>{o.tracking_number}</span>
                        </div>
                      )}

                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                        <tbody>
                          {(o.items ?? []).map((item, i) => (
                            <tr key={i} style={{ borderTop: i > 0 ? '1px solid var(--line)' : 'none' }}>
                              <td style={{ padding: '8px 0', color: 'var(--ink-900)', fontWeight: 500 }}>{item.brand} {item.name}</td>
                              <td style={{ padding: '8px 0', color: 'var(--ink-500)', textAlign: 'center' }}>×{item.qty}</td>
                              <td style={{ padding: '8px 0', color: 'var(--ink-900)', fontWeight: 600, textAlign: 'right' }}>{fmt(item.price * item.qty)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ borderTop: '1px solid var(--line)', paddingTop: 10, marginTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9375rem' }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--brand-pink)' }}>{fmt(o.total)}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
