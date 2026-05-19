export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';
import { getStaffSession } from '@/lib/staff-auth';
import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from './actions';
import { ImageUpload } from '@/components/admin/ImageUpload';

const inp: React.CSSProperties = {
  width: '100%', padding: '9px 12px', border: '1px solid #d1d5db',
  borderRadius: 8, fontSize: '0.875rem', color: '#111827',
  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
};
const lbl: React.CSSProperties = {
  display: 'block', fontSize: '0.8125rem', fontWeight: 600,
  color: '#374151', marginBottom: 5,
};
const section = (title: string, desc: string) => (
  <div style={{ marginBottom: 8 }}>
    <h2 style={{ margin: '0 0 2px', fontSize: '0.9375rem', fontWeight: 600, color: '#111827' }}>{title}</h2>
    <p style={{ margin: 0, fontSize: '0.8125rem', color: '#6b7280' }}>{desc}</p>
  </div>
);

function Toggle({ name, checked }: { name: string; checked: boolean }) {
  return (
    <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked={checked}
        style={{ width: 18, height: 18, accentColor: '#6366f1', cursor: 'pointer' }} />
      <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>Enabled</span>
    </label>
  );
}

function ColorPicker({ name, value, label }: { name: string; value: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <input type="color" name={name} defaultValue={value}
        style={{ width: 40, height: 36, border: '1px solid #d1d5db', borderRadius: 6, cursor: 'pointer', padding: 2 }} />
      <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{label}</span>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 10, boxShadow: '0 1px 3px rgba(0,0,0,0.08)', padding: '24px', marginBottom: 24 }}>
      {children}
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: '#f3f4f6', margin: '20px 0' }} />;
}

