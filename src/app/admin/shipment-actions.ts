'use server';

import { revalidatePath } from 'next/cache';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { logAudit } from '@/lib/audit';
import { getAdapter } from '@/lib/couriers';
import { attributeOrderEvents } from '@/lib/order-events';
import { sendStatusTransitionEmail } from '@/lib/order-status-emails';
import { notifyOrderShipmentTransition, orderStatusForShipment } from '@/lib/shipment-notify';
import { log } from '@/lib/logger';
import type { BookingInput } from '@/lib/couriers/types';
import type { StaffSession } from '@/lib/permissions';
import type { OrderStatus } from '@/types';

async function assertOrders() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.edit'))) {
    throw new Error('Unauthorized');
  }
  return session;
}

/** Pre-insert snapshot of the order used to decide, AFTER the shipment row
 *  lands, whether this booking is the transition to 'shipped'. Must be read
 *  BEFORE inserting into `shipments`: the sync_order_tracking_from_shipment
 *  trigger advances orders.status the moment the row is inserted, so a
 *  post-insert read would always see 'shipped' already. */
interface OrderShipSnapshot {
  status: OrderStatus | null;
  email: string | null;
  first_name: string | null;
  order_number: string;
  /** Existing courier cost, read pre-insert so an optional courier charge
   *  entered on the booking form never clobbers a recorded value. */
  delivery_cost: number | null;
}

async function getOrderShipSnapshot(orderId: string): Promise<OrderShipSnapshot | null> {
  const { data } = await supabaseAdmin()
    .from('orders')
    .select('status, email, first_name, order_number, delivery_cost')
    .eq('id', orderId)
    .single();
  return (data as OrderShipSnapshot | null) ?? null;
}

/** Optional "Courier charge (PKR)" field on the booking forms. Blank/invalid
 *  → null (ignored). */
