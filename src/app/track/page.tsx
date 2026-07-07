'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase-browser';
import { ORDER_STATUS_LABELS } from '@/types';
import { OrderStatusTimeline } from '@/components/order/OrderStatusTimeline';
import { brandPlusName } from '@/lib/product-display';
import { courierTrackingUrl } from '@/lib/couriers/profiles';
import type { Order, OrderStatus } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

const statusColors: Record<string, string> = {
  payment_pending: '#9ca3af',
  payment_failed:  '#ef4444',
  pending:         '#f59e0b',
  processing:      '#3b82f6',
  shipped:         '#8b5cf6',
  delivered:       '#10b981',
  cancelled:       '#ef4444',
  returned:        '#6b7280',
  refunded:        '#6b7280',
};

const statusMessages: Record<string, string> = {
  payment_pending: 'We\'re waiting for your payment to come through.',
  payment_failed:  'Your payment didn\'t go through. Please reorder or contact us.',
  pending:         'Your order has been received and is awaiting processing.',
  processing:      "We're preparing your items for shipment.",
  shipped:         'Your order is on its way! Check the tracking number below.',
  delivered:       'Your order has been delivered. Enjoy your products!',
  cancelled:       'This order was cancelled.',
  returned:        'This order was returned.',
  refunded:        'This order has been refunded.',
};

// Courier tracking deep-links come from the shared client-safe profiles module
// (src/lib/couriers/profiles.ts) so /track and the admin booking form can never
// drift apart on which carriers are supported.

const RATE_LIMIT_WINDOW = 60_000;
const MAX_ATTEMPTS = 5;
const attempts: { count: number; since: number } = { count: 0, since: Date.now() };

