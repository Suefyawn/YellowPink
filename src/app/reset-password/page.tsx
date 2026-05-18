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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  // Live validation hints: surface mismatches as the user types instead of
  // waiting for submit. We only flag mismatch once the confirm field has
  // some content, so the user isn't yelled at on first keystroke.
  const tooShort = password.length > 0 && password.length < 6;
  const mismatch = confirm.length > 0 && password !== confirm;

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
    try {
      const { error } = await sb.auth.updateUser({ password });
      if (error) { setError(error.message); return; }
      setSuccess(true);
      setTimeout(() => router.push('/account'), 2000);
    } catch (err) {
      setError((err as Error).message || 'Could not update password. Try again.');
    } finally {
      setLoading(false);
    }
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

            <div aria-live="polite" aria-atomic="true">
              {error && (
                <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '10px 14px', marginBottom: 20, color: '#dc2626', fontSize: '0.875rem' }}>
                  {error}
                </div>
              )}
            </div>

            <form onSubmit={handleSubmit} aria-busy={loading} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label htmlFor="reset-password" style={lbl}>New password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={{ ...inp, paddingRight: 44, borderColor: tooShort ? '#fca5a5' : '#d1d5db' }}
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                    aria-invalid={tooShort}
                    aria-describedby="reset-password-hint"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    style={{
                      position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontSize: '0.75rem', fontWeight: 600, color: '#6b7280',
                      padding: '4px 8px', borderRadius: 6,
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
                {tooShort && (
                  <div id="reset-password-hint" style={{ marginTop: 6, fontSize: '0.75rem', color: '#dc2626' }}>
                    Use at least 6 characters.
                  </div>
                )}
              </div>
              <div>
                <label htmlFor="reset-password-confirm" style={lbl}>Confirm password</label>
                <input
                  id="reset-password-confirm"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  style={{ ...inp, borderColor: mismatch ? '#fca5a5' : '#d1d5db' }}
                  placeholder="Repeat your new password"
                  autoComplete="new-password"
                  aria-invalid={mismatch}
                  aria-describedby="reset-password-confirm-hint"
                />
                <div
                  id="reset-password-confirm-hint"
                  style={{
                    marginTop: 6, fontSize: '0.75rem',
                    color: mismatch ? '#dc2626' : confirm.length > 0 && !mismatch ? '#16a34a' : 'var(--ink-500)',
                  }}
                >
                  {mismatch
                    ? 'Passwords do not match.'
                    : confirm.length > 0 && !mismatch
                    ? '✓ Passwords match'
                    : 'Type the same password again.'}
                </div>
              </div>
              <button type="submit" disabled={loading || tooShort || mismatch || confirm.length === 0} style={{
                padding: '12px',
                background: (loading || tooShort || mismatch || confirm.length === 0) ? '#f9a8d4' : 'var(--brand-pink)',
                color: 'white', border: 'none', borderRadius: 8,
                fontSize: '0.9375rem', fontWeight: 600,
                cursor: (loading || tooShort || mismatch || confirm.length === 0) ? 'not-allowed' : 'pointer',
                marginTop: 4,
              }}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
