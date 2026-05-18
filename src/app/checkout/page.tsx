import { CheckoutPage } from '@/sections/checkout/CheckoutPage';
import { getSiteSettings } from '@/lib/supabase';
import type { PayMethod } from '@/types';

export default async function CheckoutRoute() {
  // Read which payment methods the merchant has toggled on in admin settings.
  // Default: all on (matching the historical hard-coded behaviour) — so a
  // fresh install or a row that isn't in site_settings yet still works.
  const settings = await getSiteSettings();
  const isEnabled = (key: string) => settings[key] !== 'false';
  const enabledMethods: PayMethod[] = [
    isEnabled('pay_cod_enabled')       && 'cod',
    isEnabled('pay_jazzcash_enabled')  && 'jazzcash',
    isEnabled('pay_easypaisa_enabled') && 'easypaisa',
    isEnabled('pay_card_enabled')      && 'card',
    isEnabled('pay_bank_enabled')      && 'bank',
  ].filter(Boolean) as PayMethod[];

  return (
    <main className="fade-in">
      <CheckoutPage enabledMethods={enabledMethods} bankInstructions={settings.pay_bank_instructions ?? ''} />
    </main>
  );
}
