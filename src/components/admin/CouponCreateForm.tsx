'use client';

import { startTransition, useActionState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createCoupon } from '@/app/admin/coupon-actions';

const inp: React.CSSProperties = {
  padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
  fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4,
};

// Inline "Create Coupon" form. Client component so a rejected create (missing
// value, duplicate code, …) comes back as useActionState state and the fields
// the admin typed survive; the old server-form version bounced errors via
// redirect, which re-rendered the page and wiped the form. Success still
// redirects to /admin/coupons?created=<code> (page banner).
export function CouponCreateForm() {
  const [state, action, pending] = useActionState(createCoupon, null);
  const formRef = useRef<HTMLFormElement>(null);
  const searchParams = useSearchParams();
  const created = searchParams.get('created');

  // Manual dispatch keeps the uncontrolled fields intact when the action
  // settles with an error (React 19 resets them on `action`-prop submits).
  // That also means nothing clears the form after a SUCCESSFUL create, so
  // reset it ourselves when the ?created= flash lands.
  useEffect(() => {
    if (created) formRef.current?.reset();
  }, [created]);

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Create Coupon</h2>
      {state?.error && (
        <div role="alert" style={{
          marginBottom: 14, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
        }}>
          {state.error}
        </div>
      )}
      <form
        ref={formRef}
        onSubmit={e => {
          e.preventDefault();
          const formData = new FormData(e.currentTarget);
          startTransition(() => action(formData));
        }}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}
      >
        <div>
          <label style={lbl}>Code</label>
          <input name="code" required placeholder="SAVE10" style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace', width: 120 }} />
        </div>
        <div>
          <label style={lbl}>Type</label>
          <select name="type" style={inp}>
            <option value="percent">Percent %</option>
            <option value="fixed">Fixed PKR</option>
            <option value="free_shipping">Free shipping</option>
          </select>
        </div>
        <div>
          <label style={lbl}>Value</label>
          {/* Not `required`: free-shipping coupons carry no value (the
              action validates it for percent/fixed instead). */}
          <input name="value" type="number" min={1} placeholder="10" style={{ ...inp, width: 80 }} />
        </div>
        <div>
          <label style={lbl}>Min Order (PKR)</label>
          <input name="min_order" type="number" min={0} defaultValue={0} placeholder="0" style={{ ...inp, width: 100 }} />
        </div>
        <div>
          <label style={lbl}>Max Uses</label>
          <input name="max_uses" type="number" min={1} placeholder="Unlimited" style={{ ...inp, width: 100 }} />
        </div>
        <div>
          <label style={lbl}>Starts</label>
          <input name="starts_at" type="date" title="Scheduled: the code only works from this day (blank = right away)" style={inp} />
        </div>
        <div>
          <label style={lbl}>Expires</label>
          <input name="expires_at" type="date" style={inp} />
        </div>
        <button type="submit" disabled={pending} style={{
          padding: '8px 20px', background: pending ? '#9ca3af' : '#C5286A', color: 'white',
          border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600,
          cursor: pending ? 'not-allowed' : 'pointer',
        }}>
          {pending ? 'Creating…' : '+ Create'}
        </button>

        {/* Targeting options every coupon supports at checkout (place_order
            enforces them); collapsed so the quick percent-off path stays a
            one-line form. Product scoping lives in the Edit dialog. */}
        <details style={{ width: '100%', marginTop: 2 }}>
          <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280' }}>
            Advanced — per-customer limit, order cap, email restrictions
          </summary>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 12, alignItems: 'flex-start' }}>
            <div>
              <label style={lbl}>Uses per customer</label>
              <input name="usage_limit_per_user" type="number" min={1} placeholder="Unlimited" style={{ ...inp, width: 110 }} />
            </div>
            <div>
              <label style={lbl}>Max order (PKR)</label>
              <input name="max_order" type="number" min={1} placeholder="No cap" style={{ ...inp, width: 110 }} />
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label style={lbl}>Restrict to emails</label>
              <input name="email_restrictions" placeholder="someone@mail.com, *@company.pk" style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
            <div style={{ flex: '1 1 260px' }}>
              <label style={lbl}>Internal note</label>
              <input name="description" placeholder="e.g. Eid campaign, influencer batch 3" style={{ ...inp, width: '100%', boxSizing: 'border-box' }} />
            </div>
          </div>
        </details>
      </form>
    </div>
  );
}