// `?order=YP-XXXXX` (and optionally `&phone=…`) pre-fills the form when the
// customer clicks "Track your order" from the confirmation email. We can't
// auto-submit because the lookup is gated on the phone for security, but the
// pre-fill saves a copy-paste step.
function TrackForm() {
  const params = useSearchParams();
  const initialOrderNumber = params.get('order') ?? '';
  const initialPhone = params.get('phone') ?? '';
  const [orderNumber, setOrderNumber] = useState(initialOrderNumber);
  const [phone, setPhone] = useState(initialPhone);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // If both came in via the URL, auto-submit so the customer hits the page and
  // sees their status without an extra click. The form remains visible, we
  // don't trust the URL phone alone, but the RPC guards the actual lookup.
  //
  // Failure handling matters here: a *system* error (RPC/network/deploy blip)
  // must not leave a silent blank form, so we surface a soft retry message.
  // A genuine no-match on a prefilled link (rare, the link is minted from a
  // real order) stays quiet so we don't accuse a legitimate visitor of a bad
  // order number; they can correct the prefilled fields and submit manually.
  useEffect(() => {
    if (!initialOrderNumber || !initialPhone) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    const sb = getBrowserClient();
    sb.rpc('lookup_order' as never, {
      p_order_number: initialOrderNumber.trim().toUpperCase(),
      p_phone: initialPhone.trim(),
    } as never).then(({ data, error: rpcError }) => {
      const row = Array.isArray(data) ? (data[0] as Order | undefined) : (data as Order | null);
      setLoading(false);
      if (row) { setOrder(row); return; }
      if (rpcError) {
        setError("We couldn't load your order automatically. Please tap Track to try again.");
      }
    });
  }, [initialOrderNumber, initialPhone]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !phone.trim()) return;

    const now = Date.now();
    if (now - attempts.since > RATE_LIMIT_WINDOW) { attempts.count = 0; attempts.since = now; }
    attempts.count++;
    if (attempts.count > MAX_ATTEMPTS) {
      setError('Too many attempts. Please wait a minute before trying again.');
      return;
    }

    setError('');
    setOrder(null);
    setLoading(true);
    const sb = getBrowserClient();
    // Server-side lookup via SECURITY DEFINER RPC: only returns the row if
    // (order_number, phone) match. No anon read on the orders table needed.
    const { data, error: rpcError } = await sb.rpc('lookup_order' as never, {
      p_order_number: orderNumber.trim().toUpperCase(),
      p_phone: phone.trim(),
    } as never);
    setLoading(false);

    const row = Array.isArray(data) ? (data[0] as Order | undefined) : (data as Order | null);

    if (rpcError || !row) {
      setError('No order matches that order number and phone. Please check and try again.');
      return;
    }
    setOrder(row);
  };

  const status = (order?.status ?? 'pending') as OrderStatus;
  const trackingUrl = order?.tracking_number ? courierTrackingUrl(order.courier, order.tracking_number) : null;

  return (
    <div className="container" style={{ padding: '64px var(--side)' }}>
      <div style={{ maxWidth: 600, margin: '0 auto' }}>
        {/* Left-aligned eyebrow + display-serif H1 + one-line lede, the same
            page-header pattern as the rest of the storefront. */}
        <span className="overline" style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Orders</span>
        <h1 className="display-l" style={{ fontSize: '2.5rem', margin: '0 0 8px' }}>Track Order</h1>
        <p className="body-text" style={{ color: 'var(--ink-700)', margin: '0 0 32px' }}>
          Enter your order number and the phone you used at checkout.
        </p>

        <form
          onSubmit={handleSearch}
          style={{
            display: 'flex', flexDirection: 'column', gap: 12,
            background: 'white', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
            padding: 24, marginBottom: 12,
          }}
        >
          <label htmlFor="track-order" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Order number
          </label>
          <input
            id="track-order"
            value={orderNumber}
            onChange={e => setOrderNumber(e.target.value)}
            placeholder="Order number, e.g. YP-A1B2C3"
            required
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            style={{
              width: '100%', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
              fontFamily: 'var(--font-ui)', fontSize: '1rem', color: 'var(--ink-900)', outline: 'none',
              background: 'var(--paper)', boxSizing: 'border-box',
            }}
          />
          <label htmlFor="track-phone" style={{ position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', border: 0 }}>
            Phone number
          </label>
          <input
            id="track-phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="Phone used at checkout"
            required
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            style={{
              width: '100%', padding: '12px 16px', border: '1px solid var(--line)', borderRadius: 'var(--radius-card)',
              fontFamily: 'var(--font-ui)', fontSize: '1rem', color: 'var(--ink-900)', outline: 'none',
              background: 'var(--paper)', boxSizing: 'border-box',
            }}
          />
          <button type="submit" disabled={loading} style={{
            width: '100%', padding: '14px 24px', marginTop: 4,
            background: loading ? '#f9a8d4' : 'var(--brand-pink-cta)',
            color: 'white', border: 'none', borderRadius: 'var(--radius-card)',
            fontFamily: 'var(--font-ui)', fontSize: '0.8125rem', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? 'Looking up…' : 'Track Order'}
          </button>
        </form>

        <p style={{ margin: '0 0 40px', fontSize: '0.8125rem', color: 'var(--ink-500)' }}>
          Can&apos;t find your order number?{' '}
          <Link href="/page/contact" style={{ color: 'var(--brand-pink-text)', fontWeight: 600, textDecoration: 'none' }}>
            Contact us →
          </Link>
        </p>

        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 10, padding: '16px 20px', color: '#dc2626', marginBottom: 32 }}>
              {error}
            </div>
          )}
        </div>

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
                  {ORDER_STATUS_LABELS[status]}
                </span>
              </div>
            </div>

            <div style={{ padding: '28px' }}>
              <p style={{ margin: '0 0 28px', fontSize: '0.9375rem', color: 'var(--ink-700)' }}>
                {statusMessages[status]}
              </p>

              <div style={{ marginBottom: 28 }}>
                <OrderStatusTimeline
                  status={status}
                  // We only have `created_at` on the order itself today;
                  // shipped / delivered timestamps will come from
                  // `order_events` once that join is wired here.
                  events={{ pending: order.created_at ?? undefined }}
                />
              </div>

              {order.tracking_number && (
                <div style={{ padding: '14px 18px', background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 10, marginBottom: 24, fontSize: '0.9375rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <span style={{ color: '#0369a1', fontWeight: 600 }}>Tracking: </span>
                      <span style={{ fontFamily: 'monospace', color: '#0c4a6e', fontWeight: 700 }}>{order.tracking_number}</span>
                      {order.courier && <span style={{ color: '#0369a1', marginLeft: 8 }}>· {order.courier}</span>}
                    </div>
                    {trackingUrl && (
                      <a href={trackingUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#0369a1', fontWeight: 600, textDecoration: 'none', fontSize: '0.8125rem' }}>
                        Open courier page →
                      </a>
                    )}
                  </div>
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--line)', paddingTop: 20 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)', marginBottom: 10 }}>Items ordered</div>
                {(order.items ?? []).map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', padding: '4px 0', color: 'var(--ink-700)' }}>
                    {/* brandPlusName dedupes, WP-imported item names often
                        already start with the brand, so "brand + name" was
                        rendering "Kiko Milano Kiko Milano …" here. */}
                    <span>{brandPlusName(item.brand, item.name)} × {item.qty}</span>
                    <span style={{ fontWeight: 600 }}>{fmt(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: 40, textAlign: 'center', fontSize: '0.875rem', color: 'var(--ink-500)' }}>
          Have an account?{' '}
          <Link href="/account/orders" style={{ color: 'var(--brand-pink-text)', fontWeight: 600, textDecoration: 'none' }}>
            View all your orders →
          </Link>
        </div>
      </div>
    </div>
  );
}

// Suspense wraps the form because useSearchParams suspends during prerender.
export default function TrackPage() {
  return (
    <Suspense fallback={null}>
      <TrackForm />
    </Suspense>
  );
}
