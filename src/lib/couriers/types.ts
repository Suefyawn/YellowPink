// ============================================================================
// Courier adapter contract. Every API-backed courier (TCS today, Leopards /
// M&P / BlueEx later) implements this so the admin UI and shipment actions
// can talk to all of them through the same surface.
//
// `null` returns are the "best-effort failed, keep going" signal, the
// caller falls back to manual tracking-number entry. We never throw across
// this boundary so a single courier outage doesn't bring down the
// merchant's order flow.
// ============================================================================

export interface BookingInput {
  /** Internal order number (YP-XXXXXX) we'll pass as the courier's reference. */
  orderNumber: string;
  /** Buyer details, phone is mandatory for COD. */
  consignee: {
    firstName: string;
    lastName?: string;
    phone: string;             // 03xxxxxxxxx
    email?: string | null;
    address1: string;
    address2?: string | null;
    city: string;
    province?: string | null;
    zip?: string | null;
    countryCode?: string;      // default 'PK'
  };
  /** Total package weight in kilograms. Most couriers require ≥ 0.5 kg. */
  weightKg: number;
  /** Piece count for multi-box shipments. Defaults to 1. */
  pieces?: number;
  /** Amount to collect on delivery (PKR). 0 for prepaid. */
  codAmount: number;
  /** Currency, defaults to 'PKR' (which is all the live couriers do anyway). */
  currency?: string;
  /** SKU lines for the customs / weight breakdown. */
  items: Array<{
    description: string;
    quantity: number;
    weightKg: number;
    unitPrice: number;
  }>;
  /** Free-text remarks visible on the label. */
  remarks?: string;
}

export interface BookingResult {
  ok: true;
  /** What the courier issued, store as shipments.tracking_number. */
  trackingNumber: string;
  /** PDF / URL of the printable label, if the courier returned one. */
  labelUrl?: string | null;
  /** Raw response body for debugging / audit. */
  raw?: unknown;
}

export interface CancelResult {
  ok: true;
  raw?: unknown;
}

export interface TrackEvent {
  status: string;             // already normalised via normaliseCourierStatus()
  description: string;
  occurredAt: string;         // ISO timestamp
}

export interface TrackResult {
  ok: true;
  events: TrackEvent[];
  /** Latest status, convenience field; same as events[0]?.status. */
  current?: string;
  /** Set when the courier answered but has no scan data for this CN (e.g.
   *  TCS replies HTTP 200 with message:"FAIL" / "No Data Found/Invalid CN"
   *  until the first facility scan is uploaded). Callers should surface
   *  this instead of implying the shipment is up to date. */
  noData?: boolean;
  /** Courier's human-readable summary line, when provided (TCS
   *  `shipmentsummary`, e.g. "Current Status: DELIVERED ..."). */
  summary?: string;
  raw?: unknown;
}

/** A printable shipping label / AWB the courier issues for a consignment. */
export interface LabelResult {
  ok: true;
  /** URL of the label PDF (what TCS's print/label endpoint returns). */
  url: string;
  raw?: unknown;
}

/** The label as raw PDF bytes — TCS's CN Print endpoint streams the PDF
 *  directly on success (no URL envelope), so the admin needs a way to get
 *  the bytes and serve them itself. */
export interface LabelPdfResult {
  ok: true;
  contentType: string;
  /** PDF body, base64-encoded (Result<T> must stay JSON-serialisable). */
  base64: string;
}

/** One consignment's billing + COD line from the courier's payment ledger,
 *  used to reconcile the ACTUAL delivery cost + COD collection back to the
 *  order (vs. hand-keying it). All amounts PKR. */
export interface PaymentRecord {
  /** Courier consignment number (matches shipments.tracking_number). */
  trackingNumber: string;
  /** What the courier billed us to deliver this parcel (excl. GST). */
  deliveryCharges: number | null;
  /** GST on the courier charge, if broken out. */
  gst: number | null;
  /** COD amount the courier is collecting / collected for us. */
  codAmount: number | null;
  /** COD cash actually remitted to us so far. */
  amountPaid: number | null;
  /** Whether the courier has paid the COD out to us ('Y'/'N' → boolean). */
  paid: boolean;
  /** Courier's latest status string for this CN (already normalisable). */
  status: string | null;
  /** Delivery date the courier recorded, ISO if parseable. */
  deliveredAt: string | null;
}

export interface PaymentResult {
  ok: true;
  records: PaymentRecord[];
  raw?: unknown;
}

export type AdapterError = {
  ok: false;
  /** Human-readable message for the merchant. Never raw API jargon. */
  message: string;
  /** Underlying error code/status for the audit log. */
  code?: string | number;
  raw?: unknown;
};

export type Result<T> = T | AdapterError;

/**
 * Adapter capabilities. A courier that's purely "enter the tracking number
 * by hand" has every method returning AdapterError with code='not_supported'.
 */
export interface CourierAdapter {
  /** Stable id matching CourierProfile.id ('TCS', 'Leopards', etc.). */
  id: string;
  /** Whether this adapter has a live API (vs. manual-only). */
  capabilities: {
    book: boolean;
    cancel: boolean;
    track: boolean;
    /** Can fetch a printable label/AWB PDF for a consignment. */
    label: boolean;
    /** Can fetch the payment/COD ledger to reconcile actual delivery cost. */
    payment: boolean;
  };
  /** Whether the necessary env vars are set in this deployment. */
  isConfigured(): boolean;
  /** Whether the payment/ledger endpoint specifically is usable — some
   *  couriers (TCS) need an extra credential (customer number) beyond the
   *  booking config. UI uses this to show a "needs configuration" hint
   *  instead of a button that can only ever fail. */
  paymentConfigured?(): boolean;
  book(input: BookingInput): Promise<Result<BookingResult>>;
  cancel(trackingNumber: string): Promise<Result<CancelResult>>;
  track(trackingNumber: string): Promise<Result<TrackResult>>;
  /** Fetch the printable label/AWB for a booked consignment. */
  label?(trackingNumber: string): Promise<Result<LabelResult>>;
  /** Fetch the label as raw PDF bytes for couriers that stream the PDF
   *  instead of returning a URL (TCS does on most deployments). The admin
   *  label route proxies these bytes to the browser. */
  labelPdf?(trackingNumber: string): Promise<Result<LabelPdfResult>>;
  /** Fetch the courier's payment ledger for a date range so we can reconcile
   *  the real delivery cost + COD collection back to orders. Requires the
   *  merchant's customer number. */
  payment?(fromDate: string, toDate: string): Promise<Result<PaymentResult>>;
}
