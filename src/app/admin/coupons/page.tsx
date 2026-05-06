export const dynamic = 'force-dynamic';

import { supabase } from '@/lib/supabase';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createCoupon, deleteCoupon, toggleCoupon } from '@/app/admin/coupon-actions';
import type { Coupon } from '@/types';

const fmtDate = (s: string) =>
  new Date(s).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

export default async function CouponsPage() {
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  const coupons = (data ?? []) as Coupon[];

  const inp: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Coupons</h1>
      </div>

      {/* Create coupon form */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Create Coupon</h2>
        <form action={createCoupon} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Code</label>
            <input name="code" required placeholder="SAVE10" style={{ ...inp, textTransform: 'uppercase', fontFamily: 'monospace', width: 120 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Type</label>
            <select name="type" style={inp}>
              <option value="percent">Percent %</option>
              <option value="fixed">Fixed PKR</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Value</label>
            <input name="value" type="number" required min={1} placeholder="10" style={{ ...inp, width: 80 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Min Order (PKR)</label>
            <input name="min_order" type="number" min={0} defaultValue={0} placeholder="0" style={{ ...inp, width: 100 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Max Uses</label>
            <input name="max_uses" type="number" min={1} placeholder="Unlimited" style={{ ...inp, width: 100 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Expires</label>
            <input name="expires_at" type="date" style={inp} />
          </div>
          <button type="submit" style={{
            padding: '8px 20px', background: '#ec4899', color: 'white',
            border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}>
            + Create
          </button>
        </form>
      </div>

      {/* Coupons table */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {coupons.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>No coupons yet</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Code', 'Discount', 'Min Order', 'Used', 'Expires', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c, i) => (
                <tr key={c.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 700, fontSize: '0.875rem', color: '#111827' }}>{c.code}</td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {c.type === 'percent' ? `${c.value}%` : `PKR ${c.value.toLocaleString()}`}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151' }}>
                    {c.min_order ? `PKR ${c.min_order.toLocaleString()}` : '—'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#6b7280' }}>
                    {c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
                    {c.expires_at ? fmtDate(c.expires_at) : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <form action={toggleCoupon.bind(null, c.id, !c.active)}>
                      <button type="submit" style={{
                        padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                        background: c.active ? '#f0fdf4' : '#f3f4f6',
                        color: c.active ? '#15803d' : '#9ca3af',
                      }}>
                        {c.active ? '● Active' : '○ Inactive'}
                      </button>
                    </form>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <DeleteButton id={c.id} action={deleteCoupon} confirmMsg={`Delete coupon "${c.code}"?`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
