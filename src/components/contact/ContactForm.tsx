'use client';

import { useActionState } from 'react';
import { submitContactMessage, type ContactState } from '@/app/contact/actions';

// Storefront contact form, rendered on /page/contact (see app/page/[slug]).
// Submissions land in the contact_messages table (Admin → Messages) and are
// forwarded to the owner via Resend. Mirrors the newsletter form's
// useActionState pattern.

const fieldStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 13px',
  background: '#fff',
  border: '1px solid var(--line)',
  borderRadius: 6,
  color: 'var(--ink-900)',
  fontSize: '0.9375rem',
  fontFamily: 'var(--font-ui)',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: 'var(--ink-700)',
  marginBottom: 6,
  fontFamily: 'var(--font-ui)',
};

// Routes the message in Admin → Messages (folded into the subject server-side).
const TOPICS = [
  'General question',
  'Order help',
  'Product question',
  'Returns & refunds',
  'Wholesale / bulk order',
  'Something else',
];

export function ContactForm() {
  const [state, formAction, pending] = useActionState<ContactState, FormData>(
    submitContactMessage,
    null,
  );

  const success = state && 'ok' in state && state.ok;
  const error = state && 'ok' in state && !state.ok ? state.error : null;

  if (success) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          padding: '18px 20px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          borderRadius: 'var(--radius-card)',
          color: 'var(--success)',
          fontSize: '0.9375rem',
          lineHeight: 1.55,
          fontFamily: 'var(--font-ui)',
        }}
      >
        Thanks for reaching out, we&apos;ve got your message and will reply by
        email, usually within one working day.
      </div>
    );
  }

  return (
    <form action={formAction} aria-label="Contact form" noValidate>
      {/* Honeypot, hidden from real users; bots fill it and get a silent no-op. */}
      <input
        type="text" name="website" tabIndex={-1} autoComplete="off"
        aria-hidden="true"
        style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }}
      />

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="contact-topic" style={labelStyle}>What&apos;s it about?</label>
        <select
          id="contact-topic" name="topic" defaultValue="General question"
          style={{ ...fieldStyle, appearance: 'auto', cursor: 'pointer' }}
        >
          {TOPICS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label htmlFor="contact-name" style={labelStyle}>Your name</label>
          <input id="contact-name" type="text" name="name" required maxLength={120}
            autoComplete="name" style={fieldStyle} />
        </div>
        <div>
          <label htmlFor="contact-email" style={labelStyle}>Email</label>
          <input id="contact-email" type="email" name="email" required maxLength={254}
            autoComplete="email" placeholder="your@email.com"
            aria-invalid={Boolean(error)} style={fieldStyle} />
        </div>
      </div>

      <div style={{ marginTop: 16, display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <div>
          <label htmlFor="contact-subject" style={labelStyle}>Subject <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>(optional)</span></label>
          <input id="contact-subject" type="text" name="subject" maxLength={200}
            placeholder="A short summary" style={fieldStyle} />
        </div>
        <div>
          <label htmlFor="contact-order" style={labelStyle}>Order number <span style={{ fontWeight: 400, color: 'var(--ink-500)' }}>(if relevant)</span></label>
          <input id="contact-order" type="text" name="orderNumber" maxLength={40}
            placeholder="e.g. YP-1234" autoComplete="off" style={fieldStyle} />
        </div>
      </div>

      <div style={{ marginTop: 16 }}>
        <label htmlFor="contact-message" style={labelStyle}>Message</label>
        <textarea id="contact-message" name="message" required maxLength={5000} rows={6}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? 'contact-error' : undefined}
          style={{ ...fieldStyle, resize: 'vertical', lineHeight: 1.5 }} />
      </div>

      {error && (
        <div id="contact-error" role="alert"
          style={{ marginTop: 12, fontSize: '0.875rem', color: 'var(--error)' }}>
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        style={{
          marginTop: 20, padding: '12px 28px',
          background: 'var(--brand-pink-cta)', border: 'none', borderRadius: 6,
          color: '#fff', fontSize: '0.8125rem', fontWeight: 600,
          letterSpacing: '0.06em', textTransform: 'uppercase',
          cursor: pending ? 'wait' : 'pointer', opacity: pending ? 0.7 : 1,
          fontFamily: 'var(--font-ui)', transition: 'opacity 150ms',
        }}
      >{pending ? 'Sending…' : 'Send message'}</button>
    </form>
  );
}
