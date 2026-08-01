import { describe, it, expect } from 'vitest';
import { paymentState } from './OrderChips';
import type { Order } from '@/types';

// paymentState answers "am I paid?" for the orders list + dashboard chips.
// The dead-state rows are the load-bearing ones: a returned/cancelled order
// must never read as still awaiting collection, and money received on an
// order that later died must surface as a refund owed.

const order = (over: Partial<Order>): Order => ({
  pay_method: 'cod',
  status: 'pending',
  ...over,
} as unknown as Order);

describe('paymentState', () => {
  it('returned order never paid → Not collected (not "COD — on delivery")', () => {
    expect(paymentState(order({ status: 'returned' })).label).toBe('Not collected');
  });

  it('cancelled order never paid → Not collected', () => {
    expect(paymentState(order({ status: 'cancelled', pay_method: 'bank' })).label).toBe('Not collected');
  });

  it('returned order that WAS paid → Paid — refund due', () => {
    expect(paymentState(order({ status: 'returned', payment_received_at: '2026-08-01T00:00:00Z' })).label)
      .toBe('Paid — refund due');
  });

  it('cancelled prepaid order that WAS paid → Paid — refund due', () => {
    expect(paymentState(order({ status: 'cancelled', pay_method: 'easypaisa', payment_received_at: '2026-08-01T00:00:00Z' })).label)
      .toBe('Paid — refund due');
  });

  it('refunded wins over payment_received_at', () => {
    expect(paymentState(order({ status: 'refunded', payment_received_at: '2026-08-01T00:00:00Z' })).label)
      .toBe('Refunded');
  });

  it('live COD order unpaid → COD — on delivery', () => {
    expect(paymentState(order({ status: 'shipped' })).label).toBe('COD — on delivery');
  });

  it('live order reconciled → Paid', () => {
    expect(paymentState(order({ status: 'delivered', payment_received_at: '2026-08-01T00:00:00Z' })).label)
      .toBe('Paid');
  });

  it('gateway states keep their labels', () => {
    expect(paymentState(order({ status: 'payment_failed' })).label).toBe('Failed');
    expect(paymentState(order({ status: 'payment_pending', pay_method: 'jazzcash' })).label).toBe('Awaiting gateway');
  });
});
