export const dynamic = 'force-dynamic';

// ============================================================================
// Win-back outreach (admin → Customers → Win-back).
//
// Lists every past buyer whose last order is >90 days old and who left a
// phone number, with a one-click "Open in WhatsApp" button that launches the
// owner's own WhatsApp with a personalised message pre-typed (wa.me deep
// link — no Business API, no per-message cost, right-sized for a list this
// small). Clicking also records the send in a shared ledger so nobody gets
// messaged twice, whichever staff member or device does the sending.
//
// The message template and coupon code are editable and stored in
// site_settings; placeholders {name}, {last_product}, {coupon} and {link}
// are filled per customer. The link carries UTM tags + ?coupon= so replies
// that turn into orders show up in Analytics → Sources and the discount
// applies itself at checkout.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { WinbackRow, type WinbackCustomer } from '@/components/admin/WinbackRow';
import { saveWinbackSettings } from './actions';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { SITE_URL } from '@/lib/seo';
import { PK_TZ } from '@/lib/dates';

const CAMPAIGN = 'winback-2026-07';

const DEFAULT_TEMPLATE =
  `Hi {name}! It's Yellow Pink 💛 We noticed it's been a while since your last order ({last_product}). ` +
  `We'd love to have you back, so here's {coupon} for 15% off your next order. ` +
  `Browse what's new: {link} (code applies automatically). Reply here if you'd like a recommendation!`;

interface OrderRow {
  user_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  total: number | null;
  created_at: string;
  items: Array<{ name?: string }> | null;
}

const EXCLUDED = new Set(['cancelled', 'payment_pending', 'payment_failed']);
const DAY = 86_400_000;

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', year: '2-digit', timeZone: PK_TZ });

