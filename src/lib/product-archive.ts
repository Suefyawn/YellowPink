import { supabaseAdmin } from '@/lib/supabase';
import { log } from '@/lib/logger';

// Orders snapshot their line items as denormalised jsonb keyed by product id.
// A product that appears in any such snapshot must be archived rather than
// hard-deleted: Analytics joins those ids back to the products table for the
// display name, and the order detail view reads it too. Returns the subset of
// `ids` that have order history.
export async function productsWithOrderHistory(ids: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  if (ids.length === 0) return found;
  const admin = supabaseAdmin();
  await Promise.all(
    ids.map(async id => {
      // `contains` must receive the jsonb containment value as a JSON string.
      // Passing the array directly makes postgrest-js serialise it as a
      // Postgres array literal (`cs.{[object Object]}`), which never matches
      // jsonb — the query errored, `count` stayed undefined, and every
      // product looked order-free (so it got hard-deleted).
      const { count, error } = await admin
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .contains('items', JSON.stringify([{ id }]));
      if (error) {
        // Fail safe: if we can't prove the product is unreferenced, treat it
        // as referenced so it's archived rather than hard-deleted.
        log.error('product_archive.order_history_check_failed', { product_id: id, error: error.message });
        found.add(id);
        return;
      }
      if ((count ?? 0) > 0) found.add(id);
    }),
  );
  return found;
}
