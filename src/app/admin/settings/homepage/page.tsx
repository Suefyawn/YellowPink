export const dynamic = 'force-dynamic';

import { getSiteSettings } from '@/lib/supabase';
import { saveSettings } from '../actions';
import { ImageUpload } from '@/components/admin/ImageUpload';
import {
  inp, lbl, Section, Card, Divider, Toggle, ColorPicker,
  SaveBar, StatusBanner, SettingsPageHeader,
} from '@/components/admin/settings-controls';

const PATH = '/admin/settings/homepage';

export default async function SettingsHomepagePage({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const [s, sp] = await Promise.all([getSiteSettings(), searchParams]);
  const g = (key: string, fallback = '') => s[key] ?? fallback;

  return (
    <>
      <SettingsPageHeader
        title="Homepage"
        subtitle="The big hero, the store-wide Sale switch, and the thin announcement bar at the top of every page."
      />
      <StatusBanner saved={sp.saved === '1'} saveError={sp.error} />

      <form action={saveSettings}>
        <input type="hidden" name="_redirect" value={PATH} />

        <Card>
          <Section title="Homepage hero" desc="The large split-panel banner at the top of the home page." />
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
                <label style={lbl}>Primary button text</label>
                <input name="hero_cta1_text" defaultValue={g('hero_cta1_text', 'Shop Beauty')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Primary button URL</label>
                <input name="hero_cta1_url" defaultValue={g('hero_cta1_url', '/shop')} style={inp} />
              </div>
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Secondary button text</label>
                <input name="hero_cta2_text" defaultValue={g('hero_cta2_text', 'Explore Wellness')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Secondary button URL</label>
                <input name="hero_cta2_url" defaultValue={g('hero_cta2_url', '/shop?taxon=wellness')} style={inp} />
              </div>
            </div>
            <div>
              <ImageUpload name="hero_image_url" currentUrl={g('hero_image_url')} label="Hero image" aspect={4 / 3} />
              <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                Recommended size: 800×700px or taller. Leave blank to use the default gradient.
              </p>
            </div>
            <div>
              <label style={lbl}>Brand logos row (comma-separated)</label>
              <input name="hero_brands" defaultValue={g('hero_brands', 'NARS,Kiko Milano,PIXI,CeraVe')} style={inp}
                placeholder="NARS, Kiko Milano, PIXI, CeraVe" />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Sale"
            desc="The central on/off switch for a store-wide sale. When active, the homepage shows a featured Sale Collection of every discounted product. Put a product on sale by setting its Original Price above its Price (or use the bulk price tool on the Products page)."
          />
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Sale active</label>
              <Toggle name="sale_active" checked={g('sale_active') === 'true'} />
            </div>
            <div>
              <label style={lbl}>Sale title</label>
              <input name="sale_title" defaultValue={g('sale_title', 'On Sale Now')} style={inp}
                placeholder="e.g. Summer Sale" />
            </div>
            <div>
              <label style={lbl}>Subtitle</label>
              <input name="sale_subtitle" defaultValue={g('sale_subtitle')} style={inp}
                placeholder="e.g. Limited-time prices across beauty & wellness" />
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Button text</label>
                <input name="sale_cta_text" defaultValue={g('sale_cta_text', 'Shop the Sale')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Button URL</label>
                <input name="sale_cta_url" defaultValue={g('sale_cta_url', '/shop?sale=1')} style={inp}
                  placeholder="/shop?sale=1" />
              </div>
            </div>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af' }}>
              The homepage Sale Collection appears only while this is active and at least one product is discounted.
            </p>
          </div>
        </Card>

        <Card>
          <Section title="Announcement bar" desc="The thin bar at the very top of every page." />
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Status</label>
              <Toggle name="announcement_active" checked={g('announcement_active') === 'true'} />
            </div>
            <div>
              <label style={lbl}>Message</label>
              <input name="announcement_text" defaultValue={g('announcement_text')} style={inp}
                placeholder="Free delivery on orders over PKR 5,000, COD Nationwide" />
            </div>
            <div>
              <label style={lbl}>Background colour</label>
              <ColorPicker name="announcement_color" value={g('announcement_color', '#111827')} label="Bar background" />
            </div>
          </div>
        </Card>

        <Card>
          <Section
            title="Promo strip"
            desc="A richer banner under the announcement bar: label, headline, button, and an optional countdown. Good for a sale or launch week — switch it off when the moment passes."
          />
          <Divider />
          <div style={{ display: 'grid', gap: 14 }}>
            <div>
              <label style={lbl}>Status</label>
              <Toggle name="promo_active" checked={g('promo_active') === 'true'} />
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Label (small badge)</label>
                <input name="promo_label" defaultValue={g('promo_label', 'Sale')} style={inp} placeholder="Sale" />
              </div>
              <div>
                <label style={lbl}>Headline</label>
                <input name="promo_headline" defaultValue={g('promo_headline')} style={inp} placeholder="Up to 30% off summer picks" />
              </div>
            </div>
            <div>
              <label style={lbl}>Sub-text</label>
              <input name="promo_subline" defaultValue={g('promo_subline')} style={inp} placeholder="Ends Sunday · COD nationwide" />
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Button text</label>
                <input name="promo_cta_text" defaultValue={g('promo_cta_text', 'Shop Sale')} style={inp} />
              </div>
              <div>
                <label style={lbl}>Button URL</label>
                <input name="promo_cta_url" defaultValue={g('promo_cta_url', '/shop?sale=1')} style={inp} />
              </div>
            </div>
            <div className="adm-form-2col" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={lbl}>Background colour</label>
                <ColorPicker name="promo_bg_color" value={g('promo_bg_color', '#E8487F')} label="Strip background" />
              </div>
              <div>
                <label style={lbl}>Text colour</label>
                <ColorPicker name="promo_text_color" value={g('promo_text_color', '#ffffff')} label="Strip text" />
              </div>
            </div>
            <div>
              <label style={lbl}>Countdown end date (optional)</label>
              <input name="promo_end_date" type="datetime-local" defaultValue={g('promo_end_date')} style={inp} />
              <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#9ca3af' }}>
                When set, the strip shows a live countdown to this moment. Leave blank for no countdown.
              </p>
            </div>
          </div>
        </Card>

        <SaveBar />
      </form>
    </>
  );
}
