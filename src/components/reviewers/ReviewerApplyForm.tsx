'use client';

import { useActionState } from 'react';
import { submitReviewerApplication, type ApplyResult } from '@/app/medical-review-board/apply/actions';

// Public application form for clinicians who want to join the Medical Review
// Board. Submissions land in reviewer_applications (Admin → Reviewers) for the
// owner to vet and approve. Mirrors the contact form's useActionState pattern.

const fieldStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: '#fff', border: '1px solid var(--line)',
  borderRadius: 6, color: 'var(--ink-900)', fontSize: '0.9375rem',
  fontFamily: 'var(--font-ui)', outline: 'none', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--ink-700)',
  marginBottom: 6, fontFamily: 'var(--font-ui)',
};
const hint: React.CSSProperties = { fontSize: '0.75rem', color: 'var(--ink-500)', marginTop: 4 };

export function ReviewerApplyForm() {
  const [state, formAction, pending] = useActionState<ApplyResult | null, FormData>(
    submitReviewerApplication, null,
  );
  const success = state?.ok;
  const error = state && !state.ok ? state.error : null;

  if (success) {
    return (
      <div role="status" aria-live="polite" style={{
        padding: '20px 22px', background: '#f0fdf4', border: '1px solid #bbf7d0',
        borderRadius: 10, color: '#166534',
      }}>
        <strong style={{ display: 'block', marginBottom: 6, fontSize: '1rem' }}>Thank you — application received.</strong>
        We review every application personally and verify credentials before approving. If it&apos;s a fit,
        we&apos;ll email you a sign-in link to your reviewer dashboard.
      </div>
    );
  }

  return (
    <form action={formAction} style={{ display: 'grid', gap: 16, maxWidth: 620 }}>
      <div>
        <label htmlFor="r-name" style={labelStyle}>Full name *</label>
        <input id="r-name" name="name" required style={fieldStyle} placeholder="Dr. Ayesha Khan" />
      </div>
      <div>
        <label htmlFor="r-email" style={labelStyle}>Email *</label>
        <input id="r-email" name="email" type="email" required style={fieldStyle} placeholder="you@hospital.pk" />
        <p style={hint}>Used for your sign-in link if approved.</p>
      </div>
      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        <div>
          <label htmlFor="r-cred" style={labelStyle}>Credentials</label>
          <input id="r-cred" name="credentials" style={fieldStyle} placeholder="MBBS, FCPS (Gynaecology)" />
        </div>
        <div>
          <label htmlFor="r-pmdc" style={labelStyle}>PMDC reg. number</label>
          <input id="r-pmdc" name="pmdc_number" style={fieldStyle} placeholder="e.g. 12345-P" />
        </div>
      </div>
      <div>
        <label htmlFor="r-spec" style={labelStyle}>Specialty</label>
        <input id="r-spec" name="specialty" style={fieldStyle} placeholder="Obstetrics &amp; Gynaecology" />
      </div>
      <div>
        <label htmlFor="r-topics" style={labelStyle}>Topics you can review</label>
        <input id="r-topics" name="review_topics" style={fieldStyle} placeholder="Women's Health, Fertility, Supplements" />
        <p style={hint}>Comma-separated. Helps us match you to relevant articles.</p>
      </div>
      <div>
        <label htmlFor="r-profile" style={labelStyle}>Verifiable profile link</label>
        <input id="r-profile" name="profile_url" type="url" style={fieldStyle} placeholder="PMDC / hospital page / LinkedIn" />
        <p style={hint}>Helps us verify you — and becomes your public profile link if approved.</p>
      </div>
      <div>
        <label htmlFor="r-bio" style={labelStyle}>Short bio</label>
        <textarea id="r-bio" name="bio" rows={3} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="A line or two about your practice and experience." />
      </div>
      <div>
        <label htmlFor="r-msg" style={labelStyle}>Anything else?</label>
        <textarea id="r-msg" name="message" rows={2} style={{ ...fieldStyle, resize: 'vertical' }} placeholder="Optional" />
      </div>

      {error && <p role="alert" style={{ color: 'var(--error)', fontSize: '0.875rem', margin: 0 }}>{error}</p>}

      <div>
        <button type="submit" disabled={pending} className="btn-primary" style={{ padding: '12px 28px', minHeight: 46 }}>
          {pending ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
      <p style={{ ...hint, marginTop: 0 }}>
        Reviewers are volunteers and must be real, currently-registered clinicians. We verify every applicant.
      </p>
    </form>
  );
}
