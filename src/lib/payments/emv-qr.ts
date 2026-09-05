// EMVCo merchant-presented QR (MPQR), the format behind the Raast / JazzCash
// Business "Scan to Pay" code.
//
// A merchant QR is a flat list of TLV fields: a 2-digit tag, a 2-digit length,
// then that many characters of value. Some values are themselves a TLV list
// (the merchant-account templates 26-51 and the additional-data template 62).
// The last field is always 63, a CRC-16 over everything up to and including
// its own "6304" header.
//
// The shop's own code is STATIC: tag 01 reads "11" (point of initiation =
// static) and there is no tag 54, so the payer types the amount. Typing it is
// where the money goes wrong: a shopper pays 1,250 for a 12,500 order, or pays
// the right amount against the wrong order and nobody can match the receipt.
// A DYNAMIC code carries the amount (tag 54) and an order reference, flips
// tag 01 to "12", and the payer's app shows both, already filled in.
//
// We do not invent any field: the merchant identity (the account templates,
// name, city, category, currency) is copied verbatim from the code the bank
// issued. We add the amount and the reference, and recompute the CRC.

export interface EmvField {
  tag: string;
  value: string;
  /** Present when the value parsed as a well-formed nested TLV list. */
  nested?: EmvField[];
}

/** Templates whose value is itself a TLV list (EMVCo 4.7.2 / 4.7.4). */
const NESTED_TAGS = new Set([
  '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
  '39', '40', '41', '42', '43', '44', '45', '46', '47', '48', '49', '50', '51',
  '62', '64', '65', '80', '81', '82', '83', '84', '85', '86', '87', '88', '89',
]);

export const TAG_INITIATION = '01';
export const TAG_AMOUNT = '54';
export const TAG_CURRENCY = '53';
export const TAG_ADDITIONAL = '62';
export const TAG_CRC = '63';
/** Sub-tag of 62: the free-text reference the payer's receipt carries back. */
export const SUB_REFERENCE = '05';

