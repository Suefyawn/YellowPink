import QRCode from 'qrcode';

// Turns a payload into the black/white module grid of its QR symbol.
//
// Server-side only: `qrcode` is a Node library, and there is no reason to ship
// an encoder to the browser when the payload is decided on the server anyway.
// Pages compute the grid and hand the rows to <PaymentQrCode>, which is pure
// markup, so nothing is added to the client bundle and no <script> or external
// image is involved (the CSP allows neither for this).

/** One string per row, '1' for a dark module. Compact enough to travel in the
 *  RSC payload: a 45x45 symbol is 45 short strings. */
export type QrRows = string[];

/** Error correction M: the level Raast/EMVCo codes are printed at, and enough
 *  redundancy for a phone camera reading a screen at an angle. */
const LEVEL = 'M' as const;

export function qrRows(text: string): QrRows | null {
  if (!text) return null;
  try {
    const qr = QRCode.create(text, { errorCorrectionLevel: LEVEL });
    const { size, data } = qr.modules;
    const rows: string[] = [];
    for (let y = 0; y < size; y++) {
      let row = '';
      for (let x = 0; x < size; x++) row += data[y * size + x] ? '1' : '0';
      rows.push(row);
    }
    return rows;
  } catch {
    // An over-long payload is the only realistic failure. The caller shows the
    // written-out payment details instead of a broken image.
    return null;
  }
}
