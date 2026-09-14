import { describe, it, expect } from 'vitest';
import {
  makeOrderConfirmToken,
  verifyOrderConfirmToken,
  orderConfirmUrl,
} from './order-confirm-token';
import { makeUnsubscribeToken } from './unsubscribe-token';

describe('order confirm tokens', () => {
  it('round-trips a token for its own order', () => {
    const t = makeOrderConfirmToken('YP-PRG29SNJT');
    expect(verifyOrderConfirmToken('YP-PRG29SNJT', t)).toBe(true);
  });

  it('rejects a token minted for a different order', () => {
    const t = makeOrderConfirmToken('YP-PRG29SNJT');
    expect(verifyOrderConfirmToken('YP-3FRVNXFAC', t)).toBe(false);
  });

  it('is stable across calls, so a link keeps working', () => {
    expect(makeOrderConfirmToken('YP-AAA')).toBe(makeOrderConfirmToken('YP-AAA'));
  });

  it('tolerates case and surrounding whitespace', () => {
    const t = makeOrderConfirmToken('YP-PRG29SNJT');
    expect(verifyOrderConfirmToken('  yp-prg29snjt  ', t)).toBe(true);
  });

  it('rejects empty and malformed input', () => {
    expect(verifyOrderConfirmToken('', 'abc')).toBe(false);
    expect(verifyOrderConfirmToken('YP-AAA', '')).toBe(false);
    expect(verifyOrderConfirmToken('YP-AAA', 'short')).toBe(false);
    expect(verifyOrderConfirmToken('YP-AAA', 'x'.repeat(32))).toBe(false);
  });

  // The two token families share a secret and a 32-char truncation, so without
  // the "confirm:" domain separator an unsubscribe token for a string equal to
  // an order number would confirm that order.
  it('is domain-separated from unsubscribe tokens', () => {
    const order = 'YP-PRG29SNJT';
    expect(makeOrderConfirmToken(order)).not.toBe(makeUnsubscribeToken(order));
    expect(verifyOrderConfirmToken(order, makeUnsubscribeToken(order))).toBe(false);
  });

  it('builds a confirm URL carrying both order and token', () => {
    const url = orderConfirmUrl('https://www.yellowpink.pk/', 'YP-PRG29SNJT');
    expect(url).toBe(
      `https://www.yellowpink.pk/order/confirm?o=YP-PRG29SNJT&t=${makeOrderConfirmToken('YP-PRG29SNJT')}`,
    );
    // No double slash from a trailing-slash site URL.
    expect(url).not.toContain('pk//order');
  });
});
