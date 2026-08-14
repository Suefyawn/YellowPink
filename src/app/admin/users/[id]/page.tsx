export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin } from '@/lib/supabase';
import { PAY_METHOD_LABELS, type Order, type AdminUser } from '@/types';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { AdminFlash } from '@/components/admin/AdminFlash';
import { OrderStatusBadge } from '@/components/admin/OrderStatusBadge';
import { deleteCustomer } from '@/app/admin/actions';
import { adjustLoyaltyPoints } from '@/app/admin/users/loyalty-actions';
import { CustomerNotes, type CustomerNote } from '@/components/admin/CustomerNotes';
import { CustomerTagsEditor } from '@/components/admin/CustomerTagsEditor';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { isCodFlagged } from '@/lib/cod-flags';
import { NON_REVENUE_ORDER_STATUSES } from '@/lib/commerce';
import { fmtDatePK as fmtDate, fmtDateTimePK as fmtDateTime } from '@/lib/dates';

const fmt = (n: number) => `PKR ${n.toLocaleString()}`;

interface ActivityRow {
  id: string;
  action: string;
  entity: string | null;
  entity_id: string | null;
  diff: Record<string, unknown> | null;
  created_at: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  'order.placed':         'Placed an order',
  'order.status_changed': 'Order status changed',
  'customer.signup':      'Created their account',
  'review.submitted':     'Submitted a review',
  'subscription.created': 'Subscribed to a product',
  'newsletter.signup':    'Joined the newsletter',
};

function activityLabel(action: string): string {
  return ACTIVITY_LABELS[action] ?? action.replace(/[._]/g, ' ');
}

function activityDetail(a: ActivityRow): string {
  const d = a.diff ?? {};
  if (a.action === 'order.placed') {
    return `${String(d.order_number ?? '')} · PKR ${Number(d.total ?? 0).toLocaleString()}`;
  }
  if (a.action === 'order.status_changed') return `${String(d.from ?? '')} → ${String(d.to ?? '')}`;
  if (a.action === 'review.submitted') return `${String(d.rating ?? '?')}★ rating`;
  if (a.action === 'subscription.created') return `every ${String(d.interval_days ?? '?')} days`;
  return '';
}

