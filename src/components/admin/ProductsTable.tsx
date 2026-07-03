'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { deleteProduct, duplicateProduct } from '@/app/admin/actions';
import {
  bulkArchiveProducts, bulkDeleteProducts, bulkDraftProducts, bulkPriceAdjustProducts,
  bulkPublishProducts, bulkTagProducts, quickUpdateProduct,
} from '@/app/admin/bulk-product-actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { DotChip } from '@/components/admin/OrderChips';
import { SortHeader } from '@/components/admin/SortHeader';
import { ProductImage } from '@/components/ui/ProductImage';
import { useToast } from '@/components/admin/Toast';
import type { Product } from '@/types';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;
const TAGS = ['New', 'Sale', 'Bestseller', 'Featured', 'Limited'];
const STATUSES = ['published', 'draft', 'archived'] as const;

const STATUS_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  published: { bg: '#f0fdf4', fg: '#16a34a', label: 'Published' },
  draft:     { bg: '#f3f4f6', fg: '#6b7280', label: 'Draft' },
  archived:  { bg: '#fef2f2', fg: '#dc2626', label: 'Archived' },
};

// Derived stock state shared by the desktop table and the mobile cards.
function stockState(p: Product) {
  const untracked = p.track_inventory === false;
  const lowStock = !untracked && p.stock > 0 && p.stock <= 10;
  const outOfStock = !untracked && p.stock === 0;
  return { untracked, lowStock, outOfStock };
}

function StatusBadge({ status }: { status?: string }) {
  const badge = STATUS_BADGE[status ?? 'published'] ?? STATUS_BADGE.published;
  return <DotChip label={badge.label} color={badge.fg} />;
}

function StockBadge({ product }: { product: Product }) {
  const { untracked, lowStock, outOfStock } = stockState(product);
  if (untracked) return <DotChip label="Managed externally" color="#6b7280" />;
  if (outOfStock) return <DotChip label="Out of stock" color="#dc2626" />;
  if (lowStock) return <DotChip label={`${product.stock} left`} color="#d97706" />;
  return <DotChip label={`${product.stock} in stock`} color="#16a34a" />;
}

function Price({ product }: { product: Product }) {
  return (
    <>
      {fmt(product.price)}
      {product.original_price ? (
        <span style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.75rem', marginLeft: 6 }}>
          {fmt(product.original_price)}
        </span>
      ) : null}
    </>
  );
}

function Thumb({ product, size = 44 }: { product: Product; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', flexShrink: 0, border: '1px solid #e5e7eb' }}>
      <ProductImage src={product.image_url} alt={product.name} width={size} height={size} />
    </div>
  );
}

