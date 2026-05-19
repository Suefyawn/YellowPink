export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { brandPlusName } from '@/lib/product-display';
import { adjustStock } from '@/app/admin/inventory-actions';

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

interface ProductLite { id: string; name: string; brand: string | null; stock: number }
interface OrderLite { id: string; order_number: string }

const reasonColors: Record<LedgerRow['reason'], { bg: string; fg: string }> = {
  import:       { bg: '#eef2ff', fg: '#3730a3' },
  order:        { bg: '#fce7f3', fg: '#9d174d' },
  return:       { bg: '#d1fae5', fg: '#065f46' },
  cancellation: { bg: '#ede9fe', fg: '#5b21b6' },
  restock:      { bg: '#d1fae5', fg: '#065f46' },
  adjustment:   { bg: '#fef3c7', fg: '#92400e' },
  damage:       { bg: '#fee2e2', fg: '#991b1b' },
  transfer:     { bg: '#e5e7eb', fg: '#374151' },
};

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

export default async function InventoryPage({
  searchParams,
}: { searchParams: Promise<{ product?: string; reason?: string; error?: string; ok?: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('products')) {
    return <NoAccess section="Inventory" />;
  }

  const { product: productFilter, reason: reasonFilter, error: errMsg, ok: okMsg } = await searchParams;
  const admin = supabaseAdmin();

  let ledgerQuery = admin
    .from('inventory_ledger')
    .select('id, product_id, variant_id, qty_delta, balance_after, reason, order_id, actor_kind, actor_email, note, created_at')
    .order('created_at', { ascending: false })
    .limit(200);
  if (productFilter) ledgerQuery = ledgerQuery.eq('product_id', productFilter);
  if (reasonFilter && reasonFilter !== 'all') ledgerQuery = ledgerQuery.eq('reason', reasonFilter);

  // Pull every product so the manual-adjustment form has a dropdown.
  // 109 SKUs today — well under any sane limit.
  const [{ data: ledgerData }, { data: productData }] = await Promise.all([
    ledgerQuery,
    admin.from('products').select('id, name, brand, stock').order('name'),
  ]);
  const rows = (ledgerData ?? []) as LedgerRow[];
  const products = (productData ?? []) as ProductLite[];
  const productMap = new Map<string, ProductLite>(products.map(p => [p.id, p]));

  // Resolve order ids to order numbers for the rows that link to an order.
  const orderIds = Array.from(new Set(rows.map(r => r.order_id).filter((v): v is string => Boolean(v))));
  const { data: orderData } = orderIds.length
    ? await admin.from('orders').select('id, order_number').in('id', orderIds)
    : { data: [] };
  const orderMap = new Map<string, OrderLite>(((orderData ?? []) as OrderLite[]).map(o => [o.id, o]));

  return (
    <div style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Inventory</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.8125rem', color: '#6b7280' }}>
        Permanent audit trail of every stock movement. Use the form below to log a manual adjustment — restocks, write-offs, corrections.
      </p>

      {errMsg && (
        <div role="alert" style={{ background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>{errMsg}</div>
      )}
      {okMsg && (
        <div role="status" style={{ background: '#d1fae5', color: '#065f46', padding: '10px 14px', borderRadius: 8, marginBottom: 16, fontSize: '0.875rem' }}>Stock updated.</div>
      )}

      {/* ─── Manual adjustment form ─────────────────────────────────────── */}
      <form
        action={adjustStock}
        style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 16, marginBottom: 24, display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr auto', gap: 12, alignItems: 'end' }}
      >
        <div>
          <label htmlFor="product_id" style={lbl}>Product</label>
          <select id="product_id" name="product_id" required style={inp} defaultValue="">
            <option value="" disabled>Choose a product</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>
                {brandPlusName(p.brand, p.name)} — {p.stock} in stock
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

      {/* ─── Filters ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, fontSize: '0.8125rem' }}>
        <Link href="/admin/inventory" style={chipLink(!reasonFilter && !productFilter)}>All</Link>
        {(['order','return','cancellation','restock','adjustment','damage','import'] as const).map(r => (
          <Link key={r} href={`/admin/inventory?reason=${r}`} style={chipLink(reasonFilter === r)}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </Link>
        ))}
      </div>

      {/* ─── Ledger table ───────────────────────────────────────────────── */}
      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {rows.length === 0 ? (
          <div style={{ padding: 60, textAlign: 'center', color: '#9ca3af' }}>No stock movements yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
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
                    <td style={{ ...td, color: '#6b7280', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{fmtDate(r.created_at)}</td>
                    <td style={td}>
                      {product
                        ? <Link href={`/admin/products/${product.id}`} style={{ color: '#C5286A', textDecoration: 'none' }}>{brandPlusName(product.brand, product.name)}</Link>
                        : <span style={{ color: '#9ca3af' }}>(variant {r.variant_id?.slice(0, 8)}…)</span>}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontWeight: 700, color: r.qty_delta < 0 ? '#991b1b' : '#065f46' }}>
                      {r.qty_delta > 0 ? '+' : ''}{r.qty_delta}
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace' }}>{r.balance_after ?? '—'}</td>
                    <td style={td}>
                      <span style={{ background: color.bg, color: color.fg, padding: '2px 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {r.reason}
                      </span>
                    </td>
                    <td style={{ ...td, fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {order
                        ? <Link href={`/admin/orders/${order.id}`} style={{ color: '#C5286A', textDecoration: 'none' }}>{order.order_number}</Link>
                        : '—'}
                    </td>
                    <td style={{ ...td, fontSize: '0.75rem', color: '#374151' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: r.actor_kind === 'owner' ? '#C5286A' : r.actor_kind === 'staff' ? '#3b82f6' : '#6b7280', textTransform: 'uppercase' }}>
                        {r.actor_kind}
                      </span>
                      {r.actor_email && <div style={{ fontSize: '0.6875rem', color: '#6b7280' }}>{r.actor_email}</div>}
                    </td>
                    <td style={{ ...td, fontSize: '0.75rem', color: '#374151', maxWidth: 280 }}>{r.note ?? '—'}</td>
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
const chipLink = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid ' + (active ? '#C5286A' : '#e5e7eb'),
  background: active ? '#fce7f3' : 'white',
  color: active ? '#9d174d' : '#374151',
  textDecoration: 'none',
  fontWeight: active ? 700 : 500,
});
