'use client';
import { useTransition } from 'react';

interface Props {
  id: string;
  action: (formData: FormData) => Promise<void>;
  confirmMsg: string;
  label?: string;
}

export function DeleteButton({ id, action, confirmMsg, label = 'Delete' }: Props) {
  const [pending, startTransition] = useTransition();

  const handleClick = () => {
    if (!confirm(confirmMsg)) return;
    startTransition(() => {
      const fd = new FormData();
      fd.append('id', id);
      action(fd);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      style={{
        padding: '5px 12px',
        background: '#fef2f2',
        color: '#dc2626',
        border: 'none',
        borderRadius: 6,
        fontSize: '0.8125rem',
        fontWeight: 500,
        cursor: pending ? 'not-allowed' : 'pointer',
        opacity: pending ? 0.6 : 1,
      }}
    >
      {pending ? '…' : label}
    </button>
  );
}
