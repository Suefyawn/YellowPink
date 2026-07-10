'use client';
import { useState, useTransition } from 'react';

interface Props {
  id: string;
  action: (formData: FormData) => Promise<void>;
  confirmMsg: string;
  label?: string;
}

export function DeleteButton({ id, action, confirmMsg, label = 'Delete' }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(() => {
      const fd = new FormData();
      fd.append('id', id);
      action(fd);
    });
    setConfirming(false);
  };

  if (confirming) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>Sure?</span>
        <button
          onClick={handleDelete}
          style={{
            padding: '4px 10px', background: '#dc2626', color: 'white',
            border: 'none', borderRadius: 5, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
          }}
        >
          Yes, delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          style={{
            padding: '4px 10px', background: '#f3f4f6', color: '#374151',
            border: 'none', borderRadius: 5, fontSize: '0.75rem', cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </span>
    );
  }

  return (
    <button
      className="adm-btn adm-btn-danger"
      onClick={() => setConfirming(true)}
      disabled={pending}
      title={confirmMsg}
    >
      {pending ? '…' : label}
    </button>
  );
}
