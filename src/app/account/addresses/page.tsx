'use client';

import { useActionState, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import { createAddress, deleteAddress } from './actions';
import type { Address } from '@/types';

const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 12px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.875rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 };

export default function AddressesPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [state, action, pending] = useActionState(createAddress, null);

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const sb = getBrowserClient();
    sb.from('addresses')
      .select('*')
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .then(({ data }) => setAddresses((data ?? []) as Address[]));
  }, [user, state]);

  if (loading || !user) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading…</div>;
  }

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>Addresses</h1>
        </div>

        {addresses == null && <p style={{ color: '#9ca3af' }}>Loading addresses…</p>}

        {addresses && addresses.length === 0 && !showForm && (
          <div style={{ background: 'white', border: '1px dashed var(--line)', borderRadius: 12, padding: 32, textAlign: 'center' }}>
            <p style={{ color: 'var(--ink-500)', margin: '0 0 16px' }}>No saved addresses yet.</p>
            <button onClick={() => setShowForm(true)} style={{
              padding: '10px 18px', background: 'var(--brand-pink)', color: 'white', border: 'none',
              borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
            }}>
              + Add address
            </button>
          </div>
        )}

        {addresses && addresses.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, marginBottom: 24 }}>
            {addresses.map(addr => (
              <div key={addr.id} style={{
                background: 'white', borderRadius: 12, padding: 20,
                border: addr.is_default ? '2px solid var(--brand-pink)' : '1px solid var(--line)',
                position: 'relative',
              }}>
                {addr.is_default && (
                  <span style={{
                    position: 'absolute', top: 12, right: 12,
                    background: 'var(--brand-pink)', color: 'white',
                    fontSize: '0.6875rem', fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                  }}>DEFAULT</span>
                )}
                <div style={{ fontSize: '0.8125rem', color: 'var(--ink-500)', marginBottom: 4 }}>{addr.label ?? 'Address'}</div>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>{addr.first_name} {addr.last_name}</div>
                <div style={{ fontSize: '0.875rem', color: 'var(--ink-700)', lineHeight: 1.5 }}>
                  {addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}<br />
                  {addr.city}{addr.province ? `, ${addr.province}` : ''} {addr.zip ?? ''}<br />
                  {addr.phone}
                </div>
                <form action={deleteAddress} style={{ marginTop: 12 }}>
                  <input type="hidden" name="id" value={addr.id} />
                  <button type="submit" style={{
                    background: 'none', border: 'none', color: '#ef4444',
                    padding: 0, fontSize: '0.8125rem', cursor: 'pointer',
                  }}>
                    Remove
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {addresses && (
          <button onClick={() => setShowForm(s => !s)} style={{
            padding: '10px 18px', background: showForm ? 'transparent' : 'var(--brand-pink)',
            color: showForm ? 'var(--ink-700)' : 'white',
            border: showForm ? '1px solid var(--line)' : 'none',
            borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', marginBottom: 20,
          }}>
            {showForm ? 'Cancel' : '+ Add another address'}
          </button>
        )}

        {showForm && (
          <div style={{ background: 'white', borderRadius: 12, padding: 24, border: '1px solid var(--line)' }}>
            {state && 'error' in state && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: '0.875rem' }}>
                {state.error}
              </div>
            )}
            <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="addr-label" style={lbl}>Label (e.g. Home, Office)</label>
                <input id="addr-label" name="label" placeholder="Home" style={inp} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="addr-fname" style={lbl}>First Name *</label>
                  <input id="addr-fname" name="first_name" autoComplete="given-name" required style={inp} />
                </div>
                <div>
                  <label htmlFor="addr-lname" style={lbl}>Last Name *</label>
                  <input id="addr-lname" name="last_name" autoComplete="family-name" required style={inp} />
                </div>
              </div>
              <div>
                <label htmlFor="addr-phone" style={lbl}>Phone *</label>
                <input id="addr-phone" name="phone" type="tel" autoComplete="tel" required placeholder="+92 300 1234567" style={inp} />
              </div>
              <div>
                <label htmlFor="addr-line1" style={lbl}>Address Line 1 *</label>
                <input id="addr-line1" name="line1" autoComplete="address-line1" required style={inp} placeholder="House/flat, street" />
              </div>
              <div>
                <label htmlFor="addr-line2" style={lbl}>Address Line 2</label>
                <input id="addr-line2" name="line2" autoComplete="address-line2" style={inp} placeholder="Area, landmark" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label htmlFor="addr-city" style={lbl}>City *</label>
                  <input id="addr-city" name="city" autoComplete="address-level2" required style={inp} />
                </div>
                <div>
                  <label htmlFor="addr-province" style={lbl}>Province</label>
                  <select id="addr-province" name="province" autoComplete="address-level1" style={inp}>
                    <option value="">Select</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="addr-zip" style={lbl}>Postal Code</label>
                  <input id="addr-zip" name="zip" autoComplete="postal-code" inputMode="numeric" style={inp} />
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.875rem', color: 'var(--ink-700)' }}>
                <input type="checkbox" name="is_default" /> Make this my default shipping address
              </label>
              <button type="submit" disabled={pending} style={{
                padding: 12, background: pending ? '#f9a8d4' : 'var(--brand-pink)',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
              }}>
                {pending ? 'Saving…' : 'Save address'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
