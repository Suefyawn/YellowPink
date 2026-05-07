'use client';
import { useActionState } from 'react';
import { changeMyPassword } from '@/app/admin/team/actions';

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};

export function ProfilePage({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState(changeMyPassword, null);

  return (
    <div style={{ padding: '32px 36px', maxWidth: 480 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>My Profile</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: '0.875rem' }}>Manage your account settings</p>

      {/* Info card */}
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #e5e7eb',
        padding: '24px', marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{
            width: 52, height: 52, borderRadius: '50%', background: '#eef2ff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6366f1', fontWeight: 700, fontSize: '1.25rem',
          }}>
            {name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#111827' }}>{name}</div>
            <div style={{ color: '#6b7280', fontSize: '0.875rem' }}>{email}</div>
            <div style={{
              display: 'inline-block', marginTop: 4,
              background: '#eef2ff', color: '#6366f1',
              borderRadius: 4, padding: '2px 8px', fontSize: '0.75rem', fontWeight: 600,
            }}>
              Manager
            </div>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div style={{
        background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '24px',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
          Change Password
        </h2>

        {state && 'success' in state && (
          <div style={{
            background: '#dcfce7', border: '1px solid #86efac', borderRadius: 8,
            padding: '12px 16px', marginBottom: 16, color: '#166534', fontSize: '0.875rem', fontWeight: 600,
          }}>
            ✓ Password updated successfully
          </div>
        )}

        <form action={action} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={lbl}>Current Password</label>
            <input type="password" name="current_password" required style={inp} />
          </div>
          <div>
            <label style={lbl}>New Password</label>
            <input type="password" name="new_password" required minLength={8} style={inp} />
            <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>Minimum 8 characters</p>
          </div>
          <div>
            <label style={lbl}>Confirm New Password</label>
            <input type="password" name="confirm_password" required style={inp} />
          </div>

          {state && 'error' in state && (
            <p style={{ margin: 0, color: '#ef4444', fontSize: '0.8125rem' }}>{state.error}</p>
          )}

          <button type="submit" disabled={pending} style={{
            padding: '10px 20px', background: '#6366f1', color: 'white',
            border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.9375rem',
            cursor: pending ? 'not-allowed' : 'pointer', opacity: pending ? 0.6 : 1,
            alignSelf: 'flex-start',
          }}>
            {pending ? 'Updating…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
