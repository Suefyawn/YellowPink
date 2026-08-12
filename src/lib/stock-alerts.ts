// "We just sold the last one" — tell someone.
//
// Since a live listing keeps selling past zero, running out is now completely
// silent from the shopper's side: no sold-out badge, no failed checkout, no
// complaint. That is the point, but it means the only way anyone learns we are
// now selling something we do not physically have is if the system says so.
// Hence a bell entry plus a push, at the moment the count crosses to zero.
//
// Routing follows the existing model rather than inventing one: the bell row
// carries a `kind`, and notification-kinds.ts maps kinds to the permission a
// staff member needs to see them — 'products.edit', so whoever manages the
// catalogue gets it and a marketer does not. Push goes to every registered
// admin device (that is how sendAdminPush works; there is no per-kind device
// routing yet), and the owner is on all of them.
//
// Deliberately NOT an email: this fires on ordinary trading, potentially
// several times a day, and an inbox that cries wolf gets filtered. The bell is
// the durable record, the push is the nudge.

import { supabaseAdmin } from '@/lib/supabase';
import { sendAdminPush } from '@/lib/push';
import { log } from '@/lib/logger';
import { brandPlusName } from '@/lib/product-display';

interface RanOutRow {
  id: string;
  name: string;
  brand: string | null;
  stock: number;
  status: string;
  stock_mode: string;
  continue_selling_when_out: boolean | null;
}

/**
 * Alert for any of `productIds` that is now at zero, is stock we hold, is
 * live, and is still selling. Best-effort: never throws, so an order or an
 * admin save is never rolled back by a notification failure.
 *
 * Idempotent per crossing: a second sale while the count is still zero does
 * not re-alert, because an unread alert for that product already exists. Once
 * someone restocks and it sells out again, the earlier alert has been read (or
 * the restock cleared it), so the next crossing does notify.
 */
export async function notifyStockRanOut(productIds: string[]): Promise<void> {
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return;

  try {
    const admin = supabaseAdmin();
    const { data } = await admin
      .from('products')
      .select('id, name, brand, stock, status, stock_mode, continue_selling_when_out')
      .in('id', ids)
      .lte('stock', 0)
      .eq('status', 'published')
      .eq('stock_mode', 'own');

    const ranOut = ((data ?? []) as RanOutRow[])
      // A product the owner marked as a genuine sell-out shows an out-of-stock
      // badge, so the shopper already knows and the shop already stopped
      // selling it. The silent case is the one worth a push.
      .filter(p => p.continue_selling_when_out !== false);
    if (ranOut.length === 0) return;

    // One round trip for the dedupe rather than one per product.
    const { data: existing } = await admin
      .from('admin_notifications')
      .select('entity_id')
      .eq('kind', 'stock_out')
      .eq('read', false)
      .in('entity_id', ranOut.map(p => p.id));
    const alreadyPending = new Set(((existing ?? []) as Array<{ entity_id: string }>).map(r => r.entity_id));

    const fresh = ranOut.filter(p => !alreadyPending.has(p.id));
    if (fresh.length === 0) return;

    await admin.from('admin_notifications').insert(fresh.map(p => ({
      kind: 'stock_out',
      title: `Sold out: ${brandPlusName(p.brand, p.name)}`,
      body: 'The last one just went. The listing is still selling, so anything ordered now has to be sourced — restock it, or switch it to vendor-held if someone else is supplying it from here on.',
      link: '/admin/inventory',
      entity_id: p.id,
    })));

    await sendAdminPush({
      title: fresh.length === 1
        ? `Sold out: ${brandPlusName(fresh[0].brand, fresh[0].name)}`
        : `${fresh.length} products just sold out`,
      body: 'Still selling, so orders need sourcing. Tap to restock.',
      url: '/admin/inventory',
      // Same tag collapses a burst into one banner instead of a stack.
      tag: 'yp-stock-out',
    });
  } catch (err) {
    log.warn('stock.ran_out_alert_failed', { err: err instanceof Error ? err.message : String(err) });
  }
}
