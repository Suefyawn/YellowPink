'use client';

// Create/edit form for a custom customer segment — Shopify's segment editor
// simplified to criteria pickers. Every field is optional except the name;
// an empty field means "no filter on this". Submits to saveSegment, which
// builds the criteria jsonb and redirects back to the list on success.

import { useActionState } from 'react';
import Link from 'next/link';
import { saveSegment } from '@/app/admin/segments/actions';
import { SEGMENT_BUCKETS, type SegmentCriteria } from '@/lib/segments';

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '9px 11px', borderRadius: 8,
  border: '1px solid #d1d5db', fontSize: '0.8125rem', fontFamily: 'inherit',
  color: '#111827', outline: 'none', boxSizing: 'border-box', background: 'white',
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 5,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={labelStyle}>{label}</span>
      {children}
    </label>
  );
}

export function SegmentForm({ initial, tags }: {
  initial?: { id: string; name: string; criteria: SegmentCriteria };
  tags: Array<{ id: string; name: string }>;
}) {
  const [state, formAction, pending] = useActionState(saveSegment, null);
  const c = initial?.criteria ?? {};
  const selectedTags = new Set(c.tag_ids ?? []);

  return (
    <form action={formAction} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '18px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: '0.875rem', fontWeight: 700, color: '#111827', marginBottom: 4 }}>
        {initial ? 'Edit segment' : 'Create segment'}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: '0.75rem', color: '#6b7280' }}>
        Customers match when they meet every filter you set. Leave a field empty to skip that filter.
      </p>

      {initial && <input type="hidden" name="id" value={initial.id} />}

      {state?.error && (
        <div style={{ marginBottom: 12, padding: '9px 12px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8125rem' }}>
          {state.error}
        </div>
      )}

      <div style={{ marginBottom: 14, maxWidth: 420 }}>
        <Field label="Segment name">
          <input type="text" name="name" defaultValue={initial?.name ?? ''} maxLength={120} required placeholder="e.g. Lahore repeat buyers" style={inputStyle} />
        </Field>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
        <Field label="Minimum orders">
          <input type="number" name="min_orders" min={0} step={1} defaultValue={c.min_orders ?? ''} placeholder="Any" style={inputStyle} />
        </Field>
        <Field label="Maximum orders">
          <input type="number" name="max_orders" min={0} step={1} defaultValue={c.max_orders ?? ''} placeholder="Any" style={inputStyle} />
        </Field>
        <Field label="Minimum spent (PKR)">
          <input type="number" name="min_revenue" min={0} step="any" defaultValue={c.min_revenue ?? ''} placeholder="Any" style={inputStyle} />
        </Field>
        <Field label="Maximum spent (PKR)">
          <input type="number" name="max_revenue" min={0} step="any" defaultValue={c.max_revenue ?? ''} placeholder="Any" style={inputStyle} />
        </Field>
        <Field label="Ordered within last N days">
          <input type="number" name="ordered_within_days" min={0} step={1} defaultValue={c.ordered_within_days ?? ''} placeholder="Any" style={inputStyle} />
        </Field>
        <Field label="Has not ordered in N days">
          <input type="number" name="not_ordered_within_days" min={0} step={1} defaultValue={c.not_ordered_within_days ?? ''} placeholder="Any" style={inputStyle} />
        </Field>
        <Field label="City">
          <input type="text" name="city" defaultValue={c.city ?? ''} maxLength={120} placeholder="Any city" style={inputStyle} />
        </Field>
        <Field label="Customer bucket">
          <select name="bucket" defaultValue={c.bucket ?? ''} style={inputStyle}>
            <option value="">Any</option>
            {SEGMENT_BUCKETS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </Field>
        <Field label="Account status">
          <select name="has_account" defaultValue={c.has_account === true ? 'account' : c.has_account === false ? 'guests' : 'any'} style={inputStyle}>
            <option value="any">Any</option>
            <option value="guests">Guests only</option>
            <option value="account">Account holders</option>
          </select>
        </Field>
      </div>

      {tags.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Tagged with (any of the ticked tags)</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
            {tags.map(t => (
              <label key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8125rem', color: '#374151', background: 'white', border: '1px solid #e5e7eb', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>
                <input type="checkbox" name="tag_ids" value={t.id} defaultChecked={selectedTags.has(t.id)} style={{ accentColor: '#C5286A' }} />
                {t.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '9px 18px', borderRadius: 8, border: 'none',
            background: pending ? '#9ca3af' : '#C5286A', color: 'white',
            fontSize: '0.8125rem', fontWeight: 600, cursor: pending ? 'not-allowed' : 'pointer',
          }}
        >
          {pending ? 'Saving…' : initial ? 'Save segment' : 'Create segment'}
        </button>
        <Link href="/admin/segments" style={{ padding: '9px 14px', borderRadius: 8, border: '1px solid #d1d5db', background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none' }}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
