// Courier-return financials — the ONE implementation of "who holds the goods
// and money when a parcel comes back", shared by EVERY path that can move an
// order to `returned`:
//   • manual single/bulk status change (src/app/admin/actions.ts),
//   • courier tracking sync cron (api/cron/courier-sync),
//   • courier webhooks (api/couriers/webhook),
//   • admin "Sync tracking now" (shipment-actions),
// all via notifyOrderShipmentTransition's transition edge for the automated
// paths. Before this lib, only the manual path applied the rules (2026-08-01
// platform audit): a courier scan flipping the order via the migration-610
// trigger left phantom vendor receivables, unearned margins and stale
// acquisition costs behind.
//
// Rules (see also applyReturnFinancials call sites and the user manual):
//   vendor_collects vendor: refused parcel went back to THEIR shelf — void
//     pending payouts, clear an auto-recorded acquisition cost, book their
//     return fee if set, restock nothing.
//   we_collect vendor: the payable for the goods stands (they bought stock,
//     not a loss), unearned margin zeroed (minus any return fee), tracked
//     items restock.
//   no vendor: tracked items restock.
//
// Idempotent by construction: settlement void/upsert and acquisition-cost
// clearing are naturally re-runnable, and restock consults the inventory
// ledger so a manual re-apply after a courier-driven apply can't double-add
// stock. Deliberately NOT a 'use server' file — service-role writes, only
// reachable through permission-checked actions and secret-gated crons.

import { supabaseAdmin } from './supabase';
import { syncReturnChargeToVendor } from './vendor-settlement';
import { logAudit } from './audit';
import { log } from './logger';

export interface ReturnActor {
  kind: 'owner' | 'staff' | 'system';
  email?: string | null;
}

interface OrderForReturn {
  id: string;
  order_number: string | null;
  items: unknown;
  vendor_id: string | null;
  acquisition_cost_source: string | null;
}

/** Restock an order's tracked items through the inventory ledger, unless a
 *  'return' restock for this order already exists (idempotency across the
 *  manual and courier-driven paths). */
async function restockReturnedItems(
  admin: ReturnType<typeof supabaseAdmin>,
  actor: ReturnActor,
  order: OrderForReturn,
): Promise<void> {
  const { data: existing } = await admin
    .from('inventory_ledger')
    .select('id')
    .eq('order_id', order.id)
    .eq('reason', 'return')
    .limit(1);
  if (existing && existing.length > 0) return; // already restocked

  const items = (order.items ?? []) as Array<{ id?: string; qty?: number; variant_id?: string | null }>;
  for (const it of items) {
    if (!it?.id || !it.qty || it.qty <= 0) continue;
    await admin.rpc('record_stock_change' as never, {
      p_product_id:  it.id,
      p_variant_id:  it.variant_id ?? null,
      p_qty_delta:   it.qty,
      p_reason:      'return',
      p_order_id:    order.id,
      p_return_id:   null,
      p_actor_kind:  actor.kind,
      p_actor_email: actor.email ?? null,
      p_note:        `Restock from courier return ${order.order_number ?? order.id.slice(0, 8)}`,
    } as never);
  }
}

/** Apply the full return semantics for one order. Safe to call more than
 *  once and from any server context (no request/session assumptions). */
export async function applyReturnFinancialsForOrder(
  orderId: string,
  actor: ReturnActor,
): Promise<void> {
  const admin = supabaseAdmin();
  const { data: orderRow } = await admin
    .from('orders')
    .select('id, order_number, items, vendor_id, acquisition_cost_source, delivery_cost')
    .eq('id', orderId)
    .maybeSingle();
  if (!orderRow) return;
  const order = orderRow as OrderForReturn & { delivery_cost: number | null };

  if (order.vendor_id) {
    const { data: vendor } = await admin
      .from('vendors').select('settlement_direction, self_delivers, return_fee')
      .eq('id', order.vendor_id).maybeSingle();
    const returnFee = vendor?.self_delivers ? Math.max(0, Number(vendor.return_fee) || 0) : 0;
    if (returnFee > 0 && (!order.delivery_cost || Number(order.delivery_cost) === 0)) {
      await admin.from('orders').update({ delivery_cost: returnFee }).eq('id', orderId);
    }
    if (vendor?.settlement_direction === 'vendor_collects') {
      const { data: voided } = await admin
        .from('vendor_settlements').delete()
        .eq('order_id', orderId).eq('status', 'pending')
        .select('id');
      if (order.acquisition_cost_source === 'auto') {
        await admin.from('orders')
          .update({ acquisition_cost: null, acquisition_cost_source: null })
          .eq('id', orderId);
      }
      if (returnFee > 0) await syncReturnChargeToVendor(orderId, order.vendor_id, returnFee);
      void logAudit(null, {
        action: 'order.return_voided_payout', entity: 'orders', entity_id: orderId,
        diff: {
          order_number: order.order_number, voided_payouts: voided?.length ?? 0,
          return_fee: returnFee || null, actor: actor.kind, actor_email: actor.email ?? null,
        },
      });
      return; // goods never left the vendor — nothing to restock
    }
    // we_collect: the payable stands; fold in any round-trip fee and zero
    // the unearned margin.
    await syncReturnChargeToVendor(orderId, order.vendor_id, returnFee);
  }
  await restockReturnedItems(admin, actor, order);
}

/** Best-effort wrapper for the automated (cron/webhook) paths: never throws,
 *  logs failures loudly instead of swallowing them. */
export async function applyReturnFinancialsSafe(orderId: string): Promise<void> {
  try {
    await applyReturnFinancialsForOrder(orderId, { kind: 'system' });
  } catch (err) {
    log.error('return_financials.auto_apply_failed', {
      order_id: orderId, error: err instanceof Error ? err.message : String(err),
    });
  }
}
