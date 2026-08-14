export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import { supabaseAdmin } from '@/lib/supabase';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { CopyButton } from '@/components/admin/CopyButton';
import { DotChip } from '@/components/admin/OrderChips';
import { CouponEditModal } from '@/components/admin/CouponEditModal';
import { CouponCreateForm } from '@/components/admin/CouponCreateForm';
import { deleteCoupon, toggleCoupon } from '@/app/admin/coupon-actions';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Coupon } from '@/types';
import { fmtDatePK as fmtDate } from '@/lib/dates';

function getCouponState(c: Coupon): 'expired' | 'maxed' | 'scheduled' | 'active' | 'inactive' {
  if (c.expires_at && new Date(c.expires_at) < new Date()) return 'expired';
  if (c.max_uses && c.used_count >= c.max_uses) return 'maxed';
  if (!c.active) return 'inactive';
  if (c.starts_at && new Date(c.starts_at) > new Date()) return 'scheduled';
  return 'active';
}

const stateStyle: Record<string, React.CSSProperties> = {
  expired:   { background: '#fef2f2' },
  maxed:     { background: '#fff7ed' },
  scheduled: { background: '#eff6ff' },
  active:    {},
  inactive:  { background: '#f9fafb' },
};

export default async function CouponsPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; created?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('coupons'))) {
    return <NoAccess section="Coupons" />;
  }
  const sp = (await searchParams) ?? {};
  const feedbackError = sp.error;
  const feedbackCreated = sp.created;
  // coupons RLS (migration 070) drops anon SELECT, admin reads need
  // the service role.
  const admin = supabaseAdmin();
  const [{ data }, { data: orderRows }, { data: productRows }] = await Promise.all([
    admin.from('coupons').select('*').order('created_at', { ascending: false }),
    admin.from('orders').select('coupon_code, discount_amount').not('coupon_code', 'is', null).is('archived_at', null).not('status', 'in', '(cancelled,payment_failed,payment_pending)'),
    // Published catalogue for the edit dialog's product-scoping pickers.
    admin.from('products').select('id, brand, name').eq('status', 'published').order('name'),
  ]);
  const coupons = (data ?? []) as Coupon[];
  const pickerProducts = ((productRows ?? []) as Array<{ id: string; brand: string | null; name: string }>)
    .map(p => ({ id: p.id, label: p.brand ? `${p.brand} — ${p.name}` : p.name }));

  // Real redemption impact, aggregated from orders (ground truth) and keyed
  // by uppercased code so casing differences collapse together.
  const impact = new Map<string, { orders: number; discount: number }>();
  for (const row of (orderRows ?? []) as Array<{ coupon_code: string | null; discount_amount: number | null }>) {
    if (!row.coupon_code) continue;
    const key = row.coupon_code.toUpperCase();
    const cur = impact.get(key) ?? { orders: 0, discount: 0 };
    cur.orders += 1;
    cur.discount += row.discount_amount ?? 0;
    impact.set(key, cur);
  }
  // Split the headline total between codes that still exist (what the table
  // below sums to) and codes since deleted, so the header reconciles with the
  // table instead of silently including orphaned discounts.
  const liveCodes = new Set(coupons.map(c => c.code.toUpperCase()));
  let liveDiscount = 0, deletedDiscount = 0;
  for (const [code, v] of impact) {
    if (liveCodes.has(code)) liveDiscount += v.discount; else deletedDiscount += v.discount;
  }

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div className="adm-page-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Coupons</h1>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#6b7280' }}>
            {coupons.length} coupon{coupons.length !== 1 ? 's' : ''}
            {liveDiscount > 0 && ` · PKR ${liveDiscount.toLocaleString()} given in discounts`}
            {deletedDiscount > 0 && ` (plus PKR ${deletedDiscount.toLocaleString()} from deleted codes)`}
          </p>
        </div>
      </div>

      {(feedbackError || feedbackCreated) && (
        <div
          role="status"
          style={{
            marginBottom: 16, padding: '10px 14px', borderRadius: 8, fontSize: '0.875rem',
            background: feedbackError ? '#fef2f2' : '#f0fdf4',
            color: feedbackError ? '#991b1b' : '#166534',
            border: `1px solid ${feedbackError ? '#fecaca' : '#bbf7d0'}`,
          }}
        >
          {feedbackError ?? `Coupon "${feedbackCreated}" created.`}
        </div>
      )}

      {/* Create coupon form. Client component (useActionState): a rejected
          create keeps the entered fields and shows the error inline instead
          of round-tripping through a redirect that wiped the form. Suspense
          because it reads useSearchParams for the post-create reset. */}
      <Suspense fallback={null}>
        <CouponCreateForm products={pickerProducts} />
      </Suspense>

      {/* Coupons table */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {coupons.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No coupons yet</div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Code', 'Discount', 'Min Order', 'Used', 'Discount given', 'Expires', 'Status', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => {
                const state = getCouponState(c);
                const isMaxed = state === 'maxed';
                const isExpired = state === 'expired';
                return (
                  <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none', ...stateStyle[state] }}>
                    <td data-label="Code" style={{ padding: '12px 16px' }}>
                      {c.trigger_kind === 'automatic' ? (
                        // Automatic: the customer-facing title leads; the
                        // generated code is internal (no copy button — there's
                        // nothing to hand to a shopper).
                        <>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{c.title || c.code}</span>
                            <DotChip label="Automatic" color="#7c3aed" title="Applies by itself to every qualifying basket — no code to share" />
                          </span>
                          <div style={{ fontFamily: 'monospace', fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2 }}>{c.code}</div>
                        </>
                      ) : (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{c.code}</span>
                          <CopyButton value={c.code} iconOnly title={`Copy coupon code ${c.code}`} />
                        </span>
                      )}
                      {c.description && (
                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 2, maxWidth: 220 }}>{c.description}</div>
                      )}
                      {(c.product_ids?.length || c.excluded_product_ids?.length || c.email_restrictions?.length) ? (
                        <div style={{ fontSize: '0.6875rem', color: '#6b7280', marginTop: 2 }}>
                          {[
                            c.product_ids?.length ? `${c.product_ids.length} product${c.product_ids.length > 1 ? 's' : ''} only` : null,
                            c.excluded_product_ids?.length ? `${c.excluded_product_ids.length} excluded` : null,
                            c.email_restrictions?.length ? 'email-restricted' : null,
                          ].filter(Boolean).join(' · ')}
                        </div>
                      ) : null}
                    </td>
                    <td data-label="Discount" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {c.bxgy
                        // Shopify's Buy X get Y summary, e.g. "Buy 2, get 1 free".
                        ? `Buy ${c.bxgy.buy_qty}, get ${c.bxgy.get_qty} ${c.bxgy.pct_off >= 100 ? 'free' : `at ${c.bxgy.pct_off}% off`}`
                        : c.discount_type === 'free_shipping' || c.free_shipping
                          ? 'Free shipping'
                          : c.type === 'percent' ? `${c.value}%` : `PKR ${c.value.toLocaleString()}`}
                    </td>
                    <td data-label="Min order" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {c.min_order ? `PKR ${c.min_order.toLocaleString()}` : '—'}
                    </td>
                    <td data-label="Used" style={{ padding: '12px 16px', fontSize: '0.875rem', color: isMaxed ? '#ea580c' : '#6b7280', fontWeight: isMaxed ? 600 : 400 }}>
                      {c.used_count}
                      {c.max_uses ? <span style={{ color: '#9ca3af' }}> / {c.max_uses}</span> : ''}
                      {c.usage_limit_per_user ? <div style={{ fontSize: '0.6875rem', color: '#9ca3af' }}>{c.usage_limit_per_user}/customer</div> : null}
                    </td>
                    <td data-label="Discount given" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                      {(() => {
                        const imp = impact.get(c.code.toUpperCase());
                        return imp && imp.discount > 0
                          ? <span><strong>PKR {imp.discount.toLocaleString()}</strong><span style={{ color: '#9ca3af' }}> · {imp.orders} order{imp.orders !== 1 ? 's' : ''}</span></span>
                          : <span style={{ color: '#9ca3af' }}>—</span>;
                      })()}
                    </td>
                    <td data-label="Expires" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: isExpired ? '#dc2626' : '#6b7280', fontWeight: isExpired ? 600 : 400 }}>
                      {state === 'scheduled' && c.starts_at && (
                        <span style={{ display: 'block', color: '#2563eb', fontWeight: 600 }}>from {fmtDate(c.starts_at)}</span>
                      )}
                      {c.expires_at ? fmtDate(c.expires_at) : '—'}
                    </td>
                    <td data-label="Status" style={{ padding: '12px 16px' }}>
                      {/* One effective status per coupon: an expired or maxed
                          coupon shows as such, never as "Active" alongside an
                          expiry warning. The pill still toggles the underlying
                          active flag. */}
                      <form action={toggleCoupon.bind(null, c.id, !c.active)}>
                        <button
                          type="submit"
                          title={c.active ? 'Click to deactivate' : 'Click to activate'}
                          style={{
                            padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                            background: isExpired ? '#fef2f2' : isMaxed ? '#fff7ed' : state === 'scheduled' ? '#eff6ff' : c.active ? '#f0fdf4' : '#f3f4f6',
                            color: isExpired ? '#dc2626' : isMaxed ? '#ea580c' : state === 'scheduled' ? '#2563eb' : c.active ? '#15803d' : '#9ca3af',
                            minHeight: 30,
                          }}
                        >
                          {isExpired ? 'Expired' : isMaxed ? 'Maxed out' : state === 'scheduled' ? 'Scheduled' : c.active ? 'Active' : 'Inactive'}
                        </button>
                      </form>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <CouponEditModal coupon={c} products={pickerProducts} />
                        <DeleteButton id={c.id} action={deleteCoupon} confirmMsg={`Delete coupon "${c.code}"?`} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
