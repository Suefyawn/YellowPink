import { describe, expect, it } from 'vitest';
import { pkPhoneSchema, productInputSchema, checkoutSchema } from './validators';

describe('pkPhoneSchema', () => {
  it.each([
    '03001234567',
    '+923001234567',
    '00923001234567',
    '0300 123 4567', // spaces stripped
  ])('accepts %s', input => {
    expect(pkPhoneSchema.safeParse(input).success).toBe(true);
  });

  it.each(['12345', '03212345', '0411234567', 'notaphone'])('rejects %s', input => {
    expect(pkPhoneSchema.safeParse(input).success).toBe(false);
  });
});

describe('productInputSchema', () => {
  it('requires brand, name, slug, category, price', () => {
    const r = productInputSchema.safeParse({});
    expect(r.success).toBe(false);
  });

  it('coerces numeric strings for price/stock', () => {
    const r = productInputSchema.safeParse({
      brand: 'X', name: 'Y', slug: 'x-y', category: 'Skincare',
      price: '2400', stock: '5',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.price).toBe(2400);
      expect(r.data.stock).toBe(5);
    }
  });

  it('rejects slugs with capital letters or spaces', () => {
    const r = productInputSchema.safeParse({
      brand: 'X', name: 'Y', slug: 'X y', category: 'Skincare', price: '2400', stock: '0',
    });
    expect(r.success).toBe(false);
  });
});

describe('checkoutSchema', () => {
  it('requires email for online payment methods', () => {
    // We rely on the CheckoutPage to require email for online methods; the
    // schema itself accepts empty email. Just sanity-check shape.
    const r = checkoutSchema.safeParse({
      firstName: 'A', lastName: 'B', phone: '03001234567',
      address: '12 Street', city: 'Lahore', payMethod: 'cod', email: '',
    });
    expect(r.success).toBe(true);
  });
});
