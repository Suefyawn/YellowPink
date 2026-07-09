'use server';

// Server actions backing the checkout's rewards section (gift card,
// loyalty points, referral code). All read-only, the actual
// debit/credit happens after the order RPC succeeds.

import { supabase } from '@/lib/supabase';

export async function validateGiftCardCode(code: string): Promise<{ valid: boolean; balance: number; currency: string }> {
  const cleaned = code.trim();
  if (!cleaned) return { valid: false, balance: 0, currency: 'PKR' };
  const { data } = await supabase.rpc('validate_gift_card' as never, { p_code: cleaned } as never);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as { valid: boolean; balance: number; currency: string } | undefined;
  if (!row) return { valid: false, balance: 0, currency: 'PKR' };
  return { valid: row.valid, balance: Number(row.balance), currency: row.currency };
}

export async function validateReferralCode(code: string): Promise<{ valid: boolean; discount_pct: number }> {
  const cleaned = code.trim().toUpperCase();
  if (!cleaned) return { valid: false, discount_pct: 0 };
  const { data } = await supabase.rpc('validate_referral_code' as never, { p_code: cleaned } as never);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as { valid: boolean; discount_pct: number } | undefined;
  if (!row) return { valid: false, discount_pct: 0 };
  return { valid: row.valid, discount_pct: Number(row.discount_pct) };
}

/** Full referral-discount eligibility for THIS shopper: code must belong to a
 *  customer, no self-referral, programme enabled, and — the part
 *  validate_referral_code can't know — this must be their first order (by
 *  user id, email or phone). Mirrors the exact rules place_order enforces
 *  (both call the same check_referral_discount SQL function), so what the
 *  summary shows is what the order RPC will accept. */
export async function checkReferralDiscount(input: {
  code: string;
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
}): Promise<{ eligible: boolean; discount_pct: number; reason: string | null }> {
  const cleaned = input.code.trim().toUpperCase();
  if (!cleaned) return { eligible: false, discount_pct: 0, reason: 'invalid_code' };
  const { data } = await supabase.rpc('check_referral_discount' as never, {
    p_code: cleaned,
    p_email: input.email?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_user_id: input.userId || null,
  } as never);
  const rows = Array.isArray(data) ? data : data ? [data] : [];
  const row = rows[0] as { eligible: boolean; discount_pct: number; reason: string | null } | undefined;
  if (!row) return { eligible: false, discount_pct: 0, reason: 'unavailable' };
  return { eligible: row.eligible, discount_pct: Number(row.discount_pct), reason: row.reason };
}
