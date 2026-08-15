'use client';

import { useState } from 'react';
import type { SmartRules, SmartCondition } from '@/lib/collections';

// Smart-collection rule builder. Renders a friendly condition list and keeps a
// hidden `rules` input in sync (JSON) so the parent settings <form> submits it
// with updateCollection. Membership is evaluated against these rules at request
// time, so the collection stays current automatically.
//
// Operators follow Shopify's automated-collection conditions where they map
// cleanly: text fields (title, tag, brand, category) take "is" (exact pick),
// "contains" and "does not contain"; numeric fields (price, stock) take the
// at-most / at-least comparisons. Keep the op set in lock-step with
// matchCondition in lib/collections.ts — the editor and the matcher must
// agree or the preview count lies.
type Field = SmartCondition['field'];

const FIELD_LABELS: Record<Field, string> = {
  title: 'Product title',
  tag: 'Tag', brand: 'Brand', category: 'Category', price: 'Price',
  stock: 'Stock', on_sale: 'On sale', featured: 'Featured',
  bestseller: 'Bestseller', packaging: 'Packaging',
};
const BOOL_FIELDS: Field[] = ['on_sale', 'featured', 'bestseller'];
// Text fields offering the contains / does not contain ops. Title has no
// exact-pick list (free text only); the other three keep "is" with their
// value dropdowns.
const CONTAINS_FIELDS: Field[] = ['title', 'tag', 'brand', 'category'];
const NUMERIC_FIELDS: Field[] = ['price', 'stock'];

const containsOp = (op: SmartCondition['op']) => op === 'contains' || op === 'not_contains';

