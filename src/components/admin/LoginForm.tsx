'use client';
import { useActionState } from 'react';
import { loginAdmin } from '@/app/admin/actions';

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAdmin, null);

  return (
    <div style={{
      background: 'white',
      borderRadius: 12,
      padding: '40px 36px',
      width: 360,
      boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 6 }}>
          <span style={{ color: '#ec4899' }}>Yellow</span>
          <span style={{ color: '#111827' }}>Pink</span>
        </div>
        <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Sign in to admin panel</p>
      </div>

      <form action={action}>
        <div style={{ marginBottom: 16 }}>
          <label style={{
            display: 'block',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: '#374151',
            marginBottom: 6,
          }}>
            Password
          </label>
          <input
            type="password"
            name="password"
            placeholder="Enter admin password"
            required
            autoFocus
            style={{
              width: '100%',
              padding: '10px 14px',
              border: `1px solid ${state?.error ? '#ef4444' : '#d1d5db'}`,
              borderRadius: 8,
              fontSize: '0.875rem',
              color: '#111827',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {state?.error && (
            <p style={{ color: '#ef4444', fontSize: '0.8125rem', marginTop: 6, marginBottom: 0 }}>
              {state.error}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={pending}
          style={{
            width: '100%',
            padding: '11px',
            background: pending ? '#9ca3af' : '#ec4899',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s',
          }}
        >
          {pending ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
