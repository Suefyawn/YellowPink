// Every stock change goes through the ledger.
//
// Five admin paths used to write products.stock / product_variants.stock as a
// plain column update: the product form, the inline quick-edit, the variant
// form, the CSV importer and duplicate-product. The number moved and Movement
// history said nothing, so "why is this 12?" had no answer — which is exactly
// what makes a count untrustworthy, and the reason the 2026-05-19 import seeds
// went unnoticed for three months.
//
// These helpers turn "set stock to N" into the signed delta the
// record_stock_change RPC wants, so the scalar and the ledger row are written
// together and every movement has an author, a reason and a note.

import { supabaseAdmin } from '@/lib/supabase';
import { log } from '@/lib/logger';

export interface StockActor {
  isOwner?: boolean;
  email?: string | null;
}

interface ReconcileArgs {
  productId: string;
  /** Set for a shade-level write; null for the parent counter. */
  variantId?: string | null;
  /** The absolute figure the operator typed. */
  nextStock: number;
  actor: StockActor;
  note: string;
}

/**
 * Move a product (or variant) to `nextStock` via the ledger. A no-op when the
 * figure is unchanged, so saving a product form without touching stock does not
 * litter Movement history with zero-delta rows.
 *
 * Returns the applied delta, or null when nothing was written. Never throws:
 * a failed ledger write is logged and reported, but must not roll back the
 * rest of an otherwise-good save.
 */
export async function reconcileStock({
  productId, variantId = null, nextStock, actor, note,
}: ReconcileArgs): Promise<{ delta: number } | null> {
  if (!Number.isInteger(nextStock) || nextStock < 0) return null;
  const admin = supabaseAdmin();

  const { data: current } = variantId
    ? await admin.from('product_variants').select('stock').eq('id', variantId).maybeSingle()
    : await admin.from('products').select('stock').eq('id', productId).maybeSingle();
  if (!current) return null;

  const delta = nextStock - ((current as { stock: number }).stock ?? 0);
  if (delta === 0) return null;

  const { error } = await admin.rpc('record_stock_change' as never, {
    p_product_id:  productId,
    p_variant_id:  variantId,
    p_qty_delta:   delta,
    p_reason:      'adjustment',
    p_actor_kind:  actor.isOwner ? 'owner' : 'staff',
    p_actor_email: actor.email ?? null,
    p_note:        note,
  } as never);

  if (error) {
    log.error('stock.reconcile_failed', { productId, variantId, delta, error: error.message });
    return null;
  }
  return { delta };
}

/**
 * Strip `stock` out of an update payload and hand back the figure separately,
 * so a caller can write the rest of the row normally and then reconcile the
 * count through the ledger. Keeps every call site honest about the split.
 */
export function splitStock<T extends Record<string, unknown>>(
  payload: T,
): { rest: Omit<T, 'stock'>; stock: number | null } {
  const { stock, ...rest } = payload as T & { stock?: unknown };
  const n = typeof stock === 'number' ? stock : typeof stock === 'string' ? Number(stock) : NaN;
  return { rest: rest as Omit<T, 'stock'>, stock: Number.isInteger(n) && n >= 0 ? n : null };
}
