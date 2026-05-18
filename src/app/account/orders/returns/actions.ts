'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { reviewLimiter, ipFromHeaders } from '@/lib/ratelimit';

interface ReturnItem { product_id: string; qty: number; name: string; price: number }

async function authedClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const store = await cookies();
  const sessionCookie = store.getAll().find(c => /^sb-.+-auth-token$/.test(c.name));
  if (sessionCookie) {
    try {
      const parsed = JSON.parse(sessionCookie.value);
      const access  = parsed?.access_token;
      const refresh = parsed?.refresh_token;
      if (access && refresh) await sb.auth.setSession({ access_token: access, refresh_token: refresh });
    } catch { /* fall through */ }
  }
  return sb;
}

export async function requestReturn(args: {
  order_id: string;
  reason: string;
  items: ReturnItem[];
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const h = await headers();
  const { success } = await reviewLimiter.limit(`return:${ipFromHeaders(h)}`);
  if (!success) return { ok: false, error: 'Too many requests. Wait a minute.' };

  if (!args.order_id) return { ok: false, error: 'order_id required' };
  if (!args.reason || args.reason.trim().length < 5) return { ok: false, error: 'Please tell us why you\'re returning' };
  if (!Array.isArray(args.items) || args.items.length === 0) return { ok: false, error: 'Select at least one item' };

  const sb = await authedClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: 'You must be signed in' };

  const { data, error } = await sb.from('return_requests').insert({
    order_id:    args.order_id,
    user_id:     user.id,
    email:       user.email ?? null,
    reason:      args.reason.trim(),
    items:       args.items,
    status:      'pending',
  }).select('id').single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/account/orders/${args.order_id}`);
  revalidatePath('/account/orders');
  return { ok: true, id: data?.id as string };
}

// Admin-side decision actions live under /admin and use the service-role
// client; declaring them here keeps the customer/admin paths colocated.

import { getStaffSession } from '@/lib/staff-auth';
import { supabase } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';

async function assertOrders() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

export async function approveReturn(args: {
  id: string;
  refund_amount: number;
  refund_method: 'store_credit' | 'coupon' | 'original' | 'cod_deduct';
  admin_note?: string;
}): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  if (args.refund_amount < 0) return { error: 'refund_amount must be >= 0' };

  const { data: row } = await supabase
    .from('return_requests')
    .select('id, user_id, items, order_id, status')
    .eq('id', args.id)
    .single();
  if (!row) return { error: 'return request not found' };
  if (row.status !== 'pending') return { error: `cannot approve a ${row.status} request` };

  const { error } = await supabase
    .from('return_requests')
    .update({
      status: 'approved',
      refund_amount: args.refund_amount,
      refund_method: args.refund_method,
      admin_note: args.admin_note ?? null,
    })
    .eq('id', args.id);
  if (error) return { error: error.message };

  // Store-credit path: top up loyalty (1 PKR = 1 point per defaults).
  if (args.refund_method === 'store_credit' && row.user_id) {
    await supabase.rpc('grant_loyalty_points' as never, {
      p_user_id:  row.user_id,
      p_delta:    Math.round(args.refund_amount),
      p_reason:   'refund_reversal',
      p_order_id: row.order_id,
      p_note:     `return ${args.id.slice(0,8)} approved as store credit`,
    } as never);
  }

  await logAudit(session, {
    action: 'return.approve',
    entity: 'return_request',
    entity_id: args.id,
    diff: { refund_amount: args.refund_amount, refund_method: args.refund_method },
  });
  revalidatePath('/admin/returns');
  return { success: true };
}

export async function rejectReturn(id: string, admin_note: string): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();
  const { error } = await supabase
    .from('return_requests')
    .update({ status: 'rejected', admin_note: admin_note || null })
    .eq('id', id);
  if (error) return { error: error.message };
  await logAudit(session, { action: 'return.reject', entity: 'return_request', entity_id: id, diff: { admin_note } });
  revalidatePath('/admin/returns');
  return { success: true };
}
