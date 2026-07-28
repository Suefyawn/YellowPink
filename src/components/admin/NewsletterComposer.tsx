'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/Toast';
import { sendNewsletterCampaign, saveNewsletterDraft, deleteNewsletterDraft } from '@/app/admin/newsletter/actions';
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

export function NewsletterComposer({ activeCount, drafts = [] }: { activeCount: number; drafts?: NewsletterDraft[] }) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
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
    if (activeCount === 0) {
      toast('There are no active subscribers to send to.', 'error');
      return;
    }
    if (!window.confirm(
      `Send "${subject.trim()}" to ${activeCount} subscriber${activeCount === 1 ? '' : 's'}?\n\nThis sends real emails and can't be undone.`,
    )) return;

    startTransition(async () => {
      const res = await sendNewsletterCampaign(subject.trim(), body.trim(), draftId ?? undefined);
      if (!res.ok) {
        toast(res.error, 'error');
        return;
      }
      if (res.sentCount === 0) {
        toast('Sent to 0 subscribers, check the email (Resend) setup.', 'error');
      } else {
        toast(`Newsletter sent to ${res.sentCount} of ${res.recipientCount} subscriber${res.recipientCount === 1 ? '' : 's'}.`, 'success');
        clearForm();
      }
      router.refresh();
    });
  };

  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '20px 24px', marginBottom: 28 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Compose newsletter</h2>
      <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Goes to all {activeCount} active subscriber{activeCount === 1 ? '' : 's'}. Leave a blank line
        between paragraphs; web links (https://…) become clickable automatically. Yellow Pink branding
        and an unsubscribe link are added for you. Save a draft to come back to it later.
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
      </label>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <button
          onClick={handleSend}
          disabled={pending || activeCount === 0}
          style={{
            padding: '10px 20px', borderRadius: 8, border: 'none',
            background: pending || activeCount === 0 ? '#9ca3af' : '#C5286A',
            color: 'white', fontSize: '0.875rem', fontWeight: 600,
            cursor: pending || activeCount === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Working…' : `Send to ${activeCount} subscriber${activeCount === 1 ? '' : 's'}`}
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
