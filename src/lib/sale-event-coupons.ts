// Server side of the occasion → coupon link (migration 1330).
//
// Three entry points share saleEventCouponRow():
//   ensureSaleEventCoupon   activation / schedule / edit of a live occasion
//   retireSaleEventCoupon   "Turn seasonal look off"
//   syncAutopilotCoupons    daily cron: occasions that run themselves from the
//                           calendar get their code created ahead of the
//                           window, bounded to it, without anyone clicking.
//
// Upserts key on coupons.code, so a code the owner already created by hand
// (DEFENCE, AZADI14-style) is adopted rather than duplicated: its discount
// settings now follow the occasion card, its used_count is untouched.

import { supabaseAdmin } from '@/lib/supabase';
import {
  saleEventCouponRow, pickAutoEvent, SALE_EVENT_COUPON_MARK,
  type ActivationMode, type SaleEvent,
} from '@/lib/sale-events';

export interface CouponSyncResult {
  code: string | null;
  action: 'created' | 'updated' | 'skipped' | 'error';
  detail: string;
}

export async function ensureSaleEventCoupon(event: SaleEvent, mode: ActivationMode): Promise<CouponSyncResult> {
  const row = saleEventCouponRow(event, mode);
  if (!row) {
    return {
      code: event.bar_coupon ?? null,
      action: 'skipped',
      detail: event.bar_coupon ? 'the occasion has no usable discount value' : 'the occasion has no coupon code',
    };
  }
  const admin = supabaseAdmin();
  const { data: existing } = await admin.from('coupons').select('id').eq('code', row.code).maybeSingle();
  const { error } = await admin.from('coupons').upsert(row, { onConflict: 'code' });
  if (error) return { code: row.code, action: 'error', detail: error.message };
  return {
    code: row.code,
    action: existing ? 'updated' : 'created',
    detail: existing ? 'existing code adopted and updated to the occasion settings' : 'coupon created',
  };
}

/** Deactivate the occasion's code when the look is switched off early. Only
 *  codes this feature created/adopted (description marker) are touched, so
 *  a code shared with another campaign is never killed by accident. */
export async function retireSaleEventCoupon(event: SaleEvent): Promise<CouponSyncResult> {
  const code = (event.bar_coupon ?? '').trim().toUpperCase();
  if (!code) return { code: null, action: 'skipped', detail: 'no coupon code' };
  const admin = supabaseAdmin();
  const { data, error } = await admin
    .from('coupons')
    .update({ active: false })
    .eq('code', code)
    .ilike('description', `${SALE_EVENT_COUPON_MARK}%`)
    .select('id');
  if (error) return { code, action: 'error', detail: error.message };
  return (data ?? []).length > 0
    ? { code, action: 'updated', detail: 'coupon deactivated' }
    : { code, action: 'skipped', detail: 'not managed by an occasion, left as is' };
}

/** Autopilot: create/refresh the code for the occasion the calendar is about
 *  to run (or is running), scheduled to its window. Idempotent; safe daily. */
export async function syncAutopilotCoupons(now: Date = new Date()): Promise<CouponSyncResult[]> {
  const admin = supabaseAdmin();
  const { data } = await admin.from('sale_events').select('*');
  const events = (data ?? []) as SaleEvent[];
  const picked = pickAutoEvent(events, now);
  if (!picked) return [];
  const r = await ensureSaleEventCoupon(picked, 'schedule');
  return [r];
}
