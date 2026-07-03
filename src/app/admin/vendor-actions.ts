'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';
import { log } from '@/lib/logger';
import { recomputeSettlement, applyAutoAcquisitionCost } from '@/lib/vendor-settlement';

// ─── Vendor CRUD ────────────────────────────────────────────────────────────

// Failed writes bounce back to the vendors page with ?error=... so the admin
// sees a banner instead of a silently unchanged list (issue #191).
function bounceVendors(error: string): never {
  redirect(`/admin/vendors?error=${encodeURIComponent(error)}`);
}

/** Parse the commission % field, blank → null, otherwise clamped 0-100. */
function parseCommission(raw: FormDataEntryValue | null): number | null {
  const s = (raw as string | null)?.trim();
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.min(100, Math.max(0, n));
}

function parseDirection(raw: FormDataEntryValue | null): 'vendor_collects' | 'we_collect' {
  return raw === 'vendor_collects' ? 'vendor_collects' : 'we_collect';
}

export async function createVendor(formData: FormData) {
  const session = await assertPermission('orders.edit');
  const name  = (formData.get('name') as string)?.trim();
  const phone = (formData.get('phone') as string)?.trim();
  const notes = (formData.get('notes') as string)?.trim() || null;
  if (!name || !phone) return;

  const { data: created, error } = await supabaseAdmin()
    .from('vendors')
    .insert({
      name, phone, notes,
      commission_pct: parseCommission(formData.get('commission_pct')),
      settlement_direction: parseDirection(formData.get('settlement_direction')),
    })
    .select('id')
    .single();
  if (error || !created) {
    log.error('vendor.create_failed', { name, error: error?.message });
    bounceVendors(error?.message ?? 'Could not create vendor. Please try again.');
  }
  void logAudit(session, {
    action: 'vendor.create', entity: 'vendors', entity_id: created.id,
    diff: { name, phone },
  });
  revalidatePath('/admin/vendors');
}

/** Update a vendor's commission % and settlement direction. */
export async function updateVendor(formData: FormData) {
  const session = await assertPermission('orders.edit');
  const id = formData.get('id') as string;
  if (!id) return;
  const commission_pct = parseCommission(formData.get('commission_pct'));
  const settlement_direction = parseDirection(formData.get('settlement_direction'));
  const { error } = await supabaseAdmin()
    .from('vendors')
    .update({ commission_pct, settlement_direction })
    .eq('id', id);
  if (error) {
    log.error('vendor.update_failed', { id, error: error.message });
    bounceVendors(`Could not update vendor: ${error.message}`);
  }
  void logAudit(session, {
    action: 'vendor.update', entity: 'vendors', entity_id: id,
    diff: { commission_pct, settlement_direction },
  });
  revalidatePath('/admin/vendors');
}

export async function deleteVendor(formData: FormData) {
  const session = await assertPermission('orders.delete');
  const id = formData.get('id') as string;
  const { data: target } = await supabaseAdmin().from('vendors').select('name').eq('id', id).single();
  const { error } = await supabaseAdmin().from('vendors').delete().eq('id', id);
  if (error) {
    log.error('vendor.delete_failed', { id, error: error.message });
    // Every FK into vendors is ON DELETE SET NULL now (orders.vendor_id,
    // products.vendor_id and — since migration 304 — vendor_settlements.
    // vendor_id, which keeps the payout history detached rather than
    // cascade-deleting it). So a 23503 FK violation is no longer reachable;
    // surface whatever real error the DB returns.
    bounceVendors(`Could not delete vendor: ${error.message}`);
  }
  void logAudit(session, {
    action: 'vendor.delete', entity: 'vendors', entity_id: id,
    diff: { name: target?.name },
  });
  revalidatePath('/admin/vendors');
}

// ─── Order confirmation + vendor dispatch ───────────────────────────────────

/** Toggle whether the customer has confirmed the order (typically over
 *  WhatsApp). Bound with the order id + target state by the order page. */
export async function setOrderConfirmed(orderId: string, confirmed: boolean) {
  const session = await assertPermission('orders.edit');
  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ confirmed_at: confirmed ? new Date().toISOString() : null })
    .eq('id', orderId);
  if (error) {
    // Surface the failure on the order page (it reads ?err= into a toast);
    // previously the error was dropped and the page just re-rendered with
    // the confirmation seemingly ignored.
    log.error('order.set_confirmed_failed', { order_id: orderId, confirmed, error: error.message });
    redirect(`/admin/orders/${orderId}?err=` + encodeURIComponent(`Could not update confirmation: ${error.message}`));
  }
  void logAudit(session, {
    action: confirmed ? 'order.customer_confirmed' : 'order.confirmation_cleared',
    entity: 'orders', entity_id: orderId,
  });
  revalidatePath(`/admin/orders/${orderId}`);
}

/** Record that the order was forwarded to a vendor. The WhatsApp message
 *  itself is opened client-side; this persists the assignment + a "sent"
 *  timestamp, writes the vendor settlement (margin / payout) row via the
 *  shared engine (src/lib/vendor-settlement.ts — the vendor covers the whole
 *  order), and auto-fills orders.acquisition_cost with the SAME figure so
 *  Finance and the settlement always agree. A manually entered acquisition
 *  cost is never clobbered (only null or previously auto values are). */
export async function dispatchOrderToVendor(orderId: string, vendorId: string) {
  const session = await assertPermission('orders.edit');
  if (!vendorId) return;
  await supabaseAdmin()
    .from('orders')
    .update({ vendor_id: vendorId, vendor_sent_at: new Date().toISOString() })
    .eq('id', orderId);
  const costs = await recomputeSettlement(orderId, vendorId);
  if (costs) await applyAutoAcquisitionCost(orderId, costs.totalCost);
  void logAudit(session, {
    action: 'order.dispatched_to_vendor', entity: 'orders', entity_id: orderId,
    diff: { vendor_id: vendorId },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/vendors');
}

/** Mark a vendor settlement as paid/received. */
export async function markSettlementSettled(formData: FormData) {
  const session = await assertPermission('orders.edit');
  const id = formData.get('id') as string;
  if (!id) return;
  const settle = formData.get('settle') !== 'false';
  const { error } = await supabaseAdmin()
    .from('vendor_settlements')
    .update({ status: settle ? 'settled' : 'pending', settled_at: settle ? new Date().toISOString() : null })
    .eq('id', id);
  if (error) {
    log.error('vendor.settlement_update_failed', { id, settle, error: error.message });
    bounceVendors(`Could not update settlement: ${error.message}`);
  }
  void logAudit(session, {
    action: settle ? 'vendor.settlement_settled' : 'vendor.settlement_reopened',
    entity: 'vendor_settlements', entity_id: id,
  });
  revalidatePath('/admin/vendors');
}