export default async function WinbackPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return <NoAccess section="Win-back" />;
  }

  const admin = supabaseAdmin();
  const [{ data: orderRows }, { data: sentRows }, { data: settingRows }] = await Promise.all([
    admin
      .from('orders')
      .select('user_id, email, phone, first_name, last_name, status, total, created_at, items')
      .order('created_at', { ascending: false })
      .limit(5000),
    admin.from('campaign_outreach').select('cust_key, sent_at').eq('campaign', CAMPAIGN),
    admin.from('site_settings').select('key, value').in('key', ['winback_wa_template', 'winback_coupon']),
  ]);

  const settings = new Map((settingRows ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? '']));
  const template = settings.get('winback_wa_template') || DEFAULT_TEMPLATE;
  const coupon = settings.get('winback_coupon') || 'COMEBACK15';
  const sentBy = new Map((sentRows ?? []).map((r: { cust_key: string; sent_at: string }) => [r.cust_key, r.sent_at]));

  // Aggregate orders per customer with the SAME identity key the Segments
  // view uses (user_id > lower(email) > digits-only phone), so the ledger and
  // the segment labels line up with /admin/segments.
  interface Agg {
    custKey: string; name: string; phone: string;
    orders: number; revenue: number; lastOrderAt: string; lastProduct: string | null;
  }
  const byKey = new Map<string, Agg>();
  for (const o of (orderRows ?? []) as OrderRow[]) {
    if (EXCLUDED.has(o.status)) continue;
    const digitsPhone = (o.phone ?? '').replace(/\D+/g, '');
    const key = o.user_id ?? (o.email?.toLowerCase() || digitsPhone || null);
    if (!key) continue;
    const existing = byKey.get(key);
    if (existing) {
      // Rows arrive newest-first, so the first row already set the "latest"
      // fields; later rows only add to the counters.
      existing.orders += 1;
      if (o.status !== 'refunded') existing.revenue += Number(o.total ?? 0);
      if (!existing.phone && digitsPhone) existing.phone = o.phone!.trim();
    } else {
      byKey.set(key, {
        custKey: key,
        name: [o.first_name, o.last_name].filter(Boolean).join(' ').trim() || (o.email ?? 'Customer'),
        phone: digitsPhone ? o.phone!.trim() : '',
        orders: 1,
        revenue: o.status !== 'refunded' ? Number(o.total ?? 0) : 0,
        lastOrderAt: o.created_at,
        lastProduct: o.items?.[0]?.name ?? null,
      });
    }
  }

  const now = Date.now();
  const shopLink = `${SITE_URL}/shop?utm_source=whatsapp&utm_medium=outreach&utm_campaign=winback-jul26&coupon=${encodeURIComponent(coupon)}`;

  const audience: WinbackCustomer[] = Array.from(byKey.values())
    .filter(a => a.phone && now - new Date(a.lastOrderAt).getTime() > 90 * DAY)
    .sort((a, b) => new Date(a.lastOrderAt).getTime() - new Date(b.lastOrderAt).getTime())
    .map(a => {
      const firstName = a.name.split(' ')[0] || 'there';
      const message = template
        .replaceAll('{name}', firstName)
        .replaceAll('{last_product}', a.lastProduct ?? 'your last order')
        .replaceAll('{coupon}', coupon)
        .replaceAll('{link}', shopLink);
      const waHref = whatsappUrlForCustomer(a.phone, message);
      const sentAt = sentBy.get(a.custKey) ?? null;
      return waHref ? {
        custKey: a.custKey,
        name: a.name,
        phone: a.phone,
        orders: a.orders,
        revenue: a.revenue,
        lastOrderAt: fmtDate(a.lastOrderAt),
        lastProduct: a.lastProduct,
        segment: now - new Date(a.lastOrderAt).getTime() > 180 * DAY ? 'Lapsed' : 'At risk',
        sentAt: sentAt ? fmtDate(sentAt) : null,
        waHref,
      } : null;
    })
    .filter((c): c is WinbackCustomer => c !== null);

  const sentCount = audience.filter(c => c.sentAt).length;

  const th = (label: string, align: 'left' | 'right' = 'left') => (
    <th scope="col" key={label} style={{ padding: '11px 16px', textAlign: align, fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</th>
  );

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Win-back campaign</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 680 }}>
          Past buyers who haven&apos;t ordered in 90+ days. <b>Open in WhatsApp</b> launches your own WhatsApp with the
          personalised message below pre-typed — review it, hit send, done. Each send is recorded so nobody is messaged
          twice. Replies land in your normal WhatsApp; resulting orders appear under <b>Analytics → Sources</b> as
          whatsapp / winback-jul26.
        </p>
      </div>

      {/* Template + coupon settings */}
      <form action={saveWinbackSettings} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20, marginBottom: 24 }}>
        <label htmlFor="wb-template" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Message template
        </label>
        <textarea
          id="wb-template"
          name="template"
          defaultValue={template}
          rows={4}
          maxLength={2000}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <p style={{ margin: '6px 0 14px', fontSize: '0.6875rem', color: '#9ca3af' }}>
          Placeholders: <code>{'{name}'}</code> first name · <code>{'{last_product}'}</code> what they bought last ·{' '}
          <code>{'{coupon}'}</code> the code below · <code>{'{link}'}</code> tagged shop link that auto-applies the coupon.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="wb-coupon" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Coupon code
            </label>
            <input
              id="wb-coupon"
              name="coupon"
              defaultValue={coupon}
              maxLength={40}
              style={{ padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem', textTransform: 'uppercase', width: 180 }}
            />
          </div>
          <button type="submit" className="adm-btn adm-btn-secondary" style={{ padding: '8px 16px', fontSize: '0.8125rem' }}>
            Save template
          </button>
        </div>
      </form>

      {/* Progress + audience table */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Audience — {audience.length} customer{audience.length === 1 ? '' : 's'}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: sentCount === audience.length && audience.length > 0 ? '#15803d' : '#6b7280', fontWeight: 600 }}>
          {sentCount} of {audience.length} messaged
        </span>
      </div>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {audience.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
            No lapsed customers with phone numbers right now — everyone has ordered within the last 90 days. 🎉
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {th('Customer')}
                {th('Segment')}
                {th('Orders · Spent')}
                {th('Last order')}
                {th('Outreach', 'right')}
              </tr>
            </thead>
            <tbody>
              {audience.map(c => <WinbackRow key={c.custKey} c={c} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
