'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { assertPermission } from '@/lib/admin-auth';
import { logAudit } from '@/lib/audit';

// ─── Manual stock adjustment ────────────────────────────────────────────────
// Goes through the `record_stock_change` RPC (migration 078) so the stock
// scalar and the ledger row are written atomically. The RPC is restricted
// to service-role; we route via supabaseAdmin() here.
//
// `reason` is one of the inventory_reason enum values. The form surfaces
// 'restock' / 'adjustment' / 'damage' as the user-facing choices; 'order'
// and 'return' are driven by their respective flows (place_order RPC,
// return-received transition) and not exposed in this form.
export async function adjustStock(formData: FormData): Promise<void> {
  const session = await assertPermission('products.edit');
  const productId = (formData.get('product_id') as string) || null;
  const variantId = (formData.get('variant_id') as string) || null;
  const qtyDelta  = Number(formData.get('qty_delta') ?? 0);
  const reason    = (formData.get('reason') as string) || 'adjustment';
  const note      = (formData.get('note') as string)?.trim() || null;

  if (!productId && !variantId) {
    redirect('/admin/inventory?error=' + encodeURIComponent('Pick a product or variant.'));
  }
  if (!qtyDelta || !Number.isInteger(qtyDelta)) {
    redirect('/admin/inventory?error=' + encodeURIComponent('Enter a non-zero integer delta.'));
  }
  if (!['restock', 'adjustment', 'damage'].includes(reason)) {
    redirect('/admin/inventory?error=' + encodeURIComponent('Unsupported reason for manual adjustment.'));
  }
  // The sign must agree with the reason: a restock adds stock, damage
  // removes it. Only 'adjustment' is free to go either way. Without this
  // a typo'd sign would silently book the opposite movement.
  if (reason === 'restock' && qtyDelta < 0) {
    redirect('/admin/inventory?error=' + encodeURIComponent('Restock must be a positive quantity, use Damage or Adjustment to remove stock.'));
  }
  if (reason === 'damage' && qtyDelta > 0) {
    redirect('/admin/inventory?error=' + encodeURIComponent('Damage must be a negative quantity, use Restock or Adjustment to add stock.'));
  }

  const { data, error } = await supabaseAdmin().rpc('record_stock_change' as never, {
    p_product_id:  productId,
    p_variant_id:  variantId,
    p_qty_delta:   qtyDelta,
    p_reason:      reason,
    p_actor_kind:  session.isOwner ? 'owner' : 'staff',
    p_actor_email: session.email,
    p_note:        note,
  } as never) as unknown as { data: Array<{ ledger_id: string; new_balance: number; applied_delta: number }> | null; error: { message: string } | null };

  if (error) {
    redirect('/admin/inventory?error=' + encodeURIComponent(error.message));
  }

  const result = data?.[0];

  void logAudit(session, {
    action: 'inventory.adjust',
    entity: variantId ? 'product_variants' : 'products',
    entity_id: variantId ?? productId,
    diff: { qty_delta: result?.applied_delta ?? qtyDelta, requested_delta: qtyDelta, reason, note, new_balance: result?.new_balance },
  });

  revalidatePath('/admin/inventory');
  if (productId) revalidatePath(`/admin/products/${productId}`);

  // Stock can't go below zero: record_stock_change clamps the removal and
  // reports the delta it actually applied (migration 300). Warn the operator
  // instead of claiming plain success so a fat-fingered count gets noticed.
  if (result && result.applied_delta !== qtyDelta) {
    redirect('/admin/inventory?warn=' + encodeURIComponent(
      `Stock cannot go below zero: applied ${result.applied_delta} of the requested ${qtyDelta}. New balance: ${result.new_balance}. The ledger records the applied amount.`,
    ));
  }
  redirect('/admin/inventory?ok=1');
}
