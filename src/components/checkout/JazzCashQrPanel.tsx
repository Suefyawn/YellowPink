import type { QrRows } from '@/lib/payments/qr-matrix';
import { PaymentQrCode } from './PaymentQrCode';

// The scan-to-pay panel, shown on checkout, the thank-you page and order
// tracking. Presentational and hook-free, so it renders in either tree.
//
// The QR is pre-encoded by the caller (qrRows) because the encoder is a
// server-side library; this component only draws it.

function money(n: number): string {
  return `Rs ${Math.round(n).toLocaleString('en-US')}`;
}

export function JazzCashQrPanel({
  rows, merchantTitle, amount, reference, carriesAmount, notes,
}: {
  rows: QrRows;
  /** The account name the payer's app will show. */
  merchantTitle: string;
  /** Order total, when known. Null on checkout, where the order is not placed yet. */
  amount?: number | null;
  /** Order number, used as the payment reference. */
  reference?: string;
  /** True when the amount is written into the code itself. */
  carriesAmount?: boolean;
  notes?: string;
}) {
  if (!rows.length) return null;
  const label = amount != null
    ? `Scan to pay ${money(amount)}${reference ? ` for order ${reference}` : ''}`
    : 'Scan to pay with any bank or wallet app';

  return (
    <div style={{
      background: 'var(--paper2)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-card)', padding: 20, textAlign: 'left',
    }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: 4 }}>
        Scan to pay
      </div>
      <p className="small-text" style={{ marginBottom: 14 }}>
        {amount != null
          ? <>Open any bank or wallet app, scan this code and pay <strong>{money(amount)}</strong>{carriesAmount ? ', which is already filled in for you' : ''}. Then send us the receipt on WhatsApp so we can confirm and ship.</>
          : <>You can pay by scanning this code with any bank or wallet app that supports Raast. After you place the order we show you the same code with your exact total on it.</>}
      </p>

      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ padding: 10, background: '#fff', border: '1px solid var(--line)', borderRadius: 10 }}>
          <PaymentQrCode rows={rows} label={label} size={196} />
        </div>
        <div style={{ display: 'grid', gap: 6, minWidth: 180, flex: 1 }}>
          {merchantTitle && (
            <div className="small-text">
              The payment will show as <strong>{merchantTitle}</strong>. That is us.
            </div>
          )}
          {amount != null && (
            <div className="small-text">
              Amount: <strong>{money(amount)}</strong>
              {carriesAmount ? '' : ' (type this in yourself)'}
            </div>
          )}
          {reference && (
            <div className="small-text">
              Reference: <strong>{reference}</strong>
            </div>
          )}
          <div className="small-text">
            Works with JazzCash, Easypaisa, SadaPay, NayaPay and any bank app that scans Raast codes.
          </div>
        </div>
      </div>

      {notes && notes.trim() && (
        <p className="small-text" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>{notes}</p>
      )}
    </div>
  );
}
