export const dynamic = 'force-dynamic';

import { supabaseAdmin } from '@/lib/supabase';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { createVendor, deleteVendor } from '@/app/admin/vendor-actions';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import type { Vendor } from '@/types';

export default async function VendorsPage() {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('orders')) {
    return <NoAccess section="Vendors" />;
  }

  // vendors RLS has no policy — admin reads need the service role.
  const { data } = await supabaseAdmin()
    .from('vendors')
    .select('*')
    .order('created_at', { ascending: false });
  const vendors = (data ?? []) as Vendor[];

  const inp: React.CSSProperties = {
    padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 7,
    fontSize: '0.875rem', color: '#111827', background: 'white', outline: 'none',
  };

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Vendors</h1>
      <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: '#6b7280' }}>
        Suppliers you forward confirmed orders to over WhatsApp. Pick one per order from the order page.
      </p>

      {/* Create vendor */}
      <div style={{ background: 'white', borderRadius: 10, padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Add Vendor</h2>
        <form action={createVendor} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Name</label>
            <input name="name" required placeholder="Nazir's Group" style={{ ...inp, width: 200 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>WhatsApp number</label>
            <input name="phone" required placeholder="+92 300 1234567" style={{ ...inp, width: 180 }} />
          </div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', marginBottom: 4 }}>Notes (optional)</label>
            <input name="notes" placeholder="What they supply" style={{ ...inp, width: '100%' }} />
          </div>
          <button type="submit" style={{
            padding: '8px 20px', background: '#C5286A', color: 'white',
            border: 'none', borderRadius: 7, fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer',
          }}>
            + Add
          </button>
        </form>
      </div>

      {/* Vendor list */}
      <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
        {vendors.length === 0 ? (
          <div style={{ padding: '60px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No vendors yet — add your first supplier above.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Name', 'WhatsApp', 'Notes', ''].map(h => (
                  <th scope="col" key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendors.map((v, i) => (
                <tr key={v.id} style={{ borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                  <td data-label="Name" style={{ padding: '12px 16px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{v.name}</td>
                  <td data-label="WhatsApp" style={{ padding: '12px 16px', fontSize: '0.875rem', color: '#374151', fontFamily: 'monospace' }}>{v.phone}</td>
                  <td data-label="Notes" style={{ padding: '12px 16px', fontSize: '0.8125rem', color: '#6b7280' }}>{v.notes || '—'}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <DeleteButton id={v.id} action={deleteVendor} confirmMsg={`Delete vendor "${v.name}"?`} />
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
