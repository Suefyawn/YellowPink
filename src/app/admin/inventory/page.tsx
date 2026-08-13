export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { brandPlusName } from '@/lib/product-display';
import { adjustStock } from '@/app/admin/inventory-actions';
import { InventoryStockSearch } from '@/components/admin/InventoryStockSearch';
import type { StockMode } from '@/types';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { PK_TZ } from '@/lib/dates';
import { KpiCard } from '@/components/admin/insights/KpiCard';
import { DotChip } from '@/components/admin/OrderChips';

interface LedgerRow {
  id: string;
  product_id: string | null;
  variant_id: string | null;
  qty_delta: number;
  balance_after: number | null;
  reason: 'import' | 'order' | 'return' | 'restock' | 'adjustment' | 'damage' | 'transfer' | 'cancellation';
  order_id: string | null;
  actor_kind: 'system' | 'owner' | 'staff' | 'customer';
  actor_email: string | null;
  note: string | null;
  created_at: string;
}

interface ProductLite { id: string; name: string; brand: string | null; stock: number; reorder_point?: number; vendor_id?: string | null; track_inventory?: boolean; stock_mode?: StockMode; status?: string; continue_selling_when_out?: boolean | null }
interface OrderLite { id: string; order_number: string }

const LOW_STOCK_THRESHOLD = 5;

// Foreground colours only, DotChip derives its own soft tint.
const reasonColors: Record<LedgerRow['reason'], string> = {
  import:       '#3730a3',
  order:        '#9d174d',
  return:       '#065f46',
  cancellation: '#5b21b6',
  restock:      '#065f46',
  adjustment:   '#92400e',
  damage:       '#991b1b',
  transfer:     '#374151',
};

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function reasonHref(product: string | undefined, reason?: string): string {
  const p = new URLSearchParams();
  if (product) p.set('product', product);
  if (reason) p.set('reason', reason);
  const s = p.toString();
  return s ? `/admin/inventory?${s}` : '/admin/inventory';
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });

/** Stock state for stock we hold. At zero the label depends on the selling
 *  gate: since the never-out-of-stock change, most listings keep selling past
 *  zero (orders get sourced), and calling that "Out of stock" here made the
 *  owner think shoppers were seeing a dead listing. Only a product that has
 *  opted into genuine sell-outs actually refuses orders at zero. */
function stockBadge(stock: number, keepsSelling: boolean): { label: string; color: string } {
  if (stock <= 0) {
    return keepsSelling
      ? { label: 'Sold out, still selling', color: '#5b21b6' }
      : { label: 'Out of stock', color: '#991b1b' };
  }
  if (stock <= LOW_STOCK_THRESHOLD) return { label: 'Low', color: '#92400e' };
  return { label: 'In stock', color: '#065f46' };
}

/** Is the listing on the storefront at all? Everything else on this screen is
 *  moot for a draft — a count of 0 on a draft needs no attention, while the
 *  same 0 on a live listing means orders are being taken against goods we
 *  don't hold. */
