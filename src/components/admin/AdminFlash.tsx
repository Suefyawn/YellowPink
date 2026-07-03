'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/admin/Toast';

// Generic flash for server-action redirects: surfaces the result carried in a
// query param as a toast, then replaces the URL with `clearPath` so a page
// refresh doesn't replay it. Same house pattern as ProductsFlash, but takes a
// pre-resolved message so every page doesn't reimplement the param mapping.
export function AdminFlash({
  message,
  type = 'success',
  clearPath,
}: {
  message?: string | null;
  type?: 'success' | 'error';
  clearPath: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const shown = useRef(false);

  useEffect(() => {
    if (shown.current || !message) return;
    shown.current = true;
    toast(message, type);
    router.replace(clearPath);
  }, [message, type, clearPath, router, toast]);

  return null;
}