// Payment-method row: a labelled toggle with secondary description text.
// Matches the visual rhythm of the rest of the settings page; the toggle is
// the same component used for boolean flags elsewhere.
function PayMethodRow({ name, checked, label, desc }: { name: string; checked: boolean; label: string; desc: string }) {
  return (
    <label
      htmlFor={`set-${name}`}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px', borderRadius: 8,
        background: '#fafafa', border: '1px solid #f3f4f6',
        cursor: 'pointer',
      }}
    >
      <div style={{ paddingTop: 2 }}>
        <input type="hidden" name={name} value="false" />
        <input
          id={`set-${name}`}
          type="checkbox"
          name={name}
          value="true"
          defaultChecked={checked}
          style={{ width: 18, height: 18, accentColor: '#6366f1', cursor: 'pointer' }}
        />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{label}</div>
        <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
    </label>
  );
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const session = await getStaffSession();
  if (session && !session.isOwner && !session.permissions.includes('settings')) {
    redirect('/admin/dashboard');
  }

  // Next 16: `searchParams` is now a Promise. Awaiting both in parallel.
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;
  const saved = sp.saved === '1';
  const saveError = sp.error;

  return (
    <div className="adm-page" style={{ padding: '32px 36px', maxWidth: 780 }}>
      <h1 style={{ margin: '0 0 4px', fontSize: '1.5rem', fontWeight: 700, color: '#111827' }}>Site Settings</h1>
      <p style={{ margin: '0 0 32px', color: '#6b7280', fontSize: '0.875rem' }}>
        Control the store appearance, promotional banners, and seasonal campaigns.
      </p>

      {saved && (
        <div style={{
          background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8,
          padding: '12px 16px', marginBottom: 24, color: '#15803d',
          fontSize: '0.875rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span>✓</span> Settings saved — changes are live on the site.
        </div>
      )}
      {saveError && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
          padding: '12px 16px', marginBottom: 24, color: '#dc2626',
          fontSize: '0.875rem', fontWeight: 500,
        }}>
          Save failed: {saveError}
        </div>
      )}

      <form action={saveSettings}>

        {/* ── Store Info ─────────────────────────────────── */}
        <Card>
          {section('Store Info', 'Shown in email footers, structured data, and on the contact page.')}
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Store Name</label>
              <input name="store_name" defaultValue={g('store_name', 'Yellow Pink')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Currency</label>
              <input name="currency" defaultValue={g('currency', 'PKR')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Store Email</label>
              <input name="store_email" type="email" defaultValue={g('store_email')} style={inp}
                placeholder="hello@yellowpink.pk" />
            </div>
            <div>
              <label style={lbl}>Store Phone</label>
              <input name="store_phone" type="tel" defaultValue={g('store_phone')} style={inp}
                placeholder="+92 300 1234567" />
            </div>
          </div>
        </Card>

        {/* ── Shipping & Tax ─────────────────────────────── */}
        <Card>
          {section('Shipping & Tax', 'Default rates that fall back when no per-zone rule applies. Per-zone rates live in shipping_zones / shipping_rates.')}
          <Divider />
          <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Default Shipping Rate (PKR)</label>
              <input name="default_shipping_rate" type="number" min={0} defaultValue={g('default_shipping_rate', '200')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Free Shipping Threshold (PKR)</label>
              <input name="free_shipping_threshold" type="number" min={0} defaultValue={g('free_shipping_threshold', '2500')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax Rate (%)</label>
              <input name="tax_rate_percent" type="number" step="0.01" min={0} max={100} defaultValue={g('tax_rate_percent', '0')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Tax Inclusive Pricing</label>
              <Toggle name="tax_inclusive" checked={g('tax_inclusive') === 'true'} />
            </div>
          </div>
        </Card>

        {/* ── Payment Methods ─────────────────────────────── */}
        <Card>
          {section('Payment Methods', 'Which payment options the customer sees at checkout. Unticked methods disappear from the picker entirely. Default: all on.')}
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
            />
            <PayMethodRow
              name="pay_easypaisa_enabled"
              checked={g('pay_easypaisa_enabled', 'true') !== 'false'}
              label="Easypaisa"
              desc="Mobile wallet. Requires EASYPAISA_STORE_ID + EASYPAISA_HASH_KEY env vars."
            />
            <PayMethodRow
              name="pay_card_enabled"
              checked={g('pay_card_enabled', 'true') !== 'false'}
              label="Credit / Debit Card"
              desc="Visa / Mastercard via JazzCash Card. Uses the same JazzCash credentials."
            />
            <PayMethodRow
              name="pay_bank_enabled"
              checked={g('pay_bank_enabled', 'true') !== 'false'}
              label="Bank Transfer"
              desc="Manual: customer transfers to your account, you confirm + ship. Fill in your bank details below so they appear on the thank-you page."
            />
            <div style={{ marginTop: 8 }}>
              <label style={lbl}>Bank transfer instructions (shown on thank-you page)</label>
              <textarea
                name="pay_bank_instructions"
                defaultValue={g('pay_bank_instructions', '')}
                rows={3}
                style={{ ...inp, fontFamily: 'inherit', resize: 'vertical' }}
                placeholder="Account title: Yellow Pink&#10;Bank: Meezan Bank&#10;Account #: 0123456789&#10;IBAN: PK00 MEZN 0000 0123 4567 89"
              />
            </div>
          </div>
        </Card>

        {/* ── Loyalty ─────────────────────────────────────── */}
        <Card>
          {section('Loyalty Program', 'How points are earned and redeemed. Triggers in Postgres read these on every order/review/signup.')}
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Points per PKR spent</label>
              <input name="loyalty_points_per_pkr" type="number" step="0.01" min={0} defaultValue={g('loyalty_points_per_pkr', '0.1')} style={inp} />
            </div>
            <div>
              <label style={lbl}>PKR per point at redemption</label>
              <input name="loyalty_pkr_per_point" type="number" step="0.01" min={0} defaultValue={g('loyalty_pkr_per_point', '1')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Welcome points (signup)</label>
              <input name="loyalty_welcome_points" type="number" min={0} defaultValue={g('loyalty_welcome_points', '100')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Approved review points</label>
              <input name="loyalty_review_points" type="number" min={0} defaultValue={g('loyalty_review_points', '25')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Referrer reward (points)</label>
              <input name="loyalty_referral_points" type="number" min={0} defaultValue={g('loyalty_referral_points', '500')} style={inp} />
            </div>
            <div>
              <label style={lbl}>Referee discount (%)</label>
              <input name="loyalty_referral_discount_pct" type="number" min={0} max={100} defaultValue={g('loyalty_referral_discount_pct', '10')} style={inp} />
            </div>
          </div>
        </Card>

        {/* ── Brand colors ───────────────────────────────── */}
        <Card>
          {section('Brand Colors', 'Used by emails and storefront accents. CSS variables in globals.css are the source of truth for the storefront; these copies are for email + future theming.')}
          <Divider />
          <div className="adm-form-3col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Brand Pink</label>
              <ColorPicker name="brand_pink"   value={g('brand_pink',   '#E8487F')} label="Primary" />
            </div>
            <div>
              <label style={lbl}>Brand Yellow</label>
              <ColorPicker name="brand_yellow" value={g('brand_yellow', '#F7C948')} label="Accent" />
            </div>
            <div>
              <label style={lbl}>Ink</label>
              <ColorPicker name="ink_900"      value={g('ink_900',      '#111827')} label="Text" />
            </div>
          </div>
        </Card>

        {/* ── Announcement Bar ─────────────────────────────── */}
        <Card>
          {section('Announcement Bar', 'The thin bar at the very top of every page.')}
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Status</label>
              <Toggle name="announcement_active" checked={g('announcement_active') === 'true'} />
            </div>
            <div>
              <label style={lbl}>Message</label>
              <input name="announcement_text" defaultValue={g('announcement_text')} style={inp}
                placeholder="Free delivery on orders over PKR 2,500 — COD Nationwide" />
            </div>
            <div>
              <label style={lbl}>Background Color</label>
              <ColorPicker name="announcement_color" value={g('announcement_color', '#111827')} label="Bar background" />
            </div>
          </div>
        </Card>

        {/* ── Promotional Banner ───────────────────────────── */}
        <Card>
          {section('Promotional Banner', 'Full-width sale/event banner shown below the header. Use this for Eid, summer sales, launches, etc.')}
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Banner Active</label>
              <Toggle name="promo_active" checked={g('promo_active') === 'true'} />
            </div>

            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Label / Tag</label>
                <input name="promo_label" defaultValue={g('promo_label', 'Sale')} style={inp}
                  placeholder="e.g. Eid Sale · Summer Deals" />
              </div>
              <div>
                <label style={lbl}>End Date (optional)</label>
                <input name="promo_end_date" type="datetime-local" defaultValue={g('promo_end_date')} style={inp} />
              </div>
            </div>

            <div>
              <label style={lbl}>Headline</label>
              <input name="promo_headline" defaultValue={g('promo_headline')} style={inp}
                placeholder="Up to 30% off selected products" />
            </div>
            <div>
              <label style={lbl}>Sub-text</label>
              <input name="promo_subline" defaultValue={g('promo_subline')} style={inp}
                placeholder="Limited time offer — shop before it ends" />
            </div>

            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Button Text</label>
                <input name="promo_cta_text" defaultValue={g('promo_cta_text', 'Shop Sale')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Button URL</label>
                <input name="promo_cta_url" defaultValue={g('promo_cta_url', '/shop')} style={inp}
                  placeholder="/shop or /shop?tag=Sale" />
              </div>
            </div>

            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Background Color</label>
                <ColorPicker name="promo_bg_color" value={g('promo_bg_color', '#E8487F')} label="Banner background" />
              </div>
              <div>
                <label style={lbl}>Text Color</label>
                <ColorPicker name="promo_text_color" value={g('promo_text_color', '#ffffff')} label="Text & button" />
              </div>
            </div>

            {/* Live preview */}
            <div>
              <label style={lbl}>Preview</label>
              <div style={{
                padding: '16px 24px', borderRadius: 8, background: g('promo_bg_color', '#E8487F'),
                color: g('promo_text_color', '#ffffff'), textAlign: 'center',
              }}>
                <div style={{ display: 'inline-block', padding: '2px 10px', background: 'rgba(255,255,255,0.25)', borderRadius: 20, fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
                  {g('promo_label', 'Sale')}
                </div>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 4 }}>{g('promo_headline', 'Up to 30% off')}</div>
                <div style={{ fontSize: '0.875rem', opacity: 0.85, marginBottom: 12 }}>{g('promo_subline', 'Limited time offer')}</div>
                <span style={{ padding: '8px 20px', background: 'rgba(255,255,255,0.25)', borderRadius: 20, fontSize: '0.875rem', fontWeight: 600 }}>
                  {g('promo_cta_text', 'Shop Sale')} →
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Save to see live preview with your colors. The banner appears below the header when active.
              </p>
            </div>
          </div>
        </Card>

        {/* ── Hero Section ─────────────────────────────────── */}
        <Card>
          {section('Homepage Hero', 'The large split-panel banner at the top of the home page.')}
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Overline (small label above headline)</label>
              <input name="hero_overline" defaultValue={g('hero_overline')} style={inp}
                placeholder="Beauty & Wellness · Inside Out" />
            </div>
            <div>
              <label style={lbl}>Headline</label>
              <textarea name="hero_headline" defaultValue={g('hero_headline').replace(/<br\/>/g, '\n')} rows={2} style={{ ...inp, resize: 'vertical' }}
                placeholder="Beautiful skin." />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Use a new line where you want a line break. You can use <em>italic text</em> with HTML: &lt;em&gt;text&lt;/em&gt;
              </p>
            </div>
            <div>
              <label style={lbl}>Sub-text</label>
              <textarea name="hero_subline" defaultValue={g('hero_subline')} rows={3} style={{ ...inp, resize: 'vertical' }} />
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Primary Button Text</label>
                <input name="hero_cta1_text" defaultValue={g('hero_cta1_text', 'Shop Beauty')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Primary Button URL</label>
                <input name="hero_cta1_url" defaultValue={g('hero_cta1_url', '/shop')} style={inp} />
              </div>
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Secondary Button Text</label>
                <input name="hero_cta2_text" defaultValue={g('hero_cta2_text', 'Explore Wellness')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Secondary Button URL</label>
                <input name="hero_cta2_url" defaultValue={g('hero_cta2_url', '/shop?category=Wellness')} style={inp} />
              </div>
            </div>
            <div>
              <ImageUpload name="hero_image_url" currentUrl={g('hero_image_url')} label="Hero Image" aspect={4 / 3} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Recommended size: 800×700px or taller. Leave blank to use the default gradient.
              </p>
            </div>
            <div>
              <label style={lbl}>Brand Logos Row (comma-separated)</label>
              <input name="hero_brands" defaultValue={g('hero_brands', 'NARS,Kiko Milano,PIXI,CeraVe')} style={inp}
                placeholder="NARS, Kiko Milano, PIXI, CeraVe" />
            </div>
          </div>
        </Card>

        {/* ── Submit ───────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button type="submit" style={{
            padding: '11px 28px', background: '#111827', color: 'white',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.9375rem',
            cursor: 'pointer',
          }}>
            Save All Settings
          </button>
          <p style={{ margin: 0, alignSelf: 'center', fontSize: '0.8125rem', color: '#9ca3af' }}>
            Changes apply immediately to the live site.
          </p>
        </div>
      </form>
    </div>
  );
}
