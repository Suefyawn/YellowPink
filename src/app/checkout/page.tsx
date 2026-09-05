import type { Metadata } from 'next';
import { CheckoutPage } from '@/sections/checkout/CheckoutPage';
import { getSiteSettings } from '@/lib/supabase';
import { parseBankAccounts } from '@/lib/bank-accounts';
import { activeSeasonalTheme } from '@/lib/seasonal-theme';
import { jazzcashConfigured, easypaisaConfigured } from '@/lib/payments/configured';
import { parseJazzCashQr } from '@/lib/payments/jazzcash-qr';
import { qrRows } from '@/lib/payments/qr-matrix';
import type { PayMethod } from '@/types';

// Cart→checkout pages must not be indexed (audit SEV-2). Also override the
// page title, without this it inherits the homepage default.
export const metadata: Metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
};

export default async function CheckoutRoute({ searchParams }: { searchParams: Promise<{ error?: string; order?: string }> }) {
  // Gateway callbacks bounce failed/unverifiable payments back here as
  // /checkout?error=<code>&order=<number>. The cart was cleared before the
  // gateway hop, so without these props the shopper lands on "Your bag is
  // empty" with no explanation and no way to retry (audit H1).
  const { error: paymentError, order: failedOrder } = await searchParams;
  // Read which payment methods the merchant has toggled on in admin settings.
  // Default: all on (matching the historical hard-coded behaviour), so a
  // fresh install or a row that isn't in site_settings yet still works.
  const settings = await getSiteSettings();
  const isEnabled = (key: string) => settings[key] !== 'false';
  const bankAccounts = parseBankAccounts(settings.pay_bank_accounts);
  // Scan-to-pay. parseJazzCashQr returns null when the stored payload fails
  // its own checksum, so a bad paste hides the method instead of putting an
  // unscannable code in front of a shopper.
  const jazzQr = parseJazzCashQr(settings);
  // Checkout shows the shop's plain code: the order does not exist yet, so
  // there is no total to write into it. The thank-you page shows the one
  // carrying the amount.
  const jazzQrRows = jazzQr ? qrRows(jazzQr.payload) : null;
  // Gateway methods are only offered when their credentials exist — an
  // enabled-but-unconfigured method dead-ends the customer (order created in
  // payment_pending, then the payment route 500s on the missing env var).
  // Same rule as Bank Transfer's account check below. Card runs via JazzCash.
  const enabledMethods: PayMethod[] = [
    isEnabled('pay_cod_enabled')       && 'cod',
    (isEnabled('pay_jazzcash_enabled') && jazzcashConfigured()) && 'jazzcash',
    (isEnabled('pay_easypaisa_enabled') && easypaisaConfigured()) && 'easypaisa',
    (isEnabled('pay_card_enabled') && jazzcashConfigured()) && 'card',
    // Bank Transfer is only offered once at least one account is configured,     // otherwise the customer reaches a dead end with nowhere to pay.
    (isEnabled('pay_bank_enabled') && bankAccounts.length > 0) && 'bank',
    // Same rule as Bank Transfer: only offered once there is something to pay to.
    (isEnabled('pay_jazzcash_qr_enabled') && jazzQr != null && jazzQrRows != null) && 'jazzcash_qr',
  ].filter(Boolean) as PayMethod[];

  // Active seasonal-sale coupon (e.g. AZADI14 while the Azadi window is
  // open). Checkout OFFERS it as a tap-to-apply chip — never auto-applied
  // (owner decision, 4 Aug): the shopper chooses.
  const seasonalCoupon = activeSeasonalTheme(settings)?.coupon ?? null;

  return (
    <main className="fade-in">
      <CheckoutPage
        enabledMethods={enabledMethods}
        bankAccounts={bankAccounts}
        bankNotes={settings.pay_bank_instructions ?? ''}
        jazzQrRows={jazzQrRows}
        jazzQrTitle={jazzQr?.title ?? ''}
        jazzQrNotes={jazzQr?.notes ?? ''}
        paymentError={paymentError ?? null}
        failedOrder={failedOrder ?? null}
        seasonalCoupon={seasonalCoupon}
      />
    </main>
  );
}
