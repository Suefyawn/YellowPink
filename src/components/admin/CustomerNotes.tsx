'use client';

// The customer page's Notes card: append-only staff notes about a customer
// (call preferences, payment habits), newest first, with an edit-gated
// composer and per-note delete. Internal-only — the customer never sees
// these.

import { useRef, useTransition } from 'react';
import { useFormStatus } from 'react-dom';
import { addCustomerNote, deleteCustomerNote } from '@/app/admin/users/note-actions';
import { fmtDateTimePK } from '@/lib/dates';

export interface CustomerNote {
  id: string;
  author: string;
  body: string;
  created_at: string;
}

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

export function CustomerNotes({ custKey, notes, canEdit }: {
  custKey: string;
  notes: CustomerNote[];
  canEdit: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [deleting, startDelete] = useTransition();

  return (
    <div style={{ background: 'white', borderRadius: 10, padding: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginTop: 16 }}>
      <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Notes</h2>
      <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6b7280' }}>
        Internal notes about this customer. Never shown to them.
      </p>

      {canEdit && (
        <form
          ref={formRef}
          action={async (formData: FormData) => {
            await addCustomerNote(custKey, formData);
            formRef.current?.reset();
          }}
          style={{ marginBottom: notes.length > 0 ? 14 : 0 }}
        >
          <textarea
            name="body"
            rows={2}
            required
            maxLength={2000}
            placeholder="e.g. Always call before 6pm. Prefers bank transfer."
            style={{
              width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
              borderRadius: 8, fontSize: '0.8125rem', fontFamily: 'inherit',
              resize: 'vertical', boxSizing: 'border-box',
            }}
          />
          <div style={{ marginTop: 8 }}>
            <AddButton />
          </div>
        </form>
      )}

      {notes.length === 0 ? (
        !canEdit && (
          <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>No notes yet.</p>
        )
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {notes.map((n, i) => (
            <div key={n.id} style={{ padding: '10px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#92400e' }}>{n.author}</span>
                <span style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{fmtDateTimePK(n.created_at)}</span>
                {canEdit && (
                  <button
                    type="button"
                    disabled={deleting}
                    onClick={() => {
                      if (!window.confirm('Delete this note?')) return;
                      startDelete(() => deleteCustomerNote(n.id, custKey));
                    }}
                    title="Delete note"
                    aria-label="Delete note"
                    style={{
                      marginLeft: 'auto', background: 'transparent', border: 'none',
                      color: '#9ca3af', fontSize: '0.9375rem', lineHeight: 1,
                      cursor: 'pointer', padding: '0 2px', opacity: deleting ? 0.5 : 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
              <div style={{ marginTop: 4, fontSize: '0.8125rem', color: '#374151', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {n.body}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
