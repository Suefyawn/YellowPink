export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { Pagination } from '@/components/admin/Pagination';
import { UsersFilter } from '@/components/admin/UsersFilter';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { AdminUser } from '@/types';

const PAGE_SIZE = 20;

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtMoney = (n: number) => `PKR ${Math.round(n).toLocaleString()}`;

interface OrderStat {
  user_id: string;
  order_count: number | string;
  total_spent: number | string;
  last_order_at: string | null;
}

interface GuestCustomer {
  guest_key: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  order_count: number | string;
  total_spent: number | string;
  last_order_at: string | null;
  first_order_at: string | null;
}

// A customer (registered account or guest buyer) enriched with order aggregates.
interface CustomerRow extends AdminUser {
  kind: 'registered' | 'guest';
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string | null;
}

const SORT_KEYS = ['recent', 'last_order', 'spent', 'orders', 'name'] as const;
type SortKey = (typeof SORT_KEYS)[number];

const TYPE_KEYS = ['all', 'registered', 'guest'] as const;
type TypeKey = (typeof TYPE_KEYS)[number];

const ACTIVITY_KEYS = ['all', 'repeat', 'one', 'none'] as const;
type ActivityKey = (typeof ACTIVITY_KEYS)[number];

function displayName(u: { first_name: string | null; last_name: string | null; email: string }): string {
  const n = `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim();
  return n || u.email;
}

function initials(u: CustomerRow): string {
  const f = u.first_name?.trim()?.[0] ?? '';
  const l = u.last_name?.trim()?.[0] ?? '';
  const ini = (f + l).toUpperCase();
  if (ini) return ini;
  const fallback = (u.email || u.phone || '?').trim()[0];
  return (fallback ?? '?').toUpperCase();
}

// Stable, muted avatar colour derived from the customer id so the same person
// always renders the same swatch (purely decorative).
const AVATAR_COLORS = ['#0369a1', '#9333ea', '#be185d', '#0f766e', '#b45309', '#4338ca', '#15803d', '#9f1239'];
function avatarColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; sort?: string; type?: string; activity?: string }>;
}) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('customers.view')) {
    return <NoAccess section="Customers" />;
  }

  const { q, page: pageParam, sort: sortParam, type: typeParam, activity: activityParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? '1', 10));
  const sort: SortKey = SORT_KEYS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'recent';
  const type: TypeKey = TYPE_KEYS.includes(typeParam as TypeKey) ? (typeParam as TypeKey) : 'all';
  const activity: ActivityKey = ACTIVITY_KEYS.includes(activityParam as ActivityKey) ? (activityParam as ActivityKey) : 'all';

  // Three SECURITY DEFINER RPCs, all called via the service-role client: the
  // account list (get_admin_users — auth.users PII), per-account order
  // aggregates (get_customer_order_stats — revenue data) and guest buyers
  // derived from unclaimed orders (get_guest_customers). All are revoked from
  // anon/authenticated by the security_revoke_anon_rpc migration.
  const admin = supabaseAdmin();
  const [{ data: users }, { data: stats }, { data: guests }] = await Promise.all([
    admin.rpc('get_admin_users' as never),
    admin.rpc('get_customer_order_stats' as never),
    admin.rpc('get_guest_customers' as never),
  ]);

  const statById = new Map<string, OrderStat>();
  for (const st of (stats ?? []) as OrderStat[]) statById.set(st.user_id, st);

  const registered: CustomerRow[] = ((users ?? []) as AdminUser[]).map(u => {
    const st = statById.get(u.id);
    return {
      ...u,
      kind: 'registered' as const,
      orderCount: st ? Number(st.order_count) : 0,
      totalSpent: st ? Number(st.total_spent) : 0,
      lastOrderAt: st?.last_order_at ?? null,
    };
  });

  // Guests have no auth UUID; we address them by their identity key (email, or
  // phone for the rare emailless order), base64url-encoded into the id so the
  // value is path-safe (a raw "guest:<email>" segment with a colon does not
  // match the [id] route on Vercel). The detail page decodes the `guest-`
  // prefix. `created_at` stands in for "joined" — their first order.
  const guestRows: CustomerRow[] = ((guests ?? []) as GuestCustomer[]).map(g => ({
    id: `guest-${Buffer.from(g.guest_key, 'utf8').toString('base64url')}`,
    kind: 'guest' as const,
    email: g.email ?? '',
    first_name: g.first_name,
    last_name: g.last_name,
    phone: g.phone,
    created_at: g.first_order_at ?? g.last_order_at ?? new Date().toISOString(),
    orderCount: Number(g.order_count),
    totalSpent: Number(g.total_spent),
    lastOrderAt: g.last_order_at,
  }));

  const all: CustomerRow[] = [...registered, ...guestRows];

  // Overall stats (computed on the full set, before filters) for the summary
  // cards. The cards double as one-click filters.
  const totals = {
    all: all.length,
    registered: registered.length,
    guests: guestRows.length,
    repeat: all.filter(u => u.orderCount >= 2).length,
    revenue: all.reduce((s, u) => s + u.totalSpent, 0),
  };

  // ── Filtering ──
  let list = all;

  if (type !== 'all') list = list.filter(u => u.kind === type);

  if (activity !== 'all') {
    list = list.filter(u =>
      activity === 'repeat' ? u.orderCount >= 2 :
      activity === 'one'    ? u.orderCount === 1 :
      /* none */              u.orderCount === 0,
    );
  }

  if (q) {
    const lower = q.toLowerCase().trim();
    const qDigits = lower.replace(/\D+/g, '');
    list = list.filter(u => {
      const textHit =
        u.email?.toLowerCase().includes(lower) ||
        u.first_name?.toLowerCase().includes(lower) ||
        u.last_name?.toLowerCase().includes(lower) ||
        `${u.first_name ?? ''} ${u.last_name ?? ''}`.toLowerCase().includes(lower) ||
        u.phone?.toLowerCase().includes(lower);
      // Phone numbers arrive in many shapes ("0300 123…", "+92300…") — also
      // match on digits-only so a spaced/prefixed query still finds them.
      const phoneHit = qDigits.length >= 3 && (u.phone ?? '').replace(/\D+/g, '').includes(qDigits);
      return Boolean(textHit || phoneHit);
    });
  }

  // ── Sorting ──
  list = [...list].sort((a, b) => {
    switch (sort) {
      case 'spent':      return b.totalSpent - a.totalSpent;
      case 'orders':     return b.orderCount - a.orderCount;
      case 'last_order': return (b.lastOrderAt ?? '').localeCompare(a.lastOrderAt ?? '');
      case 'name':       return displayName(a).localeCompare(displayName(b));
      default:           return (b.created_at ?? '').localeCompare(a.created_at ?? '');
    }
  });

  const total = list.length;
  const paginated = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const hasFilters = !!q || type !== 'all' || activity !== 'all' || sort !== 'recent';

  // Build a href that preserves search + sort while setting type/activity —
  // used by the clickable summary cards.
  const cardHref = (next: { type?: TypeKey; activity?: ActivityKey }) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (sort !== 'recent') p.set('sort', sort);
    if (next.type && next.type !== 'all') p.set('type', next.type);
    if (next.activity && next.activity !== 'all') p.set('activity', next.activity);
    const s = p.toString();
    return s ? `/admin/users?${s}` : '/admin/users';
  };

  const cards: { label: string; value: string; icon: string; color: string; href: string; active: boolean }[] = [
    { label: 'All customers', value: totals.all.toLocaleString(), icon: '👥', color: '#0369a1',
      href: cardHref({}), active: type === 'all' && activity === 'all' },
    { label: 'Registered', value: totals.registered.toLocaleString(), icon: '🔑', color: '#075985',
      href: cardHref({ type: 'registered' }), active: type === 'registered' },
    { label: 'Guests', value: totals.guests.toLocaleString(), icon: '🛍️', color: '#b45309',
      href: cardHref({ type: 'guest' }), active: type === 'guest' },
    { label: 'Repeat buyers', value: totals.repeat.toLocaleString(), icon: '🔁', color: '#15803d',
      href: cardHref({ activity: 'repeat' }), active: activity === 'repeat' },
  ];

  // Export carries the active filters so the owner can download a targeted
  // audience (e.g. repeat buyers) as a Custom-Audience CSV.
  const exportParams = new URLSearchParams();
  if (q) exportParams.set('q', q);
  if (type !== 'all') exportParams.set('type', type);
  if (activity !== 'all') exportParams.set('activity', activity);
  const exportQs = exportParams.toString();
  const exportHref = exportQs ? `/admin/users/export?${exportQs}` : '/admin/users/export';

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Customers</h1>
          <p style={{ margin: 0, color: '#6b7280', fontSize: '0.875rem' }}>
            {totals.all.toLocaleString()} total · {fmtMoney(totals.revenue)} lifetime revenue
          </p>
        </div>
        <a href={exportHref} style={{
          padding: '9px 16px', background: 'white', border: '1px solid #d1d5db', borderRadius: 8,
          color: '#374151', textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 600,
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }} title="Download these customers as a CSV for Meta/TikTok custom audiences">
          ↓ Export CSV
        </a>
      </div>

      {/* Summary cards — also act as quick filters. */}
      <div className="adm-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {cards.map(c => (
          <Link key={c.label} href={c.href} style={{
            background: 'white', borderRadius: 10, padding: '18px 20px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            border: c.active ? `1.5px solid ${c.color}` : '1.5px solid transparent',
            display: 'flex', flexDirection: 'column', gap: 10,
            textDecoration: 'none', color: 'inherit',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: '#6b7280', fontSize: '0.8125rem', fontWeight: 500 }}>{c.label}</span>
              <span style={{
                width: 32, height: 32, borderRadius: 8, background: c.color + '18',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.95rem',
              }}>{c.icon}</span>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111827', fontVariantNumeric: 'tabular-nums' }}>
              {c.value}
            </div>
          </Link>
        ))}
      </div>

      <Suspense fallback={null}>
        <UsersFilter total={total} />
      </Suspense>

      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {paginated.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            {hasFilters ? 'No customers match these filters.' : 'No customers yet.'}
            {hasFilters && (
              <div style={{ marginTop: 12 }}>
                <Link href="/admin/users" style={{ color: '#0369a1', fontWeight: 600, textDecoration: 'none' }}>
                  Clear filters
                </Link>
              </div>
            )}
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Customer', 'Orders', 'Spent', 'Last order', 'Joined', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginated.map((u, i) => {
                const hasName = !!(u.first_name || u.last_name);
                const name = hasName ? `${u.first_name ?? ''} ${u.last_name ?? ''}`.trim() : (u.email || u.phone || '—');
                const sub = hasName ? (u.email || u.phone) : null;
                return (
                  <tr key={u.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <td data-label="Customer" style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span aria-hidden="true" style={{
                          flexShrink: 0, width: 36, height: 36, borderRadius: '50%',
                          background: avatarColor(u.id) + '1a', color: avatarColor(u.id),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.8125rem', fontWeight: 700,
                        }}>{initials(u)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{name}</span>
                            <span style={{
                              display: 'inline-block', padding: '1px 8px', borderRadius: 20,
                              fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
                              background: u.kind === 'guest' ? '#fef3c7' : '#e0f2fe',
                              color: u.kind === 'guest' ? '#92400e' : '#075985',
                            }}>
                              {u.kind === 'guest' ? 'Guest' : 'Registered'}
                            </span>
                          </div>
                          {hasName && sub && (
                            <div style={{ fontSize: '0.75rem', color: '#9ca3af', wordBreak: 'break-word' }}>{sub}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Orders" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {u.orderCount}
                    </td>
                    <td data-label="Spent" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                      {u.orderCount > 0 ? fmtMoney(u.totalSpent) : <span style={{ color: '#d1d5db', fontWeight: 400 }}>—</span>}
                    </td>
                    <td data-label="Last order" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {u.lastOrderAt ? fmtDate(u.lastOrderAt) : <span style={{ color: '#d1d5db' }}>—</span>}
                    </td>
                    <td data-label="Joined" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                      {fmtDate(u.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <Link href={`/admin/users/${u.id}`} style={{
                        padding: '7px 14px', background: '#f3f4f6', color: '#374151',
                        borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                        minHeight: 32, display: 'inline-flex', alignItems: 'center',
                      }}>
                        View →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Suspense fallback={null}>
        <Pagination total={total} pageSize={PAGE_SIZE} currentPage={page} basePath="/admin/users" />
      </Suspense>
    </div>
  );
}
