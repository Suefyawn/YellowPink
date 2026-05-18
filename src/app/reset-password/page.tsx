'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';
import { LogoWordmark } from '@/components/ui/LogoWordmark';

const inp: React.CSSProperties = {
  width: '100%', padding: '11px 14px',
  border: '1px solid #d1d5db', borderRadius: 8,
  fontSize: '0.9375rem', color: '#111827', background: 'white',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = { display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 5 };

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Supabase redirects with #access_token=...&type=recovery in the hash.
    // The browser client picks this up automatically via onAuthStateChange.
    const sb = getBrowserClient();
    const { data: { subscription } } = sb.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
    // Also check if we already have a session (PKCE code exchange flow).
    sb.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    const sb = getBrowserClient();
    const { error } = await sb.auth.updateUser({ password });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setSuccess(true);
    setTimeout(() => router.push('/account'), 2000);
  };

  if (!ready) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ textDecoration: 'none' }}><LogoWordmark /></Link>
        </div>
        <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', textAlign: 'center' }}>
          <p style={{ color: '#6b7280', fontSize: '0.9375rem' }}>Verifying reset link…</p>
          <p style={{ marginTop: 16, color: '#9ca3af', fontSize: '0.8125rem' }}>
            If nothing happens, your link may have expired.{' '}
            <Link href="/forgot-password" style={{ color: 'var(--brand-pink)', fontWeight: 600 }}>Request a new one</Link>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--cream)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 16px' }}>
      <div style={{ marginBottom: 32 }}>
        <Link href="/" style={{ textDecoration: 'none' }}><LogoWordmark /></Link>
      </div>

      <div style={{ width: '100%', maxWidth: 400, background: 'white', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: 16 }}>✓</div>
            <h1 style={{ margin: '0 0 8px', fontSize: '1.375rem', fontWeight: 700, color: '#111827' }}>Password updated</h1>
            <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>Redirecting you to your account…</p>
          </div>
        ) : (
          <>
            <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Set new password</h1>
            <p style={{ margin: '0 0 28px', color: '#6b7280', fontSize: '0.875rem' }}>Choose a strong password for your account.</p>

            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="reset-password" style={lbl}>New password</label>
                <input id="reset-password" type="password" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} style={inp} placeholder="At least 6 characters" autoComplete="new-password" />
              </div>
              <div>
                <label htmlFor="reset-password-confirm" style={lbl}>Confirm password</label>
                <input id="reset-password-confirm" type="password" required minLength={6} value={confirm} onChange={e => setConfirm(e.target.value)} style={inp} placeholder="Repeat your new password" autoComplete="new-password" />
              </div>
              <button type="submit" disabled={loading} style={{
                padding: '12px', background: loading ? '#f9a8d4' : 'var(--brand-pink)',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}>
                {loading ? '…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
