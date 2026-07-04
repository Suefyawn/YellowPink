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

// Success feedback: the money actions (Settle all, Mark settled, Save, Add,
// Delete) previously refreshed the list with no confirmation, so a staffer
// couldn't tell a click registered. Redirect with ?saved so the page shows a
// toast/banner. Call outside try/catch — redirect() throws by design.
function vendorsSaved(msg: string): never {
  redirect(`/admin/vendors?saved=${encodeURIComponent(msg)}`);
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
  const session = await assertPermission('vendors');
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
  vendorsSaved(`Added vendor ${name}.`);
}

/** Update a vendor's commission % and settlement direction. */
export async function updateVendor(formData: FormData) {
  const session = await assertPermission('vendors');
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
  vendorsSaved('Vendor terms saved.');
}

export async function deleteVendor(formData: FormData) {
  const session = await assertPermission('vendors');
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
  vendorsSaved(`Deleted vendor ${target?.name ?? ''}.`);
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

export interface AssignVendorResult {
  ok: boolean;
  error?: string;
  /** Vendor name (set path) for the toast. */
  vendorName?: string;
  /** The engine's total vendor cost for this order. */
  cost?: number;
  /** Whether the acquisition cost was (re)written — false when a manually
   *  entered value was protected. */
  costApplied?: boolean;
  /** Clearing path: true when the vendor was removed. */
  cleared?: boolean;
}

/** Assign (or clear) an order's fulfilment vendor — the SELECTION is what
 *  applies the economics, no WhatsApp message required: picking a vendor
 *  writes orders.vendor_id, the settlement row, and the auto acquisition
 *  cost from the shared engine. A manually entered acquisition cost is never
 *  clobbered (only null or previously auto values are). Clearing the vendor
 *  removes the pending settlement and an auto-filled acquisition cost, but
 *  leaves a manual cost alone. Returns a result object for the client toast
 *  rather than redirecting, so the picker can show what actually happened. */
export async function assignOrderVendor(orderId: string, vendorId: string | null): Promise<AssignVendorResult> {
  const session = await assertPermission('orders.edit');
  const admin = supabaseAdmin();

  const { data: order } = await admin
    .from('orders')
    .select('vendor_id, acquisition_cost_source')
    .eq('id', orderId)
    .maybeSingle();
  if (!order) return { ok: false, error: 'Order not found.' };
  const prevVendorId = (order as { vendor_id: string | null }).vendor_id;

  if (!vendorId) {
    // Clear the assignment. The "sent" stamp refers to the removed vendor,
    // so it goes too; a pending settlement for this order is dropped; an
    // auto-filled acquisition cost loses its basis and is cleared (a manual
    // one is the operator's number and stays).
    const { error } = await admin
      .from('orders')
      .update({ vendor_id: null, vendor_sent_at: null })
      .eq('id', orderId);
    if (error) {
      log.error('order.vendor_clear_failed', { order_id: orderId, error: error.message });
      return { ok: false, error: `Could not clear the vendor: ${error.message}` };
    }
    await admin.from('vendor_settlements').delete().eq('order_id', orderId).eq('status', 'pending');
    if ((order as { acquisition_cost_source: string | null }).acquisition_cost_source === 'auto') {
      await admin.from('orders')
        .update({ acquisition_cost: null, acquisition_cost_source: null })
        .eq('id', orderId);
    }
    void logAudit(session, {
      action: 'order.vendor_cleared', entity: 'orders', entity_id: orderId,
      diff: { previous_vendor_id: prevVendorId },
    });
    revalidatePath(`/admin/orders/${orderId}`);
    revalidatePath('/admin/vendors');
    return { ok: true, cleared: true };
  }

  const { data: vendor } = await admin
    .from('vendors').select('id, name, active').eq('id', vendorId).maybeSingle();
  if (!vendor || !(vendor as { active: boolean }).active) {
    return { ok: false, error: 'That vendor no longer exists or is inactive.' };
  }

  const { error } = await admin
    .from('orders')
    .update({
      vendor_id: vendorId,
      // Switching vendors: the old "sent" stamp described a message to the
      // previous vendor, so it resets; re-selecting the same vendor keeps it.
      ...(prevVendorId && prevVendorId !== vendorId ? { vendor_sent_at: null } : {}),
    })
    .eq('id', orderId);
  if (error) {
    log.error('order.vendor_assign_failed', { order_id: orderId, vendor_id: vendorId, error: error.message });
    return { ok: false, error: `Could not assign the vendor: ${error.message}` };
  }

  const costs = await recomputeSettlement(orderId, vendorId);
  const costApplied = costs ? await applyAutoAcquisitionCost(orderId, costs.totalCost) : false;

  void logAudit(session, {
    action: 'order.vendor_assigned', entity: 'orders', entity_id: orderId,
    diff: { vendor_id: vendorId, previous_vendor_id: prevVendorId, cost: costs?.totalCost, cost_applied: costApplied },
  });
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin/vendors');
  return {
    ok: true,
    vendorName: (vendor as { name: string | null }).name ?? 'vendor',
    cost: costs?.totalCost,
    costApplied,
  };
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
  const session = await assertPermission('vendors');
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
  vendorsSaved(settle ? 'Payout marked settled.' : 'Payout reopened.');
}

/** Settle every pending payout for one vendor in one click — the common case
 *  after a periodic reconciliation (one transfer covers the accumulated
 *  margin or costs across many orders). */
export async function settleVendorPending(formData: FormData) {
  const session = await assertPermission('vendors');
  const vendorId = formData.get('vendor_id') as string;
  if (!vendorId) return;
  const { data, error } = await supabaseAdmin()
    .from('vendor_settlements')
    .update({ status: 'settled', settled_at: new Date().toISOString() })
    .eq('vendor_id', vendorId)
    .eq('status', 'pending')
    .select('id');
  if (error) {
    log.error('vendor.settle_all_failed', { vendorId, error: error.message });
    bounceVendors(`Could not settle payouts: ${error.message}`);
  }
  void logAudit(session, {
    action: 'vendor.settlements_settled_bulk',
    entity: 'vendors', entity_id: vendorId,
    diff: { settled_count: data?.length ?? 0 },
  });
  revalidatePath('/admin/vendors');
  vendorsSaved(`Settled ${data?.length ?? 0} payout${(data?.length ?? 0) === 1 ? '' : 's'}.`);
}
