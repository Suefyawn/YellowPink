export const dynamic = 'force-dynamic';

// ============================================================================
// Abandoned checkouts (admin → Customers → Abandoned).
//
// Lists shoppers who started checkout (typed a phone number) but never placed
// the order, with a one-click "Open in WhatsApp" button that launches the
// owner's own WhatsApp with a personalised message pre-typed (wa.me deep
// link — no Business API, no per-message cost). Clicking records the nudge on
// the cart row so nobody gets messaged twice, whichever staff member or
// device does the sending.
//
// Relationship to the automated reminder emails: rows WITH an email address
// already receive the 1h/24h/72h email sequence (that continues unchanged,
// and the Emails column here shows how far it got); rows with only a phone
// number get no automation at all, so this queue is their only follow-up.
// Recovery is automatic — placing an order with a matching phone or email
// drops the row off this list.
//
// The message template and coupon are editable and stored in site_settings;
// placeholders {name}, {items}, {total}, {coupon} and {link} are filled per
// cart. {link} is the cart-restore URL with UTM tags, so taps land in a
// pre-filled cart and resulting orders show up in Analytics → Sources.
// ============================================================================

import { supabaseAdmin } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { AbandonedRow, type AbandonedCartRow } from '@/components/admin/AbandonedRow';
import { saveAbandonedSettings } from './actions';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { SITE_URL } from '@/lib/seo';
import { PK_TZ } from '@/lib/dates';
import type { CartItem } from '@/types';

const DEFAULT_TEMPLATE =
  `Hi {name}! It's Yellow Pink 💛 You were about to order {items} (PKR {total}) and we saved your cart for you: {link} ` +
  `Cash on delivery is available nationwide. Use code {coupon} for a discount if you order today. Reply here if anything held you back, happy to help!`;

interface Row {
  id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  cart_items: CartItem[];
  subtotal: number;
  restore_token: string;
  reminder_tier: number;
  last_wa_sent_at: string | null;
  last_activity_at: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

const fmtWhen = (iso: string) => {
  const age = Date.now() - new Date(iso).getTime();
  if (age < DAY) return `${Math.max(1, Math.round(age / HOUR))}h ago`;
  if (age < 7 * DAY) return `${Math.round(age / DAY)}d ago`;
  return new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', timeZone: PK_TZ });
};

export default async function AbandonedPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('customers.view'))) {
    return <NoAccess section="Abandoned checkouts" />;
  }

  const admin = supabaseAdmin();
  const [{ data: cartRows }, { data: settingRows }] = await Promise.all([
    admin
      .from('abandoned_carts')
      .select('id, email, phone, first_name, cart_items, subtotal, restore_token, reminder_tier, last_wa_sent_at, last_activity_at')
      .eq('recovered', false)
      .not('phone', 'is', null)
      // Give the shopper an hour to finish on their own; drop off after 30
      // days (a month-old cart is win-back territory, not a checkout nudge).
      .lt('last_activity_at', new Date(Date.now() - HOUR).toISOString())
      .gt('last_activity_at', new Date(Date.now() - 30 * DAY).toISOString())
      .order('last_activity_at', { ascending: false })
      .limit(200),
    admin.from('site_settings').select('key, value').in('key', ['abandoned_wa_template', 'abandoned_wa_coupon']),
  ]);

  const settings = new Map((settingRows ?? []).map((r: { key: string; value: string | null }) => [r.key, r.value ?? '']));
  const template = settings.get('abandoned_wa_template') || DEFAULT_TEMPLATE;
  // Default matches the tier-3 reminder email's code so the discount story is
  // consistent whichever channel reaches the shopper first.
  const coupon = settings.get('abandoned_wa_coupon') || 'COMEBACK10';

  const queue: AbandonedCartRow[] = ((cartRows ?? []) as Row[])
    .map(r => {
      const items = Array.isArray(r.cart_items) ? r.cart_items : [];
      const first = items[0]?.name ?? 'your picks';
      const itemsSummary = items.length > 1 ? `${first} + ${items.length - 1} more` : first;
      const firstName = (r.first_name ?? '').split(' ')[0] || 'there';
      const link = `${SITE_URL}/cart?restore=${r.restore_token}&utm_source=whatsapp&utm_medium=outreach&utm_campaign=abandoned-checkout`;
      const message = template
        .replaceAll('{name}', firstName)
        .replaceAll('{items}', itemsSummary)
        .replaceAll('{total}', Math.round(r.subtotal).toLocaleString())
        .replaceAll('{coupon}', coupon)
        .replaceAll('{link}', link);
      const waHref = whatsappUrlForCustomer(r.phone, message);
      return waHref ? {
        id: r.id,
        name: r.first_name || 'Shopper',
        phone: r.phone!,
        email: r.email,
        itemsSummary,
        itemCount: items.reduce((s, i) => s + (i.qty ?? 1), 0),
        subtotal: Number(r.subtotal),
        abandonedAt: fmtWhen(r.last_activity_at),
        emailTier: r.reminder_tier,
        waSentAt: r.last_wa_sent_at ? fmtWhen(r.last_wa_sent_at) : null,
        waHref,
      } : null;
    })
    .filter((c): c is AbandonedCartRow => c !== null);

  const nudged = queue.filter(c => c.waSentAt).length;

  const th = (label: string, align: 'left' | 'right' = 'left') => (
    <th scope="col" key={label} style={{ padding: '11px 16px', textAlign: align, fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</th>
  );

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Abandoned checkouts</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 680 }}>
          Shoppers who started checkout with a phone number but didn&apos;t place the order. <b>Open in WhatsApp</b> launches
          your own WhatsApp with the message below pre-typed and their saved cart linked — review, send, done. Each send is
          recorded so nobody is messaged twice, and placing an order takes them off this list automatically. Shoppers who
          also left an email keep getting the automatic reminder emails; the Emails column shows how far that sequence got.
        </p>
      </div>

      {/* Template + coupon settings */}
      <form action={saveAbandonedSettings} style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20, marginBottom: 24 }}>
        <label htmlFor="ab-template" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
          Message template
        </label>
        <textarea
          id="ab-template"
          name="template"
          defaultValue={template}
          rows={4}
          maxLength={2000}
          style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.8125rem', fontFamily: 'inherit', resize: 'vertical' }}
        />
        <p style={{ margin: '6px 0 14px', fontSize: '0.6875rem', color: '#9ca3af' }}>
          Placeholders: <code>{'{name}'}</code> first name · <code>{'{items}'}</code> what&apos;s in the cart ·{' '}
          <code>{'{total}'}</code> cart total · <code>{'{coupon}'}</code> the code below · <code>{'{link}'}</code> tagged
          link that restores their cart.
        </p>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <label htmlFor="ab-coupon" style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Coupon code
            </label>
            <input
              id="ab-coupon"
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

      {/* Progress + queue table */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Queue — {queue.length} checkout{queue.length === 1 ? '' : 's'}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: nudged === queue.length && queue.length > 0 ? '#15803d' : '#6b7280', fontWeight: 600 }}>
          {nudged} of {queue.length} messaged
        </span>
      </div>

      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {queue.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
            No abandoned checkouts with a phone number right now. New ones appear here an hour after the shopper stops.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {th('Shopper')}
                {th('Cart')}
                {th('Abandoned')}
                {th('Emails')}
                {th('Outreach', 'right')}
              </tr>
            </thead>
            <tbody>
              {queue.map(c => <AbandonedRow key={c.id} c={c} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
