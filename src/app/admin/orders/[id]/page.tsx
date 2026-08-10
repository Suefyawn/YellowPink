export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabaseAdmin, getSiteSettings } from '@/lib/supabase';
import { parseBankAccounts } from '@/lib/bank-accounts';
import { OrderStatusForm } from '@/components/admin/OrderStatusForm';
import { PrintInvoiceButton } from '@/components/admin/PrintInvoiceButton';
import { ShipmentBookingForm } from '@/components/admin/ShipmentBookingForm';
import { VendorDispatch } from '@/components/admin/VendorDispatch';
import { setOrderConfirmed } from '@/app/admin/vendor-actions';
import { setOrderCosts, recalcAcquisitionCost, recordPayment, clearPayment, updateOrderNotes } from '@/app/admin/finance/actions';
import { resolveOrderCosts } from '@/lib/order-costs';
import { deleteOrder, archiveOrder, unarchiveOrder } from '@/app/admin/actions';
import { DeleteButton } from '@/components/admin/DeleteButton';
import { CopyButton } from '@/components/admin/CopyButton';
import { AdminFlash } from '@/components/admin/AdminFlash';
import { OrderStatusBadge, orderStatusColor } from '@/components/admin/OrderStatusBadge';
import { BackToOrdersLink } from '@/components/admin/BackToOrdersLink';
import { ResendConfirmationButton } from '@/components/admin/ResendConfirmationButton';
import { whatsappUrlForCustomer as waUrlForCustomer } from '@/lib/whatsapp';
import { buildReviewAskMessage } from '@/lib/review-ask';
import { buildConfirmAskMessage, buildConfirmedThanksMessage } from '@/lib/confirm-ask';
import { brandPlusName } from '@/lib/product-display';
import { stripEmoji } from '@/lib/text';
import { configuredAdapterIds } from '@/lib/couriers';
import { ORDER_STATUS_LABELS, PAY_METHOD_LABELS } from '@/types';
import { NON_REVENUE_ORDER_STATUSES, parseCommerceConfig } from '@/lib/commerce';
import type { Order, CartItem, OrderStatus } from '@/types';
import { getStaffSession } from '@/lib/staff-auth';
import { NoAccess } from '@/components/admin/NoAccess';
import { PK_TZ, fmtDatePK } from '@/lib/dates';

interface OrderEventRow {
  id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  note: string | null;
  actor_kind: string | null;
  /** Operator attribution written by the admin status actions ('owner' or a
   *  staff email); null for trigger-only rows (customer/system/gateway). */
  actor_id: string | null;
  created_at: string;
}

function statusLabel(s: OrderStatus | null): string {
  return s ? (ORDER_STATUS_LABELS[s] ?? s) : '';
}

// `n === 0 ? 0 : n` normalises negative zero: profit lines negate their
// values, and (-0).toLocaleString() renders "PKR -0".
const fmt = (n: number) => `PKR ${(n === 0 ? 0 : n).toLocaleString()}`;
const fmtDate = (s: string) =>
  new Date(s).toLocaleString('en-PK', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: PK_TZ });

