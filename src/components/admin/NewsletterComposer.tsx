'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/Toast';
import { sendNewsletterCampaign, saveNewsletterDraft, deleteNewsletterDraft, previewNewsletterCampaign } from '@/app/admin/newsletter/actions';
import { fmtDatePK as fmtDate } from '@/lib/dates';

export interface NewsletterDraft {
  id: string;
  subject: string;
  body: string;
  created_at: string;
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 12px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: '0.875rem', fontFamily: 'inherit',
  color: '#111827', outline: 'none', boxSizing: 'border-box',
};

export function NewsletterComposer({ activeCount, customerCount = 0, bothCount = 0, drafts = [] }: {
  activeCount: number;
  /** Distinct order emails that have not unsubscribed. */
  customerCount?: number;
  /** Union of subscribers + customers, deduped. */
  bothCount?: number;
  drafts?: NewsletterDraft[];
}) {
  const [audience, setAudience] = useState<'subscribers' | 'customers' | 'both'>('subscribers');
  const audienceCount = audience === 'subscribers' ? activeCount : audience === 'customers' ? customerCount : bothCount;
  const audienceLabel = audience === 'subscribers' ? 'subscribers' : audience === 'customers' ? 'customers' : 'people (subscribers + customers)';
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  // Which saved draft the composer currently holds. Sending or saving keeps
  // targeting this row; "start fresh" is just clearing the form.
  const [draftId, setDraftId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toast = useToast();
  const router = useRouter();

  const clearForm = () => { setSubject(''); setBody(''); setDraftId(null); };

  const loadDraft = (d: NewsletterDraft) => {
    setSubject(d.subject);
    setBody(d.body);
    setDraftId(d.id);
  };

  const handleSaveDraft = () => {
    if (pending) return;
    if (!subject.trim() || !body.trim()) {
      toast('Add a subject and a body first.', 'error');
      return;
    }
    startTransition(async () => {
      const res = await saveNewsletterDraft(draftId, subject.trim(), body.trim());
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      setDraftId(res.id);
      toast('Draft saved.', 'success');
      router.refresh();
    });
  };

  const handleDeleteDraft = (d: NewsletterDraft) => {
    if (pending) return;
    if (!window.confirm(`Delete the draft "${d.subject}"?`)) return;
    startTransition(async () => {
      const res = await deleteNewsletterDraft(d.id);
      if (!res.ok) {
        toast(res.error ?? 'Could not delete the draft.', 'error');
        return;
      }
      if (draftId === d.id) clearForm();
      toast('Draft deleted.', 'success');
      router.refresh();
    });
  };

  const handleSend = () => {
    if (pending) return;
    if (!subject.trim() || !body.trim()) {
      toast('Add a subject and a body first.', 'error');
      return;
    }
    if (audienceCount === 0) {
      toast('There is nobody in that audience to send to.', 'error');
      return;
    }
    if (!window.confirm(
      `Send "${subject.trim()}" to ${audienceCount} ${audienceLabel}?\n\nThis sends real emails and can't be undone.`,
    )) return;

    startTransition(async () => {
      const res = await sendNewsletterCampaign(subject.trim(), body.trim(), draftId ?? undefined, audience);
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      if (res.sentCount === 0) {
        toast('Sent to 0 recipients, check the email (Resend) setup.', 'error');
      } else {
        toast(`Sent to ${res.sentCount} of ${res.recipientCount} recipient${res.recipientCount === 1 ? '' : 's'}.`, 'success');
        clearForm();
      }
      router.refresh();
    });
  };

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '20px 24px', marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Compose newsletter</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Pick who receives it below. Leave a blank line between paragraphs; web links (https://…)
        become clickable automatically. Yellow Pink branding and an unsubscribe link are added for
        you. Save a draft to come back to it later. Nothing sends until you press Send.
      </p>

      {drafts.length > 0 && (
        <div style={{ marginBottom: 16, border: '1px solid #fbcfe8', background: '#fdf2f8', borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#9d174d', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
            Drafts
          </div>
          {drafts.map(d => (
            <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '4px 0' }}>
              <span style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: draftId === d.id ? 700 : 500 }}>
                {d.subject}
              </span>
              <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{fmtDate(d.created_at)}</span>
              <button
                type="button"
                onClick={() => loadDraft(d)}
                disabled={pending}
                style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #f9a8d4', background: 'white', color: '#9d174d', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                {draftId === d.id ? 'Loaded' : 'Open'}
              </button>
              <button
                type="button"
                onClick={() => handleDeleteDraft(d)}
                disabled={pending}
                style={{ padding: '2px 10px', borderRadius: 6, border: '1px solid #e5e7eb', background: 'white', color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer' }}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <label style={{ display: 'block', marginBottom: 14 }}>
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Subject</span>
        <input
          type="text"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          maxLength={200}
          placeholder="e.g. New arrivals + a little something for you"
          style={inputStyle}
        />
      </label>

      <label style={{ display: 'block', marginBottom: 16 }}>
        <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Body</span>
        <textarea
          value={body}
          onChange={e => setBody(e.target.value)}
          maxLength={20000}
          rows={12}
          placeholder={'Hi there,\n\nHere’s what’s new this fortnight…\n\nShop the latest: https://yellow-pink.vercel.app/shop'}
          style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
        />
        <span style={{ display: 'block', marginTop: 6, fontSize: '0.6875rem', color: '#9ca3af', lineHeight: 1.6 }}>
          Branded blocks (each on its own paragraph): <code># Big headline</code> · <code>[[code:AZADI14]]</code> ·{' '}
          <code>[[products:slug-one,slug-two]]</code> (live product cards with image and price) ·{' '}
          <code>[[button:Shop the sale|/shop]]</code>. Everything else sends as styled paragraphs. Use Preview to see the real email.
        </span>
      </label>

      {previewHtml && (
        <div style={{ marginBottom: 16, border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Preview — exactly what recipients get</span>
            <button onClick={() => setPreviewHtml(null)} style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>close</button>
          </div>
          <iframe title="Email preview" srcDoc={previewHtml} style={{ width: '100%', height: 560, border: 'none', display: 'block', background: '#FAF6EE' }} />
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: '#374151' }}>
          Send to
          <select
            value={audience}
            onChange={e => setAudience(e.target.value as typeof audience)}
            style={{ padding: '9px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem', background: 'white' }}
          >
            <option value="subscribers">Subscribers ({activeCount})</option>
            <option value="customers">Customers ({customerCount})</option>
            <option value="both">Both, deduped ({bothCount})</option>
          </select>
        </label>
        <button
          onClick={handleSend}
          disabled={pending || audienceCount === 0}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: pending || audienceCount === 0 ? '#9ca3af' : '#C5286A',
            color: 'white', fontSize: '0.875rem', fontWeight: 600,
            cursor: pending || audienceCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Working…' : `Send to ${audienceCount} ${audience === 'both' ? 'people' : audience}`}
        </button>
        <button
          onClick={async () => {
            if (!body.trim()) { toast('Type a body first.', 'error'); return; }
            setPreviewing(true);
            const res = await previewNewsletterCampaign(body.trim()).catch(() => ({ ok: false as const, error: 'Preview failed.' }));
            setPreviewing(false);
            if (res.ok && 'html' in res && res.html) setPreviewHtml(res.html);
            else toast(('error' in res && res.error) || 'Preview failed.', 'error');
          }}
          disabled={pending || previewing}
          style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid #d1d5db', background: 'white',
            color: '#374151', fontSize: '0.875rem', fontWeight: 600,
            cursor: pending || previewing ? 'not-allowed' : 'pointer',
          }}
        >
          {previewing ? 'Rendering…' : 'Preview'}
        </button>
        <button
          onClick={handleSaveDraft}
          disabled={pending}
          style={{
            padding: '10px 20px', borderRadius: 8,
            border: '1px solid #d1d5db', background: 'white',
            color: '#374151', fontSize: '0.875rem', fontWeight: 600,
            cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {draftId ? 'Update draft' : 'Save as draft'}
        </button>
        {draftId && (
          <button
            onClick={clearForm}
            disabled={pending}
            style={{ padding: '10px 12px', borderRadius: 8, border: 'none', background: 'transparent', color: '#6b7280', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
          >
            Start fresh
          </button>
        )}
        {pending && (
          <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Working, this can take a few seconds.</span>
        )}
      </div>
    </div>
  );
}
