export const dynamic = 'force-dynamic';

import { getSiteSettings, supabaseAdmin } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { createZone, updateZone, deleteZone } from './actions';
import { ZoneRateCost } from './ZoneRateCost';
import { DeleteButton } from '@/components/admin/DeleteButton';
import {
  inp, lbl, Section, Card, Divider, Toggle,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/shipping';

interface Zone {
  id: string;
  name: string;
  sort_order: number;
  active: boolean;
}

interface Rate {
  id: string;
  zone_id: string;
  rate: number;
  cost: number | null;
  free_shipping_threshold: number | null;
  label: string;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
}

// The 7 provinces the checkout dropdown emits — used for the per-zone
// assignment checkboxes.
const PROVINCES = ['Punjab', 'Sindh', 'KPK', 'Balochistan', 'Islamabad', 'AJK', 'Gilgit-Baltistan'];

async function loadZones(): Promise<{ zone: Zone; rate: Rate | null; provinces: string[] }[]> {
  const sb = supabaseAdmin();
  const [zonesRes, ratesRes, pzRes] = await Promise.all([
    sb.from('shipping_zones').select('*').order('sort_order', { ascending: true }),
    sb.from('shipping_rates').select('*'),
    sb.from('province_zones').select('province, zone_id'),
  ]);
  const zones = (zonesRes.data ?? []) as Zone[];
  const rates = (ratesRes.data ?? []) as Rate[];
  const pz = (pzRes.data ?? []) as { province: string; zone_id: string }[];
  return zones.map(z => ({
    zone: z,
    rate: rates.find(r => r.zone_id === z.id) ?? null,
    provinces: pz.filter(p => p.zone_id === z.id).map(p => p.province),
  }));
}

function ZoneFields({ zone, rate, provinces = [] }: { zone?: Zone; rate?: Rate | null; provinces?: string[] }) {
  return (
    <>
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Zone name</label>
          <input name="name" defaultValue={zone?.name ?? ''} required style={inp} placeholder="e.g. Karachi" />
        </div>
        <div>
          <label style={lbl}>Sort order</label>
          <input name="sort_order" type="number" defaultValue={zone?.sort_order ?? 0} style={inp} />
        </div>
      </div>
      {/* Rate + cost with a live margin/loss guard. */}
      <ZoneRateCost defaultRate={rate?.rate ?? 250} defaultCost={rate?.cost ?? null} />
      <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={lbl}>Free shipping at (PKR, blank for never)</label>
          <input name="free_shipping_threshold" type="number" min={0} defaultValue={rate?.free_shipping_threshold ?? ''} style={inp} placeholder="e.g. 5000" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Est. min days</label>
            <input name="estimated_days_min" type="number" min={0} defaultValue={rate?.estimated_days_min ?? ''} style={inp} />
          </div>
          <div>
            <label style={lbl}>Est. max days</label>
            <input name="estimated_days_max" type="number" min={0} defaultValue={rate?.estimated_days_max ?? ''} style={inp} />
          </div>
        </div>
      </div>
      {/* Province assignment — which destinations use this zone's rate. A
          province can belong to only one zone; ticking it here moves it here. */}
      <div>
        <label style={lbl}>Provinces in this zone</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {PROVINCES.map(p => (
            <label key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.875rem', color: '#374151' }}>
              <input type="checkbox" name="provinces" value={p} defaultChecked={provinces.includes(p)} />
              {p}
            </label>
          ))}
        </div>
        <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
          Unticked provinces fall back to the default rate above. Each province can be in only one zone.
        </p>
      </div>
      <div>
        <label style={lbl}>Active</label>
        <Toggle name="active" checked={zone?.active ?? true} />
      </div>
    </>
  );
}

export default async function SettingsShippingPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp, zones] = await Promise.all([getSiteSettings(), searchParams, loadZones()]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Shipping & tax"
        subtitle="Default rates that apply when no zone matches, plus the per-zone overrides used by checkout."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      {/* ── Defaults ───────────────────────────────────────── */}
      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />
        <Card>
          <Section title="Default fallback" desc="Used when checkout can't match the customer's address to a zone below." />
          <Divider />
          <div style={{ marginBottom: 14 }}>
            <label style={lbl}>Offer free shipping</label>
            <Toggle name="free_shipping_enabled" checked={g('free_shipping_enabled', 'true') !== 'false'} />
            <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
              When off, no order qualifies for free shipping anywhere on the site, the cart progress bar and &ldquo;free over&rdquo; copy disappear, and the flat rate (or zone rate) always applies.
            </p>
          </div>
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Default shipping rate (PKR)</label>
              <input name="default_shipping_rate" type="number" min={0} defaultValue={g('default_shipping_rate', '200')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Free shipping threshold (PKR)</label>
              <input name="free_shipping_threshold" type="number" min={0} defaultValue={g('free_shipping_threshold', '5000')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Typical delivery cost per order (PKR)</label>
              <input name="default_delivery_cost" type="number" min={0} defaultValue={g('default_delivery_cost', '')} style={inp} placeholder="what the courier bills you, e.g. 180" />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                Internal only — never shown to customers. Used to estimate your <strong>shipping margin</strong> (what you charge minus what delivery costs) on orders where the exact courier charge hasn&apos;t been entered. Leave blank to show the margin only from recorded actuals.
              </p>
            </div>
            {/* The tax rate/inclusive settings that used to sit here were
                dead controls: nothing in checkout, order costs, or P&L ever
                read them (Pakistan retail prices are quoted tax-inclusive).
                Removed rather than left as toggles that silently do nothing;
                restore alongside a real tax computation if it's ever needed. */}
          </div>
        </Card>
        <SaveBar />
      </form>

      {/* ── Zones ──────────────────────────────────────────── */}
      <div style={{ marginTop: 40 }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
          Shipping zones
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: '0.875rem', color: '#6b7280' }}>
          One named region per zone with its own rate. Checkout picks the first matching zone based on the customer&apos;s province.
        </p>
      </div>

      {/* Existing zones */}
      {zones.length === 0 ? (
        <div style={{
          background: 'white', borderRadius: 12, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
          padding: '32px 24px', textAlign: 'center', color: '#9ca3af', fontSize: '0.875rem', marginBottom: 24,
        }}>
          No zones yet, checkout falls back to the default above. Add one to start charging per region.
        </div>
      ) : (
        zones.map(({ zone, rate, provinces }) => (
          <div key={zone.id} style={{
            background: 'white', borderRadius: 12, border: '1px solid #eef0f2', boxShadow: '0 1px 2px rgba(16,24,40,0.04)',
            padding: 24, marginBottom: 12,
            opacity: zone.active ? 1 : 0.6,
          }}>
            <form action={updateZone.bind(null, zone.id)} style={{ display: 'grid', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{zone.name}</div>
                {!zone.active && (
                  <span style={{ padding: '2px 10px', borderRadius: 20, background: '#f3f4f6', color: '#6b7280', fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Inactive
                  </span>
                )}
              </div>
              <ZoneFields zone={zone} rate={rate} provinces={provinces} />
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                <button type="submit" style={{
                  padding: '8px 18px', background: '#C5286A', color: 'white',
                  border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer',
                }}>
                  Save zone
                </button>
                <DeleteButton id={zone.id} action={deleteZone} confirmMsg={`Delete the "${zone.name}" zone? Its rate is removed too.`} />
              </div>
            </form>
          </div>
        ))
      )}

      {/* Add zone */}
      <details
        style={{ background: 'white', borderRadius: 12, border: '1px solid #eef0f2', padding: '12px 20px', boxShadow: '0 1px 2px rgba(16,24,40,0.04)', marginBottom: 24 }}
        open={zones.length === 0}
      >
        <summary style={{ cursor: 'pointer', fontSize: '0.9375rem', fontWeight: 600, color: '#111827', padding: '8px 0' }}>
          + Add a zone
        </summary>
        <form action={createZone} style={{ display: 'grid', gap: 14, marginTop: 16 }}>
          <ZoneFields />
          <div>
            <button type="submit" style={{
              padding: '10px 22px', background: '#C5286A', color: 'white',
              border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer',
            }}>
              Create zone
            </button>
          </div>
        </form>
      </details>

      <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
        Province-to-zone mapping is currently seeded to &ldquo;Pakistan, Nationwide&rdquo; for every province. Per-province mapping UI lands in a follow-up.
      </p>
    </>
  );
}
