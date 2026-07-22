'use server';

// Anon-callable server action to capture an abandoned cart. Called from
// CheckoutPage when the user enters their phone or email and has at least one
// cart item. Idempotent, the underlying RPC upserts on email (or phone when
// no email was given) and merges a phone-only row into the email row if the
// shopper fills both over time.

import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { emailSchema } from '@/lib/validators';
import type { CartItem } from '@/types';

interface CartSnapshot {
  email?: string | null;
  phone?: string | null;
  first_name?: string | null;
  items: CartItem[];
  subtotal: number;
  user_id?: string | null;
}

export async function captureAbandonedCart(snapshot: CartSnapshot): Promise<{ ok: true; token?: string } | { ok: false; error: string }> {
  const email = (snapshot.email ?? '').trim();
  const phoneDigits = (snapshot.phone ?? '').replace(/\D+/g, '');
  const emailOk = email !== '' && emailSchema.safeParse(email).success;
  // 10 digits = local format without the leading 0 ("3001234567"); the RPC
  // normalises 0…/92… variants itself and re-validates length.
  const phoneOk = phoneDigits.length >= 10;
  if (!emailOk && !phoneOk) return { ok: false, error: 'contact required' };
  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    return { ok: false, error: 'cart is empty' };
  }

  // Soft rate-limit by IP so we don't get hammered by a runaway client.
  const h = await headers();
  const { success } = await checkoutLimiter.limit(`abandoned:${ipFromHeaders(h)}`);
  if (!success) return { ok: false, error: 'rate limited' };

  const { data, error } = await supabase.rpc('capture_abandoned_cart' as never, {
    p_email:    emailOk ? email : null,
    p_cart:     snapshot.items,
    p_subtotal: snapshot.subtotal,
    p_user_id:  snapshot.user_id ?? null,
    p_phone:    phoneOk ? snapshot.phone : null,
    p_name:     snapshot.first_name?.trim() || null,
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true, token: typeof data === 'string' ? data : undefined };
}