const STATIC = '11';
const DYNAMIC = '12';

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF), the checksum EMVCo mandates. */
export function crc16(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

/** Split a payload into fields. Returns [] if it is not well-formed TLV, which
 *  is how a mistyped or truncated paste is rejected rather than half-read. */
export function parseEmv(payload: string): EmvField[] {
  const out: EmvField[] = [];
  let i = 0;
  while (i < payload.length) {
    // A field needs at least tag(2) + length(2).
    if (i + 4 > payload.length) return [];
    const tag = payload.slice(i, i + 2);
    const lenRaw = payload.slice(i + 2, i + 4);
    if (!/^\d{2}$/.test(tag) || !/^\d{2}$/.test(lenRaw)) return [];
    const len = Number(lenRaw);
    const end = i + 4 + len;
    if (end > payload.length) return [];
    const value = payload.slice(i + 4, end);
    const field: EmvField = { tag, value };
    if (NESTED_TAGS.has(tag)) {
      const nested = parseEmv(value);
      if (nested.length) field.nested = nested;
    }
    out.push(field);
    i = end;
  }
  return out;
}

function encodeField(tag: string, value: string): string {
  return tag + String(value.length).padStart(2, '0') + value;
}

/** Serialise fields back to a payload, recomputing the trailing CRC.
 *  Any 63 in the input is dropped: the checksum is always derived, never
 *  carried over, so a stale CRC can't survive an edit. */
export function serialiseEmv(fields: EmvField[]): string {
  const body = fields
    .filter(f => f.tag !== TAG_CRC)
    .map(f => encodeField(f.tag, f.nested ? serialiseNested(f.nested) : f.value))
    .join('');
  const withHeader = `${body}${TAG_CRC}04`;
  return withHeader + crc16(withHeader);
}

function serialiseNested(fields: EmvField[]): string {
  return fields.map(f => encodeField(f.tag, f.value)).join('');
}

/** True when the payload parses and its own CRC matches. The admin uses this
 *  to reject a bad paste at the point of entry rather than at checkout. */
export function isValidEmv(payload: string): boolean {
  const trimmed = payload.trim();
  const marker = trimmed.lastIndexOf(`${TAG_CRC}04`);
  if (marker < 0 || marker + 8 !== trimmed.length) return false;
  const fields = parseEmv(trimmed);
  if (!fields.length) return false;
  if (fields[fields.length - 1]?.tag !== TAG_CRC) return false;
  return crc16(trimmed.slice(0, marker + 4)) === trimmed.slice(marker + 4).toUpperCase();
}

/** The merchant name (tag 59) the payer's app will show. Shoppers see this
 *  instead of the store name, so checkout warns them with it up front. */
export function merchantName(payload: string): string {
  return parseEmv(payload).find(f => f.tag === '59')?.value.trim() ?? '';
}

/** PKR is quoted in whole rupees across the store, and EMVCo wants a plain
 *  decimal string, so a whole number stays a whole number. */
function formatAmount(rupees: number): string {
  const rounded = Math.round(rupees * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/** Build a dynamic, one-order QR payload from the merchant's static one.
 *
 *  Returns null when the source payload is not valid EMVCo or the amount is
 *  not a positive, representable number: the caller then shows the static code
 *  rather than a QR nobody's bank app can read.
 */
export function withAmount(
  staticPayload: string,
  rupees: number,
  reference?: string,
): string | null {
  if (!isValidEmv(staticPayload)) return null;
  if (!Number.isFinite(rupees) || rupees <= 0) return null;
  const amount = formatAmount(rupees);
  // EMVCo caps tag 54 at 13 characters.
  if (amount.length > 13) return null;

  const fields = parseEmv(staticPayload).filter(f => f.tag !== TAG_CRC);

  const initiation = fields.find(f => f.tag === TAG_INITIATION);
  if (initiation) initiation.value = DYNAMIC;
  else fields.unshift({ tag: TAG_INITIATION, value: DYNAMIC });

  const existingAmount = fields.find(f => f.tag === TAG_AMOUNT);
  if (existingAmount) existingAmount.value = amount;
  else {
    // The amount goes straight after the currency it is denominated in.
    // Ordering is not significant in TLV, and it cannot be derived from the
    // tag numbers either: the issuer emits 52, 58, 59, 60, 53, 62, so sorting
    // numerically would strand 54 several fields away from its currency.
    const currency = fields.findIndex(f => f.tag === TAG_CURRENCY);
    const field = { tag: TAG_AMOUNT, value: amount };
    if (currency >= 0) fields.splice(currency + 1, 0, field);
    else fields.push(field);
  }

  const ref = (reference ?? '').trim().slice(0, 25);
  if (ref) {
    let additional = fields.find(f => f.tag === TAG_ADDITIONAL);
    if (!additional) {
      additional = { tag: TAG_ADDITIONAL, value: '', nested: [] };
      const at = fields.findIndex(f => Number(f.tag) > Number(TAG_ADDITIONAL));
      if (at < 0) fields.push(additional); else fields.splice(at, 0, additional);
    }
    // Keep whatever sub-fields the bank put here (they identify the till) and
    // add or replace only the reference label.
    const nested = additional.nested ?? parseEmv(additional.value);
    const existingRef = nested.find(f => f.tag === SUB_REFERENCE);
    if (existingRef) existingRef.value = ref;
    else {
      const at = nested.findIndex(f => Number(f.tag) > Number(SUB_REFERENCE));
      const field = { tag: SUB_REFERENCE, value: ref };
      if (at < 0) nested.push(field); else nested.splice(at, 0, field);
    }
    additional.nested = nested;
  }

  return serialiseEmv(fields);
}

/** Whether a payload is a static code (payer types the amount). */
export function isStatic(payload: string): boolean {
  return parseEmv(payload).find(f => f.tag === TAG_INITIATION)?.value !== DYNAMIC;
}

export { STATIC, DYNAMIC };
