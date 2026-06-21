'use client';

import { useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { sendReply } from './actions';

function SendButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{
      padding: '8px 18px', background: pending ? '#e5a7c4' : '#C5286A', color: '#fff',
      border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 700,
      cursor: pending ? 'default' : 'pointer',
    }}>
      {pending ? 'Sending…' : 'Send reply'}
    </button>
  );
}

// Inline reply box for a conversation. Submits the server action, which emails
// the customer via Resend and records the reply in the thread; the page then
// revalidates and the new outbound bubble appears.
export function ReplyComposer({ email, name, subject }: { email: string; name: string; subject: string }) {
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={ref}
      action={async (fd) => { await sendReply(fd); ref.current?.reset(); }}
      style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}
    >
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="subject" value={subject} />
      <textarea
        name="body"
        required
        rows={3}
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
        <SendButton />
      </div>
    </form>
  );
}
