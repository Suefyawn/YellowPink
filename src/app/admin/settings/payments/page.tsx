export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { BankAccountsEditor } from '@/components/admin/BankAccountsEditor';
import { parseBankAccounts } from '@/lib/bank-accounts';
import { jazzcashConfigured, easypaisaConfigured } from '@/lib/payments/configured';
import { parseJazzCashQr } from '@/lib/payments/jazzcash-qr';
import { JazzCashQrEditor } from '@/components/admin/JazzCashQrEditor';
import {
  inp, lbl, Section, Card, Divider, PayMethodRow,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/payments';

export default async function SettingsPaymentsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;
  // Null until a code that passes its own checksum is saved, which is also
  // what gates the method at checkout.
  const jazzQr = parseJazzCashQr(s);

  return (
    <>
      <SettingsPageHeader
        title="Payments"
        subtitle="Which payment options the customer sees at checkout, and which bank/wallet accounts they pay to for manual transfers."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Payment methods" desc="Unticked methods disappear from the checkout picker entirely. Default: all on." />
          <Divider />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <PayMethodRow
              name="pay_cod_enabled"
              checked={g('pay_cod_enabled', 'true') !== 'false'}
              label="Cash on Delivery (COD)"
              desc="Customer pays the courier when the order arrives. No payment gateway needed."
            />
            <PayMethodRow
              name="pay_jazzcash_enabled"
              checked={g('pay_jazzcash_enabled', 'true') !== 'false'}
              label="JazzCash"
              desc="Mobile wallet. Requires JAZZCASH_MERCHANT_ID + JAZZCASH_PASSWORD + JAZZCASH_INTEGRITY_SALT env vars."
              configured={jazzcashConfigured()}
            />
            <PayMethodRow
              name="pay_easypaisa_enabled"
              checked={g('pay_easypaisa_enabled', 'true') !== 'false'}
              label="Easypaisa"
              desc="Mobile wallet. Requires EASYPAISA_STORE_ID + EASYPAISA_HASH_KEY env vars."
              configured={easypaisaConfigured()}
            />
            <PayMethodRow
              name="pay_card_enabled"
              checked={g('pay_card_enabled', 'true') !== 'false'}
              label="Credit / Debit card"
              desc="Visa / Mastercard via JazzCash Card. Uses the same JazzCash credentials."
              configured={jazzcashConfigured()}
            />
            <PayMethodRow
              name="pay_bank_enabled"
              checked={g('pay_bank_enabled', 'true') !== 'false'}
              label="Bank transfer"
              desc="Manual: the customer transfers to one of your accounts, then you confirm and ship. Add your accounts below, they show at checkout and on the order confirmation page."
            />
            <PayMethodRow
              name="pay_jazzcash_qr_enabled"
              checked={g('pay_jazzcash_qr_enabled', 'true') !== 'false'}
              label="JazzCash / Raast QR"
              desc="Manual: the customer scans your shop code from any bank or wallet app, then you confirm and ship. No gateway account needed. Paste your code below."
              configured={jazzQr != null}
            />
          </div>
        </Card>

        <Card>
          <Section title="Bank & wallet accounts" desc="Shown to customers who choose Bank Transfer. Add as many as you like." />
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <BankAccountsEditor name="pay_bank_accounts" initial={parseBankAccounts(g('pay_bank_accounts'))} />
            <div>
              <label style={lbl}>Additional notes (optional)</label>
              <textarea
                name="pay_bank_instructions"
                defaultValue={g('pay_bank_instructions', '')}
                rows={2}
                style={{ ...inp, resize: 'vertical' }}
                placeholder="e.g. Send your transfer receipt to our WhatsApp to confirm the order."
              />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Scan to pay (JazzCash / Raast QR)"
            desc="Your shop's own payment code, shown at checkout and on the order confirmation page. The customer scans it with any bank or wallet app, so it works for people who do not have JazzCash."
          />
          <Divider />
          <JazzCashQrEditor
            payload={g('pay_jazzcash_qr', '')}
            title={g('pay_jazzcash_qr_title', '')}
            dynamic={g('pay_jazzcash_qr_dynamic') === '1'}
            notes={g('pay_jazzcash_qr_notes', '')}
          />
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
