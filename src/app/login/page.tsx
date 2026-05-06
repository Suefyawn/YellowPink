'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';
import { LogoWordmark } from '@/components/ui/LogoWordmark';

type Mode = 'login' | 'signup';

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.9375rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 };

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    const sb = getBrowserClient();

    if (mode === 'login') {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      router.push('/account');
    } else {
      const { error } = await sb.auth.signUp({ email, password });
      if (error) { setError(error.message); setLoading(false); return; }
      setMessage('Account created! Check your email to confirm your address.');
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <LogoWordmark />
        </Link>
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>
          {mode === 'login' ? 'Sign in' : 'Create account'}
        </h1>
        <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.875rem' }}>
          {mode === 'login' ? 'Welcome back to YellowPink' : 'Join YellowPink for a better experience'}
        </p>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}
        {message && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#16a34a', fontSize: '0.875rem' }}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={lbl}>Email address</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={inp} placeholder="you@example.com" autoComplete="email" />
          </div>
          <div>
            <label style={lbl}>Password</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="••••••••" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} />
          </div>
          <button type="submit" disabled={loading} style={{
            padding: '12px', background: loading ? '#f9a8d4' : 'var(--brand-pink)',
            color: 'white', border: 'none', borderRadius: 8,
            fontSize: '0.9375rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}>
            {loading ? '…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <div style={{ marginTop: 24, textAlign: 'center', fontSize: '0.875rem', color: '#6b7280' }}>
          {mode === 'login' ? (
            <>Don&apos;t have an account?{' '}
              <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-pink)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Sign up
              </button>
            </>
          ) : (
            <>Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }} style={{ background: 'none', border: 'none', color: 'var(--brand-pink)', fontWeight: 600, cursor: 'pointer', fontSize: '0.875rem' }}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/track" style={{ fontSize: '0.8125rem', color: '#9ca3af', textDecoration: 'none' }}>
            Track an order without signing in →
          </Link>
        </div>
      </div>
    </div>
  );
}
