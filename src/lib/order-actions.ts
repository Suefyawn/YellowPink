// ============================================================================
// Next-step engine for the order workflow.
//
// The order flow has follow-ups spread across days and people (confirm the
// customer, dispatch to vendor or courier, chase delivery, record the courier
// charge, record product costs, reconcile the COD payout, settle the vendor),
// and staff were keeping the sequence in their heads — steps got missed.
// This module is the single, unit-tested statement of "given where this order
// is, what is still owed" — the cron (api/cron/order-actions) evaluates it
// daily for every active order and posts one deduped admin notification (bell
// + phone push via the migration-370 fanout) per outstanding step.
//
// Design rules:
//  • Nudges fire when an order SITS, not on every transition — staff just
//    performed the transition; telling them about it is noise.
//  • Pure function: all timing/state inputs come in the snapshot, so rules
//    are trivially testable and the cron stays a thin data-fetch shell.
//  • One action per key per order, ever (dedupe key in the cron), so a
//    dismissed nudge doesn't nag forever.
// ============================================================================

export interface OrderActionSnapshot {
  id: string;
  order_number: string;
  status: string;
  pay_method: string;
  /** Hours since the order entered its CURRENT status (from order_events;
   *  falls back to updated_at in the cron). */
  hoursInStatus: number;
  /** True when a non-cancelled shipment row exists (courier booked or manual
   *  tracking entered). */
  hasShipment: boolean;
  /** orders.vendor_sent_at — staff forwarded the order to a vendor. */
  vendorDispatched: boolean;
  /** orders.delivery_cost recorded (actual courier charge). */
  hasDeliveryCost: boolean;
  /** orders.acquisition_cost recorded (COGS basis). */
  hasAcquisitionCost: boolean;
  /** orders.payment_received_at set (COD payout / transfer reconciled). */
  paymentReconciled: boolean;
  /** A vendor settlement row for this order still 'pending', and its age. */
  pendingSettlementDays: number | null;
  /** orders.confirmed_at — customer said yes (WhatsApp/call). Splits the
   *  pending-order nudge: chase the confirmation vs act on it. */
  confirmedAt: string | null;
  /** Every line item's product carries a cost basis (cost_price or
   *  vendor_cost) — Finance derives COGS from those when the order-level
   *  acquisition cost is absent, so no nudge is owed. */
  itemsHaveCostBasis: boolean;
}

export interface OrderAction {
  /** Stable key — part of the notification dedupe id. */
  key: string;
  title: string;
  body: string;
}

const day = (h: number) => Math.floor(h / 24);
const ageLabel = (h: number) => (h < 48 ? `${Math.round(h)}h` : `${day(h)} days`);

export function outstandingOrderActions(o: OrderActionSnapshot): OrderAction[] {
  const acts: OrderAction[] = [];
  const n = o.order_number;

  switch (o.status) {
    case 'pending':
      // The unconfirmed-COD window is where July's returns came from.
      if (o.hoursInStatus >= 24) {
        if (!o.confirmedAt) {
          acts.push({
            key: 'confirm',
            title: `Confirm order ${n}`,
            body: `Awaiting customer confirmation for ${ageLabel(o.hoursInStatus)}. Use "Send WhatsApp confirmation" on the order page and record the yes, or cancel it — unconfirmed parcels are where returns come from.`,
          });
        } else {
          // Confirmed but nobody moved it forward — the yes goes stale.
          acts.push({
            key: 'start_preparing',
            title: `Start preparing ${n}`,
            body: `Customer confirmed but the order has sat in Order received for ${ageLabel(o.hoursInStatus)}. Mark it Preparing and get it dispatched while the yes is fresh.`,
          });
        }
      }
      break;

    case 'processing':
      if (!o.hasShipment && !o.vendorDispatched && o.hoursInStatus >= 24) {
        acts.push({
          key: 'dispatch',
          title: `Dispatch order ${n}`,
          body: `Confirmed ${ageLabel(o.hoursInStatus)} ago but not dispatched — book the courier or send it to the vendor from the order page.`,
        });
      }
      break;

    case 'shipped':
      if (o.hoursInStatus >= 5 * 24) {
        acts.push({
          key: 'delivery_check',
          title: `Check delivery of ${n}`,
          body: `Shipped ${ageLabel(o.hoursInStatus)} ago and still not delivered. Sync tracking / chase the courier before the customer chases you.`,
        });
      }
      break;

    case 'delivered': {
      // Finance follow-ups, the most-missed steps. Give staff a day before
      // nudging; the delivery-day rush is not the moment.
      if (o.hoursInStatus >= 24 && !o.hasDeliveryCost) {
        acts.push({
          key: 'record_delivery_cost',
          title: `Record courier charge for ${n}`,
          body: `Delivered, but the actual delivery cost is not recorded — the shipping margin and P&L are estimates until it is (order page → Order costs).`,
        });
      }
      // COGS handled at EITHER level counts: an order-level acquisition cost,
      // or every line item carrying a product-level cost (cost_price /
      // vendor_cost) — Finance derives the same COGS from those, so nagging
      // for an order-page entry on top was a false positive (owner records
      // COGS on the product page for own-stock items).
      if (o.hoursInStatus >= 24 && !o.hasAcquisitionCost && !o.itemsHaveCostBasis) {
        acts.push({
          key: 'record_cogs',
          title: `Record product cost for ${n}`,
          body: `Delivered, but no acquisition cost/COGS is recorded anywhere — its profit reads as 100% margin in Finance. Set a cost price on the product page, or an acquisition cost on the order page (or pick the vendor to auto-fill).`,
        });
      }
      if (o.pay_method === 'cod' && !o.paymentReconciled && o.hoursInStatus >= 7 * 24) {
        acts.push({
          key: 'reconcile_cod',
          title: `Reconcile COD payout for ${n}`,
          body: `Delivered ${ageLabel(o.hoursInStatus)} ago and the courier's COD payout is not marked received. Check the courier statement and record it (order page → Payment).`,
        });
      }
      break;
    }

    case 'returned':
      if (!o.hasDeliveryCost) {
        acts.push({
          key: 'return_costs',
          title: `Record return costs for ${n}`,
          body: `Returned order with no courier cost recorded — the return's real loss is invisible in Finance. Record the (two-way) courier charge, and reduce COGS if the goods went back into stock.`,
        });
      }
      if (o.pendingSettlementDays != null) {
        acts.push({
          key: 'void_settlement',
          title: `Fix vendor payout for ${n}`,
          body: `This order was returned but its vendor settlement is still pending — the ledger claims money is owed on a sale that didn't happen. Settle or void it on the Vendors page.`,
        });
      }
      break;
  }

  // Vendor settlement aging applies to any live order state.
  if (o.status !== 'returned' && o.pendingSettlementDays != null && o.pendingSettlementDays >= 14) {
    acts.push({
      key: 'settle_vendor',
      title: `Settle vendor payout for ${n}`,
      body: `The vendor settlement for this order has been pending for ${o.pendingSettlementDays} days. One transfer usually clears the whole balance (Vendors → Settle all).`,
    });
  }

  return acts;
}
