export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import {
  inp, lbl, Section, Card, Divider, Toggle,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/shipping';

export default async function SettingsShippingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Shipping & tax"
        subtitle="The default rates the storefront falls back to when no per-zone rule applies."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Defaults" desc="Per-zone rates live in the shipping_zones / shipping_rates tables. A per-zone UI is coming in a follow-up." />
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Default shipping rate (PKR)</label>
              <input name="default_shipping_rate" type="number" min={0} defaultValue={g('default_shipping_rate', '200')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Free shipping threshold (PKR)</label>
              <input name="free_shipping_threshold" type="number" min={0} defaultValue={g('free_shipping_threshold', '2500')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax rate (%)</label>
              <input name="tax_rate_percent" type="number" step="0.01" min={0} max={100} defaultValue={g('tax_rate_percent', '0')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax-inclusive pricing</label>
              <Toggle name="tax_inclusive" checked={g('tax_inclusive') === 'true'} />
            </div>
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
