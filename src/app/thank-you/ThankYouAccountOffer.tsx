'use client';

// Post-purchase account offer (the Shopify-style "save your information for
// next time" moment). Checkout stays guest-first — this card appears only
// AFTER the sale, when we already hold the buyer's email from the order, so
// creating an account is one password field away and can't cost a conversion.
//
// Flow: signUp with the order's email → Supabase sends the confirmation
// link → /auth/confirm?next=/account/orders exchanges it for a session and
// lands on the orders page, whose claim_guest_orders() call folds this (and
// any past) guest orders into the fresh account. If the email already has an
// account we don't leak anything new — the visitor is looking at their own
// order confirmation — we just point them at sign-in instead.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';
import { Overline } from '@/components/ui/Overline';
import { sendSignupWelcomeEmail } from '@/app/login/actions';

export function ThankYouAccountOffer({ email }: { email: string }) {
  // 'checking' → session probe in flight; hide until we know the visitor is
  // actually a guest so signed-in customers never see a signup form.
  const [state, setState] = useState<'checking' | 'guest' | 'signed-in' | 'done' | 'exists'>('checking');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getBrowserClient().auth.getUser()
      .then(({ data }) => { if (!cancelled) setState(data.user ? 'signed-in' : 'guest'); })
      .catch(() => { if (!cancelled) setState('guest'); });
    return () => { cancelled = true; };
  }, []);

  if (state === 'checking' || state === 'signed-in') return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const sb = getBrowserClient();
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=${encodeURIComponent('/account/orders')}` },
      });
      if (error) {
        if (/already registered|already exists/i.test(error.message)) { setState('exists'); return; }
        setError(error.message || 'We couldn’t create your account. Please try again.');
        return;
      }
      // Supabase quirk: signUp for an existing confirmed email doesn't error —
      // it returns a user with no identities. Treat it as "account exists".
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setState('exists');
        return;
      }
      if (data.user) void sendSignupWelcomeEmail(data.user.id);
      setState('done');
    } catch (err) {
      setError((err as Error).message?.includes('fetch') ? 'Network hiccup — please try again.' : 'We couldn’t create your account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const card: React.CSSProperties = {
    padding: 20,
    background: 'var(--paper2)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius-card)',
    textAlign: 'left',
    maxWidth: 480,
    margin: '0 auto 24px',
  };

  if (state === 'done') {
    return (
      <div style={card}>
        <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>Almost there</Overline>
        <p className="small-text" style={{ margin: 0, color: 'var(--ink-700)' }}>
          Account created! Check <strong>{email}</strong> for a confirmation link — once you confirm,
          this order (and any previous ones) will be waiting in your account.
        </p>
      </div>
    );
  }

  if (state === 'exists') {
    return (
      <div style={card}>
        <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>Welcome back</Overline>
        <p className="small-text" style={{ marginBottom: 12, color: 'var(--ink-700)' }}>
          <strong>{email}</strong> already has an account — sign in and this order will appear in your history.
        </p>
        <Link href="/login" className="btn-secondary" style={{ display: 'inline-block' }}>Sign in</Link>
      </div>
    );
  }

  return (
    <div style={card}>
      <Overline style={{ display: 'block', marginBottom: 6, color: 'var(--brand-pink-text)' }}>
        Save your details for next time
      </Overline>
      <p className="small-text" style={{ marginBottom: 12, color: 'var(--ink-700)' }}>
        Create an account with <strong>{email}</strong> — track this order, check out faster next time,
        and earn loyalty points on every purchase. Just pick a password.
      </p>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px' }}>
          <div style={{ position: 'relative' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Choose a password"
            minLength={6}
            required
            autoComplete="new-password"
            aria-label="Choose a password"
            aria-describedby="tyao-password-hint"
            style={{
              width: '100%', padding: '10px 40px 10px 12px', fontSize: '0.875rem',
              border: '1px solid var(--line)', borderRadius: 8, background: 'white',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(s => !s)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', padding: 4,
              color: 'var(--ink-500)', fontSize: '0.75rem', fontWeight: 600,
            }}
          >
            {showPassword ? 'Hide' : 'Show'}
          </button>
          </div>
          <p id="tyao-password-hint" className="small-text" style={{ margin: '6px 0 0', color: 'var(--ink-500)' }}>
            Minimum 6 characters.
          </p>
        </div>
        <button type="submit" className="btn-primary" disabled={loading} style={{ flexShrink: 0 }}>
          {loading ? 'Creating…' : 'Create account'}
        </button>
      </form>
      {error && (
        <p className="small-text" role="alert" style={{ margin: '10px 0 0', color: '#b91c1c' }}>{error}</p>
      )}
    </div>
  );
}