export function CollectionRulesEditor({
  initialRules,
  allTags,
  allBrands,
  allCategories,
}: {
  initialRules: SmartRules;
  allTags: { slug: string; name: string }[];
  allBrands: string[];
  allCategories: string[];
}) {
  const [match, setMatch] = useState<'all' | 'any'>(initialRules.match ?? 'all');
  const [conditions, setConditions] = useState<SmartCondition[]>(initialRules.conditions ?? []);

  const rulesJson = JSON.stringify({ match, conditions });

  function patch(i: number, next: Partial<SmartCondition>) {
    setConditions(prev => prev.map((c, idx) => (idx === i ? { ...c, ...next } as SmartCondition : c)));
  }
  function setField(i: number, field: Field) {
    // Reset op/value to sensible defaults for the new field.
    if (BOOL_FIELDS.includes(field)) patch(i, { field, op: 'is', value: true });
    else if (NUMERIC_FIELDS.includes(field)) patch(i, { field, op: 'lte', value: 0 });
    else if (field === 'title') patch(i, { field, op: 'contains', value: '' });
    else patch(i, { field, op: 'in', value: [] });
  }
  function setTextOp(i: number, op: 'in' | 'contains' | 'not_contains') {
    // The value shape follows the op: exact picks store an array, substring
    // ops store the typed string. Reset on switch so stale shapes never leak
    // into the matcher.
    patch(i, { op, value: op === 'in' ? [] : '' });
  }
  function addCondition() { setConditions(prev => [...prev, { field: 'tag', op: 'in', value: [] }]); }
  function removeCondition(i: number) { setConditions(prev => prev.filter((_, idx) => idx !== i)); }

  const sel: React.CSSProperties = { padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', background: 'white', color: '#111827' };

  return (
    <div style={{ marginTop: 8 }}>
      <input type="hidden" name="rules" value={rulesJson} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.8125rem', color: '#374151' }}>
        Products match
        <select value={match} onChange={e => setMatch(e.target.value as 'all' | 'any')} style={sel}>
          <option value="all">all</option>
          <option value="any">any</option>
        </select>
        of these conditions:
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {conditions.map((c, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={c.field} onChange={e => setField(i, e.target.value as Field)} style={sel}>
              {(Object.keys(FIELD_LABELS) as Field[]).map(f => <option key={f} value={f}>{FIELD_LABELS[f]}</option>)}
            </select>

            {/* Operator select for text fields (Shopify's is / contains /
                does not contain). Title is substring-only. */}
            {CONTAINS_FIELDS.includes(c.field) && (
              <select
                value={c.op}
                onChange={e => setTextOp(i, e.target.value as 'in' | 'contains' | 'not_contains')}
                style={sel}
              >
                {c.field !== 'title' && <option value="in">is</option>}
                <option value="contains">contains</option>
                <option value="not_contains">does not contain</option>
              </select>
            )}

            {/* Value control per field + op */}
            {CONTAINS_FIELDS.includes(c.field) && containsOp(c.op) && (
              <input
                type="text"
                value={typeof c.value === 'string' ? c.value : ''}
                onChange={e => patch(i, { value: e.target.value })}
                style={{ ...sel, width: 180 }}
                placeholder={c.field === 'tag' ? 'e.g. viral' : c.field === 'title' ? 'e.g. sunscreen' : 'text to match'}
              />
            )}
            {c.field === 'tag' && !containsOp(c.op) && (
              <select value={(Array.isArray(c.value) && c.value[0]) || ''} onChange={e => patch(i, { op: 'in', value: e.target.value ? [e.target.value] : [] })} style={sel}>
                <option value="">— choose tag —</option>
                {allTags.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
              </select>
            )}
            {c.field === 'brand' && !containsOp(c.op) && (
              <select value={(Array.isArray(c.value) && c.value[0]) || ''} onChange={e => patch(i, { op: 'in', value: e.target.value ? [e.target.value] : [] })} style={sel}>
                <option value="">— choose brand —</option>
                {allBrands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            )}
            {c.field === 'category' && !containsOp(c.op) && (
              <select value={(Array.isArray(c.value) && c.value[0]) || ''} onChange={e => patch(i, { op: 'in', value: e.target.value ? [e.target.value] : [] })} style={sel}>
                <option value="">— choose category —</option>
                {allCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            )}
            {c.field === 'packaging' && (
              <select value={(Array.isArray(c.value) && c.value[0]) || ''} onChange={e => patch(i, { op: 'in', value: e.target.value ? [e.target.value] : [] })} style={sel}>
                <option value="">— choose packaging —</option>
                <option value="standard">Standard</option>
                <option value="tester">Tester</option>
                <option value="no_box">Without box</option>
              </select>
            )}
            {NUMERIC_FIELDS.includes(c.field) && (
              <>
                <select value={c.op} onChange={e => patch(i, { op: e.target.value as 'lte' | 'gte' })} style={sel}>
                  <option value="lte">≤ (at most)</option>
                  <option value="gte">≥ (at least)</option>
                </select>
                <input type="number" min={0} value={typeof c.value === 'number' ? c.value : 0} onChange={e => patch(i, { value: Number(e.target.value) })} style={{ ...sel, width: 110 }} placeholder={c.field === 'price' ? 'PKR' : 'units'} />
              </>
            )}
            {BOOL_FIELDS.includes(c.field) && (
              <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>is true</span>
            )}

            <button type="button" onClick={() => removeCondition(i)} aria-label="Remove condition" style={{ marginLeft: 'auto', width: 28, height: 28, border: '1px solid #fecaca', borderRadius: 6, background: 'white', color: '#dc2626', cursor: 'pointer' }}>×</button>
          </div>
        ))}
      </div>

      <button type="button" onClick={addCondition} style={{ marginTop: 12, padding: '7px 14px', border: '1px dashed #d1d5db', borderRadius: 7, background: '#f9fafb', color: '#374151', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
        + Add condition
      </button>
      {conditions.length === 0 && (
        <p style={{ margin: '10px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>No conditions yet, a smart collection with no rules shows no products.</p>
      )}
    </div>
  );
}
