'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { ORDER_STATUS_LABELS, PAY_METHOD_LABELS, type OrderStatus } from '@/types';
import { SearchInput } from '@/components/admin/SearchInput';
import { saveOrdersView, deleteOrdersView } from '@/app/admin/orders/view-actions';

// Saved-view tabs (Shopify's orders-index pattern): the workflow views an
// operator actually lives in, not one pill per raw status. 'tofulfil' and
// 'unpaid' are composite views resolved server-side (admin/orders/page.tsx +
// exportOrdersCsv); the rest map to single statuses. Less-used statuses
// (awaiting/failed payment, returned) stay reachable via the More dropdown.
const VIEWS: { value: string; label: string }[] = [
  { value: 'all',       label: 'All' },
  { value: 'tofulfil',  label: 'To fulfil' },
  { value: 'unpaid',    label: 'Unpaid' },
  { value: 'shipped',   label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];
const MORE_STATUSES = (Object.keys(ORDER_STATUS_LABELS) as OrderStatus[])
  .filter(s => !VIEWS.some(v => v.value === s));

// Quick "show me orders from the last X days" presets. `all` clears the date
// filter so the page falls back to the full history.
const RANGES: { value: string; label: string }[] = [
  { value: 'all',  label: 'All time' },
  { value: '1d',   label: 'Today' },
  { value: '7d',   label: 'Last 7d' },
  { value: '30d',  label: 'Last 30d' },
  { value: '90d',  label: 'Last 90d' },
];

// Payment-method options for the More-filters row, in checkout order.
// Labels come from the shared PAY_METHOD_LABELS map so no surface leaks a
// raw enum value like "jazzcash".
const PAY_METHODS = ['cod', 'bank', 'card', 'jazzcash', 'easypaisa', 'gift_card'];

export interface SavedView { id: string; name: string; query: string }

/** Canonical form of a querystring for saved-view matching: drop `page`,
 *  sort the params. Two querystrings that filter identically compare equal
 *  regardless of the order the operator clicked the controls in. */
function normalizeQuery(qs: string): string {
  const p = new URLSearchParams(qs);
  p.delete('page');
  return Array.from(p.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
}

// Lucide "bookmark" at 12px, marks saved-view tabs apart from the built-ins.
function BookmarkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

export function OrdersFilter({ total, tags = [], savedViews = [] }: { total: number; tags?: { slug: string; name: string }[]; savedViews?: SavedView[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();
  const status = params.get('status') ?? 'all';
  const q = params.get('q') ?? '';
  const range = params.get('range') ?? 'all';
  const tag = params.get('tag') ?? '';
  const pay = params.get('pay') ?? '';
  const city = params.get('city') ?? '';
  const confirmed = params.get('confirmed') ?? '';
  const min = params.get('min') ?? '';
  const max = params.get('max') ?? '';
  const coupon = params.get('coupon') ?? '';

  const hasMoreFilters = !!pay || !!city || !!confirmed || !!min || !!max || !!coupon;
  // Collapsed by default; auto-expanded whenever one of its filters becomes
  // active (e.g. clicking a saved view or arriving via a shared URL). The
  // toggle stores a manual override; a change in whether the row's filters
  // are active drops the override so the row re-derives its state ("adjust
  // state when props change" pattern, per the set-state-in-effect rule).
  const [moreOpenManual, setMoreOpenManual] = useState<boolean | null>(null);
  const [prevHasMore, setPrevHasMore] = useState(hasMoreFilters);
  if (hasMoreFilters !== prevHasMore) {
    setPrevHasMore(hasMoreFilters);
    setMoreOpenManual(null);
  }
  const moreOpen = moreOpenManual ?? hasMoreFilters;

  // Remember the active list query so the order-detail "← Orders" link can
  // return the staffer to the exact filtered/searched view they came from.
  useEffect(() => {
    const qs = params.toString();
    try { sessionStorage.setItem('adminOrdersQuery', qs ? `?${qs}` : ''); } catch { /* private mode */ }
  }, [params]);

  const push = useCallback((next: URLSearchParams) => {
    startTransition(() => router.push(`/admin/orders?${next.toString()}`));
  }, [router]);

  const setStatus = (s: string) => {
    const next = new URLSearchParams(params.toString());
    if (s === 'all') { next.delete('status'); } else { next.set('status', s); }
    next.delete('page');
    push(next);
  };

  const setRange = (r: string) => {
    const next = new URLSearchParams(params.toString());
    if (r === 'all') { next.delete('range'); } else { next.set('range', r); }
    next.delete('page');
    push(next);
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString());
    if (!value) { next.delete(key); } else { next.set(key, value); }
    next.delete('page');
    push(next);
  };

  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setDebounced = (key: string, v: string) => {
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (v) { next.set(key, v); } else { next.delete(key); }
      next.delete('page');
      push(next);
    }, 300);
  };

  const clearAll = () => push(new URLSearchParams());
  const hasFilters = status !== 'all' || !!q || range !== 'all' || !!tag || hasMoreFilters;

  // Saved views (admin_saved_views, shared across staff): one is "active"
  // when the current querystring (minus page) is exactly its stored query.
  const currentNorm = normalizeQuery(params.toString());
  const activeSavedView = savedViews.find(v => normalizeQuery(v.query) === currentNorm);
  const canSaveView = hasFilters && !activeSavedView;

  const handleSaveView = async () => {
    const name = window.prompt('Name this view (max 60 characters):');
    if (name === null || !name.trim()) return;
    const query = new URLSearchParams(params.toString());
    query.delete('page');
    const fd = new FormData();
    fd.set('name', name.trim());
    fd.set('query', query.toString());
    const res = await saveOrdersView(fd);
    if (res.error) alert(res.error);
  };

  const handleDeleteView = async (view: SavedView) => {
    if (!confirm(`Remove the saved view "${view.name}"?`)) return;
    const res = await deleteOrdersView(view.id);
    if (res.error) alert(res.error);
  };

  const inputStyle: React.CSSProperties = {
    padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8,
    fontSize: '0.8125rem', color: '#111827', background: 'white', outline: 'none',
  };
  const numStyle: React.CSSProperties = { ...inputStyle, width: 84 };

  return (
    <div style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <div className="adm-filter-pills" style={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', borderBottom: '1px solid #e5e7eb', flexBasis: '100%' }}>
        {VIEWS.map(v => {
          const isActive = status === v.value;
          return (
            <button key={v.value} onClick={() => setStatus(v.value)} style={{
              padding: '9px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500,
              color: isActive ? '#111827' : '#6b7280',
              borderBottom: `2px solid ${isActive ? '#C5286A' : 'transparent'}`,
              marginBottom: -1,
            }}>
              {v.label}
            </button>
          );
        })}
        <select
          aria-label="More statuses"
          value={MORE_STATUSES.includes(status as OrderStatus) || status === 'archived' ? status : ''}
          onChange={e => e.target.value && setStatus(e.target.value)}
          style={{
            marginLeft: 4, padding: '5px 8px', border: '1px solid #e5e7eb', borderRadius: 7,
            fontSize: '0.75rem', background: 'white',
            color: MORE_STATUSES.includes(status as OrderStatus) || status === 'archived' ? '#111827' : '#6b7280',
            fontWeight: MORE_STATUSES.includes(status as OrderStatus) || status === 'archived' ? 600 : 400,
          }}
        >
          <option value="">More…</option>
          {MORE_STATUSES.map(s => (
            <option key={s} value={s}>{ORDER_STATUS_LABELS[s]}</option>
          ))}
          {/* Not a status: archived orders are history (legacy imports and
              the like), hidden from every other view. */}
          <option value="archived">Archived</option>
        </select>
        {/* Staff-pinned saved views after the built-in tabs, marked with a
            bookmark glyph. The active one carries a × to remove it. */}
        {savedViews.map(v => {
          const isActive = activeSavedView?.id === v.id;
          return (
            <button key={v.id} onClick={() => push(new URLSearchParams(v.query))} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '9px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
              fontSize: '0.8125rem', fontWeight: isActive ? 600 : 500,
              color: isActive ? '#111827' : '#6b7280',
              borderBottom: `2px solid ${isActive ? '#C5286A' : 'transparent'}`,
              marginBottom: -1,
            }}>
              <BookmarkIcon />
              {v.name}
              {isActive && (
                <span
                  role="button"
                  aria-label={`Remove saved view ${v.name}`}
                  onClick={e => { e.stopPropagation(); void handleDeleteView(v); }}
                  style={{ color: '#9ca3af', fontWeight: 400, padding: '0 2px' }}
                >
                  ✕
                </span>
              )}
            </button>
          );
        })}
        {canSaveView && (
          <button onClick={() => void handleSaveView()} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '9px 14px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontSize: '0.8125rem', fontWeight: 500, color: '#C5286A',
            borderBottom: '2px solid transparent', marginBottom: -1,
          }}>
            <BookmarkIcon />
            Save view
          </button>
        )}
      </div>
      <SearchInput
        urlValue={q}
        onSearch={v => setDebounced('q', v)}
        placeholder="Search order #, name, email or phone…"
        style={{
          padding: '7px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
          minWidth: 220,
        }}
      />
      {/* Tag filter (Shopify: "Tagged with"); only offered once tags exist. */}
      {tags.length > 0 && (
        <select
          aria-label="Filter by tag"
          value={tag}
          onChange={e => setParam('tag', e.target.value)}
          style={{
            padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 8,
            fontSize: '0.8125rem', background: 'white',
            color: tag ? '#111827' : '#6b7280',
            fontWeight: tag ? 600 : 400,
          }}
        >
          <option value="">All tags</option>
          {tags.map(t => (
            <option key={t.slug} value={t.slug}>{t.name}</option>
          ))}
        </select>
      )}
      <button
        onClick={() => setMoreOpenManual(!moreOpen)}
        aria-expanded={moreOpen}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', background: 'white', cursor: 'pointer',
          color: hasMoreFilters ? '#111827' : '#6b7280',
          fontWeight: hasMoreFilters ? 600 : 400,
        }}
      >
        More filters
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ transform: moreOpen ? 'rotate(180deg)' : 'none' }}>
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {hasFilters && (
        <button onClick={clearAll} style={{
          padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8,
          fontSize: '0.8125rem', color: '#6b7280', background: 'white', cursor: 'pointer',
        }}>
          Clear ✕
        </button>
      )}
      <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 'auto' }}>
        {total} order{total !== 1 ? 's' : ''}
      </span>
    </div>
    <div className="adm-filter-pills" style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 6 }}>
        Placed
      </span>
      {RANGES.map(r => {
        const isActive = range === r.value;
        return (
          <button key={r.value} onClick={() => setRange(r.value)} style={{
            padding: '5px 12px', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontSize: '0.75rem', fontWeight: isActive ? 600 : 400,
            background: isActive ? '#111827' : '#f3f4f6',
            color: isActive ? '#f9fafb' : '#6b7280',
          }}>
            {r.label}
          </button>
        );
      })}
    </div>
    {/* The More-filters row: payment method, city, confirmed state, amount
        range, coupon. Server side lives in admin/orders/page.tsx (and
        exportOrdersCsv, kept in lock-step). */}
    {moreOpen && (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <select
          aria-label="Filter by payment method"
          value={pay}
          onChange={e => setParam('pay', e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', color: pay ? '#111827' : '#6b7280', fontWeight: pay ? 600 : 400 }}
        >
          <option value="">All payments</option>
          {PAY_METHODS.map(m => (
            <option key={m} value={m}>{PAY_METHOD_LABELS[m]}</option>
          ))}
        </select>
        <select
          aria-label="Filter by confirmation state"
          value={confirmed}
          onChange={e => setParam('confirmed', e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer', color: confirmed ? '#111827' : '#6b7280', fontWeight: confirmed ? 600 : 400 }}
        >
          <option value="">Confirmed or not</option>
          <option value="yes">Confirmed</option>
          <option value="no">Unconfirmed</option>
        </select>
        <SearchInput
          urlValue={city}
          onSearch={v => setDebounced('city', v)}
          placeholder="City…"
          aria-label="Filter by city"
          style={{ ...inputStyle, width: 130 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem', color: '#6b7280' }}>
          <span>PKR</span>
          <input key={`min${min}`} defaultValue={min} onChange={e => setDebounced('min', e.target.value.replace(/\D/g, ''))} placeholder="min" inputMode="numeric" style={numStyle} aria-label="Min total" />
          <span>–</span>
          <input key={`max${max}`} defaultValue={max} onChange={e => setDebounced('max', e.target.value.replace(/\D/g, ''))} placeholder="max" inputMode="numeric" style={numStyle} aria-label="Max total" />
        </div>
        <SearchInput
          urlValue={coupon}
          onSearch={v => setDebounced('coupon', v)}
          placeholder="Coupon code…"
          aria-label="Filter by coupon code"
          style={{ ...inputStyle, width: 130 }}
        />
      </div>
    )}
    </div>
  );
}
