'use client';

// Slide-in side drawer: peek at an order from the list without losing your
// place (scroll position, filters, selection all survive). Renders entirely
// from the row's own data — the list query already carries the full item
// snapshots — so opening it costs no request. Escape, the backdrop, or the
// × close it.

import { useEffect } from 'react';
import Link from 'next/link';
import type { Order } from '@/types';
import { PAY_METHOD_LABELS } from '@/types';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { fmtDateTimePK } from '@/lib/dates';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

export function OrderPeekDrawer({ order, onClose }: { order: Order; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // Lock the page scroll behind the drawer.
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  const items = order.items ?? [];
  const itemsSubtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const discount = Number(order.discount_amount ?? 0);
  const waHref = whatsappUrlForCustomer(order.phone, `Assalam-o-Alaikum ${order.first_name}, aap ke Yellow Pink order (${order.order_number}) ke baare mein message kar rahe hain.`);

  return (
    <>
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.4)', zIndex: 60 }}
      />
      <aside
        role="dialog"
        aria-label={`Order ${order.order_number} quick view`}
        className="adm-drawer"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 61,
          width: 'min(440px, 100vw)', background: 'white',
          boxShadow: '-12px 0 40px rgba(16,24,40,0.18)',
          display: 'flex', flexDirection: 'column',
          animation: 'adm-drawer-in 0.18s ease-out',
        }}
      >
        <style>{`@keyframes adm-drawer-in { from { transform: translateX(24px); opacity: 0.4; } to { transform: none; opacity: 1; } }`}</style>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.9375rem', color: '#111827' }}>{order.order_number}</span>
              <OrderStatusBadge status={order.status ?? 'pending'} />
            </div>
            <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 2 }}>
              {order.created_at ? fmtDateTimePK(order.created_at) : ''}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick view"
            style={{
              marginLeft: 'auto', width: 32, height: 32, borderRadius: 8, border: '1px solid #e5e7eb',
              background: 'white', color: '#6b7280', cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {/* Customer */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Customer</div>
            <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{order.first_name} {order.last_name}</div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
              {order.address}{order.city ? `, ${order.city}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {order.phone && <a href={`tel:${order.phone}`} className="adm-btn adm-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>{order.phone}</a>}
              {waHref && (
                <a href={waHref} target="_blank" rel="noopener noreferrer" className="adm-btn adm-btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem', color: '#128C4B', borderColor: '#25D366' }}>
                  WhatsApp
                </a>
              )}
            </div>
          </div>

          {/* Items */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
              Items ({items.length})
            </div>
            {items.map((it, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 0', borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                {it.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={it.image_url} alt="" width={40} height={40} style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #f3f4f6', flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 40, height: 40, borderRadius: 8, background: '#f9fafb', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                    {it.variant_label ? `${it.variant_label} · ` : ''}{it.qty} × {fmt(it.price)}
                  </div>
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>{fmt(it.price * it.qty)}</div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ background: '#f9fafb', borderRadius: 10, padding: '12px 14px', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#6b7280' }}>
              <span>Subtotal</span><span>{fmt(itemsSubtotal)}</span>
            </div>
            {discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#15803d' }}>
                <span>Discount</span><span>−{fmt(discount)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0', color: '#6b7280' }}>
              <span>Shipping</span><span>{order.shipping > 0 ? fmt(order.shipping) : 'Free'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 4, borderTop: '1px solid #e5e7eb', fontWeight: 700, color: '#111827', fontSize: '0.875rem' }}>
              <span>Total</span><span>{fmt(order.total)}</span>
            </div>
            <div style={{ marginTop: 6, fontSize: '0.75rem', color: '#9ca3af' }}>
              {PAY_METHOD_LABELS[order.pay_method] ?? order.pay_method}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid #f3f4f6', display: 'flex', gap: 10 }}>
          <Link href={`/admin/orders/${order.id}`} className="adm-btn adm-btn-primary" style={{ flex: 1 }}>
            Open full order
          </Link>
          <button type="button" onClick={onClose} className="adm-btn adm-btn-secondary">Close</button>
        </div>
      </aside>
    </>
  );
}
