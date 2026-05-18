'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { deleteProduct } from '@/app/admin/actions';
import {
  bulkArchiveProducts, bulkDeleteProducts, bulkPriceAdjustProducts,
  bulkPublishProducts, bulkTagProducts,
} from '@/app/admin/bulk-product-actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { useToast } from '@/components/admin/Toast';
import type { Product } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const TAGS = ['New', 'Sale', 'Bestseller', 'Featured', 'Limited'];

export function ProductsTable({ products }: { products: Product[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const toast = useToast();

  const allSelected = products.length > 0 && selected.size === products.length;
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map(p => p.id)));

  const wrap = (fn: () => Promise<unknown>, label: string) => {
    if (selected.size === 0) return;
    startTransition(async () => {
      await fn();
      const count = selected.size;
      setSelected(new Set());
      toast(`${label} (${count})`, 'success');
    });
  };

  return (
    <>
      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {products.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
            No products found. <Link href="/admin/products/new" style={{ color: '#ec4899' }}>Add one →</Link>
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                <th scope="col" style={{ padding: '11px 12px', width: 30 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all products" />
                </th>
                {['Brand / Name', 'Price', 'Stock', 'Category', 'Tag', 'Actions'].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => {
                const lowStock = p.stock > 0 && p.stock <= 10;
                const outOfStock = p.stock === 0;
                const checked = selected.has(p.id);
                return (
                  <tr key={p.id} style={{
                    borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                    background: checked ? '#fdf2f8' : outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : 'transparent',
                  }}>
                    <td style={{ padding: '12px' }}>
                      <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                    </td>
                    <td data-label="Brand / Name" style={{ padding: '12px 16px', maxWidth: 260 }}>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 1 }}>{p.brand}</div>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                      {p.variant && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{p.variant}</div>}
                    </td>
                    <td data-label="Price" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      {fmt(p.price)}
                      {p.original_price && (
                        <div style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.75rem' }}>
                          {fmt(p.original_price)}
                        </div>
                      )}
                    </td>
                    <td data-label="Stock" style={{ padding: '12px 16px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 10px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700,
                        background: outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : '#f0fdf4',
                        color: outOfStock ? '#dc2626' : lowStock ? '#d97706' : '#16a34a',
                        border: `1px solid ${outOfStock ? '#fecaca' : lowStock ? '#fde68a' : '#bbf7d0'}`,
                      }}>
                        {outOfStock ? '✕ Out of stock' : lowStock ? `⚠ ${p.stock} left` : `✓ ${p.stock}`}
                      </span>
                    </td>
                    <td data-label="Category" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                      <div>{p.category}</div>
                      {p.subcategory && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.subcategory}</div>}
                    </td>
                    <td data-label="Tag" style={{ padding: '12px 16px' }}>
                      {p.tag ? (
                        <span style={{ display: 'inline-block', padding: '2px 8px', background: '#fdf2f8', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, color: '#9d174d' }}>
                          {p.tag}
                        </span>
                      ) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <Link href={`/admin/products/${p.id}`} style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>
                          Edit
                        </Link>
                        <DeleteButton id={p.id} action={deleteProduct} confirmMsg={`Delete "${p.name}"?`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="adm-bulk-bar" style={{
          position: 'sticky', bottom: 16, zIndex: 20,
          background: '#111827', borderRadius: 10,
          padding: '12px 20px', margin: '12px 0 0',
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>{selected.size} selected</span>

          <button onClick={() => wrap(() => bulkPublishProducts(Array.from(selected)), 'Published')} disabled={pending} style={btn('#10b981')}>Publish</button>
          <button onClick={() => wrap(() => bulkArchiveProducts(Array.from(selected)), 'Archived')} disabled={pending} style={btn('#6b7280')}>Archive</button>

          <select onChange={e => {
            const v = e.target.value;
            if (!v) return;
            wrap(() => bulkTagProducts(Array.from(selected), v === '__clear__' ? null : v), `Tagged "${v}"`);
            e.target.value = '';
          }} defaultValue="" style={{
            padding: '5px 10px', borderRadius: 6, border: '1px solid #374151',
            background: '#1f2937', color: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            <option value="" disabled>Set tag…</option>
            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            <option value="__clear__">— Clear tag —</option>
          </select>

          <button onClick={() => {
            const v = window.prompt('Adjust price by %? (e.g. -10 = 10% off, +5 = 5% mark-up)');
            if (v === null || v === '') return;
            const n = Number(v);
            if (!isFinite(n)) return;
            wrap(async () => { await bulkPriceAdjustProducts(Array.from(selected), n); }, `Price ${n >= 0 ? '+' : ''}${n}%`);
          }} disabled={pending} style={btn('#3b82f6')}>Adjust price…</button>

          <button onClick={() => {
            if (!window.confirm(`Delete ${selected.size} products? This can't be undone.`)) return;
            wrap(() => bulkDeleteProducts(Array.from(selected)), 'Deleted');
          }} disabled={pending} style={btn('#ef4444')}>Delete</button>

          <button onClick={() => setSelected(new Set())} style={{
            marginLeft: 'auto', padding: '5px 12px', borderRadius: 6,
            border: '1px solid #374151', background: 'transparent', color: '#9ca3af',
            fontSize: '0.8125rem', cursor: 'pointer',
          }}>
            Clear
          </button>
        </div>
      )}
    </>
  );
}

function btn(color: string): React.CSSProperties {
  return {
    padding: '5px 14px', borderRadius: 20, border: 'none',
    background: color + '30', color,
    fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
  };
}
