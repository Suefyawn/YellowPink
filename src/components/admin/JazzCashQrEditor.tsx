import { isValidEmv, merchantName, isStatic, withAmount } from '@/lib/payments/emv-qr';
import { qrRows } from '@/lib/payments/qr-matrix';
import { PaymentQrCode } from '@/components/checkout/PaymentQrCode';
import { inp, lbl } from '@/components/admin/settings-controls';

// Editor for the scan-to-pay code, on Settings → Payments.
//
// The owner pastes the payload their QR contains (any QR reader app shows it,
// or the JazzCash Business app's share sheet). We do not ask for an image:
// an image cannot be checked, cannot carry an order's amount, and prints badly
// at checkout. A payload can be checksum-verified the moment it is saved, and
// re-drawn at any size.

const OK = '#166534';
const BAD = '#b91c1c';
const WARN = '#92400e';

export function JazzCashQrEditor({ payload, title, dynamic, notes }: {
  payload: string;
  title: string;
  dynamic: boolean;
  notes: string;
}) {
  const trimmed = payload.trim();
  const valid = trimmed ? isValidEmv(trimmed) : false;
  const name = valid ? merchantName(trimmed) : '';
  const staticCode = valid ? isStatic(trimmed) : true;
  const rows = valid ? qrRows(trimmed) : null;
  // Prove the per-order build works on THIS payload before the owner turns it
  // on, rather than discovering it at a customer's checkout.
  const sampleDynamic = valid ? withAmount(trimmed, 2499, 'YP-SAMPLE') : null;

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div>
        <label style={lbl} htmlFor="jazz-qr-payload">QR content</label>
        <textarea
          id="jazz-qr-payload"
          name="pay_jazzcash_qr"
          defaultValue={payload}
          rows={4}
          spellCheck={false}
          style={{ ...inp, resize: 'vertical', fontFamily: 'ui-monospace, monospace', fontSize: '0.75rem' }}
          placeholder="000201010211... paste what your QR contains, not a link to an image"
        />
        <p className="small-text" style={{ marginTop: 6 }}>
          Open the JazzCash Business app, go to your QR, and share it to any QR reader to
          copy this text. It starts with 0002 and ends in four letters or digits.
        </p>
      </div>

      {trimmed !== '' && (
        <div style={{
          padding: '10px 12px', borderRadius: 8, fontSize: '0.8125rem',
          background: valid ? '#f0fdf4' : '#fef2f2',
          border: `1px solid ${valid ? '#bbf7d0' : '#fecaca'}`,
          color: valid ? OK : BAD,
        }}>
          {valid ? (
            <>
              <strong>Valid code.</strong> Customers will see the payment go to{' '}
              <strong>{name || 'the name on your account'}</strong>.{' '}
              {staticCode
                ? 'It is a fixed code with no amount on it, which is the normal shop counter code.'
                : 'This code already carries an amount, so it will ask every customer for that same amount. Paste your plain shop code instead.'}
            </>
          ) : (
            <><strong>This is not a readable payment code.</strong> Its checksum does not match, so
            it was probably copied incompletely. Nothing is shown to customers until it is fixed.</>
          )}
        </div>
      )}

      {rows && (
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ padding: 10, background: '#fff', border: '1px solid var(--line)', borderRadius: 10 }}>
            <PaymentQrCode rows={rows} label="Preview of the code customers will scan" size={148} />
          </div>
          <p className="small-text" style={{ maxWidth: 360 }}>
            This is exactly what a customer sees. Scan it with your own phone to confirm it
            opens your shop before you switch the method on.
          </p>
        </div>
      )}

      <div>
        <label style={lbl} htmlFor="jazz-qr-title">Account name shown to customers (optional)</label>
        <input
          id="jazz-qr-title"
          name="pay_jazzcash_qr_title"
          defaultValue={title}
          style={inp}
          placeholder={name || 'Taken from the code itself'}
        />
        <p className="small-text" style={{ marginTop: 6 }}>
          Checkout warns the customer which name their app will show, so an unfamiliar name does
          not look like a mistake. Leave this blank to use the name inside the code.
        </p>
      </div>

      <div>
        <label style={lbl} htmlFor="jazz-qr-notes">Additional notes (optional)</label>
        <textarea
          id="jazz-qr-notes"
          name="pay_jazzcash_qr_notes"
          defaultValue={notes}
          rows={2}
          style={{ ...inp, resize: 'vertical' }}
          placeholder="e.g. Send the payment screenshot to our WhatsApp so we can confirm your order."
        />
      </div>

      <div style={{
        padding: '12px 14px', borderRadius: 8,
        background: '#fffbeb', border: '1px solid #fde68a',
      }}>
        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
          {/* Hidden partner so unticking persists: saveSettings takes the
              last value for a repeated key. */}
          <input type="hidden" name="pay_jazzcash_qr_dynamic" value="0" />
          <input
            type="checkbox"
            name="pay_jazzcash_qr_dynamic"
            value="1"
            defaultChecked={dynamic}
            style={{ marginTop: 3 }}
          />
          <span>
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
              Put each order&apos;s amount on the code
            </span>
            <span className="small-text" style={{ display: 'block', marginTop: 4, color: WARN }}>
              The customer&apos;s app then fills in the exact total and your order number, so nobody
              can pay the wrong amount or leave you guessing which order a payment belongs to.
              <strong> Test this before you rely on it:</strong> tick it, place a cheap test order,
              and scan the code on the confirmation page with your own banking app. If your app
              shows the amount already filled in, it works. If it will not read the code, untick
              this and customers go back to typing the amount themselves.
            </span>
          </span>
        </label>
        {dynamic && sampleDynamic == null && (
          <p className="small-text" style={{ marginTop: 8, color: BAD }}>
            An amount cannot be added to the saved code, so customers will keep typing it in.
            Re-paste the code above.
          </p>
        )}
      </div>
    </div>
  );
}
