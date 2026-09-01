'use client';

import { useActionState, useState } from 'react';
import { sendReply, type ReplyState } from './actions';

// Inline reply box for a conversation. Submits the server action, which emails
// the customer via Resend and records the reply in the thread; the page then
// revalidates and the new outbound bubble appears.
//
// The textarea is CONTROLLED and only cleared on a confirmed send — a failed
// send (Resend outage, config problem) keeps the typed reply in the box with
// the error above it, instead of the old redirect that wiped it.
export function ReplyComposer({ email, name, subject }: { email: string; name: string; subject: string }) {
  const [state, action, pending] = useActionState<ReplyState, FormData>(sendReply, null);
  const [body, setBody] = useState('');
  // Clear the box exactly once per confirmed send (state adjustment during
  // render — the React-sanctioned pattern for "reset when a prop-ish value
  // changes", no effect needed).
  const [handledSend, setHandledSend] = useState<number | null>(null);
  if (state?.sent && state.sent !== handledSend) {
    setHandledSend(state.sent);
    setBody('');
  }

  return (
    <form action={action} style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="subject" value={subject} />
      {state?.error && (
        <div role="status" style={{
          padding: '8px 12px', borderRadius: 8, fontSize: '0.8125rem',
          background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca',
        }}>
          {state.error}
        </div>
      )}
      <textarea
        name="body"
        required
        rows={3}
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder={`Reply to ${name || email}…`}
        style={{
          width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 10,
          fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
          color: '#111827', outline: 'none',
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
          Sends from your store address; the customer can reply back to this thread.
        </span>
        <button type="submit" disabled={pending} style={{
          padding: '8px 18px', background: pending ? '#e5a7c4' : '#C5286A', color: '#fff',
          border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
          cursor: pending ? 'default' : 'pointer',
        }}>
          {pending ? 'Sending…' : 'Send reply'}
        </button>
      </div>
    </form>
  );
}