export default async function OrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ costs?: string; costs_note?: string; pay?: string; notes?: string; err?: string }>;
}) {
  const session = await getStaffSession();
  if (!session || (!session.isOwner && !session.permissions.includes('orders.view'))) {
    return <NoAccess section="Orders" />;
  }
  // orders.edit gates the mutating widgets below (confirmation, vendor
  // dispatch, shipment booking, status update). A view-only staffer still
  // sees the full read-only order detail.
  const canEdit = !session || session.isOwner || session.permissions.includes('orders.edit');
  const canDelete = !session || session.isOwner || session.permissions.includes('orders.delete');
  const { id } = await params;

  // Widget-action feedback: the costs / payment / notes / confirmation forms
  // on this page are plain server actions that redirect back here with a
  // result query param (?costs=saved, ?pay=recorded|cleared, ?notes=saved,
  // ?err=<message>). Surface it as a toast, then strip the param.
  const sp = (await searchParams) ?? {};
  let flash: { message: string; type: 'success' | 'error' } | null = null;
  if (sp.err) flash = { message: sp.err, type: 'error' };
  else if (sp.costs === 'saved') flash = { message: `Order costs saved.${sp.costs_note ? ` ${sp.costs_note}` : ''}`, type: 'success' };
  else if (sp.pay === 'recorded') flash = { message: 'Payment recorded.', type: 'success' };
  else if (sp.pay === 'cleared') flash = { message: 'Payment record cleared.', type: 'success' };
  else if (sp.notes === 'saved') flash = { message: 'Note saved.', type: 'success' };

  const { data: order } = await supabaseAdmin().from('orders').select('*').eq('id', id).single();
  if (!order) notFound();

  const o = order as Order;
  const items = (o.items ?? []) as CartItem[];
  const currentStatus = (o.status ?? 'pending') as OrderStatus;

  // Bundle items expand into their components in the vendor message: the
  // vendor packs individual products, not "a combo", and the arrangement
  // (their products, our set discount, their per-item billing unchanged)
  // must be stated on every order so there is never confusion about what a
  // bundle line means.
  // Legacy WordPress-era orders carry numeric item ids (or none); only real
  // UUIDs can be bundle products, and a non-uuid value would cast-error the
  // query and take the whole order page down with it.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const itemIds = items.map(it => it.id).filter((v): v is string => typeof v === 'string' && UUID_RE.test(v));
  const { data: bcRows } = itemIds.length
    ? await supabaseAdmin()
        .from('bundle_components')
        .select('bundle_product_id, qty, sort_order, product:products!bundle_components_component_product_id_fkey(name, brand)')
        .in('bundle_product_id', itemIds)
        .order('sort_order')
    : { data: [] };
  const componentsByBundle = new Map<string, Array<{ qty: number; name: string; brand: string | null }>>();
  for (const r of (bcRows ?? []) as unknown as Array<{ bundle_product_id: string; qty: number; product: { name: string; brand: string | null } | null }>) {
    if (!r.product) continue;
    const list = componentsByBundle.get(r.bundle_product_id) ?? [];
    list.push({ qty: r.qty, name: r.product.name, brand: r.product.brand });
    componentsByBundle.set(r.bundle_product_id, list);
  }
  const orderHasBundle = items.some(it => (componentsByBundle.get(it.id)?.length ?? 0) > 0);

  // Pull the most-recent shipment for this order so the booking form can
  // toggle into its "already shipped" state. Cheap query, one row max for
  // most orders. Couriers with a configured API adapter (env vars set) get
  // a "Book pickup" button; everything else falls back to manual entry.
  const { data: shipmentRow } = await supabaseAdmin()
    .from('shipments')
    .select('id, courier, tracking_number, status, raw_label_url')
    .eq('order_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  // Courier scan history (the granular timeline the courier reports: picked up
  // → in transit → out for delivery → delivery attempted / refused → delivered).
  // Populated by the courier-sync cron / "Sync tracking now" from the TCS
  // checkpoints feed; empty until the TCS API is credentialed.
  const shipmentEvents = shipmentRow
    ? ((await supabaseAdmin()
        .from('shipment_events')
        .select('status, description, occurred_at')
        .eq('shipment_id', shipmentRow.id as string)
        .order('occurred_at', { ascending: false })
        .limit(40)).data as Array<{ status: string; description: string | null; occurred_at: string }> | null) ?? []
    : [];
  const apiAdapters = configuredAdapterIds();

  // Status history, every transition this order went through, oldest first.
  const { data: eventRows } = await supabaseAdmin()
    .from('order_events')
    .select('id, from_status, to_status, note, actor_kind, actor_id, created_at')
    .eq('order_id', id)
    .order('created_at', { ascending: true });
  const events = (eventRows ?? []) as OrderEventRow[];

  // Active vendors for the dispatch picker.
  const { data: vendorRows } = await supabaseAdmin()
    .from('vendors')
    .select('id, name, phone')
    .eq('active', true)
    .order('name');
  const vendors = (vendorRows ?? []) as Array<{ id: string; name: string; phone: string }>;

  // Vendor settlement (margin / payout) for this order, if it has been
  // dispatched to a vendor.
  const { data: settlementRow } = await supabaseAdmin()
    .from('vendor_settlements')
    .select('gross_amount, vendor_cost, our_margin, amount_due, due_to, status')
    .eq('order_id', id)
    .maybeSingle();

  // Customer history block, lifetime orders + total spend for the same
  // (user_id OR phone OR email). Cheap query, admin-only view, no caching
  // needed. Excludes the current order from "previous" + "ltv" so the
  // merchant sees "this is their 3rd order" rather than counting the one
  // they're already looking at.
  const orFilters = [
    o.user_id ? `user_id.eq.${o.user_id}` : null,
    o.email ? `email.eq.${o.email}` : null,
    o.phone ? `phone.eq.${o.phone}` : null,
  ].filter(Boolean).join(',');
  let customerStats: { count: number; total: number; first: string | null } | null = null;
  if (orFilters) {
    const { data: history } = await supabaseAdmin()
      .from('orders')
      .select('id, total, status, created_at')
      .or(orFilters)
      // Lifetime spend counts realized revenue only, drop cancelled, refunded,
      // returned and payment-failed so the figure (and the customer-detail
      // page's matching Total spend / AOV) reflect money actually taken.
      .not('status', 'in', `(${NON_REVENUE_ORDER_STATUSES.join(',')})`);
    const rows = (history ?? []) as Array<{ id: string; total: number; status: string; created_at: string }>;
    const orderCount = rows.length;
    const total = rows.reduce((s, r) => s + (r.total ?? 0), 0);
    const first = rows.length > 0
      ? rows.reduce((min, r) => (r.created_at < min ? r.created_at : min), rows[0].created_at)
      : null;
    customerStats = { count: orderCount, total, first };
  }

  // minWidth: 0 on the cards (grid items of .adm-analytics-grid) and on <dd>
  // values so long unbreakable values (emails, phone numbers) wrap inside the
  // card on phones instead of widening the whole page.
  const section: React.CSSProperties = {
    background: 'white', borderRadius: 10,
    padding: '24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    minWidth: 0,
  };
  const dl: React.CSSProperties = { display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px 16px', margin: 0 };
  const dt: React.CSSProperties = { fontSize: '0.8125rem', color: '#6b7280', fontWeight: 500 };
  const dd: React.CSSProperties = { fontSize: '0.875rem', color: '#111827', margin: 0, minWidth: 0, overflowWrap: 'anywhere' };

  // Customer name, emoji-stripped, for the WhatsApp messages we send out.
  const custFirst = stripEmoji(o.first_name ?? '');
  const custLast = stripEmoji(o.last_name ?? '');

  // Prefilled WhatsApp message the owner forwards to the chosen vendor.
  // Bundle lines expand into their components so the packer has an exact
  // item list, and a closing note states the bundle arrangement plainly.
  const vendorMessage = [
    `Yellow Pink, Order ${o.order_number}`,
    '',
    ...items.flatMap(it => {
      const v = it.variant_label ?? it.variant;
      const line = `• ${it.qty}× ${brandPlusName(it.brand, it.name)}${v ? ` (${v})` : ''}`;
      const comps = componentsByBundle.get(it.id) ?? [];
      if (comps.length === 0) return [line];
      return [
        `${line} — ye hamara set hai, is mein pack karein:`,
        ...comps.map(c => `   - ${c.qty * it.qty}× ${brandPlusName(c.brand, c.name)}`),
      ];
    }),
    ...(orderHasBundle
      ? ['', 'Note: set wale items aap ke apne individual products hain jo hum apni website par ek sath bechte hain. Aap ki billing har item ke maujooda vendor rate par hi hogi.']
      : []),
    '',
    'Deliver to:',
    `${custFirst} ${custLast}`,
    `${o.address}, ${o.city}${o.province ? `, ${o.province}` : ''}`,
    `Phone: ${o.phone}`,
    '',
    `Total: ${fmt(o.total)} · ${PAY_METHOD_LABELS[o.pay_method] ?? o.pay_method}`,
  ].join('\n');

  // Prefilled WhatsApp message the merchant sends TO the customer to confirm
  // their order (the green button in the top bar). Warm, branded, bilingual:
  // the human lines (greeting / confirm ask / sign-off) are in roman Urdu the
  // way PK shoppers chat, while the transactional details (order no, items,
  // total, address) stay in clear English so amounts and address are never
  // ambiguous. COD orders get a roman-Urdu pay-on-delivery note.
  const customerMessage = [
    `Assalam-o-Alaikum${custFirst ? ` ${custFirst}` : ''}!`,
    '',
    `Yellow Pink se shopping ka shukriya! Neeche apne order ki tafseel confirm kar lein:`,
    '',
    `Order ${o.order_number}`,
    ...items.map(it => {
      const v = it.variant_label ?? it.variant;
      return `• ${it.qty}× ${brandPlusName(it.brand, it.name)}${v ? ` (${v})` : ''}`;
    }),
    '',
    `Total: ${fmt(o.total)} (${PAY_METHOD_LABELS[o.pay_method] ?? o.pay_method})`,
    ...(o.pay_method === 'cod' ? ['Parcel milne par cash adaa karein.'] : []),
    '',
    `Delivery address:`,
    `${custFirst} ${custLast}`,
    `${o.address}, ${o.city}${o.province ? `, ${o.province}` : ''}`,
    '',
    `Agar sab kuch theek hai to please reply kar ke confirm kar dein, hum aap ka order foran tayyar kar denge. Koi tabdeeli chahiye to yahin bata dein.`,
    '',
    `Shukriya!, Team Yellow Pink`,
  ].join('\n');

  // Per-order profit: gross amount minus the costs recorded for this order.
  // COGS combines the vendor settlement (vendor-dispatched lines) with the
  // acquisition cost of own-stock lines (products.cost_price × qty, only for
  // products with no vendor_id so vendor lines aren't double-counted).
  const orderItems = (Array.isArray(o.items) ? o.items : []) as Array<{ id?: string; qty?: number; price?: number; name?: string }>;
  let ownCogs = 0;
  const engineProducts = new Map<string, { vendor_cost: number | null; cost_price: number | null }>();
  // Sourcing-vendor suggestion: when every sourced item in the order points
  // at the same products.vendor_id (the product form's "default supplier"),
  // the fulfilment picker offers it one-click. Products aren't the source of
  // truth for order economics — the ORDER's vendor is — this only suggests.
  const sourcingTally = new Map<string, number>();
  const ownItemIds = orderItems.map(i => i?.id).filter((v): v is string => Boolean(v));
  if (ownItemIds.length) {
    const { data: costRows } = await supabaseAdmin()
      .from('products').select('id, vendor_id, vendor_cost, cost_price').in('id', ownItemIds);
    const cmap = new Map(
      ((costRows ?? []) as { id: string; vendor_id: string | null; vendor_cost: number | null; cost_price: number | null }[])
        .map(p => [p.id, p]),
    );
    for (const it of orderItems) {
      const p = it?.id ? cmap.get(it.id) : undefined;
      if (p && p.vendor_id == null && p.cost_price != null) ownCogs += Number(p.cost_price) * (Number(it.qty) || 0);
      if (p?.vendor_id) sourcingTally.set(p.vendor_id, (sourcingTally.get(p.vendor_id) ?? 0) + 1);
    }
    for (const [pid, p] of cmap) engineProducts.set(pid, { vendor_cost: p.vendor_cost, cost_price: p.cost_price });
  }
  const suggestedVendorId = sourcingTally.size === 1 ? [...sourcingTally.keys()][0] : null;
  const suggestedItemCount = suggestedVendorId ? (sourcingTally.get(suggestedVendorId) ?? 0) : 0;
  // Per-order acquisition cost (auto-filled at vendor dispatch by the shared
  // cost engine, or staff-entered) overrides the computed estimate; blank
  // falls back to vendor settlement + product cost_price.
  const computedCogs = (settlementRow ? Number(settlementRow.vendor_cost ?? 0) : 0) + ownCogs;
  const ordAcq = (o as { acquisition_cost?: number | null }).acquisition_cost;
  const ordCogs = ordAcq != null ? Number(ordAcq) : computedCogs;

  // Acquisition-cost provenance for the Order costs card (and the mirrored
  // COGS line in Order profit): rerun the shared engine against the order's
  // current vendor + items so the "Auto-filled from …" label always names
  // the live basis (vendor rate / per-product costs / unknown gaps).
  const acqSource = (o as { acquisition_cost_source?: 'auto' | 'manual' | null }).acquisition_cost_source ?? null;
  let dispatchedVendor: { id: string; name: string | null; commission_pct: number | null } | null = null;
  // Whether the order's vendor delivers to the customer itself (NB Sons) — the
  // Shipment panel skips courier booking for these.
  let vendorSelfDelivers: { name: string; deliveryFee: number } | null = null;
  // Vendor keeps the COD cash (vendor_collects): the Payment card must not
  // invite reconciling money that never comes to a store account.
  let vendorCollectsPayment: string | null = null;
  if (o.vendor_id) {
    const { data: vRow } = await supabaseAdmin()
      .from('vendors').select('id, name, commission_pct, self_delivers, delivery_fee, settlement_direction').eq('id', o.vendor_id).maybeSingle();
    dispatchedVendor = vRow ? { id: vRow.id as string, name: vRow.name as string | null, commission_pct: vRow.commission_pct as number | null } : null;
    if (vRow && (vRow as { settlement_direction?: string | null }).settlement_direction === 'vendor_collects') {
      vendorCollectsPayment = (vRow.name as string) ?? 'The vendor';
    }
    if (vRow && (vRow as { self_delivers?: boolean }).self_delivers) {
      vendorSelfDelivers = { name: (vRow.name as string) ?? 'the vendor', deliveryFee: Number((vRow as { delivery_fee?: number | null }).delivery_fee ?? 0) };
    }
  }
  const costEngine = resolveOrderCosts(orderItems, dispatchedVendor, engineProducts);
  const acqProvenance = ordAcq == null
    ? 'Unknown — select a vendor above or enter manually.'
    : acqSource === 'auto'
      ? `Auto-filled from ${costEngine.basisLabel}${costEngine.unknownCount > 0 ? ` (${costEngine.unknownCount} item(s) had no cost basis)` : ''}.`
      : 'Entered manually.';
  const ordDelivery = Number(o.delivery_cost ?? 0);
  const ordFee = Number(o.payment_fee ?? 0);
  // Revenue is what was actually COLLECTED, which for a cancelled / returned /
  // refunded / failed order is nothing — the COD parcel came back or the money
  // went back. The card previously used o.total regardless of status, so a
  // returned order with recorded costs still showed a healthy "profit"; the
  // honest picture is a loss equal to the sunk costs. Mirrors DEAD_STATES in
  // lib/finance.ts (where these orders earn no revenue in the P&L and their
  // delivery cost is counted as a sunk return cost).
  const NO_REVENUE_STATUSES = new Set(['cancelled', 'payment_failed', 'payment_pending', 'refunded', 'returned']);
  const revenueCollected = !NO_REVENUE_STATUSES.has(o.status ?? '');
  // Which recorded costs are actually SUNK on a no-revenue order (owner
  // correction, 9 Aug 2026 — the card previously counted everything):
  //  - returned: the goods came back to sellable stock (the return flow
  //    restocks them / voids the vendor payout), so COGS is not a loss;
  //    the courier round trip and any payment fee are.
  //  - cancelled / failed / pending: nothing was dispatched — the goods
  //    never left the shelf and no courier billed us. Nothing is sunk
  //    except a recorded payment fee (rare); a recorded delivery cost on
  //    these orders is almost always a data slip, flagged below.
  //  - refunded: the money went back but the goods are often with the
  //    customer, so COGS stays counted; reduce it if the item came back.
  const isReturned = o.status === 'returned';
  const isNeverDispatched = ['cancelled', 'payment_failed', 'payment_pending'].includes(o.status ?? '');
  const cogsSunk = revenueCollected || o.status === 'refunded' ? ordCogs : 0;
  const deliverySunk = isNeverDispatched ? 0 : ordDelivery;
  const ordRevenue = revenueCollected ? Number(o.total ?? 0) : 0;
  const ordNet = ordRevenue - cogsSunk - deliverySunk - ordFee;
  const ordMargin = ordRevenue > 0 ? (ordNet / ordRevenue) * 100 : 0;
  // Configured bank/wallet accounts (Settings → Payments) for the payment
  // reconciliation picker, plus the implicit cash option.
  const siteSettings = await getSiteSettings();
  const payAccountOptions = ['Cash on delivery', ...parseBankAccounts(siteSettings['pay_bank_accounts']).map(a => a.label)];

  // Prefilled WhatsApp review ask — the "Ask for review" button in the top
  // bar, shown once the order is delivered. The automatic review-request
  // email already goes out 3–30 days post-delivery, but PK customers live
  // on WhatsApp, not email; a personal ask right after delivery converts
  // far better. Mentions the LIVE reward-points value (Settings → Loyalty)
  // so the promised incentive can't drift from what the review actually
  // earns, and deep-links each product's review form.
  const reviewPoints = Math.max(0, Number(siteSettings['loyalty_review_points'] ?? 25) || 0);
  const reviewMessage = buildReviewAskMessage({
    firstName: custFirst,
    orderNumber: o.order_number,
    slugs: items.map(it => (it as { slug?: string }).slug).filter((s): s is string => Boolean(s)),
    rewardPoints: reviewPoints,
  });

  // Shipping margin: what we charged the customer for delivery (o.shipping) vs
  // what the courier costs us. Uses the recorded delivery_cost when present,
  // otherwise the owner's "typical delivery cost" baseline (Settings → Shipping)
  // as an estimate. null when neither is available (no baseline set + no actual).
  const shippingCharged = Number(o.shipping ?? 0);
  const defaultDeliveryCost = parseCommerceConfig(siteSettings).defaultDeliveryCost;
  const deliveryActual = o.delivery_cost != null ? Number(o.delivery_cost) : null;
  const deliveryEffective = deliveryActual ?? (defaultDeliveryCost > 0 ? defaultDeliveryCost : null);
  const shippingMarginEstimated = deliveryActual == null && deliveryEffective != null;
  const shippingMargin = deliveryEffective != null ? shippingCharged - deliveryEffective : null;

  const profitLines: { label: string; value: number; kind?: 'net' }[] = [
    { label: revenueCollected ? 'Gross amount' : 'Amount collected', value: ordRevenue },
    { label: !revenueCollected && cogsSunk === 0 && ordCogs > 0 ? 'Cost of goods (back in stock)' : 'Cost of goods (COGS)', value: -cogsSunk },
    { label: 'Delivery cost', value: -deliverySunk },
    { label: 'Payment fee', value: -ordFee },
    { label: revenueCollected ? 'Net profit' : ordNet === 0 ? 'Net' : 'Net loss', value: ordNet, kind: 'net' },
  ];

  return (
    <div id="order-detail-page" style={{ padding: '32px 36px' }}>
      {flash && <AdminFlash message={flash.message} type={flash.type} clearPath={`/admin/orders/${id}`} />}
      {/* Print styles, printing this page outputs ONLY the invoice card.
          Every other block is a direct child of #order-detail-page, so one
          rule hides them all (and stays correct as sections are added). */}
      <style>{`
        @media print {
          .adm-sidebar, .adm-topbar, .adm-overlay, .no-print { display: none !important; }
          .adm-main { margin-left: 0 !important; background: white !important; }
          #order-detail-page { padding: 0 !important; }
          #order-detail-page > :not(#print-invoice) { display: none !important; }
          #print-invoice { display: block !important; }
        }
        #print-invoice { display: none; }
      `}</style>

      <div className="no-print print-hide" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28, flexWrap: 'wrap' }}>
        <BackToOrdersLink />
        <span style={{ color: '#d1d5db' }}>/</span>
        <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827', fontFamily: 'monospace' }}>
          {o.order_number}
        </h1>
        <CopyButton value={o.order_number} title={`Copy order number ${o.order_number}`} />
        <OrderStatusBadge status={currentStatus} />
        {o.created_at && (
          <span style={{ fontSize: '0.8125rem', color: '#9ca3af', marginLeft: 4 }}>{fmtDate(o.created_at)}</span>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* WhatsApp the customer, uses their phone, prefills the order
              number. One-tap support reply from the order page. */}
          {(() => {
            const href = waUrlForCustomer(o.phone, customerMessage);
            if (!href) return null;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#25D366', color: '#fff', textDecoration: 'none',
                  padding: '7px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </a>
            );
          })()}
          {/* Delivered orders: one-tap review ask on WhatsApp, prefilled with
              the product review links + the live points reward. */}
          {currentStatus === 'delivered' && (() => {
            const href = waUrlForCustomer(o.phone, reviewMessage);
            if (!href) return null;
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'white', color: '#128C4B', textDecoration: 'none',
                  border: '1px solid #25D366',
                  padding: '6px 12px', borderRadius: 6, fontSize: '0.8125rem', fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
                Ask for review
              </a>
            );
          })()}
          <PrintInvoiceButton />
        </div>
      </div>

      {/* Printable invoice */}
      <div id="print-invoice" style={{ fontFamily: 'sans-serif', color: '#111827', maxWidth: 700, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32, borderBottom: '2px solid #111827', paddingBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.5rem', letterSpacing: '-0.02em' }}>
              <span style={{ color: '#E8487F' }}>Yellow</span>Pink
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>yellowpink.pk</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '1.125rem' }}>{o.order_number}</div>
            <div style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>{o.created_at ? fmtDate(o.created_at) : ''}</div>
            <div style={{ marginTop: 6, padding: '2px 10px', display: 'inline-block', borderRadius: 20, fontSize: '0.75rem', fontWeight: 700, background: orderStatusColor(currentStatus) + '25', color: orderStatusColor(currentStatus) }}>
              {statusLabel(currentStatus)}
            </div>
          </div>
        </div>
        {/* One clear recipient block, billing and shipping are the same
            person here, and a courier reading the parcel wants name +
            address + phone together and prominent. */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#6b7280', marginBottom: 8 }}>Deliver To</div>
          <div style={{ fontWeight: 700, fontSize: '1.0625rem', color: '#111827' }}>{o.first_name} {o.last_name}</div>
          <div style={{ fontSize: '0.9375rem', color: '#374151', marginTop: 4 }}>{o.address}</div>
          <div style={{ fontSize: '0.9375rem', color: '#374151' }}>{o.city}{o.province ? `, ${o.province}` : ''}{o.zip ? ` ${o.zip}` : ''}</div>
          <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827', marginTop: 6 }}>{o.phone}</div>
          {o.email && <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{o.email}</div>}
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 20 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
              {['Item', 'Price', 'Qty', 'Total'].map(h => (
                <th scope="col" key={h} style={{ padding: '8px 0', textAlign: h === 'Price' || h === 'Qty' || h === 'Total' ? 'right' : 'left', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '10px 0', fontSize: '0.875rem' }}>{brandPlusName(item.brand, item.name)}{(item.variant_label ?? item.variant) ? `, ${item.variant_label ?? item.variant}` : ''}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', textAlign: 'right' }}>{fmt(item.price)}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', textAlign: 'right' }}>{item.qty}</td>
                <td style={{ padding: '10px 0', fontSize: '0.875rem', fontWeight: 600, textAlign: 'right' }}>{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ marginLeft: 'auto', maxWidth: 240 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 6 }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span><span>{fmt(o.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: o.discount_amount && o.discount_amount > 0 ? 6 : 10 }}>
            <span style={{ color: '#6b7280' }}>Shipping</span><span>{o.shipping === 0 ? 'Free' : fmt(o.shipping)}</span>
          </div>
          {o.discount_amount != null && o.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: 10 }}>
              <span style={{ color: '#15803d' }}>Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}</span>
              <span style={{ color: '#15803d' }}>− {fmt(o.discount_amount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1rem', borderTop: '2px solid #111827', paddingTop: 10 }}>
            <span>Total</span><span>{fmt(o.total)}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: '0.8125rem', color: '#6b7280' }}>
            Payment: <strong style={{ color: '#374151' }}>{PAY_METHOD_LABELS[o.pay_method] ?? o.pay_method}</strong>
          </div>
        </div>
      </div>

      {/* ── Top zone (2026-07 audit §3.7): what the order IS on the left
          (customer, address, items, fulfilment steps), how to ACT on it in
          the right rail (status control, payment) — so the status changer
          sits next to the status badge it affects instead of ~4,800px below
          it. Collapses to one column below 768px (adm-analytics-grid). ── */}
      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 380px', gap: 20, alignItems: 'start', marginBottom: 20 }}>
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* auto-fit minmax: at ~1024px the outer rail leaves this pair ~600px, and
          fixed 1fr 1fr squeezed each card into an unreadable sliver. Below
          ~640px of available width the cards stack instead. */}
      <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
        {/* Customer */}
        <div style={section}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 16, gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Customer</h2>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, minWidth: 0 }}>
              {customerStats && customerStats.count > 1 && (
                <span
                  title={customerStats.first ? `First ordered ${fmtDatePK(customerStats.first)}` : undefined}
                  style={{
                    fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    padding: '3px 9px', borderRadius: 20,
                    background: '#fdf2f8', color: '#9d174d', border: '1px solid #fbcfe8',
                  }}
                >
                  Repeat · {customerStats.count} orders
                </span>
              )}
              {o.user_id && (
                <Link href={`/admin/users/${o.user_id}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}>
                  View profile →
                </Link>
              )}
              {(o.phone || o.email) && (
                <Link href={`/admin/orders?q=${encodeURIComponent(o.phone || o.email || '')}`} style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}>
                  This customer&apos;s orders →
                </Link>
              )}
            </div>
          </div>
          <dl style={dl}>
            <dt style={dt}>Name</dt>
            <dd style={dd}>{o.first_name} {o.last_name}</dd>
            <dt style={dt}>Phone</dt>
            <dd style={dd}>
              <a href={`tel:${o.phone}`} style={{ color: '#C5286A', fontWeight: 500, textDecoration: 'none' }}>{o.phone}</a>
            </dd>
            {o.email ? (
              <>
                <dt style={dt}>Email</dt>
                <dd style={dd}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <a href={`mailto:${o.email}`} style={{ color: '#C5286A', textDecoration: 'none', fontWeight: 500 }}>{o.email}</a>
                    {canEdit && o.id && (
                      <ResendConfirmationButton orderId={o.id} hasEmail />
                    )}
                  </div>
                </dd>
              </>
            ) : (
              <>
                <dt style={dt}>Email</dt>
                <dd style={dd}>
                  {/* Email is optional at checkout (phone-first market), and it
                      is the ONLY automated channel — no address means this
                      customer gets no confirmation or shipping emails at all.
                      Flag it so the operator knows to use the WhatsApp button. */}
                  <span style={{
                    display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                    background: '#fffbeb', border: '1px solid #fde68a',
                    color: '#92400e', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    No email — this customer receives no automatic updates. Confirm on WhatsApp (button above).
                  </span>
                </dd>
              </>
            )}
            {customerStats && (
              <>
                <dt style={dt}>Lifetime spend</dt>
                <dd style={dd}>
                  <strong style={{ color: '#16a34a' }}>{fmt(customerStats.total)}</strong>
                  <span style={{ color: '#9ca3af', marginLeft: 6, fontSize: '0.75rem' }}>across {customerStats.count} order{customerStats.count !== 1 ? 's' : ''}</span>
                </dd>
              </>
            )}
          </dl>
        </div>

        {/* Shipping */}
        <div style={section}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipping address</h2>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${o.address}, ${o.city}${o.province ? `, ${o.province}` : ''}${o.zip ? ` ${o.zip}` : ''}, Pakistan`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: '0.75rem', fontWeight: 600, color: '#C5286A', textDecoration: 'none' }}
            >
              Open in Maps ↗
            </a>
          </div>
          <dl style={dl}>
            <dt style={dt}>Address</dt>
            <dd style={dd}>{o.address}</dd>
            <dt style={dt}>City</dt>
            <dd style={dd}>{o.city}{o.province ? `, ${o.province}` : ''}</dd>
            {o.zip && <><dt style={dt}>ZIP</dt><dd style={dd}>{o.zip}</dd></>}
          </dl>
        </div>
      </div>

      {/* Order Items */}
      <div style={section}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order items</h2>
        <div className="adm-table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Product', 'Brand', 'Variant', 'Price', 'Qty', 'Subtotal'].map(h => (
                <th scope="col" key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 500, color: '#111827' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                    {/* Shopify-style line-item thumbnail from the order's
                        denormalised items snapshot; plain <img>, the admin
                        doesn't route through next/image. */}
                    {(item as { image_url?: string | null }).image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={(item as { image_url?: string }).image_url}
                        alt=""
                        width={40}
                        height={40}
                        style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8, border: '1px solid #e5e7eb', flexShrink: 0, background: '#f9fafb' }}
                      />
                    ) : (
                      <span style={{ width: 40, height: 40, borderRadius: 8, border: '1px solid #e5e7eb', background: '#f9fafb', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: '0.6875rem', fontWeight: 700, flexShrink: 0 }}>
                        {(item.name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    )}
                    {item.name}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{item.brand}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: '#6b7280' }}>{item.variant_label ?? item.variant ?? '—'}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', color: '#374151' }}>{fmt(item.price)}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', color: '#374151' }}>{item.qty}</td>
                <td style={{ padding: '10px 12px', fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{fmt(item.price * item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Confirmation & vendor dispatch, edit-gated */}
      {canEdit && (
      <div style={section}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Confirmation &amp; vendor</h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Send the WhatsApp confirmation ask below (COD refusals are where returns come from), record the customer&apos;s yes, then forward the order to a vendor.
        </p>
        <div className="adm-analytics-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          {/* Customer confirmation */}
          <div>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#374151', marginBottom: 6 }}>Customer confirmation</div>
            {o.confirmed_at ? (
              <div>
                <span style={{
                  display: 'inline-block', padding: '4px 10px', borderRadius: 6,
                  background: '#f0fdf4', color: '#16a34a', fontSize: '0.8125rem', fontWeight: 600,
                }}>
                  ✓ Confirmed {fmtDate(o.confirmed_at)}
                </span>
                {/* Post-confirmation acknowledgment carries the refusal-
                    deterrent ("flagged" wording, owner decision 10 Aug 2026).
                    It lives AFTER confirmation on purpose — the ask message
                    above must never discourage a YES. COD only: prepaid
                    can't be refused into a courier loss. */}
                {(() => {
                  if (o.pay_method !== 'cod') return null;
                  const waThanks = waUrlForCustomer(o.phone, buildConfirmedThanksMessage({
                    firstName: o.first_name,
                    orderNumber: o.order_number ?? '',
                  }));
                  return waThanks ? (
                    <a href={waThanks} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, marginRight: 8,
                      padding: '6px 12px', background: '#16a34a', color: 'white',
                      borderRadius: 6, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none',
                    }}>
                      Send thanks + delivery note (WhatsApp)
                    </a>
                  ) : null;
                })()}
                <form action={setOrderConfirmed.bind(null, o.id!, false)} style={{ marginTop: 8, display: 'inline-block' }}>
                  <button type="submit" style={{
                    padding: '6px 12px', background: 'transparent', border: '1px solid #d1d5db',
                    borderRadius: 6, color: '#6b7280', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  }}>
                    Mark unconfirmed
                  </button>
                </form>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {/* COD refusals are where returns come from: ask on WhatsApp
                    first, record the answer with the button next to it. */}
                {(() => {
                  // The scripted ask is COD-specific ("cash on delivery,
                  // reply YES"); prepaid orders keep just the manual button.
                  if (o.pay_method !== 'cod') return null;
                  const waConfirm = waUrlForCustomer(o.phone, buildConfirmAskMessage({
                    firstName: o.first_name,
                    orderNumber: o.order_number ?? '',
                    itemNames: orderItems.map(it => stripEmoji(it.name ?? '').trim()).filter(Boolean),
                    total: Number(o.total) || 0,
                    city: o.city,
                  }));
                  return waConfirm ? (
                    <a href={waConfirm} target="_blank" rel="noopener noreferrer" style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '9px 16px', background: '#16a34a', color: 'white',
                      borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600, textDecoration: 'none',
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Send WhatsApp confirmation
                    </a>
                  ) : null;
                })()}
                <form action={setOrderConfirmed.bind(null, o.id!, true)}>
                  <button type="submit" style={{
                    padding: '9px 16px', background: '#C5286A', color: 'white', border: 'none',
                    borderRadius: 7, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
                  }}>
                    Customer said yes — mark confirmed
                  </button>
                </form>
              </div>
            )}
          </div>
          {/* Vendor dispatch */}
          <VendorDispatch
            orderId={o.id!}
            vendors={vendors}
            currentVendorId={o.vendor_id ?? null}
            vendorSentAt={o.vendor_sent_at ?? null}
            message={vendorMessage}
            suggestedVendorId={suggestedVendorId}
            suggestedItemCount={suggestedItemCount}
            itemCount={orderItems.length}
          />
        </div>
        {settlementRow && (
          <div style={{
            marginTop: 16, padding: '12px 14px', borderRadius: 8,
            background: '#f9fafb', border: '1px solid #e5e7eb',
            display: 'flex', flexWrap: 'wrap', gap: 20, fontSize: '0.8125rem',
          }}>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Vendor cost</div>
              <div style={{ fontWeight: 600, color: '#111827' }}>PKR {Math.round(settlementRow.vendor_cost).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Our margin</div>
              <div style={{ fontWeight: 700, color: '#16a34a' }}>PKR {Math.round(settlementRow.our_margin).toLocaleString()}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>
                {settlementRow.due_to === 'us' ? 'Vendor pays you' : 'You pay vendor'}
              </div>
              <div style={{ fontWeight: 700, color: settlementRow.due_to === 'us' ? '#16a34a' : '#dc2626' }}>
                PKR {Math.round(settlementRow.amount_due).toLocaleString()}
                <span style={{ fontWeight: 600, color: '#9ca3af', marginLeft: 6 }}>
                  · {settlementRow.status === 'settled' ? 'settled' : 'pending'}
                </span>
              </div>
            </div>
            <div style={{ alignSelf: 'center', marginLeft: 'auto' }}>
              <Link href="/admin/vendors" style={{ color: '#C5286A', textDecoration: 'none', fontSize: '0.75rem', fontWeight: 600 }}>
                Manage payouts →
              </Link>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Shipment booking, edit-gated. Sits after confirmation/vendor because
          most merchant workflows confirm + source first, then book a courier. */}
      {canEdit && (
      <div style={section}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Shipment</h2>
        {vendorSelfDelivers && (
          <div style={{ marginBottom: 16, padding: '12px 14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, fontSize: '0.8125rem', color: '#1e3a8a' }}>
            <strong>{vendorSelfDelivers.name} ships this order with their own courier</strong> — no booking from our account needed.
            {vendorSelfDelivers.deliveryFee > 0
              ? ` Their delivery fee (PKR ${vendorSelfDelivers.deliveryFee.toLocaleString()}) is recorded as this order's delivery cost.`
              : ' No delivery cost is charged to us for it right now.'}
            {' '}When {vendorSelfDelivers.name} sends the tracking number, enter it below (pick their courier, e.g. TCS) — that marks
            the order shipped and emails the customer the tracking link automatically.
          </div>
        )}
        {/* Vendor self-delivery used to HIDE the form entirely, which left no
            way to record the tracking number the vendor sends over — exactly
            the orders that need manual entry (owner report, 2026-08-01). The
            form now always renders; self-delivered orders default to the
            manual tab since there is nothing to book from our account. */}
        {(
          <ShipmentBookingForm
            orderId={o.id!}
            preferManual={!!vendorSelfDelivers}
            apiAdapters={apiAdapters}
            deliveryCost={o.delivery_cost ?? null}
            suggestedCharge={defaultDeliveryCost > 0 ? defaultDeliveryCost : undefined}
            unconfirmed={o.status === 'pending'}
            shipment={shipmentRow ? {
              id: shipmentRow.id as string,
              courier: shipmentRow.courier as string,
              tracking_number: shipmentRow.tracking_number as string,
              status: shipmentRow.status as string,
              labelUrl: (shipmentRow.raw_label_url as string | null) ?? null,
            } : null}
          />
        )}

        {/* Courier scan history — the granular timeline (delivery attempted /
            refused / in process / delivered) pulled from the courier's checkpoints
            feed. Mirrors what the courier's own portal shows, inside the admin. */}
        {shipmentRow && (
          <div style={{ marginTop: 18, borderTop: '1px solid #f3f4f6', paddingTop: 14 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
              Courier tracking history
            </div>
            {shipmentEvents.length === 0 ? (
              <p style={{ margin: 0, fontSize: '0.8125rem', color: '#9ca3af' }}>
                {apiAdapters.includes(shipmentRow.courier as string)
                  ? 'No courier scans yet — use “Sync tracking now” above (or wait for the daily sync) to pull the latest from the courier.'
                  : 'No courier scans yet. Add the courier API keys (see docs/TCS-SETUP.md) so the scan history (out for delivery / delivery attempted / delivered) syncs in here automatically.'}
              </p>
            ) : (
              <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 0 }}>
                {shipmentEvents.map((e, i) => {
                  const color = e.status === 'delivered' ? '#15803d'
                    : e.status === 'returned' || e.status === 'failed' ? '#dc2626'
                    : e.status === 'out_for_delivery' ? '#b45309'
                    : '#6b7280';
                  const when = new Date(e.occurred_at).toLocaleString('en-PK', { timeZone: PK_TZ, day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
                  return (
                    <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', alignSelf: 'stretch' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? color : '#d1d5db', marginTop: 4, flexShrink: 0 }} />
                        {i < shipmentEvents.length - 1 && <span style={{ width: 2, flex: 1, background: '#e5e7eb', minHeight: 14 }} />}
                      </div>
                      <div style={{ paddingBottom: 12, minWidth: 0 }}>
                        <div style={{ fontSize: '0.8125rem', color: '#111827', fontWeight: i === 0 ? 600 : 400 }}>
                          {e.description || e.status.replace(/_/g, ' ')}
                          {i === 0 && <span style={{ marginLeft: 8, fontSize: '0.625rem', fontWeight: 700, color, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Latest</span>}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: '#9ca3af', marginTop: 1 }}>{when}</div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}
      </div>
      )}

      </div>{/* end left column */}

      {/* Right rail: act on the order. */}
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Order Status Management, edit-gated */}
      {canEdit && (
      <div style={section}>
        <h2 style={{ margin: '0 0 20px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Update Order</h2>
        <OrderStatusForm
          orderId={o.id!}
          currentStatus={currentStatus}
        />
      </div>
      )}

      {/* Payment Summary */}
      <div style={section}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Payment</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span style={{ color: '#6b7280' }}>Subtotal</span>
            <span>{fmt(o.subtotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span style={{ color: '#6b7280' }}>Shipping</span>
            <span>{o.shipping === 0 ? 'Free' : fmt(o.shipping)}</span>
          </div>
          {o.discount_amount != null && o.discount_amount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
              <span style={{ color: '#15803d' }}>
                Discount{o.coupon_code ? ` (${o.coupon_code})` : ''}
              </span>
              <span style={{ color: '#15803d' }}>− {fmt(o.discount_amount)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1rem', fontWeight: 700, borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
            <span>Total</span>
            <span style={{ color: '#C5286A' }}>{fmt(o.total)}</span>
          </div>
          <div style={{ marginTop: 4, fontSize: '0.8125rem', color: '#6b7280' }}>
            Method: <strong style={{ color: '#374151' }}>{PAY_METHOD_LABELS[o.pay_method] ?? o.pay_method}</strong>
          </div>
        </div>
      </div>

      {/* Payment received, manual reconciliation: which configured account the
          money landed in, when, and who confirmed it. Feeds Finance → Revenue
          by account. Reconciliation only; doesn't change the order status. */}
      <div style={section}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Payment received</h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Record which account this order&apos;s payment landed in. Accounts come from Settings → Payments. This is for reconciliation only and doesn&apos;t change the order status.
        </p>
        {o.payment_received_at ? (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, fontSize: '0.8125rem', marginBottom: canEdit ? 14 : 0 }}>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Account</div>
                <div style={{ fontWeight: 600, color: '#111827' }}>{o.payment_account ?? '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>Received</div>
                <div style={{ fontWeight: 600, color: '#15803d' }}>{fmtDate(o.payment_received_at)}</div>
              </div>
              {o.payment_received_by && (
                <div>
                  <div style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>By</div>
                  <div style={{ color: '#374151' }}>{o.payment_received_by}</div>
                </div>
              )}
            </div>
            {(currentStatus === 'returned' || currentStatus === 'cancelled') && (
              <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.8125rem', color: '#92400e', marginBottom: canEdit ? 14 : 0 }}>
                Payment was received but the order is {currentStatus} — the customer is owed {fmt(o.total)} back.
                Once the refund is paid, set the order status to <strong>Refunded</strong> so the books close out.
              </div>
            )}
            {canEdit && (
              <form action={clearPayment.bind(null, o.id!)}>
                <button type="submit" style={{ padding: '8px 14px', background: 'white', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                  Clear / re-record
                </button>
              </form>
            )}
          </>
        ) : currentStatus === 'returned' || currentStatus === 'cancelled' ? (
          <>
            <div style={{ padding: '12px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: '0.8125rem', color: '#4b5563' }}>
              This order was {currentStatus} before any payment was recorded — there is nothing to collect.
            </div>
            {/* Edge case kept reachable: a COD parcel paid at the door, returned
                later via RMA — the courier still remits that cash, so the form
                stays available behind a fold instead of inviting mistakes. */}
            {canEdit && (
              <details style={{ marginTop: 10 }}>
                <summary style={{ cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#6b7280' }}>
                  The customer did pay (e.g. COD collected at the door, returned afterwards)? Record it
                </summary>
                <form action={recordPayment.bind(null, o.id!)} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginTop: 12 }}>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Account<br />
                    <select name="payment_account" defaultValue={o.pay_method === 'cod' ? 'Cash on delivery' : (payAccountOptions[1] ?? 'Cash on delivery')}
                      style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: 'white', minWidth: 180 }}>
                      {payAccountOptions.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </label>
                  <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Received on<br />
                    <input type="date" name="received_on" defaultValue={new Date().toISOString().slice(0, 10)}
                      style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} />
                  </label>
                  <button type="submit" style={{ padding: '9px 18px', background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Mark received</button>
                </form>
              </details>
            )}
          </>
        ) : vendorCollectsPayment && o.pay_method === 'cod' ? (
          <div style={{ padding: '12px 14px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, fontSize: '0.8125rem', color: '#92400e' }}>
            {vendorCollectsPayment} collects this COD payment at the door — it never lands in a store account.
            Your share settles on the <Link href={o.vendor_id ? `/admin/vendors/${o.vendor_id}` : '/admin/vendors'} style={{ color: '#b45309', fontWeight: 700 }}>Vendors page</Link>.
          </div>
        ) : canEdit ? (
          <form action={recordPayment.bind(null, o.id!)} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Account<br />
              <select name="payment_account" defaultValue={o.pay_method === 'cod' ? 'Cash on delivery' : (payAccountOptions[1] ?? 'Cash on delivery')}
                style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', background: 'white', minWidth: 180 }}>
                {payAccountOptions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </label>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Received on<br />
              <input type="date" name="received_on" defaultValue={new Date().toISOString().slice(0, 10)}
                style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem' }} />
            </label>
            <button type="submit" style={{ padding: '9px 18px', background: '#15803d', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Mark received</button>
          </form>
        ) : (
          <p style={{ fontSize: '0.8125rem', color: '#9ca3af' }}>Not yet recorded.</p>
        )}
      </div>

      </div>{/* end right rail */}
      </div>{/* end top zone */}

      {/* Order costs, what we paid to fulfil this order; feeds the Finance P&L. */}
      {canEdit && (
        <div style={{ ...section, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order costs</h2>
          <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Courier charge, payment-gateway fee, and the actual goods (acquisition) cost for this order. These feed the Finance profit &amp; loss. The acquisition cost overrides the estimated cost of goods for this order, useful for drop-ship, where the supplier price varies; leave it blank to use the product&apos;s default cost.
          </p>
          <form action={setOrderCosts.bind(null, o.id!)} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Acquisition cost / COGS (PKR)<br />
              <input type="number" name="acquisition_cost" min="0" step="any"
                defaultValue={ordAcq ?? ''}
                style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', width: 150 }} />
              <span style={{ display: 'block', marginTop: 4, fontSize: '0.6875rem', color: ordAcq == null ? '#b45309' : '#9ca3af', maxWidth: 220 }}>
                {acqProvenance}
              </span>
            </label>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Delivery cost (PKR)<br />
              <input type="number" name="delivery_cost" min="0" step="1" defaultValue={o.delivery_cost ?? ''}
                style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', width: 150 }} />
            </label>
            <label style={{ fontSize: '0.75rem', color: '#6b7280' }}>Payment fee (PKR)<br />
              <input type="number" name="payment_fee" min="0" step="1" defaultValue={o.payment_fee ?? ''}
                style={{ display: 'block', marginTop: 4, padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', width: 150 }} />
            </label>
            <button type="submit" style={{ padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Save costs</button>
          </form>

          {/* Shipping margin — what we charged for delivery vs what it costs us,
              so the flat PKR rate's saving (or free-shipping loss) is explicit. */}
          <div style={{ marginTop: 14, padding: '10px 14px', background: '#f9fafb', border: '1px solid #eef0f2', borderRadius: 8, fontSize: '0.8125rem' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>Shipping margin</span>
            {isReturned ? (
              // The customer paid nothing on a returned order — showing
              // "charged X − delivery Y" implied the shipping fee was
              // collected. The whole courier round trip is the loss.
              <span style={{ marginLeft: 8, color: '#6b7280' }}>
                courier billed <strong style={{ color: '#dc2626' }}>{deliveryEffective != null ? fmt(deliveryEffective) : '—'}</strong> for the failed round trip
                {shippingMarginEstimated && <span style={{ color: '#9ca3af' }}> (est.)</span>}; the customer paid nothing. Counted in Net loss below.
              </span>
            ) : isNeverDispatched ? (
              <span style={{ color: '#9ca3af', marginLeft: 8 }}>
                not applicable: this order was never dispatched, so no delivery was charged or paid.
              </span>
            ) : shippingMargin == null ? (
              <span style={{ color: '#9ca3af', marginLeft: 8 }}>
                — enter the delivery cost above (or set a typical cost in Settings → Shipping) to see it.
              </span>
            ) : (
              <span style={{ marginLeft: 8, color: '#6b7280' }}>
                charged <strong style={{ color: '#111827' }}>{shippingCharged === 0 ? 'Free' : fmt(shippingCharged)}</strong>
                {' − '}delivery <strong style={{ color: '#111827' }}>{fmt(deliveryEffective!)}</strong>
                {shippingMarginEstimated && <span style={{ color: '#9ca3af' }}> (est.)</span>}
                {' = '}
                <strong style={{ color: shippingMargin >= 0 ? '#15803d' : '#dc2626' }}>
                  {shippingMargin >= 0 ? `+${fmt(shippingMargin)}` : `(${fmt(-shippingMargin)})`}
                </strong>
                <span style={{ color: '#9ca3af' }}>{shippingMargin >= 0 ? ' kept' : ' out of pocket'}</span>
              </span>
            )}
          </div>
          {o.vendor_id && (
            <form action={recalcAcquisitionCost.bind(null, o.id!)} style={{ marginTop: 12 }}>
              <button type="submit" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', background: 'white', color: '#374151',
                border: '1px solid #d1d5db', borderRadius: 8,
                fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                  <polyline points="21 3 21 9 15 9" />
                </svg>
                Recalculate from vendor rate
              </button>
            </form>
          )}
        </div>
      )}

      {/* Order profit, gross amount less the costs recorded for this order. */}
      <div style={{ ...section, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order profit</h2>
        <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
          Based on the costs recorded for this order (vendor settlement, delivery, payment fee). Shared overheads like ads and salaries are accounted for in the Finance profit &amp; loss.
        </p>
        {!revenueCollected && (
          <p style={{ margin: '0 0 14px', padding: '8px 12px', borderRadius: 8, fontSize: '0.8125rem', background: isNeverDispatched && ordNet === 0 ? '#f9fafb' : '#fef2f2', color: isNeverDispatched && ordNet === 0 ? '#374151' : '#991b1b', border: `1px solid ${isNeverDispatched && ordNet === 0 ? '#e5e7eb' : '#fecaca'}` }}>
            {isReturned
              ? 'No revenue was collected on this returned order. The goods are back in sellable stock, so COGS is not lost; the loss is the courier round trip plus any payment fee.'
              : isNeverDispatched
                ? `This order was ${ORDER_STATUS_LABELS[o.status as OrderStatus]?.toLowerCase() ?? o.status} before dispatch: nothing was collected, the goods stayed in stock, and no courier billed us, so there is no loss on this order.`
                : `No revenue was collected on this ${ORDER_STATUS_LABELS[o.status as OrderStatus]?.toLowerCase() ?? o.status} order, so the recorded costs are a sunk loss. If the goods went back into sellable stock or the vendor credited the return, reduce the COGS/acquisition cost above accordingly.`}
          </p>
        )}
        {isNeverDispatched && ordDelivery > 0 && (
          <p style={{ margin: '0 0 14px', padding: '8px 12px', borderRadius: 8, fontSize: '0.8125rem', background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>
            A courier charge of {fmt(ordDelivery)} is recorded on this order even though it was never dispatched. If the parcel never went out, clear the Delivery cost above; it is excluded from the loss figures either way.
          </p>
        )}
        <table style={{ width: '100%', maxWidth: 360, borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <tbody>
            {profitLines.map((l, i) => (
              <tr key={i} style={{ borderTop: l.kind === 'net' ? '1px solid #e5e7eb' : 'none' }}>
                <td style={{ padding: '7px 0', color: l.kind === 'net' ? '#111827' : '#374151', fontWeight: l.kind === 'net' ? 700 : 400 }}>{l.label}</td>
                <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: l.kind === 'net' ? 700 : 400, color: l.kind === 'net' ? (ordNet >= 0 ? '#15803d' : '#dc2626') : l.value < 0 ? '#b91c1c' : '#111827' }}>
                  {l.value < 0 ? `(${fmt(-l.value)})` : fmt(l.value)}
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ padding: '7px 0', color: '#6b7280' }}>Margin</td>
              <td style={{ padding: '7px 0', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: '#6b7280' }}>{revenueCollected ? `${ordMargin.toFixed(1)}%` : '—'}</td>
            </tr>
          </tbody>
        </table>
        <p style={{ margin: '10px 0 0', fontSize: '0.6875rem', color: '#9ca3af' }}>
          COGS: {ordAcq != null ? acqProvenance : 'estimated from the vendor settlement + product cost prices.'}
        </p>
      </div>

      {/* Internal notes, freeform staff note, admin-only. Distinct from the
          order timeline (which records status-change reasons). */}
      {canEdit && (
        <div style={{ ...section, marginBottom: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Internal notes</h2>
          <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
            A private note for your team (e.g. delivery preferences, call attempts). Never shown to the customer.
          </p>
          <form action={updateOrderNotes.bind(null, o.id!)}>
            <textarea
              name="notes"
              defaultValue={o.notes ?? ''}
              rows={3}
              maxLength={4000}
              placeholder="Add a note about this order…"
              style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: '0.875rem', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
            />
            <div style={{ marginTop: 10 }}>
              <button type="submit" style={{ padding: '9px 18px', background: '#111827', color: '#fff', border: 'none', borderRadius: 8, fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>Save note</button>
            </div>
          </form>
        </div>
      )}

      {/* Order timeline, full status history from order_events */}
      <div style={{ ...section, marginBottom: 20 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Order timeline</h2>
        {events.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem' }}>
            No status history recorded yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {events.map((e, i) => (
              <div key={e.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid #f3f4f6' : 'none' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: orderStatusColor(e.to_status), marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.875rem', color: '#111827', fontWeight: 500 }}>
                    {e.from_status
                      ? `${statusLabel(e.from_status)} → ${statusLabel(e.to_status)}`
                      : `Order created, ${statusLabel(e.to_status)}`}
                  </div>
                  {e.note && <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 1 }}>{e.note}</div>}
                </div>
                {/* Prefer the operator identity the admin actions record
                    (owner / staff email) over the trigger's generic kind. */}
                {(e.actor_id || e.actor_kind) && (
                  <span style={{
                    fontSize: '0.6875rem', fontWeight: 700, color: '#9ca3af',
                    textTransform: e.actor_id?.includes('@') ? 'none' : 'uppercase',
                    alignSelf: 'flex-start', marginTop: 2,
                  }}>
                    {e.actor_id ?? e.actor_kind}
                  </span>
                )}
                <div style={{ fontSize: '0.75rem', color: '#9ca3af', whiteSpace: 'nowrap' }}>{fmtDate(e.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canEdit && (
        <div style={{ ...section, marginTop: 20 }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>Archive</h2>
          <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
            {(o as { archived_at?: string | null }).archived_at
              ? 'This order is archived: it stays in the database for history but is hidden from order lists, dashboards, finance and reminders. Unarchive to bring it back into the working views.'
              : 'Archiving keeps the order for history but removes it from order lists, dashboards, finance numbers and reminders. Use it for legacy imports, tests, or anything that is not a real trading record. Reversible any time.'}
          </p>
          <form action={(o as { archived_at?: string | null }).archived_at ? unarchiveOrder : archiveOrder}>
            <input type="hidden" name="id" value={o.id!} />
            <button
              type="submit"
              style={{
                padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db',
                background: 'white', color: '#374151', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {(o as { archived_at?: string | null }).archived_at ? 'Unarchive order' : 'Archive order'}
            </button>
          </form>
        </div>
      )}

      {canDelete && (
        <div style={{ ...section, marginTop: 20, border: '1px solid #fecaca', background: '#fef2f2' }}>
          <h2 style={{ margin: '0 0 4px', fontSize: '0.9375rem', fontWeight: 600, color: '#b91c1c' }}>Danger zone</h2>
          <p style={{ margin: '0 0 14px', fontSize: '0.8125rem', color: '#6b7280' }}>
            Permanently delete this order along with its payment, shipment and settlement records. This can&apos;t be undone.
          </p>
          <DeleteButton
            id={o.id!}
            action={deleteOrder}
            confirmMsg={`Permanently delete order ${o.order_number}? This also removes its payments, shipments and settlement records and cannot be undone.`}
            label="Delete order"
          />
        </div>
      )}
    </div>
  );
}
