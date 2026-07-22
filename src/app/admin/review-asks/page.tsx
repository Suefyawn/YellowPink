export const dynamic = 'force-dynamic';

// ============================================================================
// Review asks (admin → Customers → Review asks).
//
// Queue of recently DELIVERED orders whose customer hasn't been asked for a
// review on WhatsApp yet. The automated review-request email already goes out
// 3–30 days post-delivery to customers who left an email, but ~all COD
// shoppers leave a phone and PK customers live on WhatsApp — a personal ask
// there converts far better, and phone-only orders get no automation at all.
//
// "Open in WhatsApp" pre-types the same Roman-Urdu message as the order
// page's Ask-for-review button (shared builder in lib/review-ask.ts): review
// deep-links for up to two purchased products and the live reward-points
// value from Settings → Loyalty. Each send is recorded on the order so
// nobody is asked twice, whichever staff member or device does the sending.
// The Email column shows whether the automated email also reached them.
// ============================================================================

import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { ReviewAskRow, type ReviewAskOrder } from '@/components/admin/ReviewAskRow';
import { whatsappUrlForCustomer } from '@/lib/whatsapp';
import { buildReviewAskMessage } from '@/lib/review-ask';
import { brandPlusName } from '@/lib/product-display';
import { PK_TZ } from '@/lib/dates';

const DAY_MS = 86_400_000;

interface OrderItem { name?: string; brand?: string | null; slug?: string }
interface Row {
  id: string;
  order_number: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  items: OrderItem[] | null;
  review_request_sent_at: string | null;
  review_wa_sent_at: string | null;
}

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-PK', { day: '2-digit', month: 'short', timeZone: PK_TZ });

export default async function ReviewAsksPage() {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('reviews'))) {
    return <NoAccess section="Review asks" />;
  }

  const admin = supabaseAdmin();

  // Delivery timestamps live in order_events (same source the email cron
  // uses). Window: delivered within the last 30 days — a review ask for a
  // months-old order reads as spam.
  const { data: events } = await admin
    .from('order_events')
    .select('order_id, created_at')
    .eq('to_status', 'delivered')
    .gte('created_at', new Date(Date.now() - 30 * DAY_MS).toISOString())
    .order('created_at', { ascending: false })
    .limit(500);
  const deliveredAtByOrder = new Map<string, string>();
  for (const e of (events ?? []) as { order_id: string; created_at: string }[]) {
    if (!deliveredAtByOrder.has(e.order_id)) deliveredAtByOrder.set(e.order_id, e.created_at);
  }

  let queue: ReviewAskOrder[] = [];
  if (deliveredAtByOrder.size > 0) {
    const [{ data: orders }, siteSettings] = await Promise.all([
      admin
        .from('orders')
        .select('id, order_number, first_name, last_name, phone, items, review_request_sent_at, review_wa_sent_at')
        .in('id', [...deliveredAtByOrder.keys()])
        .eq('status', 'delivered')
        .not('phone', 'is', null),
      getSiteSettings(),
    ]);
    const rewardPoints = Math.max(0, Number(siteSettings['loyalty_review_points'] ?? 25) || 0);

    queue = ((orders ?? []) as Row[])
      .map(o => {
        const items = Array.isArray(o.items) ? o.items : [];
        const slugs = items.map(i => i.slug).filter((s): s is string => Boolean(s));
        const first = items[0] ? brandPlusName(items[0].brand, items[0].name ?? '') : 'their order';
        const message = buildReviewAskMessage({
          firstName: o.first_name,
          orderNumber: o.order_number,
          slugs,
          rewardPoints,
        });
        const waHref = whatsappUrlForCustomer(o.phone, message);
        const deliveredIso = deliveredAtByOrder.get(o.id)!;
        return waHref ? {
          id: o.id,
          orderNumber: o.order_number,
          name: [o.first_name, o.last_name].filter(Boolean).join(' ').trim() || 'Customer',
          phone: o.phone!,
          itemsSummary: items.length > 1 ? `${first} + ${items.length - 1} more` : first,
          deliveredAt: fmtDate(deliveredIso),
          emailAsked: Boolean(o.review_request_sent_at),
          waSentAt: o.review_wa_sent_at ? fmtDate(o.review_wa_sent_at) : null,
          waHref,
          deliveredIso,
        } : null;
      })
      .filter((c): c is ReviewAskOrder & { deliveredIso: string } => c !== null)
      .sort((a, b) => new Date(b.deliveredIso).getTime() - new Date(a.deliveredIso).getTime());
  }

  const asked = queue.filter(c => c.waSentAt).length;

  const th = (label: string, align: 'left' | 'right' = 'left') => (
    <th scope="col" key={label} style={{ padding: '11px 16px', textAlign: align, fontSize: '0.6875rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</th>
  );

  return (
    <div className="adm-page" style={{ padding: '32px 36px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Review asks</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.8125rem', color: '#6b7280', maxWidth: 680 }}>
          Orders delivered in the last 30 days whose customer left a phone number. <b>Open in WhatsApp</b> launches your
          own WhatsApp with a personal review request pre-typed (same message as the order page&apos;s Ask-for-review
          button): review links for what they bought, plus the reward points they&apos;ll earn. Each ask is recorded so
          nobody is nudged twice; the Email column shows whether the automatic review-request email also reached them.
        </p>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>
          Queue — {queue.length} order{queue.length === 1 ? '' : 's'}
        </h2>
        <span style={{ fontSize: '0.8125rem', color: asked === queue.length && queue.length > 0 ? '#15803d' : '#6b7280', fontWeight: 600 }}>
          {asked} of {queue.length} asked
        </span>
      </div>

      <div className="adm-table-scroll" style={{ background: 'white', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {queue.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9ca3af' }}>
            No recently delivered orders to ask right now. Orders appear here once they&apos;re marked delivered.
          </div>
        ) : (
          <table className="adm-table-cards" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                {th('Customer')}
                {th('Order')}
                {th('Delivered')}
                {th('Email')}
                {th('Outreach', 'right')}
              </tr>
            </thead>
            <tbody>
              {queue.map(c => <ReviewAskRow key={c.id} c={c} />)}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
