'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserClient } from '@/lib/supabase-browser';

// Magic-link sign-in for approved Medical Review Board doctors. We never create
// a user here (shouldCreateUser:false), accounts are provisioned only when the
// owner approves an application, so a stranger's email simply gets no link.
// Supabase returns success either way (no email enumeration), so the UI always
// shows the same "check your inbox" state.

export default function ReviewerLoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(clean)) { setStatus('error'); setMsg('Please enter a valid email address.'); return; }
    setStatus('sending'); setMsg('');
    const sb = getBrowserClient();
    const { error } = await sb.auth.signInWithOtp({
      email: clean,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/reviewer`,
      },
    });
    if (error) { setStatus('error'); setMsg(error.message); return; }
    setStatus('sent');
  };

  return (
    <main className="fade-in">
      <section style={{ padding: '72px var(--side)' }}>
        <div className="container" style={{ maxWidth: 440, margin: '0 auto' }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.875rem', fontWeight: 500, letterSpacing: '-0.025em', margin: '0 0 8px' }}>
            Reviewer sign in
          </h1>
          <p className="body-text" style={{ color: 'var(--ink-700)', lineHeight: 1.6, marginBottom: 28 }}>
            Enter the email on your approved application and we&rsquo;ll send you a one-time sign-in link.
          </p>

          {status === 'sent' ? (
            <div role="status" aria-live="polite" style={{ padding: '18px 20px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, color: '#166534' }}>
              <strong style={{ display: 'block', marginBottom: 4 }}>Check your inbox.</strong>
              If <strong>{email.trim().toLowerCase()}</strong> is an approved reviewer, a sign-in link is on its way.
              The link opens your dashboard, no password needed.
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'grid', gap: 14 }}>
              <div>
                <label htmlFor="rv-email" style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)', marginBottom: 6 }}>Email</label>
                <input
                  id="rv-email" type="email" autoComplete="email" inputMode="email" required
                  value={email} onChange={e => setEmail(e.target.value)} disabled={status === 'sending'}
                  placeholder="you@hospital.pk"
                  style={{ width: '100%', padding: '11px 13px', background: '#fff', border: '1px solid var(--line)', borderRadius: 6, fontSize: '0.9375rem', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
              {status === 'error' && <p role="alert" style={{ color: 'var(--error)', fontSize: '0.875rem', margin: 0 }}>{msg}</p>}
              <button type="submit" disabled={status === 'sending'} className="btn-primary" style={{ padding: '12px 24px', minHeight: 46 }}>
                {status === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
          )}

          <p className="small-text" style={{ color: 'var(--ink-500)', marginTop: 28, lineHeight: 1.6 }}>
            Not a reviewer yet? <Link href="/medical-review-board/apply" style={{ color: 'var(--brand-pink-text, #9d174d)', fontWeight: 600 }}>Apply to join the board</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