function parseCourierCharge(v: FormDataEntryValue | null): number | null {
  const s = typeof v === 'string' ? v.trim() : '';
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Record what the courier bills for this parcel as orders.delivery_cost
 *  (the authoritative home — it feeds the Finance P&L), but ONLY when no
 *  delivery cost is recorded yet; an existing value is never clobbered
 *  (staff edit it in Order costs instead). Returns the amount written, or
 *  null when nothing was saved. */
async function saveCourierCharge(
  orderId: string,
  charge: number | null,
  currentDeliveryCost: number | null | undefined,
): Promise<number | null> {
  if (charge == null || currentDeliveryCost != null) return null;
  const { error } = await supabaseAdmin()
    .from('orders')
    .update({ delivery_cost: charge })
    .eq('id', orderId);
  if (error) {
    // The shipment itself is booked; a failed cost write shouldn't fail the
    // booking. Log and move on — the merchant can enter it in Order costs.
    log.error('shipment.save_courier_charge_failed', { order_id: orderId, charge, error: error.message });
    return null;
  }
  return charge;
}

/** After a successful booking (API or manual tracking entry), make sure the
 *  order is 'shipped' and send the customer the same shipped email the
 *  status-update path sends. The shipments trigger flips orders.status on
 *  insert, but the customer never got the shipped email (and the timeline
 *  never got operator attribution) unless the merchant remembered to also
 *  change the status by hand. `before` is the pre-insert snapshot; it makes
 *  this idempotent — an order that was ALREADY shipped (or delivered) before
 *  this booking is left untouched and NOT re-emailed. */
async function markOrderShipped(
  session: StaffSession,
  orderId: string,
  before: OrderShipSnapshot | null,
  tracking: { tracking_number: string; courier: string },
): Promise<{ markedShipped: boolean; emailed: boolean }> {
  if (!before) return { markedShipped: false, emailed: false };
  const status = (before.status ?? 'pending') as OrderStatus;
  if (status === 'shipped' || status === 'delivered') {
    return { markedShipped: false, emailed: false };
  }
  const admin = supabaseAdmin();
  // Usually a no-op (the shipments trigger already advanced it), but kept
  // explicit so the order still lands on 'shipped' if the trigger's status
  // mapping ever changes. A same-value update logs no duplicate order_event.
  const { error } = await admin.from('orders').update({ status: 'shipped' }).eq('id', orderId);
  if (error) {
    // The shipment row is already saved; don't fail the booking over the
    // status advance — log it and let the merchant see the stale status.
    log.error('shipment.mark_shipped_failed', { order_id: orderId, error: error.message });
    return { markedShipped: false, emailed: false };
  }
  // Attribute the transition the order_events trigger logged (it can only
  // stamp a generic 'staff') to the signed-in operator.
  await attributeOrderEvents(admin, [orderId], 'shipped', session);
  const emailed = Boolean(before.email);
  if (emailed) {
    void sendStatusTransitionEmail({
      email: before.email,
      first_name: before.first_name,
      order_number: before.order_number,
      tracking_number: tracking.tracking_number,
      courier: tracking.courier,
    }, 'shipped');
  }
  return { markedShipped: true, emailed };
}

export async function createShipment(
  _prev: { error?: string; success?: boolean; markedShipped?: boolean; emailed?: boolean; courierCharge?: number } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; markedShipped?: boolean; emailed?: boolean; courierCharge?: number }> {
  const session = await assertOrders();

  const order_id = formData.get('order_id');
  const courier  = formData.get('courier');
  const tracking_number = formData.get('tracking_number');
  if (typeof order_id !== 'string' || !order_id) return { error: 'order_id required' };
  if (typeof courier !== 'string' || !courier) return { error: 'courier required' };
  if (typeof tracking_number !== 'string' || !tracking_number) return { error: 'tracking_number required' };

  const weightRaw = formData.get('weight_grams');
  const weight_grams = typeof weightRaw === 'string' && weightRaw ? Number(weightRaw) : null;

  // Snapshot BEFORE the insert; the shipments trigger advances orders.status.
  const before = await getOrderShipSnapshot(order_id);

  const { data, error } = await supabaseAdmin().from('shipments').insert({
    order_id,
    courier,
    tracking_number: tracking_number.trim(),
    weight_grams,
    status: 'picked_up',
  }).select('id').single();

  if (error) return { error: error.message };

  await logAudit(session, {
    action: 'shipment.create',
    entity: 'shipment',
    entity_id: data?.id as string | undefined,
    diff: { order_id, courier, tracking_number },
  });

  const shipped = await markOrderShipped(session, order_id, before, {
    tracking_number: tracking_number.trim(),
    courier,
  });

  const courierCharge = await saveCourierCharge(
    order_id, parseCourierCharge(formData.get('courier_charge')), before?.delivery_cost,
  );

  revalidatePath(`/admin/orders/${order_id}`);
  revalidatePath('/admin/orders');
  return { success: true, ...shipped, ...(courierCharge != null ? { courierCharge } : {}) };
}

// ─── Book via courier API (currently TCS, more couriers as adapters ship) ─
//
// Flow:
//   1. Validate session has the 'orders.edit' permission.
//   2. Look up the courier adapter; if not configured, return an error
//      telling the merchant which env vars to set.
//   3. Pull the order from Supabase so we have the consignee details.
//   4. Call adapter.book(...). On success, persist a shipment row with the
//      tracking number the courier assigned. On failure, return the
//      adapter's message verbatim, the UI shows it to the merchant.
//
// The merchant ALWAYS has the manual `createShipment` fallback above, so a
// courier outage / API hiccup never blocks fulfillment.
export async function bookShipment(
  _prev: { error?: string; success?: boolean; trackingNumber?: string; markedShipped?: boolean; emailed?: boolean; courierCharge?: number } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; trackingNumber?: string; markedShipped?: boolean; emailed?: boolean; courierCharge?: number }> {
  const session = await assertOrders();

  const order_id = formData.get('order_id');
  const courier  = formData.get('courier');
  if (typeof order_id !== 'string' || !order_id) return { error: 'order_id required' };
  if (typeof courier !== 'string' || !courier) return { error: 'courier required' };

  const adapter = getAdapter(courier);
  if (!adapter) {
    return { error: `${courier} has no API adapter configured, use manual entry instead.` };
  }

  // Pull the order so we can give the courier the consignee + line items.
  // `status` doubles as the pre-booking snapshot for markOrderShipped (the
  // shipments trigger advances it as soon as the shipment row is inserted).
  const { data: order, error: orderErr } = await supabaseAdmin()
    .from('orders')
    .select('status, order_number, total, first_name, last_name, phone, email, address, city, province, zip, items, delivery_cost')
    .eq('id', order_id)
    .single();
  if (orderErr || !order) return { error: orderErr?.message ?? 'Order not found' };
  const before: OrderShipSnapshot = {
    status: (order.status ?? 'pending') as OrderStatus,
    email: order.email ?? null,
    first_name: order.first_name ?? null,
    order_number: order.order_number ?? order_id,
    delivery_cost: order.delivery_cost != null ? Number(order.delivery_cost) : null,
  };

  // Weight: estimate from line items if any have weight_grams; otherwise
  // a conservative 0.5 kg minimum (TCS's lower bound).
  const items = Array.isArray(order.items) ? order.items as Array<{ name?: string; qty?: number; price?: number; weight_grams?: number }> : [];
  const totalGrams = items.reduce((g, it) => g + (it.weight_grams ?? 0) * (it.qty ?? 1), 0);
  const weightKg = totalGrams > 0 ? totalGrams / 1000 : 0.5;

  const weightOverride = formData.get('weight_kg');
  const pieceOverride = formData.get('pieces');

  const input: BookingInput = {
    orderNumber: order.order_number ?? order_id,
    consignee: {
      firstName: order.first_name ?? 'Customer',
      lastName: order.last_name ?? undefined,
      phone: order.phone ?? '',
      email: order.email,
      address1: order.address ?? '',
      city: order.city ?? '',
      province: order.province,
      zip: order.zip,
    },
    weightKg: typeof weightOverride === 'string' && weightOverride
      ? Math.max(0.5, Number(weightOverride))
      : weightKg,
    pieces: typeof pieceOverride === 'string' && pieceOverride
      ? Math.max(1, Number(pieceOverride))
      : 1,
    codAmount: Number(order.total) || 0,
    items: items.map(it => ({
      description: it.name ?? 'Item',
      quantity: it.qty ?? 1,
      weightKg: it.weight_grams ? it.weight_grams / 1000 : 0.5,
      unitPrice: it.price ?? 0,
    })),
    remarks: `Yellow Pink order ${order.order_number}`,
  };

  const result = await adapter.book(input);
  if (!('ok' in result) || !result.ok) {
    void logAudit(session, {
      action: 'shipment.book_failed',
      entity: 'orders',
      entity_id: order_id,
      diff: { courier, message: result.message, code: result.code },
    });
    return { error: result.message };
  }

  // Fetch the printable label/AWB PDF (TCS exposes it via a separate endpoint,
  // not the booking response). Best-effort — a label miss never blocks the
  // booking; staff can re-print from the courier portal.
  let labelUrl = result.labelUrl ?? null;
  if (!labelUrl && adapter.label) {
    const lbl = await adapter.label(result.trackingNumber);
    if ('ok' in lbl && lbl.ok) labelUrl = lbl.url;
  }

  // Persist the shipment row. The shipments_sync_order trigger (see
  // 20260521_040_shipments.sql) mirrors tracking_number + courier onto
  // orders for the /track + /account UI.
  const { data: shipment, error: insErr } = await supabaseAdmin()
    .from('shipments')
    .insert({
      order_id,
      courier,
      tracking_number: result.trackingNumber,
      weight_grams: Math.round(input.weightKg * 1000),
      raw_label_url: labelUrl,
      status: 'picked_up',
    })
    .select('id')
    .single();
  if (insErr) return { error: insErr.message };

  void logAudit(session, {
    action: 'shipment.book',
    entity: 'shipment',
    entity_id: shipment?.id ?? null,
    diff: { courier, order_id, tracking_number: result.trackingNumber },
  });

  const shipped = await markOrderShipped(session, order_id, before, {
    tracking_number: result.trackingNumber,
    courier,
  });

  const courierCharge = await saveCourierCharge(
    order_id, parseCourierCharge(formData.get('courier_charge')), before.delivery_cost,
  );

  revalidatePath(`/admin/orders/${order_id}`);
  revalidatePath('/admin/orders');
  return { success: true, trackingNumber: result.trackingNumber, ...shipped, ...(courierCharge != null ? { courierCharge } : {}) };
}

// ─── On-demand tracking sync ──────────────────────────────────────────────
// The courier-sync cron only runs daily (Vercel schedule), so staff need a way
// to pull the latest scans for one order on demand — e.g. to confirm a delivery
// or chase a stuck parcel. Same logic as the cron for one shipment: fetch scans
// via the adapter, append new shipment_events, advance status, and (on a
// shipped/delivered edge) attribute the order event + email the customer.
export async function syncShipmentNow(
  _prev: { error?: string; success?: boolean; updated?: boolean; current?: string } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean; updated?: boolean; current?: string }> {
  const session = await assertOrders();

  const shipment_id = formData.get('shipment_id');
  if (typeof shipment_id !== 'string' || !shipment_id) return { error: 'shipment_id required' };

  const admin = supabaseAdmin();
  const { data: s, error: lookupErr } = await admin
    .from('shipments')
    .select('id, order_id, courier, tracking_number, status')
    .eq('id', shipment_id)
    .single();
  if (lookupErr || !s) return { error: lookupErr?.message ?? 'Shipment not found' };

  const adapter = getAdapter(s.courier);
  if (!adapter || !adapter.capabilities.track) {
    return { error: `${s.courier} has no live tracking API — open the courier's own tracking page for updates.` };
  }

  const r = await adapter.track(s.tracking_number);
  if (!('ok' in r) || !r.ok) return { error: r.message };

  // Dedupe vs. events we already have (same rule as the cron).
  const { data: latest } = await admin
    .from('shipment_events')
    .select('occurred_at')
    .eq('shipment_id', s.id)
    .order('occurred_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const since = latest?.occurred_at ? new Date(latest.occurred_at as string).getTime() : 0;
  const newEvents = r.events
    .filter(e => new Date(e.occurredAt).getTime() > since)
    .map(e => ({
      shipment_id: s.id,
      status: e.status,
      description: e.description,
      occurred_at: e.occurredAt,
      raw_payload: null,
    }));
  if (newEvents.length > 0) await admin.from('shipment_events').insert(newEvents);

  const newest = r.current ?? r.events[0]?.status;
  let updated = false;
  if (newest && newest !== s.status) {
    const update: Record<string, unknown> = { status: newest };
    if (newest === 'delivered') update.delivered_at = r.events[0]?.occurredAt ?? new Date().toISOString();
    await admin.from('shipments').update(update).eq('id', s.id);
    updated = true;
    // Attribute the order-status advance the trigger logs, then email the
    // customer on the transition edge (shipped / delivered).
    const target = orderStatusForShipment(newest);
    if (target) await attributeOrderEvents(admin, [s.order_id], target, session);
    await notifyOrderShipmentTransition(admin, s.order_id, s.status, newest);
  }

  await logAudit(session, {
    action: 'shipment.sync',
    entity: 'shipment',
    entity_id: s.id,
    diff: { courier: s.courier, from: s.status, to: newest ?? s.status },
  });
  revalidatePath(`/admin/orders/${s.order_id}`);
  revalidatePath('/admin/orders');
  return { success: true, updated, current: newest ?? s.status };
}

// ─── TCS payment reconciliation ───────────────────────────────────────────
// Pull the courier's billing ledger (Payment Detail API) for a date range and
// write the ACTUAL delivery charge (courier charge + GST) back onto each
// matching order's delivery_cost — so the shipping-margin figures run on real
// courier costs instead of a manually-keyed estimate. Best-effort per record;
// a courier that can't reconcile (no adapter / no TCS_CUSTOMER_NO) returns a
// clear message.
export async function reconcileTcsPayments(
  _prev: { error?: string; success?: boolean; scanned?: number; matched?: number; updated?: number } | null,
  formData: FormData,
): Promise<{ error?: string; success?: boolean; scanned?: number; matched?: number; updated?: number }> {
  const session = await assertOrders();

  const adapter = getAdapter('TCS');
  if (!adapter || !adapter.payment) {
    return { error: 'TCS payment reconciliation isn’t available — set TCS_CUSTOMER_NO (and the TCS API keys) first.' };
  }

  const daysRaw = formData.get('days');
  const days = typeof daysRaw === 'string' && daysRaw ? Math.min(180, Math.max(1, Number(daysRaw))) : 30;
  const fmtDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const now = Date.now();
  const res = await adapter.payment(fmtDate(now - days * 86_400_000), fmtDate(now));
  if (!('ok' in res) || !res.ok) return { error: res.message };

  const admin = supabaseAdmin();
  let matched = 0;
  let updated = 0;
  for (const rec of res.records) {
    if (!rec.trackingNumber || rec.deliveryCharges == null) continue;
    // The real cost to us is the courier charge plus GST on it.
    const cost = Math.round(rec.deliveryCharges + (rec.gst ?? 0));
    const { data: ord } = await admin
      .from('orders')
      .select('id, delivery_cost')
      .eq('tracking_number', rec.trackingNumber)
      .maybeSingle();
    if (!ord) continue;
    matched++;
    if (Number((ord as { delivery_cost: number | null }).delivery_cost ?? NaN) === cost) continue;
    const { error } = await admin.from('orders').update({ delivery_cost: cost }).eq('id', (ord as { id: string }).id);
    if (!error) updated++;
  }

  await logAudit(session, {
    action: 'shipment.reconcile_payments',
    entity: 'orders',
    diff: { courier: 'TCS', days, scanned: res.records.length, matched, updated },
  });
  revalidatePath('/admin/finance');
  revalidatePath('/admin/orders');
  return { success: true, scanned: res.records.length, matched, updated };
}

// ─── Cancel a shipment via courier API ────────────────────────────────────
// Manual shipments (those entered with createShipment) can also be marked
// cancelled; we just skip the API call and only update the DB.
export async function cancelShipment(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const session = await assertOrders();

  const shipment_id = formData.get('shipment_id');
  if (typeof shipment_id !== 'string' || !shipment_id) return { error: 'shipment_id required' };

  const { data: shipment, error: lookupErr } = await supabaseAdmin()
    .from('shipments')
    .select('id, order_id, courier, tracking_number, status')
    .eq('id', shipment_id)
    .single();
  if (lookupErr || !shipment) return { error: lookupErr?.message ?? 'Shipment not found' };

  // Try the API first; if there's no adapter, that's fine, we still mark
  // the DB row cancelled (the merchant has presumably called the courier
  // by phone or used the courier's web portal).
  const adapter = getAdapter(shipment.courier);
  let apiNote = 'manual cancel (no adapter)';
  if (adapter) {
    const r = await adapter.cancel(shipment.tracking_number);
    if (!('ok' in r) || !r.ok) {
      // Don't fail the action, the merchant explicitly asked to cancel.
      // Log it and continue with the local update.
      apiNote = `API cancel failed: ${r.message}`;
    } else {
      apiNote = 'API cancel OK';
    }
  }

  const { error: updErr } = await supabaseAdmin()
    .from('shipments')
    .update({ status: 'cancelled' })
    .eq('id', shipment_id);
  if (updErr) return { error: updErr.message };

  void logAudit(session, {
    action: 'shipment.cancel',
    entity: 'shipment',
    entity_id: shipment_id,
    diff: { courier: shipment.courier, tracking_number: shipment.tracking_number, note: apiNote },
  });

  revalidatePath(`/admin/orders/${shipment.order_id}`);
  revalidatePath('/admin/orders');
  return { success: true };
}
