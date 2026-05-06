'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Overline } from '@/components/ui/Overline';
import { useCart } from '@/context/CartContext';
import { useAuth } from '@/context/AuthContext';
import { createOrder } from '@/lib/supabase';
import { getBrowserClient } from '@/lib/supabase-browser';

const FREE_SHIPPING = 2500;
const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

type PayMethod = 'cod' | 'card' | 'bank';

export function CheckoutPage() {
  const { cartItems, clearCart } = useCart();
  const { user } = useAuth();
  const router = useRouter();
  const total = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = total >= FREE_SHIPPING ? 0 : 200;

  const [payMethod, setPayMethod] = useState<PayMethod>('cod');
  const [formData, setFormData] = useState({ email: '', firstName: '', lastName: '', phone: '', address: '', city: '', province: '', zip: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const update = (key: string, val: string) => {
    setFormData(p => ({ ...p, [key]: val }));
    if (errors[key]) setErrors(p => { const n = { ...p }; delete n[key]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!formData.firstName.trim()) e.firstName = 'Required';
    if (!formData.lastName.trim()) e.lastName = 'Required';
    if (!formData.phone.trim()) e.phone = 'Required';
    if (!formData.address.trim()) e.address = 'Required';
    if (!formData.city.trim()) e.city = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const orderNumber = 'YP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
      await createOrder({
        order_number: orderNumber,
        email: formData.email || undefined,
        first_name: formData.firstName,
        last_name: formData.lastName,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        province: formData.province || undefined,
        zip: formData.zip || undefined,
        pay_method: payMethod,
        subtotal: total,
        shipping,
        total: total + shipping,
        items: cartItems,
        status: 'pending',
        user_id: user?.id || undefined,
      });
      const sb = getBrowserClient();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await Promise.all(cartItems.map(item =>
        (sb as any).rpc('decrement_stock', { pid: item.id, amount: item.qty })
      ));
      clearCart();
      router.push(`/thank-you?order=${orderNumber}`);
    } catch {
      setSubmitting(false);
    }
  };

  const inputStyle = (key: string): React.CSSProperties => ({
    width: '100%', padding: '10px 12px',
    border: `1px solid ${errors[key] ? 'var(--error)' : 'var(--line)'}`,
    borderRadius: 'var(--radius-card)', fontFamily: 'var(--font-ui)',
    fontSize: '0.875rem', color: 'var(--ink-900)', background: 'var(--paper)',
    outline: 'none',
  });
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 500, marginBottom: 6 };

  return (
    <div>
      <section style={{ padding: '48px 0 0', borderBottom: '1px solid var(--line)' }}>
        <div className="container">
          <Overline style={{ display: 'block', marginBottom: 8, color: 'var(--ink-500)' }}>Checkout</Overline>
          <h1 className="display-l" style={{ fontSize: '2rem', marginBottom: 32 }}>Complete Your Order</h1>
        </div>
      </section>

      <section style={{ padding: '40px 0 var(--section-gap)' }}>
        <div className="container">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48 }} className="duo-grid">
            <div>
              <Overline style={{ display: 'block', marginBottom: 16 }}>Contact</Overline>
              <div style={{ marginBottom: 24 }}>
                <label style={labelStyle}>Email (optional)</label>
                <input type="email" value={formData.email} onChange={e => update('email', e.target.value)} placeholder="For order updates" style={inputStyle('email')} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label style={labelStyle}>Phone *</label>
                  <input type="tel" value={formData.phone} onChange={e => update('phone', e.target.value)} placeholder="+92 300 1234567" style={inputStyle('phone')} />
                  {errors.phone && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.phone}</span>}
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Shipping Address</Overline>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>First Name *</label>
                  <input value={formData.firstName} onChange={e => update('firstName', e.target.value)} style={inputStyle('firstName')} />
                  {errors.firstName && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.firstName}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Last Name *</label>
                  <input value={formData.lastName} onChange={e => update('lastName', e.target.value)} style={inputStyle('lastName')} />
                  {errors.lastName && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.lastName}</span>}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={labelStyle}>Address *</label>
                <input value={formData.address} onChange={e => update('address', e.target.value)} placeholder="House/flat, street, area" style={inputStyle('address')} />
                {errors.address && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.address}</span>}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input value={formData.city} onChange={e => update('city', e.target.value)} style={inputStyle('city')} />
                  {errors.city && <span style={{ fontSize: '0.75rem', color: 'var(--error)' }}>{errors.city}</span>}
                </div>
                <div>
                  <label style={labelStyle}>Province</label>
                  <select value={formData.province} onChange={e => update('province', e.target.value)} style={{ ...inputStyle('province'), cursor: 'pointer' }}>
                    <option value="">Select</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Postal Code</label>
                  <input value={formData.zip} onChange={e => update('zip', e.target.value)} style={inputStyle('zip')} />
                </div>
              </div>

              <hr className="hairline" style={{ margin: '32px 0' }} />
              <Overline style={{ display: 'block', marginBottom: 16 }}>Payment Method</Overline>
              {([['cod', 'Cash on Delivery (COD)', 'Pay when your order arrives'], ['card', 'Credit / Debit Card', 'Visa, Mastercard, JazzCash'], ['bank', 'Bank Transfer', 'Direct bank deposit']] as [PayMethod, string, string][]).map(([key, label, desc]) => (
                <label key={key} onClick={() => setPayMethod(key)} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, padding: '16px',
                  border: '1px solid ' + (payMethod === key ? 'var(--ink-900)' : 'var(--line)'),
                  borderRadius: 'var(--radius-card)', cursor: 'pointer',
                  marginBottom: -1, background: payMethod === key ? 'var(--paper2)' : 'transparent',
                  transition: 'all 150ms',
                }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1, border: payMethod === key ? '5px solid var(--ink-900)' : '2px solid var(--line)', transition: 'border 150ms' }} />
                  <div>
                    <div style={{ fontSize: '0.875rem', fontWeight: 600 }}>{label}</div>
                    <div className="small-text">{desc}</div>
                  </div>
                </label>
              ))}
            </div>

            <div style={{ background: 'var(--paper2)', borderRadius: 'var(--radius-card)', padding: 28, border: '1px solid var(--line)', alignSelf: 'start', position: 'sticky', top: 100 }}>
              <Overline style={{ display: 'block', marginBottom: 16, color: 'var(--ink-500)' }}>Your Order</Overline>
              {cartItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  <div className="img-placeholder" style={{ width: 48, height: 48, borderRadius: 'var(--radius-card)', flexShrink: 0, fontSize: '0.45rem', position: 'relative' }}>
                    img
                    <span style={{ position: 'absolute', top: -6, right: -6, background: 'var(--ink-900)', color: 'var(--paper)', width: 18, height: 18, borderRadius: '50%', fontSize: '0.625rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{item.qty}</span>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{item.name}</div>
                    {item.variant && <div className="small-text" style={{ fontSize: '0.6875rem' }}>{item.variant}</div>}
                  </div>
                  <span className="tabular-nums" style={{ fontSize: '0.8125rem', fontWeight: 500, flexShrink: 0 }}>PKR {(item.price * item.qty).toLocaleString()}</span>
                </div>
              ))}
              <hr className="hairline" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Subtotal</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500 }}>PKR {total.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="small-text">Shipping</span>
                <span className="small-text tabular-nums" style={{ fontWeight: 500, color: shipping === 0 ? 'var(--success)' : 'inherit' }}>{shipping === 0 ? 'FREE' : `PKR ${shipping}`}</span>
              </div>
              <hr className="hairline" style={{ margin: '16px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24 }}>
                <span className="h3">Total</span>
                <span className="h3 tabular-nums">PKR {(total + shipping).toLocaleString()}</span>
              </div>
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Placing Order…' : 'Place Order'}
              </button>
              <p className="small-text" style={{ textAlign: 'center', marginTop: 12, color: 'var(--ink-500)' }}>Secure checkout · COD available</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
