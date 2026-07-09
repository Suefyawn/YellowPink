import type { Metadata } from 'next';
import { CheckoutPage } from '@/sections/checkout/CheckoutPage';
import { getSiteSettings } from '@/lib/supabase';
import { parseBankAccounts } from '@/lib/bank-accounts';
import { jazzcashConfigured, easypaisaConfigured } from '@/lib/payments/configured';
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
  ].filter(Boolean) as PayMethod[];

  return (
    <main className="fade-in">
      <CheckoutPage
        enabledMethods={enabledMethods}
        bankAccounts={bankAccounts}
        bankNotes={settings.pay_bank_instructions ?? ''}
        paymentError={paymentError ?? null}
        failedOrder={failedOrder ?? null}
      />
    </main>
  );
}