export default async function UserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ err?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return <NoAccess section="Customers" />;
  }
  const canDeleteCustomer = !session || session.isOwner || session.permissions.includes('customers.delete');
  const canAdjustPoints = session.isOwner || session.permissions.includes('customers.edit');
  const { id } = await params;
  // deleteCustomer bounces failures back here with ?err=<message>.
  const { err } = (await searchParams) ?? {};

  // orders is RLS-locked; the `get_admin_user` RPC already uses
  // SECURITY DEFINER but route via service-role for consistency.
  const admin = supabaseAdmin();

  // Guest buyers have no auth account; the Customers list addresses them with a
  // `guest-<base64url(identity)>` id, where identity is their email (or
  // `phone:<phone>` for the rare emailless order). We resolve them straight off
  // their unclaimed orders and synthesise an account-shaped record.
  const isGuest = id.startsWith('guest-');

  let user: AdminUser;
  let orderList: Order[];
  let activityRows: ActivityRow[] = [];
  // Reward-points balance (registered customers only; guests have no
  // account to hold points).
  let loyalty: { points_balance: number; lifetime_points: number } | null = null;

  if (isGuest) {
    const key = Buffer.from(id.slice('guest-'.length), 'base64url').toString('utf8');
    const byPhone = key.startsWith('phone:');
    const ident = byPhone ? key.slice('phone:'.length) : key;
    const base = admin.from('orders').select('*').is('user_id', null).order('created_at', { ascending: false });
    const { data: gOrders } = byPhone ? await base.eq('phone', ident) : await base.ilike('email', ident);
    orderList = (gOrders ?? []) as Order[];
    if (orderList.length === 0) notFound();
    const latest = orderList[0];
    const earliest = orderList[orderList.length - 1];
    user = {
      id,
      email: latest.email ?? '',
      first_name: latest.first_name ?? null,
      last_name: latest.last_name ?? null,
      phone: latest.phone ?? null,
      created_at: earliest.created_at ?? latest.created_at ?? new Date().toISOString(),
    };
    // Guests have no auth UUID so audit_log is empty; derive activity from orders.
    activityRows = orderList.map(o => ({
      id: o.id ?? o.order_number,
      action: 'order.placed',
      entity: 'order',
      entity_id: o.id ?? null,
      diff: { order_number: o.order_number, total: o.total },
      created_at: o.created_at ?? new Date().toISOString(),
    }));
  } else {
    const [{ data: userData }, { data: orders }, { data: activity }, { data: loyaltyRow }] = await Promise.all([
      admin.rpc('get_admin_user' as never, { p_id: id } as never),
      admin.from('orders').select('*').eq('user_id', id).order('created_at', { ascending: false }),
      // The customer's own journey, activity_log rows where they are the actor
      // (signup, orders, reviews, subscriptions). See migration 090.
      admin.from('audit_log')
        .select('id, action, entity, entity_id, diff, created_at')
        .eq('actor_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
      admin.from('loyalty_accounts').select('points_balance, lifetime_points').eq('user_id', id).maybeSingle(),
    ]);

    // get_admin_user RETURNS TABLE, a set-returning RPC, so `.rpc()` yields an
    // array even for a single match. Take the first row.
    user = ((userData ?? []) as AdminUser[])[0];
    if (!user) notFound();

    orderList = (orders ?? []) as Order[];
    activityRows = (activity ?? []) as ActivityRow[];
    loyalty = (loyaltyRow as { points_balance: number; lifetime_points: number } | null) ?? null;
  }
  // Staff notes about this customer, keyed by the same identifier this page's
  // URL uses (registered auth uuid, or the guest-<base64url> id), newest first.
  const { data: noteRows } = await admin
    .from('customer_notes')
    .select('id, author, body, created_at')
    .eq('cust_key', id)
    .order('created_at', { ascending: false });
  const customerNotes = (noteRows ?? []) as CustomerNote[];

  // Customer tags (Shopify-style labels: vip, prepay-only, influencer…),
  // keyed by the same cust_key the Notes card uses, plus the full registry
  // for the editor's suggestions.
  const [{ data: custTagMapRows }, { data: custTagRegistryRows }] = await Promise.all([
    admin.from('customer_tag_map').select('tag_id, customer_tags(name)').eq('cust_key', id),
    admin.from('customer_tags').select('name').order('name'),
  ]);
  const customerTags = ((custTagMapRows ?? []) as Array<{ tag_id: string; customer_tags: { name: string } | { name: string }[] | null }>)
    .flatMap(r => {
      const t = Array.isArray(r.customer_tags) ? r.customer_tags[0] : r.customer_tags;
      return t ? [{ id: r.tag_id, name: t.name }] : [];
    });
  const customerTagSuggestions = ((custTagRegistryRows ?? []) as Array<{ name: string }>).map(t => t.name);

  // Who-are-they signals for the confirmation call, same sources the order
  // page uses. COD flag: the shared helper (lib/cod-flags) that gates
  // dispatch; newsletter: the subscribers table's unsubscribed_at flag
  // (ilike = case-insensitive match, emails are stored as typed).
  const codFlagged = await isCodFlagged({ phone: user.phone, email: user.email });
  let newsletter: 'subscribed' | 'unsubscribed' | 'none' = 'none';
  if (user.email) {
    const { data: nlRows } = await admin
      .from('newsletter_subscribers')
      .select('unsubscribed_at')
      .ilike('email', user.email)
      .limit(1);
    const nl = (nlRows ?? [])[0] as { unsubscribed_at: string | null } | undefined;
    if (nl) newsletter = nl.unsubscribed_at ? 'unsubscribed' : 'subscribed';
  }
  // First order date ("Customer since"): orderList arrives newest-first in
  // both the guest and registered branches, but reduce anyway so a future
  // sort change can't silently flip this to the latest order.
  const customerSince = orderList.length
    ? orderList.reduce((min, o) => (o.created_at && o.created_at < min ? o.created_at : min), orderList[0].created_at ?? '')
    : null;

  // Lifetime spend + AOV are revenue figures, so they count only realized
  // orders, a cancelled / refunded / returned / payment-failed order brought
  // in no money and would otherwise inflate both numbers (and AOV especially,
  // since it divides by the order count). "Orders" below still shows the full
  // count so the customer's total activity is visible.
  // Archived orders stay visible in the history below (the customer's real
  // past) but never count toward money metrics, same as every other surface.
  const revenueOrders = orderList.filter(
    o => o.archived_at == null
      && !(NON_REVENUE_ORDER_STATUSES as readonly string[]).includes(o.status ?? ''),
  );
  const totalSpend = revenueOrders.reduce((s, o) => s + o.total, 0);
  const deliveredCount = orderList.filter(o => o.status === 'delivered').length;
  const aov = revenueOrders.length ? Math.round(totalSpend / revenueOrders.length) : 0;
  const customerName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim()
    || user.email || user.phone || 'there';
  const waMessage = `Hi ${customerName.split(' ')[0]}, hope you're well, message from Yellow Pink.`;
  const waHref = whatsappUrlForCustomer(user.phone, waMessage);

  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <AdminFlash message={err} type="error" clearPath={`/admin/users/${id}`} />
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Link href="/admin/users" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '0.875rem' }}>← Customers</Link>
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
          {user.first_name || user.last_name
            ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
            : (user.email || user.phone)}
        </h1>
        <span style={{
          display: 'inline-block', padding: '2px 10px', borderRadius: 20,
          fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em',
          background: isGuest ? '#fef3c7' : '#e0f2fe',
          color: isGuest ? '#92400e' : '#075985',
        }}>
          {isGuest ? 'Guest' : 'Registered'}
        </span>
        {codFlagged && (
          <span
            title="A confirmed COD parcel of this phone/email was refused. Collect advance payment before dispatching their next order."
            style={{
              display: 'inline-block', padding: '2px 10px', borderRadius: 20,
              fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.03em',
              background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
            }}
          >
            COD refusal flag
          </span>
        )}
      </div>

      {/* minWidth: 0 on both columns so the Order History table's intrinsic
          width can't blow the grid (and the page) past the viewport. */}
      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 20, marginBottom: 20 }}>
        {/* Profile card */}
        <div style={{ minWidth: 0 }}>
          <div style={{ ...section, marginBottom: 16 }}>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              background: '#fdf2f8', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.5rem', marginBottom: 16,
            }}>
              {(user.first_name?.[0] ?? user.email?.[0] ?? user.phone?.[0] ?? '?').toUpperCase()}
            </div>
            <h2 style={{ margin: '0 0 4px', fontSize: '1rem', fontWeight: 700, color: '#111827' }}>
              {user.first_name || user.last_name
                ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim()
                : '—'}
            </h2>
            <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#6b7280' }}>{user.email || user.phone || '—'}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Phone</span>
                {user.phone ? (
                  <a href={`tel:${user.phone}`} style={{ color: '#C5286A', fontWeight: 500, textDecoration: 'none' }}>{user.phone}</a>
                ) : (
                  <span style={{ color: '#374151', fontWeight: 500 }}>—</span>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Joined</span>
                <span style={{ color: '#374151' }}>{fmtDate(user.created_at)}</span>
              </div>
              {customerSince && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                  <span style={{ color: '#6b7280' }}>Customer since</span>
                  <span style={{ color: '#374151' }}>{fmtDate(customerSince)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                <span style={{ color: '#6b7280' }}>Newsletter</span>
                <span style={{
                  fontWeight: 500,
                  color: newsletter === 'subscribed' ? '#15803d' : newsletter === 'unsubscribed' ? '#b45309' : '#9ca3af',
                }}>
                  {newsletter === 'subscribed' ? 'Subscribed to newsletter' : newsletter === 'unsubscribed' ? 'Unsubscribed' : 'Not subscribed'}
                </span>
              </div>
            </div>
            {waHref && (
              <a
                href={waHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: '#25D366', color: 'white', textDecoration: 'none',
                  padding: '8px 14px', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.5 14.4c-.3-.1-1.7-.8-2-.9s-.5-.1-.7.2-.8.9-.9 1.1-.3.2-.6 0c-.3-.1-1.2-.4-2.3-1.4-.9-.8-1.4-1.7-1.6-2-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5s-.7-1.7-.9-2.3c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4s-1 1-1 2.5 1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.7-.7 2-1.4.2-.7.2-1.2.2-1.4 0-.1-.2-.2-.5-.4z"/>
                  <path d="M21.6 4.4C16.9-.3 9.3-.3 4.6 4.4c-3.7 3.7-4.4 9.3-2.1 13.7L0 24l6.1-2.4c1.6.9 3.4 1.4 5.3 1.4 7.1 0 12.6-5.5 12.6-12.6 0-2.6-.9-5-2.4-7zM12.1 21c-1.6 0-3.2-.4-4.7-1.3l-.3-.2-3.6 1.4 1.4-3.5-.2-.3c-2.1-3.3-1.6-7.5 1.3-10.4 3.5-3.5 9.1-3.5 12.5 0 3.5 3.5 3.5 9.1 0 12.5-1.7 1.7-3.9 2.8-6.4 2.8z"/>
                </svg>
                WhatsApp
              </a>
            )}
          </div>

          {/* Stats */}
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {[
              { label: 'Orders', value: orderList.length, wide: false },
              { label: 'Delivered', value: deliveredCount, wide: false },
              { label: 'Total spend', value: fmt(totalSpend), wide: false },
              { label: 'Avg order', value: fmt(aov), wide: false },
            ].map(s => (
              <div key={s.label} style={{
                ...section,
                padding: '16px 20px',
                gridColumn: s.wide ? '1 / -1' : undefined,
              }}>
                <div style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, marginBottom: 4 }}>{s.label}</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Reward points — registered customers only (guests have no
              account to hold a balance). Manual adjustments cover the
              Google-review bonus (unverifiable by code, so the operator
              grants it by hand), goodwill credits and corrections. */}
          {!isGuest && (
            <div style={{ ...section, marginTop: 16 }}>
              <h2 style={{ margin: '0 0 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ color: '#C5286A' }}>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                Reward points
              </h2>
              <div style={{ display: 'flex', gap: 12, marginBottom: canAdjustPoints ? 16 : 0 }}>
                <div style={{ flex: 1, background: '#fdf2f8', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#9d174d', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Balance</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{(loyalty?.points_balance ?? 0).toLocaleString()}</div>
                </div>
                <div style={{ flex: 1, background: '#f9fafb', borderRadius: 8, padding: '10px 14px' }}>
                  <div style={{ fontSize: '0.6875rem', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Lifetime</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>{(loyalty?.lifetime_points ?? 0).toLocaleString()}</div>
                </div>
              </div>
              {canAdjustPoints && (
                <form action={adjustLoyaltyPoints} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <input type="hidden" name="user_id" value={user.id} />
                  <input
                    type="number"
                    name="delta"
                    required
                    placeholder="Points (e.g. 100 or -50)"
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem' }}
                  />
                  <input
                    type="text"
                    name="note"
                    maxLength={200}
                    placeholder="Reason (e.g. Google review bonus)"
                    style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem' }}
                  />
                  <button type="submit" style={{
                    padding: '8px 14px', background: '#111827', color: 'white', border: 'none',
                    borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  }}>
                    Adjust points
                  </button>
                  <p style={{ margin: 0, fontSize: '0.6875rem', color: '#9ca3af' }}>
                    Shows on the customer&apos;s rewards page as &ldquo;Manual adjustment&rdquo;. Use a negative number to deduct.
                  </p>
                </form>
              )}
            </div>
          )}

          {/* Staff notes about this customer — internal-only, append-only,
              works for guests too (keyed by the page's customer id). */}
          <CustomerNotes custKey={id} notes={customerNotes} canEdit={canAdjustPoints} />

          {/* Tags — Shopify-style customer labels; the customers list filters
              by them. Keyed by the same cust_key as the Notes card. */}
          <CustomerTagsEditor
            custKey={id}
            initialTags={customerTags}
            suggestions={customerTagSuggestions}
            canEdit={canAdjustPoints}
          />
        </div>

        {/* Order history */}
        <div style={{ ...section, minWidth: 0 }}>
          <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Order History
          </h2>
          {orderList.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
              No orders yet
            </div>
          ) : (
            <div className="adm-table-scroll"><table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Order #', 'Date', 'Items', 'Total', 'Status', 'Payment', ''].map(h => (
                    <th scope="col" key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {orderList.map((o, i) => {
                  const status = o.status ?? 'pending';
                  const itemCount = (o.items ?? []).length;
                  return (
                    <tr key={o.id} style={{ borderTop: i > 0 ? '1px solid #f9fafb' : 'none' }}>
                      <td data-label="Order #" style={{ padding: '10px 12px' }}>
                        <Link href={`/admin/orders/${o.id}`} style={{ fontWeight: 700, fontSize: '0.875rem', color: '#C5286A', textDecoration: 'none', fontFamily: 'monospace' }}>
                          {o.order_number}
                        </Link>
                      </td>
                      <td data-label="Date" style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {o.created_at ? fmtDateTime(o.created_at) : '—'}
                      </td>
                      <td data-label="Items" style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#374151' }}>
                        {itemCount} item{itemCount !== 1 ? 's' : ''}
                      </td>
                      <td data-label="Total" style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827', whiteSpace: 'nowrap' }}>
                        {fmt(o.total)}
                      </td>
                      <td data-label="Status" style={{ padding: '10px 12px' }}>
                        <OrderStatusBadge status={status} />
                      </td>
                      <td data-label="Payment" style={{ padding: '10px 12px' }}>
                        <span style={{
                          display: 'inline-block', padding: '2px 8px',
                          background: '#f3f4f6', borderRadius: 20,
                          fontSize: '0.75rem', color: '#374151',
                        }}>
                          {PAY_METHOD_LABELS[o.pay_method] ?? o.pay_method}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Link href={`/admin/orders/${o.id}`} style={{
                          padding: '4px 10px', background: '#f3f4f6', color: '#374151',
                          borderRadius: 6, textDecoration: 'none', fontSize: '0.8125rem', fontWeight: 500,
                          whiteSpace: 'nowrap',
                        }}>
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          )}
        </div>
      </div>

      {/* Activity timeline, the customer's journey */}
      <div style={{ ...section, marginTop: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          {isGuest ? 'Order activity' : 'Activity timeline'}
        </h2>
        {activityRows.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No recorded activity yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {activityRows.map((a, i) => {
              const detail = activityDetail(a);
              return (
                <div key={a.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#C5286A', marginTop: 6, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>{activityLabel(a.action)}</div>
                    {detail && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{detail}</div>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                    {fmtDateTime(a.created_at)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {canDeleteCustomer && !isGuest && (
        <div style={{ ...section, marginTop: 20, border: '1px solid #fecaca', background: '#fef2f2' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#b91c1c' }}>Danger zone</h2>
          <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Permanently delete this customer&apos;s account. Their {orderList.length} order{orderList.length === 1 ? '' : 's'} are kept (detached as guest orders) so revenue history stays intact. This can&apos;t be undone.
          </p>
          <DeleteButton
            id={user.id}
            action={deleteCustomer}
            confirmMsg={`Permanently delete ${user.email || 'this customer'}'s account? Their orders are kept as guest orders. This cannot be undone.`}
            label="Delete customer"
          />
        </div>
      )}
    </div>
  );
}
