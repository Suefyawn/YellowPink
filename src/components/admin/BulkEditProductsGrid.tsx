'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { bulkEditProducts } from '@/app/admin/bulk-product-actions';
import { brandPlusName } from '@/lib/product-display';
import type { StockMode } from '@/types';

// The Shopify bulk editor: selected products as one editable spreadsheet.
// Status, price, compare-at, cost and (where it means anything) stock are
// inline; one save writes only the rows that changed — the server diffs, so a
// stray tab-out can't rewrite the catalogue.

export interface BulkEditRow {
  id: string;
  name: string;
  brand: string | null;
  status: string;
  price: number;
  original_price: number | null;
  cost_price: number | null;
  stock: number;
  stock_mode?: StockMode | null;
  track_inventory?: boolean | null;
  has_variants?: boolean;
  variant_stock?: number;
}

const th: React.CSSProperties = { padding: '9px 12px', textAlign: 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' };
const td: React.CSSProperties = { padding: '6px 12px', verticalAlign: 'middle' };
const inp: React.CSSProperties = { padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', background: 'white', boxSizing: 'border-box' };

export function BulkEditProductsGrid({ products }: { products: BulkEditRow[] }) {
  const [state, formAction, pending] = useActionState(bulkEditProducts, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="ids" value={products.map(p => p.id).join(',')} />
      <div className="adm-table-scroll" style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
          <thead>
            <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <th style={th}>Product</th>
              <th style={{ ...th, width: 110 }}>Status</th>
              <th style={{ ...th, width: 110 }}>Price</th>
              <th style={{ ...th, width: 110 }}>Compare-at</th>
              <th style={{ ...th, width: 110 }}>Cost</th>
              <th style={{ ...th, width: 100 }}>Stock</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => {
              const mode = p.stock_mode ?? (p.track_inventory === false ? 'untracked' : 'own');
              const stockEditable = mode === 'own' && !p.has_variants;
              return (
                <tr key={p.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ ...td, maxWidth: 340 }}>
                    <input type="hidden" name={`p__${p.id}__present`} value="1" />
                    <Link href={`/admin/products/${p.id}`} style={{ color: '#111827', fontWeight: 600, textDecoration: 'none', fontSize: '0.8125rem' }}>
                      {brandPlusName(p.brand, p.name)}
                    </Link>
                  </td>
                  <td style={td}>
                    <select name={`p__${p.id}__status`} defaultValue={p.status} style={{ ...inp, width: 100 }}>
                      <option value="published">Active</option>
                      <option value="draft">Draft</option>
                    </select>
                  </td>
                  <td style={td}>
                    <input name={`p__${p.id}__price`} type="number" min={0} step="0.01" required defaultValue={p.price} style={{ ...inp, width: 96 }} />
                  </td>
                  <td style={td}>
                    <input name={`p__${p.id}__compare`} type="number" min={0} step="0.01" defaultValue={p.original_price ?? ''} placeholder="—" style={{ ...inp, width: 96 }} />
                  </td>
                  <td style={td}>
                    <input name={`p__${p.id}__cost`} type="number" min={0} step="0.01" defaultValue={p.cost_price ?? ''} placeholder="—" style={{ ...inp, width: 96 }} />
                  </td>
                  <td style={td}>
                    {stockEditable ? (
                      <input name={`p__${p.id}__stock`} type="number" min={0} step="1" defaultValue={p.stock} style={{ ...inp, width: 80 }} />
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {p.has_variants ? `${p.variant_stock ?? 0} via variants` : mode === 'external' ? 'vendor-held' : 'not counted'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 14 }}>
        <button type="submit" disabled={pending} style={{
          padding: '10px 22px', background: pending ? '#9ca3af' : '#C5286A', color: 'white',
          border: 'none', borderRadius: 8, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
        }}>
          {pending ? 'Saving…' : 'Save all changes'}
        </button>
        {state?.error && <span style={{ fontSize: '0.8125rem', color: '#dc2626' }}>{state.error}</span>}
        {state?.success && (
          <span style={{ fontSize: '0.8125rem', color: state.changed ? '#065f46' : '#6b7280' }}>
            {state.changed ? `Saved ${state.changed} product${state.changed === 1 ? '' : 's'}.` : 'Nothing changed.'}
          </span>
        )}
      </div>
    </form>
  );
}
