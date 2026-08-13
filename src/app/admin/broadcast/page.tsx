export const dynamic = 'force-dynamic';

// ============================================================================
// WhatsApp broadcast (admin → Customers → Broadcast).
//
// Every customer who left a phone number, each with a one-tap "Open in
// WhatsApp" that launches the store's own WhatsApp with the personalised
// message pre-typed. Sends are recorded in the shared campaign ledger so
// nobody is messaged twice. The template and the campaign key are editable:
// change the campaign key for the next sale and the checklist starts fresh.
// Win-back stays the tool for lapsed customers; this one reaches everyone.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { BroadcastRow, type BroadcastCustomer } from '@/components/admin/BroadcastRow';
import { saveBroadcastSettings } from './actions';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { SITE_URL } from '@/lib/seo';
import { PK_TZ } from '@/lib/dates';

const DEFAULT_CAMPAIGN = 'azadi-2026-08';
const DEFAULT_TEMPLATE =
  'Azadi Mubarak {name}! 🇵🇰 Sufyan here from Yellow Pink. Our Azadi Sale is live: 14% off everything with code AZADI14, cash on delivery nationwide. The code works until tomorrow night, 15 August. {link}';

interface OrderRow {
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  created_at: string;
}

const EXCLUDED = new Set(['cancelled', 'payment_pending', 'payment_failed']);

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit', timeZone: PK_TZ });

export default async function BroadcastPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return <NoAccess section="Broadcast" />;
  }

  const admin = supabaseAdmin();
  const [{ data: settingRows }, { data: orderRows }] = await Promise.all([
    admin.from('site_settings').select('key, value').in('key', ['broadcast_template', 'broadcast_campaign']),
    admin
      .from('orders')
      .select('email, phone, first_name, last_name, status, created_at')
      .not('phone', 'is', null)
      .order('created_at', { ascending: false }),
  ]);
  const settings = new Map(((settingRows ?? []) as Array<{ key: string; value: string }>).map(s => [s.key, s.value]));
  const template = settings.get('broadcast_template') || DEFAULT_TEMPLATE;
  const campaign = settings.get('broadcast_campaign') || DEFAULT_CAMPAIGN;

  // One row per phone number, newest order wins the name.
  const byPhone = new Map<string, { name: string; phone: string; orders: number; lastOrderAt: string }>();
  for (const o of (orderRows ?? []) as OrderRow[]) {
    if (!o.phone || EXCLUDED.has(o.status)) continue;
    const key = o.phone.replace(/[^0-9+]/g, '');
    if (!key) continue;
    const existing = byPhone.get(key);
    if (existing) {
      existing.orders += 1;
    } else {
      byPhone.set(key, {
        name: [o.first_name, o.last_name].filter(Boolean).join(' ').trim() || 'there',
        phone: o.phone,
        orders: 1,
        lastOrderAt: fmtDate(o.created_at),
      });
    }
  }

  const { data: sentRows } = await admin
    .from('campaign_outreach')
    .select('cust_key, created_at')
    .eq('campaign', campaign);
  const sentMap = new Map(
    ((sentRows ?? []) as Array<{ cust_key: string; created_at: string }>).map(r => [r.cust_key, fmtDate(r.created_at)]),
  );

  const link = `${SITE_URL}/?utm_source=whatsapp&utm_medium=broadcast&utm_campaign=${encodeURIComponent(campaign)}`;
  const audience: BroadcastCustomer[] = [...byPhone.entries()].flatMap(([key, c]) => {
    const firstName = c.name.split(' ')[0] || 'there';
    const message = template
      .replaceAll('{name}', firstName)
      .replaceAll('{link}', link);
    const waHref = whatsappUrlForCustomer(c.phone, message);
    if (!waHref) return []; // phone had no usable digits
    return [{
      custKey: key,
      name: c.name,
      phone: c.phone,
      orders: c.orders,
      lastOrderAt: c.lastOrderAt,
      sentAt: sentMap.get(key) ?? null,
      waHref,
    }];
  });
  const sentCount = audience.filter(a => a.sentAt).length;

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>WhatsApp broadcast</h1>
      <p style={{ margin: '0 0 20px', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 720 }}>
        Every customer with a phone number, one tap each: the button opens your WhatsApp with the
        personalised message pre-typed, you press send, done. Each send is recorded so nobody is
        messaged twice, whichever device does the sending.
      </p>

      {/* Template + campaign settings */}
      <form action={saveBroadcastSettings} style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, padding: 16, marginBottom: 20, display: 'grid', gap: 12 }}>
        <div>
          <label htmlFor="template" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
            Message ({'{name}'} and {'{link}'} are filled per customer)
          </label>
          <textarea id="template" name="template" defaultValue={template} rows={4} maxLength={1000}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', lineHeight: 1.55, resize: 'vertical', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="campaign" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>
              Campaign key
            </label>
            <input id="campaign" name="campaign" defaultValue={campaign} maxLength={60}
              style={{ padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.8125rem', fontFamily: 'monospace', width: 220 }} />
            <span style={{ display: 'block', fontSize: '0.6875rem', color: '#9ca3af', marginTop: 3 }}>
              Change it for the next sale and the checklist starts fresh.
            </span>
          </div>
          <button type="submit" style={{ padding: '9px 18px', background: '#C5286A', color: 'white', border: 'none', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
            Save
          </button>
        </div>
      </form>

      {/* Audience */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
            Audience ({audience.length})
          </h2>
          <span style={{ fontSize: '0.8125rem', color: sentCount === audience.length && audience.length > 0 ? '#065f46' : '#6b7280', fontWeight: 600 }}>
            {sentCount} of {audience.length} messaged
          </span>
        </div>
        {audience.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No customers with phone numbers yet.
          </div>
        ) : (
          <table className="adm-table-cards adm-cards-dense" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {['Customer', 'Orders', 'Last order', ''].map((h, i) => (
                  <th scope="col" key={h} style={{ padding: '10px 14px', textAlign: i === 1 ? 'right' : 'left', fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audience.map(c => (
                <BroadcastRow key={c.custKey} c={c} campaign={campaign} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
