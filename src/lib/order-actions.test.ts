// The next-step engine is the single statement of what each order state
// still owes; these tests pin the thresholds and the "sitting, not
// transitioning" philosophy so a future edit can't silently drop a
// follow-up from the workflow.
import { describe, it, expect } from 'vitest';
import { outstandingOrderActions, type OrderActionSnapshot } from './order-actions';

const base: OrderActionSnapshot = {
  id: 'o1',
  order_number: 'YP-TEST1',
  status: 'pending',
  pay_method: 'cod',
  hoursInStatus: 0,
  hasShipment: false,
  vendorDispatched: false,
  hasDeliveryCost: false,
  hasAcquisitionCost: false,
  paymentReconciled: false,
  pendingSettlementDays: null,
};
const keys = (s: Partial<OrderActionSnapshot>) =>
  outstandingOrderActions({ ...base, ...s }).map(a => a.key);

describe('outstandingOrderActions', () => {
  it('fresh orders in any state get no nudges — staff just acted', () => {
    expect(keys({ status: 'pending', hoursInStatus: 2 })).toEqual([]);
    expect(keys({ status: 'processing', hoursInStatus: 2 })).toEqual([]);
    expect(keys({ status: 'shipped', hoursInStatus: 48 })).toEqual([]);
  });

  it('pending 24h+ → confirm nudge', () => {
    expect(keys({ status: 'pending', hoursInStatus: 25 })).toEqual(['confirm']);
  });

  it('processing 24h+ with no dispatch → dispatch nudge; any dispatch silences it', () => {
    expect(keys({ status: 'processing', hoursInStatus: 30 })).toEqual(['dispatch']);
    expect(keys({ status: 'processing', hoursInStatus: 30, hasShipment: true })).toEqual([]);
    expect(keys({ status: 'processing', hoursInStatus: 30, vendorDispatched: true })).toEqual([]);
  });

  it('shipped 5 days+ undelivered → delivery check', () => {
    expect(keys({ status: 'shipped', hoursInStatus: 5 * 24 + 1 })).toEqual(['delivery_check']);
  });

  it('delivered: missing finance data nudges after a day, COD reconcile after a week', () => {
    expect(keys({ status: 'delivered', hoursInStatus: 30 })).toEqual([
      'record_delivery_cost',
      'record_cogs',
    ]);
    expect(keys({ status: 'delivered', hoursInStatus: 8 * 24 })).toEqual([
      'record_delivery_cost',
      'record_cogs',
      'reconcile_cod',
    ]);
    // Fully recorded delivered order owes nothing.
    expect(keys({
      status: 'delivered', hoursInStatus: 8 * 24,
      hasDeliveryCost: true, hasAcquisitionCost: true, paymentReconciled: true,
    })).toEqual([]);
    // Prepaid orders never get the COD reconcile nudge.
    expect(keys({
      status: 'delivered', hoursInStatus: 8 * 24, pay_method: 'jazzcash',
      hasDeliveryCost: true, hasAcquisitionCost: true,
    })).toEqual([]);
  });

  it('returned: return costs + pending settlement are flagged immediately', () => {
    expect(keys({ status: 'returned', hoursInStatus: 1 })).toEqual(['return_costs']);
    expect(keys({ status: 'returned', hoursInStatus: 1, pendingSettlementDays: 3 })).toEqual([
      'return_costs',
      'void_settlement',
    ]);
  });

  it('settlement aging nudges at 14 days on live orders, not before', () => {
    expect(keys({ status: 'delivered', hoursInStatus: 30, hasDeliveryCost: true, hasAcquisitionCost: true, pendingSettlementDays: 13 })).toEqual([]);
    expect(keys({ status: 'delivered', hoursInStatus: 30, hasDeliveryCost: true, hasAcquisitionCost: true, pendingSettlementDays: 14 })).toEqual(['settle_vendor']);
  });
});
