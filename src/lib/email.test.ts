// Regression coverage for the bug fixed in the "Resend failure visibility"
// commit: the Resend SDK returns `{ data, error }` on validation errors
// rather than throwing, so the prior try/catch was a no-op. These tests pin
// the new behaviour, every Resend failure ends in a Sentry capture with the
// tags the alert rule filters on.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSend, mockCaptureMessage, mockCaptureException } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockCaptureMessage: vi.fn(),
  mockCaptureException: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({ emails: { send: mockSend } })),
}));

vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
}));

// Import AFTER vi.mock so the email module sees the mocked dependencies.
import { fromDomain, sendNewOrderEmail } from './email';

const ORDER = {
  order_number: 'YP-TEST-1',
  first_name: 'Test', last_name: 'Customer',
  phone: '03001234567', city: 'Karachi',
  total: 1000, pay_method: 'cod',
  items: [{ name: 'Widget', qty: 1, price: 1000 }],
};

describe('fromDomain', () => {
  it('parses the domain out of an RFC-5322 angled From header', () => {
    expect(fromDomain('Yellow Pink <orders@yellowpink.pk>')).toBe('yellowpink.pk');
  });

  it('parses a bare email address', () => {
    expect(fromDomain('orders@yellowpink.pk')).toBe('yellowpink.pk');
  });

  it("returns 'unknown' when no @ is present", () => {
    expect(fromDomain('not-an-email')).toBe('unknown');
  });
});

describe('email send → Sentry capture', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockCaptureMessage.mockReset();
    mockCaptureException.mockReset();
  });

  it('does NOT capture to Sentry on a successful send', async () => {
    mockSend.mockResolvedValueOnce({ data: { id: 'msg-ok' }, error: null });
    await sendNewOrderEmail(ORDER);
    expect(mockCaptureMessage).not.toHaveBeenCalled();
    expect(mockCaptureException).not.toHaveBeenCalled();
  });

  it('flags domain-unverified failures with resend_domain_unverified=true', async () => {
    // `invalid_from_address` is one of the names Resend uses for an
    // unverified sending domain.
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'invalid_from_address', message: 'The yellowpink.pk domain is not verified.', statusCode: 403 },
    });
    await sendNewOrderEmail(ORDER);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [, scope] = mockCaptureMessage.mock.calls[0];
    expect(scope.level).toBe('error');
    expect(scope.tags).toMatchObject({
      email_send_failed: 'true',
      resend_error_name: 'invalid_from_address',
      resend_domain_unverified: 'true',
      from_domain: 'yellowpink.pk',
    });
  });

  it('captures other validation errors with resend_domain_unverified=false', async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: { name: 'rate_limit_exceeded', message: 'Too many requests', statusCode: 429 },
    });
    await sendNewOrderEmail(ORDER);
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1);
    const [, scope] = mockCaptureMessage.mock.calls[0];
    expect(scope.tags).toMatchObject({
      email_send_failed: 'true',
      resend_error_name: 'rate_limit_exceeded',
      resend_domain_unverified: 'false',
    });
  });

  it('captures transport throws via captureException with the same tag set', async () => {
    const transportErr = new Error('ECONNRESET');
    mockSend.mockRejectedValueOnce(transportErr);
    await sendNewOrderEmail(ORDER);
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
    const [thrown, scope] = mockCaptureException.mock.calls[0];
    expect(thrown).toBe(transportErr);
    expect(scope.tags).toMatchObject({
      email_send_failed: 'true',
      resend_error_name: 'transport_error',
      from_domain: 'yellowpink.pk',
    });
  });
});
