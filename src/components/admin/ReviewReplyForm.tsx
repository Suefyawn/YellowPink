'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { replyToReview } from '@/app/admin/reviews/actions';

function SaveButton({ hasReply }: { hasReply: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{
      padding: '6px 14px', background: '#C5286A', color: 'white',
      border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
      cursor: 'pointer', opacity: pending ? 0.6 : 1,
    }}>
      {pending ? 'Saving…' : hasReply ? 'Update reply' : 'Post reply'}
    </button>
  );
}

// Public owner reply, shown on the PDP as "Response from Yellow Pink".
// Collapsed to a link until opened; submitting empty clears the reply.
export function ReviewReplyForm({ reviewId, existingReply, returnTo }: {
  reviewId: string;
  existingReply: string | null;
  returnTo: string;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: '#C5286A', fontSize: '0.8125rem', fontWeight: 600,
      }}>
        {existingReply ? 'Edit public reply' : 'Reply publicly'}
      </button>
    );
  }

  return (
    <form action={replyToReview} style={{ marginTop: 10 }}>
      <input type="hidden" name="id" value={reviewId} />
      <input type="hidden" name="return_to" value={returnTo} />
      <textarea
        name="owner_reply"
        defaultValue={existingReply ?? ''}
        rows={3}
        maxLength={2000}
        placeholder="Thank the customer, answer their concern… This appears publicly under the review as “Response from Yellow Pink”."
        style={{
          width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
          borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit',
          resize: 'vertical', boxSizing: 'border-box', marginBottom: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <SaveButton hasReply={!!existingReply} />
        <button type="button" onClick={() => setOpen(false)} style={{
          padding: '6px 14px', background: 'white', color: '#374151',
          border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, cursor: 'pointer',
        }}>Cancel</button>
        {existingReply && (
          <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Save with an empty box to remove the reply.</span>
        )}
      </div>
    </form>
  );
}