export function ProductsTable({ products }: { products: Product[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  // Inline editing: which row+field is open, and its draft value.
  const [edit, setEdit] = useState<{ id: string; field: 'price' | 'stock' } | null>(null);
  const [draft, setDraft] = useState('');

  const sort = params.get('sort') ?? 'newest';

  const setSort = (key: string) => {
    const next = new URLSearchParams(params.toString());
    if (key === 'newest') next.delete('sort'); else next.set('sort', key);
    next.delete('page');
    startTransition(() => router.push(`/admin/products?${next.toString()}`));
  };

  // Column-header sort control: first click sorts descending (or A→Z for
  // name), second flips, third clears back to newest-first.
  const sortHeader = (label: string, ascKey: string, descKey: string) => {
    const dir = sort === ascKey ? 'asc' as const : sort === descKey ? 'desc' as const : null;
    const next = dir === 'desc' ? ascKey : dir === 'asc' ? 'newest' : descKey;
    return <SortHeader label={label} dir={dir} onClick={() => setSort(next)} />;
  };

  const allSelected = products.length > 0 && selected.size === products.length;
  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(products.map(p => p.id)));

  // ── Inline quick edit ──────────────────────────────────────────────────────
  const openEdit = (id: string, field: 'price' | 'stock', current: number) => {
    setEdit({ id, field }); setDraft(String(current));
  };
  const commitEdit = () => {
    if (!edit) return;
    const n = Number(draft);
    const current = edit;
    setEdit(null);
    if (!Number.isFinite(n) || n < 0) return;
    startTransition(async () => {
      const res = await quickUpdateProduct(current.id, current.field === 'price' ? { price: n } : { stock: Math.round(n) });
      if (res.error) { toast(res.error, 'error'); return; }
      toast('Saved', 'success');
      router.refresh();
    });
  };
  const setStatus = (id: string, status: string) => {
    startTransition(async () => {
      const res = await quickUpdateProduct(id, { status });
      if (res.error) { toast(res.error, 'error'); return; }
      toast(`Status → ${status}`, 'success');
      router.refresh();
    });
  };

  const editInput = (
    <input
      autoFocus
      type="number"
      min={0}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onKeyDown={e => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEdit(null); }}
      onBlur={commitEdit}
      style={{ width: 90, padding: '4px 6px', border: '1px solid #C5286A', borderRadius: 6, fontSize: '0.8125rem' }}
    />
  );

  const wrap = (fn: () => Promise<{ error?: string } | void>, label: string) => {
    if (selected.size === 0) return;
    startTransition(async () => {
      const res = await fn();
      if (res && res.error) { toast(res.error, 'error'); return; }
      const count = selected.size;
      setSelected(new Set());
      toast(`${label} (${count})`, 'success');
    });
  };

  // Deep-copies the product (variants, tags, images, related links) into a
  // new draft, then jumps straight to the copy's edit page.
  const duplicate = (id: string) => {
    startTransition(async () => {
      const res = await duplicateProduct(id);
      if (res.error) { toast(res.error, 'error'); return; }
      router.push(`/admin/products/${res.id}?duplicated=1`);
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    const n = selected.size;
    if (!window.confirm(
      `Delete ${n} product${n !== 1 ? 's' : ''}? Any with order history will be archived instead so reports stay intact.`,
    )) return;
    const ids = Array.from(selected);
    startTransition(async () => {
      const { deleted, archived, error } = await bulkDeleteProducts(ids);
      if (error) { toast(error, 'error'); return; }
      setSelected(new Set());
      const parts: string[] = [];
      if (deleted) parts.push(`${deleted} deleted`);
      if (archived) parts.push(`${archived} archived (had orders)`);
      toast(parts.join(' · ') || 'No products changed', 'success');
    });
  };

  return (
    <>
      {products.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af' }}>
            No products found. <Link href="/admin/products/new" style={{ color: '#C5286A' }}>Add one &rarr;</Link>
          </div>
        </div>
      ) : (
        <>
          {/* -- Desktop: table -- */}
          <div className="adm-products-table adm-table-scroll" style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  <th scope="col" style={{ ...thBase, width: 30, position: 'sticky', top: 0, background: '#f9fafb', zIndex: 2 }}>
                    <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all products" />
                  </th>
                  <th scope="col" style={{ ...thBase, width: 56, position: 'sticky', top: 0, background: '#f9fafb', zIndex: 2 }} />
                  <th scope="col" style={{ ...thSticky }}>{sortHeader('Brand / Name', 'name', 'name')}</th>
                  <th scope="col" style={{ ...thSticky }}>{sortHeader('Price', 'price_low', 'price_high')}</th>
                  <th scope="col" style={{ ...thSticky }}>{sortHeader('Stock', 'stock_low', 'stock_high')}</th>
                  <th scope="col" style={{ ...thSticky }}>Status</th>
                  <th scope="col" style={{ ...thSticky }}>Category</th>
                  <th scope="col" style={{ ...thSticky }}>Tag</th>
                  <th scope="col" style={{ ...thSticky, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p, i) => {
                  const { lowStock, outOfStock } = stockState(p);
                  const checked = selected.has(p.id);
                  const editingPrice = edit?.id === p.id && edit.field === 'price';
                  const editingStock = edit?.id === p.id && edit.field === 'stock';
                  return (
                    <tr key={p.id} className="adm-row adm-hover-row" style={{
                      borderTop: i > 0 ? '1px solid #f3f4f6' : 'none',
                      // Undefined (not 'transparent') for plain rows so the
                      // CSS hover tint can apply — inline styles beat :hover.
                      background: checked ? '#fdf2f8' : outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : undefined,
                    }}>
                      <td style={{ padding: '12px' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} />
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <Link href={`/admin/products/${p.id}`}><Thumb product={p} /></Link>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: 260 }}>
                        <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: 1 }}>{p.brand}</div>
                        <Link href={`/admin/products/${p.id}`} style={{ fontWeight: 600, fontSize: '0.875rem', color: '#111827', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{p.name}</Link>
                        {p.variant && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{p.variant}</div>}
                      </td>
                      {/* Price, inline editable */}
                      <td style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                        {editingPrice ? editInput : (
                          <button type="button" onClick={() => openEdit(p.id, 'price', p.price)} title="Click to edit price" style={editCellBtn}>
                            {fmt(p.price)}
                            {p.original_price ? <span style={{ color: '#9ca3af', fontWeight: 400, textDecoration: 'line-through', fontSize: '0.75rem', display: 'block' }}>{fmt(p.original_price)}</span> : null}
                          </button>
                        )}
                      </td>
                      {/* Stock, inline editable (only when tracked) */}
                      <td style={{ padding: '12px 16px' }}>
                        {p.track_inventory === false ? (
                          <StockBadge product={p} />
                        ) : editingStock ? editInput : (
                          <button type="button" onClick={() => openEdit(p.id, 'stock', p.stock)} title="Click to edit stock" style={editCellBtn}>
                            <StockBadge product={p} />
                          </button>
                        )}
                      </td>
                      {/* Status, inline select */}
                      <td style={{ padding: '12px 16px' }}>
                        <select
                          value={p.status ?? 'published'}
                          onChange={e => setStatus(p.id, e.target.value)}
                          disabled={pending}
                          aria-label={`Status for ${p.name}`}
                          style={{
                            padding: '3px 8px', borderRadius: 20, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                            border: `1px solid ${(STATUS_BADGE[p.status ?? 'published'] ?? STATUS_BADGE.published).fg}33`,
                            background: (STATUS_BADGE[p.status ?? 'published'] ?? STATUS_BADGE.published).bg,
                            color: (STATUS_BADGE[p.status ?? 'published'] ?? STATUS_BADGE.published).fg,
                          }}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{STATUS_BADGE[s].label}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#374151' }}>
                        <div>{p.category}</div>
                        {p.subcategory && <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{p.subcategory}</div>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {p.tag ? (
                          <span style={{ display: 'inline-block', padding: '2px 8px', background: '#fdf2f8', borderRadius: 20, fontSize: '0.75rem', fontWeight: 500, color: '#9d174d' }}>{p.tag}</span>
                        ) : <span style={{ color: '#d1d5db' }}>&mdash;</span>}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <Link href={`/admin/products/${p.id}`} style={{ padding: '7px 14px', background: '#f3f4f6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500, minHeight: 32, display: 'inline-flex', alignItems: 'center' }}>Edit</Link>
                          <button type="button" onClick={() => duplicate(p.id)} disabled={pending} title="Create a draft copy with variants, tags and images" style={{ padding: '7px 14px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 500, minHeight: 32, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>Duplicate</button>
                          <DeleteButton id={p.id} action={deleteProduct} confirmMsg={`Delete "${p.name}"?`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* -- Mobile: headline-led cards with a thumbnail. -- */}
          <div className="adm-products-cards">
            {products.map(p => {
              const { lowStock, outOfStock } = stockState(p);
              const checked = selected.has(p.id);
              return (
                <div key={p.id} className="adm-product-card" style={{ background: checked ? '#fdf2f8' : outOfStock ? '#fef2f2' : lowStock ? '#fffbeb' : 'white' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} style={{ cursor: 'pointer', accentColor: '#C5286A', width: 18, height: 18, flexShrink: 0, marginTop: 3 }} />
                    <Link href={`/admin/products/${p.id}`}><Thumb product={p} size={52} /></Link>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {p.brand && <div style={{ fontSize: '0.6875rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.brand}</div>}
                      <Link href={`/admin/products/${p.id}`} style={{ display: 'block', fontWeight: 700, fontSize: '1rem', lineHeight: 1.3, color: '#111827', textDecoration: 'none' }}>{p.name}</Link>
                      {p.variant && <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 1 }}>{p.variant}</div>}
                    </div>
                    <span style={{ flexShrink: 0 }}><StatusBadge status={p.status} /></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827' }}><Price product={p} /></span>
                    <StockBadge product={p} />
                    <span style={{ fontSize: '0.75rem', color: '#9ca3af', marginLeft: 'auto', textAlign: 'right' }}>
                      {p.category}{p.subcategory ? ` · ${p.subcategory}` : ''}{p.tag ? ` · ${p.tag}` : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <Link href={`/admin/products/${p.id}`} style={{ padding: '8px 16px', background: '#f3f4f6', color: '#374151', borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center' }}>Edit</Link>
                    <button type="button" onClick={() => duplicate(p.id)} disabled={pending} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', cursor: 'pointer' }}>Duplicate</button>
                    <DeleteButton id={p.id} action={deleteProduct} confirmMsg={`Delete "${p.name}"?`} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="adm-bulk-bar" style={{
          position: 'sticky', bottom: 16, zIndex: 20, background: '#111827', borderRadius: 10,
          padding: '12px 20px', margin: '12px 0 0', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
        }}>
          <span style={{ color: '#f9fafb', fontSize: '0.875rem', fontWeight: 600 }}>{selected.size} selected</span>
          <button onClick={() => wrap(() => bulkPublishProducts(Array.from(selected)), 'Published')} disabled={pending} style={btn('#10b981')}>Publish</button>
          <button onClick={() => wrap(() => bulkDraftProducts(Array.from(selected)), 'Set to draft')} disabled={pending} style={btn('#f59e0b')}>Set draft</button>
          <button onClick={() => wrap(() => bulkArchiveProducts(Array.from(selected)), 'Archived')} disabled={pending} style={btn('#6b7280')}>Archive</button>
          <select onChange={e => {
            const v = e.target.value; if (!v) return;
            wrap(() => bulkTagProducts(Array.from(selected), v === '__clear__' ? null : v), `Tagged "${v}"`);
            e.target.value = '';
          }} defaultValue="" style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #374151', background: '#1f2937', color: '#f9fafb', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <option value="" disabled>Set tag&hellip;</option>
            {TAGS.map(t => <option key={t} value={t}>{t}</option>)}
            <option value="__clear__">&mdash; Clear tag &mdash;</option>
          </select>
          <button onClick={() => {
            const v = window.prompt('Adjust price by %? (e.g. -10 = 10% off, +5 = 5% mark-up)');
            if (v === null || v === '') return;
            const n = Number(v); if (!isFinite(n)) return;
            wrap(() => bulkPriceAdjustProducts(Array.from(selected), n), `Price ${n >= 0 ? '+' : ''}${n}%`);
          }} disabled={pending} style={btn('#3b82f6')}>Adjust price&hellip;</button>
          <button onClick={handleBulkDelete} disabled={pending} style={btn('#ef4444')}>Delete</button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', padding: '5px 12px', borderRadius: 6, border: '1px solid #374151', background: 'transparent', color: '#9ca3af', fontSize: '0.8125rem', cursor: 'pointer' }}>Clear</button>
        </div>
      )}
    </>
  );
}

// Sortable column header, clicking cycles desc → asc → off (newest).
const thBase: React.CSSProperties = { padding: '11px 12px', textAlign: 'left' };
const thSticky: React.CSSProperties = {
  padding: '11px 16px', textAlign: 'left', position: 'sticky', top: 0, background: '#f9fafb', zIndex: 2,
  fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em',
  whiteSpace: 'nowrap', borderBottom: '1px solid #e5e7eb',
};
const editCellBtn: React.CSSProperties = {
  background: 'none', border: 'none', padding: '2px 4px', margin: '-2px -4px', borderRadius: 6,
  cursor: 'pointer', font: 'inherit', color: 'inherit', textAlign: 'left',
};

function btn(color: string): React.CSSProperties {
  return { padding: '5px 14px', borderRadius: 20, border: 'none', background: color + '30', color, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' };
}