function listingBadge(status: string | undefined): { label: string; color: string } {
  if (status === 'published') return { label: 'Live', color: '#065f46' };
  return { label: titleCase(status ?? 'draft'), color: '#6b7280' };
}

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<{ product?: string; reason?: string; error?: string; ok?: string; warn?: string; view?: string; q?: string }> }) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('products.view'))) {
    return <NoAccess section="Inventory" />;
  }

  const { product: productFilter, reason: reasonFilter, error: errMsg, ok: okMsg, warn: warnMsg, view, q } = await searchParams;
  const stockQuery = (q ?? '').trim().toLowerCase();
  const admin = supabaseAdmin();

  let ledgerQuery = admin
    .from('inventory_ledger')
    .select('id, product_id, variant_id, qty_delta, balance_after, reason, order_id, actor_kind, actor_email, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (productFilter) ledgerQuery = ledgerQuery.eq('product_id', productFilter);
  if (reasonFilter && reasonFilter !== 'all') {
    ledgerQuery = ledgerQuery.eq('reason', reasonFilter);
  } else if (!reasonFilter) {
    // The 2026-05-19 backfill is 285 of the ~330 ledger rows, so the default
    // 200-row window was 155 rows of one day's import and only 45 rows of real
    // movement. Hide it unless it is asked for — the Import chip still shows it.
    ledgerQuery = ledgerQuery.neq('reason', 'import');
  }

  // Pull every product so the manual-adjustment form has a dropdown.
  // 109 SKUs today, well under any sane limit.
  const [{ data: ledgerData }, { data: productData }, { data: variantStockRows }] = await Promise.all([
    ledgerQuery,
    admin.from('products')
      .select('id, name, brand, stock, reorder_point, vendor_id, track_inventory, stock_mode, status, continue_selling_when_out')
      .neq('status', 'archived')
      .order('name'),
    // Shade-level counts. For a product with variants the parent scalar is an
    // aggregate that nothing maintains — NARS reads 1 at the parent against 328
    // across 33 shades — so judging "needs reorder" by it would have the panel
    // crying wolf the first time anyone opened it.
    admin.from('product_variants').select('product_id, stock').eq('enabled', true),
  ]);
  const rows = (ledgerData ?? []) as LedgerRow[];
  const variantTotals = new Map<string, number>();
  for (const v of (variantStockRows ?? []) as Array<{ product_id: string; stock: number | null }>) {
    variantTotals.set(v.product_id, (variantTotals.get(v.product_id) ?? 0) + (v.stock ?? 0));
  }
  /** What this product actually has on the shelf: the sum of its shades when it
   *  has any, otherwise its own counter. */
  const effectiveStock = (p: ProductLite) => variantTotals.get(p.id) ?? p.stock;
  const allProducts = (productData ?? []) as ProductLite[];
  const productMap = new Map<string, ProductLite>(allProducts.map(p => [p.id, p]));
  // Only stock we physically hold is countable. 'external' (a vendor holds it)
  // and 'untracked' (we deliberately keep no count) both have nothing to count
  // or adjust here — but 'external' is worth showing as its own list, because
  // "we stock 100 things we never see" is a fact the owner needs, and it used
  // to be invisible on this screen.
  const countable = (p: ProductLite) => (p.stock_mode ?? (p.track_inventory === false ? 'untracked' : 'own')) === 'own';
  const products = allProducts.filter(countable);
  const externalProducts = allProducts.filter(p => p.stock_mode === 'external');

  // Stock overview, buckets + the lowest-first sorted list.
  const outOfStock = products.filter(p => effectiveStock(p) <= 0);
  const lowStock = products.filter(p => effectiveStock(p) > 0 && effectiveStock(p) <= LOW_STOCK_THRESHOLD);
  const healthyCount = products.length - outOfStock.length - lowStock.length;
  // "Needs attention" is the default view; the owner can switch to the full list.
  // A search spans the whole catalogue (regardless of the attention/all toggle)
  // so a product is always findable by name or brand.
  const showAll = view === 'all';
  const showExternal = view === 'external';
  const stockList = [...products].sort((a, b) => effectiveStock(a) - effectiveStock(b));
  const attentionList = stockList.filter(p => effectiveStock(p) <= LOW_STOCK_THRESHOLD);
  const searching = stockQuery.length > 0;
  const visibleStock = searching
    ? [...allProducts].filter(p => brandPlusName(p.brand, p.name).toLowerCase().includes(stockQuery))
    : showExternal ? externalProducts
    : showAll ? stockList : attentionList;

  // Resolve order ids to order numbers for the rows that link to an order.
  const orderIds = Array.from(new Set(rows.map(r => r.order_id).filter((v): v is string => Boolean(v))));
  const { data: orderData } = orderIds.length
    ? await admin.from('orders').select('id, order_number').in('id', orderIds)
    : { data: [] };
  const orderMap = new Map<string, OrderLite>(((orderData ?? []) as OrderLite[]).map(o => [o.id, o]));

  // ─── Reorder needed ──────────────────────────────────────────────────────
  // Tracked products at/below their per-product reorder point, grouped by
  // vendor with a WhatsApp purchase-order link. Suggested qty tops the SKU
  // back up to ~2× its reorder point.
  const reorderList = products
    .filter(p => (p.reorder_point ?? 0) > 0 && effectiveStock(p) <= (p.reorder_point ?? 0))
    .sort((a, b) => effectiveStock(a) - effectiveStock(b));
  const suggestQty = (p: ProductLite) => Math.max((p.reorder_point ?? 0) * 2 - effectiveStock(p), 1);
  const reorderVendorIds = Array.from(new Set(reorderList.map(p => p.vendor_id).filter((v): v is string => Boolean(v))));
  const { data: vendorData } = reorderVendorIds.length
    ? await admin.from('vendors').select('id, name, phone').in('id', reorderVendorIds)
    : { data: [] };
  const vendorMap = new Map<string, { id: string; name: string; phone: string | null }>(
    ((vendorData ?? []) as Array<{ id: string; name: string; phone: string | null }>).map(v => [v.id, v]),
  );
  const reorderByVendor = new Map<string, ProductLite[]>();
  for (const p of reorderList) {
    const key = p.vendor_id ?? 'none';
    const arr = reorderByVendor.get(key) ?? [];
    arr.push(p);
    reorderByVendor.set(key, arr);
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Inventory</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Current stock levels at a glance, plus a permanent audit trail of every movement.
        {allProducts.length - products.length > 0 && ` Showing ${products.length} inventory-managed products; ${allProducts.length - products.length} more have stock managed externally and aren't tracked here.`}
      </p>

      {errMsg && (
        <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{errMsg}</div>
      )}
      {warnMsg && (
        <div role="alert" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{warnMsg}</div>
      )}
      {okMsg && (
        <div role="status" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>Stock updated.</div>
      )}

      {/* ─── Stock summary ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 20 }} className="adm-stat-grid">
        <KpiCard label="Out of stock" value={outOfStock.length} accent="#dc2626" />
        <KpiCard label={`Low stock (≤ ${LOW_STOCK_THRESHOLD})`} value={lowStock.length} accent="#d97706" />
        <KpiCard label="Healthy" value={healthyCount} accent="#16a34a" />
      </div>

      {/* ─── Reorder needed ─────────────────────────────────────────────── */}
      {reorderList.length > 0 && (
        <div style={{ background: 'white', borderRadius: 10, border: '1px solid #fde68a', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', background: '#fffbeb' }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 700, color: '#92400e' }}>
              Reorder needed · {reorderList.length} product{reorderList.length === 1 ? '' : 's'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#b45309' }}>
              At or below their reorder point. Grouped by vendor, send a purchase order on WhatsApp in one tap.
            </p>
          </div>
          <div style={{ padding: '8px 16px 16px' }}>
            {Array.from(reorderByVendor.entries()).map(([key, items]) => {
              const vendor = key === 'none' ? null : vendorMap.get(key);
              const vendorName = vendor?.name ?? 'No vendor assigned';
              const poMessage = [
                'Yellow Pink, Reorder request',
                '',
                // effectiveStock, not p.stock: for a variant product the parent
                // counter is stale (caught on a live screenshot — Rhode showed
                // "in stock: 40" while its shades held 0).
                ...items.map(p => `• ${suggestQty(p)}× ${brandPlusName(p.brand, p.name)} (in stock: ${effectiveStock(p)})`),
              ].join('\n');
              const waHref = vendor?.phone ? whatsappUrlForCustomer(vendor.phone, poMessage) : null;
              return (
                <div key={key} style={{ marginTop: 12, border: '1px solid #f3f4f6', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 14px', borderBottom: '1px solid #f3f4f6', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{vendorName}</span>
                    {waHref ? (
                      <a href={waHref} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#25D366', color: '#fff', textDecoration: 'none', padding: '6px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 600 }}>
                        Send PO on WhatsApp
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{key === 'none' ? 'Assign a vendor to send a PO' : 'No vendor phone on file'}</span>
                    )}
                  </div>
                  <div className="adm-table-scroll">
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                      <thead>
                        <tr style={{ background: '#fafafa' }}>
                          {['Product', 'In stock', 'Reorder at', 'Suggest order'].map((h, i) => (
                            <th scope="col" key={h} style={{ padding: '8px 14px', textAlign: i === 0 ? 'left' : 'right', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map(p => (
                          <tr key={p.id} style={{ borderTop: '1px solid #f9fafb' }}>
                            <td style={{ padding: '8px 14px' }}>
                              <Link href={`/admin/products/${p.id}`} style={{ color: '#111827', textDecoration: 'none', fontWeight: 500 }}>{brandPlusName(p.brand, p.name)}</Link>
                              {p.status !== 'published' && (
                                <span style={{ marginLeft: 8, display: 'inline-block' }}>
                                  <DotChip label={titleCase(p.status ?? 'draft')} color="#6b7280" />
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: effectiveStock(p) <= 0 ? '#991b1b' : '#92400e' }}>{effectiveStock(p)}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', color: '#6b7280' }}>{p.reorder_point}</td>
                            <td style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600 }}>{suggestQty(p)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── Stock levels table ─────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            {searching
              ? `Search results (${visibleStock.length})`
              : showExternal ? `Externally managed (${externalProducts.length})`
              : showAll ? 'All products' : 'Needs attention'}
          </h2>
          <div style={{ display: 'flex', gap: 8, fontSize: '0.8125rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <InventoryStockSearch />
            <Link href="/admin/inventory" style={chipLink(!showAll && !showExternal && !searching)}>Needs attention</Link>
            <Link href="/admin/inventory?view=all" style={chipLink(showAll && !searching)}>All products</Link>
            <Link href="/admin/inventory?view=external" style={chipLink(showExternal && !searching)}>
              Externally managed ({externalProducts.length})
            </Link>
          </div>
        </div>
        {visibleStock.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: searching ? '#9ca3af' : '#16a34a', fontSize: '0.875rem', fontWeight: 600 }}>
            {searching
              ? `No products match “${q}”.`
              : showExternal
                ? 'No products are marked as vendor-held. Set one on a product page under “Who holds this stock?”.'
                : 'Every product is in stock. Nothing needs restocking.'}
          </div>
        ) : (
          <div style={{ maxHeight: 440, overflowY: 'auto' }}>
            <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  {['Product', 'Stock', 'Status', 'Listing', ''].map(h => (
                    <th scope="col" key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleStock.map(p => {
                  const mode: StockMode = p.stock_mode ?? (p.track_inventory === false ? 'untracked' : 'own');
                  const shown = effectiveStock(p);
                  const fromShades = variantTotals.has(p.id);
                  // Absent flag = the column default = keeps selling.
                  const badge = mode === 'own'
                    ? stockBadge(shown, p.continue_selling_when_out !== false)
                    : mode === 'external'
                      ? { label: 'Vendor holds it', color: '#3730a3' }
                      : { label: 'Not counted', color: '#6b7280' };
                  const listing = listingBadge(p.status);
                  return (
                    <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                      <td data-label="Product" style={td}>
                        <Link href={`/admin/products/${p.id}`} style={{ color: '#111827', fontWeight: 500, textDecoration: 'none' }}>
                          {brandPlusName(p.brand, p.name)}
                        </Link>
                      </td>
                      {/* A count only means something for stock we hold. Printing
                          the stored number for a vendor-held product shows an
                          alarming red 0 for a product that is selling fine. */}
                      <td data-label="Stock" style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: mode !== 'own' ? '#9ca3af' : shown <= 0 ? '#991b1b' : shown <= LOW_STOCK_THRESHOLD ? '#92400e' : '#111827' }}>
                        {mode === 'own' ? shown : '–'}
                        {mode === 'own' && fromShades && (
                          <span style={{ display: 'block', fontFamily: 'inherit', fontWeight: 400, fontSize: '0.6875rem', color: '#6b7280' }}>
                            across shades
                          </span>
                        )}
                      </td>
                      <td data-label="Status" style={td}>
                        <DotChip label={badge.label} color={badge.color} />
                      </td>
                      <td data-label="Listing" style={td}>
                        <DotChip label={listing.label} color={listing.color} />
                      </td>
                      <td style={{ ...td, textAlign: 'right' }}>
                        <Link href={`/admin/products/${p.id}`} style={{ color: '#C5286A', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                          Edit →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Manual adjustment form ─────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Log a stock change</h2>
      <form
        action={adjustStock}
        className="adm-stock-form"
        style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}
      >
        <div>
          <label htmlFor="product_id" style={lbl}>Product</label>
          <select id="product_id" name="product_id" required style={inp} defaultValue={productFilter ?? ''}>
            <option value="" disabled>Choose a product</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {brandPlusName(p.brand, p.name)}, {p.stock} in stock
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="qty_delta" style={lbl}>Δ (signed)</label>
          <input id="qty_delta" name="qty_delta" type="number" required step="1" placeholder="e.g. -3 or 50" style={inp} />
        </div>
        <div>
          <label htmlFor="reason" style={lbl}>Reason</label>
          <select id="reason" name="reason" required style={inp} defaultValue="restock">
            <option value="restock">Restock (+)</option>
            <option value="adjustment">Adjustment (±)</option>
            <option value="damage">Damage (–)</option>
          </select>
        </div>
        <div>
          <label htmlFor="note" style={lbl}>Note (optional)</label>
          <input id="note" name="note" type="text" maxLength={200} placeholder="e.g. Vendor delivery PO-2025-04" style={inp} />
        </div>
        <button type="submit" style={btn}>Log change</button>
      </form>

      {/* ─── Movement history ───────────────────────────────────────────── */}
      <h2 style={{ margin: '0 0 10px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Movement history</h2>

      {/* Filters. Hrefs keep an active ?product= filter so switching reason
          doesn't silently drop the product scope. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: '0.8125rem', flexWrap: 'wrap' }}>
        <Link href={reasonHref(productFilter)} style={chipLink(!reasonFilter)}>All</Link>
        {(['order','return','cancellation','restock','adjustment','damage','import'] as const).map(r => (
          <Link key={r} href={reasonHref(productFilter, r)} style={chipLink(reasonFilter === r)}>
            {titleCase(r)}
          </Link>
        ))}
      </div>

      {/* Ledger table */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>No stock movements yet.</div>
        ) : (
          <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['When','Product','Δ','Balance','Reason','Order','Actor','Note'].map(h => (
                  <th scope="col" key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const product = r.product_id ? productMap.get(r.product_id) : null;
                const order = r.order_id ? orderMap.get(r.order_id) : null;
                const color = reasonColors[r.reason];
                return (
                  <tr key={r.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                    <td data-label="When" style={{ ...td, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td data-label="Product" style={td}>
                      {product
                        ? <Link href={`/admin/products/${product.id}`} style={{ color: '#C5286A', textDecoration: 'none' }}>{brandPlusName(product.brand, product.name)}</Link>
                        : <span style={{ color: '#9ca3af' }}>(variant {r.variant_id?.slice(0, 8)}…)</span>}
                    </td>
                    <td data-label="Δ" style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: r.qty_delta < 0 ? '#991b1b' : '#065f46' }}>
                      {r.qty_delta > 0 ? '+' : ''}{r.qty_delta}
                    </td>
                    <td data-label="Balance" style={{ ...td, fontFamily: 'monospace' }}>{r.balance_after ?? '—'}</td>
                    <td data-label="Reason" style={td}>
                      <DotChip label={titleCase(r.reason)} color={color} />
                    </td>
                    <td data-label="Order" style={{ ...td, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {order
                        ? <Link href={`/admin/orders/${order.id}`} style={{ color: '#C5286A', textDecoration: 'none' }}>{order.order_number}</Link>
                        : '—'}
                    </td>
                    <td data-label="Actor" style={{ ...td, fontSize: '0.75rem', color: '#374151' }}>
                      <DotChip
                        label={titleCase(r.actor_kind)}
                        color={r.actor_kind === 'owner' ? '#C5286A' : r.actor_kind === 'staff' ? '#3b82f6' : '#6b7280'}
                      />
                      {r.actor_email && <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{r.actor_email}</div>}
                    </td>
                    <td data-label="Note" style={{ ...td, fontSize: '0.75rem', color: '#374151', maxWidth: 280 }}>{r.note ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p style={{ marginTop: 12, fontSize: '0.75rem', color: '#9ca3af' }}>Showing the most recent 200 movements{reasonFilter ? ` for "${reasonFilter}"` : ''}.</p>
    </div>
  );
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 };
const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.875rem', background: 'white' };
const btn: React.CSSProperties = { padding: '9px 18px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
const th:  React.CSSProperties = { padding: '11px 16px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' };
const td:  React.CSSProperties = { padding: '10px 16px', verticalAlign: 'top' };
// System range-pill style (matches RangePicker): dark when active, grey idle.
const chipLink = (active: boolean): React.CSSProperties => ({
  padding: '5px 12px',
  borderRadius: 16,
  fontSize: '0.75rem',
  fontWeight: 600,
  background: active ? '#111827' : '#f3f4f6',
  color: active ? '#fff' : '#6b7280',
  textDecoration: 'none',
});
