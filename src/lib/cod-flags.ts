// COD refusal flags — see supabase/migrations/20260810_960_cod_flags.sql.
// An identity (phone AND email, owner directive) that refused a CONFIRMED
// COD delivery prepays future orders. This module is the one place that
// knows the normalization and lifecycle; checkout eligibility, the
// status-transition hooks and the admin toggle all go through it so the
// rules can't drift.

import { supabaseAdmin } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import type { StaffSession } from '@/lib/permissions';

/** Mirror of SQL normalize_pk_phone: digits only, then 0092…/92… → 0…,
 *  bare 3xxxxxxxxx → 03xxxxxxxxx. Keep the two implementations in step. */
export function normalizePkPhone(raw: string | null | undefined): string {
  const d = (raw ?? '').replace(/\D/g, '');
  if (d.startsWith('0092')) return '0' + d.slice(4);
  if (d.startsWith('92') && d.length >= 12) return '0' + d.slice(2);
  if (d.startsWith('3') && d.length === 10) return '0' + d;
  return d;
}

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

interface Identity { phone?: string | null; email?: string | null }

/** Usable key values, or null when neither field carries enough signal. */
function keysOf(id: Identity): { phone: string | null; email: string | null } | null {
  const phone = normalizePkPhone(id.phone);
  const email = normalizeEmail(id.email);
  const p = phone.length >= 10 ? phone : null;
  const e = email.includes('@') ? email : null;
  return p || e ? { phone: p, email: e } : null;
}

export async function isCodFlagged(id: Identity): Promise<boolean> {
  const keys = keysOf(id);
  if (!keys) return false;
  const ors: string[] = [];
  if (keys.phone) ors.push(`phone.eq.${keys.phone}`);
  if (keys.email) ors.push(`email.eq.${keys.email}`);
  const { data } = await supabaseAdmin()
    .from('cod_flags')
    .select('id')
    .is('cleared_at', null)
    .or(ors.join(','))
    .limit(1);
  return (data?.length ?? 0) > 0;
}

/** Set the active flag for an identity (idempotent per key: an existing
 *  active flag on either key wins). One row carries both keys so a match on
 *  either blocks COD. */
export async function flagCodIdentity(opts: Identity & {
  orderId?: string | null;
  reason: string;
  by: string;
}): Promise<void> {
  const keys = keysOf(opts);
  if (!keys) return;
  if (await isCodFlagged(opts)) return;
  // A lost race just bounces off the partial unique indexes — same outcome.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin().from('cod_flags') as any)
    .insert({ phone: keys.phone, email: keys.email, reason: opts.reason, order_id: opts.orderId ?? null, created_by: opts.by });
}

/** Clear active flags matching either key (redemption or staff override). */
export async function clearCodFlag(id: Identity, by: string): Promise<void> {
  const keys = keysOf(id);
  if (!keys) return;
  const ors: string[] = [];
  if (keys.phone) ors.push(`phone.eq.${keys.phone}`);
  if (keys.email) ors.push(`email.eq.${keys.email}`);
  await supabaseAdmin()
    .from('cod_flags')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ cleared_at: new Date().toISOString(), cleared_by: by } as any)
    .is('cleared_at', null)
    .or(ors.join(','));
}

/** Status-transition lifecycle, shared by the single and bulk status paths:
 *  confirmed COD order → returned  ⇒ flag the identity (they refused it);
 *  any order → delivered           ⇒ clear the identity's flags (redeemed).
 *  Cancellations never flag — only a refusal after confirmation costs the
 *  courier round trip. */
export async function applyCodFlagTransition(
  session: StaffSession | null,
  order: { id: string; order_number: string | null; phone: string | null; email?: string | null; pay_method: string | null; confirmed_at: string | null },
  transition: 'returned' | 'delivered',
): Promise<void> {
  const by = session?.email ?? 'system';
  if (transition === 'returned') {
    if (order.pay_method !== 'cod' || !order.confirmed_at) return;
    await flagCodIdentity({
      phone: order.phone,
      email: order.email,
      orderId: order.id,
      reason: `confirmed COD order ${order.order_number ?? order.id} returned`,
      by,
    });
    if (session) {
      void logAudit(session, { action: 'cod.flagged', entity: 'cod_flags', entity_id: normalizePkPhone(order.phone) || normalizeEmail(order.email), diff: { order: order.order_number } });
    }
    return;
  }
  await clearCodFlag({ phone: order.phone, email: order.email }, by);
}
