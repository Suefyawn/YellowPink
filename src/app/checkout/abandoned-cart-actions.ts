'use server';

// Anon-callable server action to capture an abandoned cart. Called from
// CheckoutPage when the user enters their email and has at least one cart
// item. Idempotent — the underlying RPC upserts on email.

import { headers } from 'next/headers';
import { supabase } from '@/lib/supabase';
import { createServerSupabase } from '@/lib/supabase-server';
import { checkoutLimiter, ipFromHeaders } from '@/lib/ratelimit';
import { emailSchema } from '@/lib/validators';
import type { CartItem } from '@/types';

// The client used to pass `user_id` directly; the RPC then merged it via
// COALESCE on upsert. A malicious caller could spoof their own UUID onto
// another user's cart row keyed by email. We now ignore any client-supplied
// user_id and read the authenticated user from cookies server-side.
interface CartSnapshot {
  email: string;
  items: CartItem[];
  subtotal: number;
}

export async function captureAbandonedCart(snapshot: CartSnapshot): Promise<{ ok: true; token?: string } | { ok: false; error: string }> {
  const parsedEmail = emailSchema.safeParse(snapshot.email);
  if (!parsedEmail.success) return { ok: false, error: 'invalid email' };
  if (!Array.isArray(snapshot.items) || snapshot.items.length === 0) {
    return { ok: false, error: 'cart is empty' };
  }

  // Soft rate-limit by IP so we don't get hammered by a runaway client.
  const h = await headers();
  const { success } = await checkoutLimiter.limit(`abandoned:${ipFromHeaders(h)}`);
  if (!success) return { ok: false, error: 'rate limited' };

  // Resolve the actual authenticated user from the session cookie; null for
  // guest checkouts. Never trust the client.
  const authed = await createServerSupabase();
  const { data: { user } } = await authed.auth.getUser();

  const { data, error } = await supabase.rpc('capture_abandoned_cart' as never, {
    p_email:    snapshot.email,
    p_cart:     snapshot.items,
    p_subtotal: snapshot.subtotal,
    p_user_id:  user?.id ?? null,
  } as never);

  if (error) return { ok: false, error: error.message };
  return { ok: true, token: typeof data === 'string' ? data : undefined };
}
