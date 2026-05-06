'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { getBrowserClient } from '@/lib/supabase-browser';
import type { Profile } from '@/types';

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.9375rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 };

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) { router.replace('/login'); return; }
    if (!user) return;
    const sb = getBrowserClient();
    sb.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
      const profile = data as Profile | null;
      if (profile) {
        setFirstName(profile.first_name ?? '');
        setLastName(profile.last_name ?? '');
        setPhone(profile.phone ?? '');
      }
    });
  }, [user, loading, router]);

  if (loading || !user) {
    return <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>Loading…</div>;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    const sb = getBrowserClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('profiles') as any).upsert({
      id: user.id,
      first_name: firstName || null,
      last_name: lastName || null,
      phone: phone || null,
    });
    if (error) { setError(error.message); }
    else { setSuccess(true); }
    setSaving(false);
  };

  return (
    <div className="container" style={{ padding: '48px var(--side)' }}>
      <div style={{ maxWidth: 520, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <Link href="/account" style={{ color: 'var(--ink-500)', textDecoration: 'none', fontSize: '0.875rem' }}>← Account</Link>
          <span style={{ color: 'var(--line)' }}>/</span>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 500 }}>Profile</h1>
        </div>

        <div style={{ background: 'white', borderRadius: 16, padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid var(--line)' }}>
          <div style={{ marginBottom: 24, padding: '12px 16px', background: 'var(--cream)', borderRadius: 8, fontSize: '0.875rem', color: 'var(--ink-500)' }}>
            Email: <strong style={{ color: 'var(--ink-900)' }}>{user.email}</strong>
          </div>

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
              {error}
            </div>
          )}
          {success && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#16a34a', fontSize: '0.875rem' }}>
              Profile saved successfully.
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>First Name</label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inp} placeholder="Aisha" />
              </div>
              <div>
                <label style={lbl}>Last Name</label>
                <input value={lastName} onChange={e => setLastName(e.target.value)} style={inp} placeholder="Khan" />
              </div>
            </div>
            <div>
              <label style={lbl}>Phone Number</label>
              <input value={phone} onChange={e => setPhone(e.target.value)} style={inp} placeholder="+92 300 1234567" type="tel" />
            </div>
            <button type="submit" disabled={saving} style={{
              padding: '12px', background: saving ? '#f9a8d4' : 'var(--brand-pink)',
              color: 'white', border: 'none', borderRadius: 8,
              fontSize: '0.9375rem', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', marginTop: 4,
            }}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
