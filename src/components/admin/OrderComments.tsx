'use client';

// Compose/delete controls for order timeline comments. The comments
// themselves render server-side in the order page's timeline card,
// interleaved with the status events; this file only holds the two
// interactive bits.

import { useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { addOrderComment, deleteOrderComment } from '@/app/admin/orders/comment-actions';

function AddButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} style={{
      padding: '7px 16px', background: '#C5286A', color: 'white',
      border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
      cursor: 'pointer', opacity: pending ? 0.6 : 1,
    }}>
      {pending ? 'Saving…' : 'Add note'}
    </button>
  );
}

export function OrderCommentComposer({ orderId }: { orderId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData: FormData) => {
        await addOrderComment(orderId, formData);
        formRef.current?.reset();
      }}
      style={{ marginBottom: 16 }}
    >
      <textarea
        name="body"
        rows={2}
        required
        maxLength={2000}
        placeholder="Leave a note on the timeline… (call attempts, delivery instructions, what the customer said)"
        style={{
          width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
          borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit',
          resize: 'vertical', boxSizing: 'border-box',
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
        <AddButton />
        <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>Internal note, the customer never sees this.</span>
      </div>
    </form>
  );
}

export function DeleteCommentButton({ commentId, orderId }: { commentId: string; orderId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!window.confirm('Delete this note?')) return;
        startTransition(() => deleteOrderComment(commentId, orderId));
      }}
      title="Delete note"
      aria-label="Delete note"
      style={{
        background: 'transparent', border: 'none', color: '#9ca3af',
        fontSize: '0.9375rem', lineHeight: 1, cursor: 'pointer',
        padding: '0 2px', opacity: pending ? 0.5 : 1,
      }}
    >
      ×
    </button>
  );
}
