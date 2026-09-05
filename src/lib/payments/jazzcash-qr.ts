import { isValidEmv, merchantName, withAmount } from './emv-qr';

// The "JazzCash QR" payment method: the shopper scans the shop's Raast code
// with any bank or wallet app and pays, then sends the receipt.
//
// This is deliberately NOT the JazzCash hosted gateway (see payments/jazzcash.ts,
// which needs merchant credentials). It settles into the same JazzCash Business
// account without an integration, which is why it can be switched on today.
//
// Settings, all in site_settings so the owner owns them and nothing merchant
// specific lives in the repo:
//   pay_jazzcash_qr_enabled   'false' to hide the method (default on)
//   pay_jazzcash_qr           the EMVCo payload decoded from the shop's QR
//   pay_jazzcash_qr_title     what the payer's app shows, if it differs from
//                             the name inside the code
//   pay_jazzcash_qr_dynamic   '1' to put the order's amount into the QR
//   pay_jazzcash_qr_notes     extra instructions under the code

export interface JazzCashQrConfig {
  /** The merchant's own static payload, exactly as the bank issued it. */
  payload: string;
  /** The name the payer's app shows. Shoppers are warned with it up front. */
  title: string;
  /** Whether to build a per-order code carrying the amount. */
  dynamic: boolean;
  notes: string;
}

export function parseJazzCashQr(
  settings: Record<string, string>,
): JazzCashQrConfig | null {
  const payload = (settings.pay_jazzcash_qr ?? '').trim();
  // A payload that fails its own checksum is a bad paste. Offering it would
  // put a QR on checkout that no app can read, so the method simply is not
  // offered until it is fixed.
  if (!payload || !isValidEmv(payload)) return null;
  return {
    payload,
    title: (settings.pay_jazzcash_qr_title ?? '').trim() || merchantName(payload),
    dynamic: settings.pay_jazzcash_qr_dynamic === '1',
    notes: (settings.pay_jazzcash_qr_notes ?? '').trim(),
  };
}

/** The payload to show for one order.
 *
 *  With the dynamic setting off (the default) every shopper sees the shop's
 *  own static code and types the amount, exactly as an in-store customer does.
 *  With it on, the amount and the order number are written into the code, so
 *  the payer's app fills both in and the receipt carries the order number back.
 *
 *  Falls back to the static code whenever the dynamic build fails, so the
 *  worst case is the shopper typing an amount, never a QR that will not scan.
 */
export function qrPayloadForOrder(
  config: JazzCashQrConfig,
  total: number | null | undefined,
  orderNumber?: string,
): { payload: string; carriesAmount: boolean } {
  if (!config.dynamic || total == null) {
    return { payload: config.payload, carriesAmount: false };
  }
  const dynamic = withAmount(config.payload, total, orderNumber);
  return dynamic
    ? { payload: dynamic, carriesAmount: true }
    : { payload: config.payload, carriesAmount: false };
}
