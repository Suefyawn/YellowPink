// Coverage for the shared status-transition email helper introduced when the
// bulk-status and shipment-booking paths were taught to send the same
// shipped/delivered/cancelled emails as the single-order status action.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockShipped, mockDelivered, mockCancelled } = vi.hoisted(() => ({
  mockShipped: vi.fn(),
  mockDelivered: vi.fn(),
  mockCancelled: vi.fn(),
}));

vi.mock('@/lib/email', () => ({
  sendShippedEmail: mockShipped,
  sendDeliveredEmail: mockDelivered,
  sendCancelledEmail: mockCancelled,
}));

import { sendStatusTransitionEmail, sendStatusTransitionEmails } from './order-status-emails';

const ORDER = {
  email: 'buyer@example.com',
  first_name: 'Ayesha',
  order_number: 'YP-1001',
  tracking_number: 'TRK-42',
  courier: 'TCS',
};

describe('sendStatusTransitionEmail', () => {
  beforeEach(() => {
    mockShipped.mockReset().mockResolvedValue(undefined);
    mockDelivered.mockReset().mockResolvedValue(undefined);
    mockCancelled.mockReset().mockResolvedValue(undefined);
  });

  it('sends the shipped email with tracking details', async () => {
    await sendStatusTransitionEmail(ORDER, 'shipped');
    expect(mockShipped).toHaveBeenCalledWith({
      email: 'buyer@example.com',
      first_name: 'Ayesha',
      order_number: 'YP-1001',
      tracking_number: 'TRK-42',
      courier: 'TCS',
    });
    expect(mockDelivered).not.toHaveBeenCalled();
    expect(mockCancelled).not.toHaveBeenCalled();
  });

  it('routes delivered and cancelled to their templates', async () => {
    await sendStatusTransitionEmail(ORDER, 'delivered');
    await sendStatusTransitionEmail(ORDER, 'cancelled');
    expect(mockDelivered).toHaveBeenCalledTimes(1);
    expect(mockCancelled).toHaveBeenCalledTimes(1);
  });

  it('is a no-op for statuses without a customer email template', async () => {
    await sendStatusTransitionEmail(ORDER, 'processing');
    expect(mockShipped).not.toHaveBeenCalled();
    expect(mockDelivered).not.toHaveBeenCalled();
    expect(mockCancelled).not.toHaveBeenCalled();
  });

  it('skips orders without an email address', async () => {
    await sendStatusTransitionEmail({ ...ORDER, email: null }, 'shipped');
    expect(mockShipped).not.toHaveBeenCalled();
  });

  it('falls back to a friendly first name and never throws on send failure', async () => {
    mockShipped.mockRejectedValueOnce(new Error('provider down'));
    await expect(
      sendStatusTransitionEmail({ ...ORDER, first_name: null }, 'shipped'),
    ).resolves.toBeUndefined();
    expect(mockShipped).toHaveBeenCalledWith(expect.objectContaining({ first_name: 'there' }));
  });
});

describe('sendStatusTransitionEmails (bulk)', () => {
  beforeEach(() => {
    mockDelivered.mockReset().mockResolvedValue(undefined);
  });

  it('emails every order while never exceeding the concurrency cap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    mockDelivered.mockImplementation(async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise(r => setTimeout(r, 5));
      inFlight -= 1;
    });
    const orders = Array.from({ length: 12 }, (_, i) => ({
      email: `c${i}@example.com`,
      first_name: 'C',
      order_number: `YP-${i}`,
    }));
    await sendStatusTransitionEmails(orders, 'delivered', 5);
    expect(mockDelivered).toHaveBeenCalledTimes(12);
    expect(maxInFlight).toBeLessThanOrEqual(5);
  });

  it('handles an empty list', async () => {
    await sendStatusTransitionEmails([], 'delivered');
    expect(mockDelivered).not.toHaveBeenCalled();
  });
});
